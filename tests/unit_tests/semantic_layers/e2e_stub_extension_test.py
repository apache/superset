# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""The Playwright semantic stub loads as an extension and serves host queries."""

import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import PropertyMock
from uuid import uuid4

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC
from werkzeug.test import TestResponse

from superset.app import SupersetApp
from superset.initialization import SupersetAppInitializer
from superset.semantic_layers.models import (
    SemanticLayer as SemanticLayerModel,
    SemanticView,
)
from superset.semantic_layers.registry import registry

STUB_PATH: Path = (
    Path(__file__).resolve().parents[2] / "e2e_extensions" / "semantic_stub"
)
STUB_TYPE: str = "extensions.superset-e2e.semantic-stub.stub"


@pytest.fixture
def stub_layer(app: SupersetApp, mocker: MockerFixture) -> Iterator[type[Any]]:
    """Load the bundle through the same path ``LOCAL_EXTENSIONS`` uses at startup."""
    mocker.patch.dict(app.config, {"LOCAL_EXTENSIONS": [str(STUB_PATH)]})
    # Startup imports the entrypoint once per process; undo the import and its
    # in-memory finder so each test re-runs the real registration.
    mocker.patch.dict(sys.modules)
    mocker.patch.object(sys, "meta_path", list(sys.meta_path))
    try:
        with app.app_context():
            SupersetAppInitializer(app).init_extensions()
        yield registry[STUB_TYPE]
    finally:
        registry.pop(STUB_TYPE, None)


@pytest.fixture
def stub_view(
    stub_layer: type[SemanticLayer[Any, Any]], mocker: MockerFixture
) -> SemanticViewABC:
    """Serve chart-data requests for a semantic view backed by the stub."""
    view: SemanticViewABC = stub_layer.from_configuration({}).get_semantic_view(
        "orders", {}
    )
    model: SemanticView = SemanticView(
        id=91,
        name="orders",
        cache_timeout=-1,
        semantic_layer=SemanticLayerModel(type=STUB_TYPE),
    )
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=view
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=model
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    return view


def _chart_data(client: FlaskClient, filters: list[dict[str, Any]]) -> TestResponse:
    return client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 91, "type": "semantic_view"},
            "queries": [
                {
                    "columns": ["category"],
                    "metrics": ["total_amount"],
                    "filters": filters,
                    "orderby": [["category", True]],
                }
            ],
            "result_type": "full",
            "result_format": "json",
        },
    )


def test_stub_registers_through_the_extension_loader(
    stub_layer: type[SemanticLayer[Any, Any]],
) -> None:
    """The stub carries the extension-prefixed type that seeding code uses."""
    assert stub_layer.name == "E2E Semantic Stub"
    assert {
        view.name for view in stub_layer.from_configuration({}).get_semantic_views({})
    } == {"orders"}


def test_stub_rejects_configuration_and_unknown_views(
    stub_layer: type[SemanticLayer[Any, Any]],
) -> None:
    """Typos in seeding fail at creation instead of producing an empty view."""
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        stub_layer.from_configuration({"account": "unexpected"})
    with pytest.raises(ValueError, match="no semantic view"):
        stub_layer.from_configuration({}).get_semantic_view("missing", {})


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_stub_runtime_schema_through_host_api(
    client: FlaskClient,
    full_api_access: None,
    stub_layer: type[SemanticLayer[Any, Any]],
    mocker: MockerFixture,
) -> None:
    """The host can obtain runtime schema from a stored stub configuration."""
    layer: SemanticLayerModel = SemanticLayerModel(
        uuid=uuid4(), type=STUB_TYPE, configuration="{}"
    )
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    mocker.patch.object(SemanticLayerModel, "raise_for_access")

    response: TestResponse = client.post(
        f"/api/v1/semantic_layer/{layer.uuid}/schema/runtime", json={}
    )

    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"] == {"type": "object", "properties": {}}


def test_chart_data_through_host_mapper(
    client: FlaskClient, full_api_access: None, stub_view: SemanticViewABC
) -> None:
    """Unfiltered and dimension-filtered requests return the fixed aggregates."""
    response: TestResponse = _chart_data(client, [])
    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == [
        {"category": "Books", "total_amount": 15},
        {"category": "Games", "total_amount": 7},
        {"category": "Music", "total_amount": 3},
    ]

    response = _chart_data(client, [{"col": "region", "op": "IN", "val": ["West"]}])
    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == [
        {"category": "Books", "total_amount": 5},
        {"category": "Music", "total_amount": 3},
    ]


def test_unsupported_operator_fails_loudly(
    client: FlaskClient, full_api_access: None, stub_view: SemanticViewABC
) -> None:
    """A query shape the stub cannot honour errors rather than returning all rows."""
    response: TestResponse = _chart_data(
        client, [{"col": "category", "op": "LIKE", "val": "B%"}]
    )
    assert response.status_code >= 400
    assert "does not support" in str(response.json)
