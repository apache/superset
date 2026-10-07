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

"""Column suggestions retain the catalog observation used by their provider."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import Mock
from uuid import uuid4

import pyarrow as pa
import pytest
from flask import Flask
from flask.testing import FlaskClient
from flask_caching import Cache
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import Dimension, Filter, SemanticResult
from werkzeug.test import TestResponse

from superset.extensions import cache_manager
from superset.semantic_layers.metadata import ScopedMetadataStore
from superset.semantic_layers.metadata_binding import (
    connection_store,
    operation_deadline,
    request_metadata_budget,
)
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.utils import json
from tests.unit_tests.semantic_layers.metadata_binding_test import (
    mock_metadata_revalidation,
)
from tests.unit_tests.semantic_layers.metadata_contract_test import (
    OptedInLayer,
    SnapshotView,
)
from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend


class ValuesView(SnapshotView):
    """Keep names and provider UID stable while dimension definitions change."""

    def get_dimensions(self) -> set[Dimension]:
        return {Dimension("country", "country", pa.string(), self.snapshot.payload)}

    def get_values(
        self, dimension: Dimension, filters: set[Filter] | None = None
    ) -> SemanticResult:
        """Read values from the same observation that supplied the dimension."""
        return SemanticResult(
            [], pa.table({"country": json.loads(self.snapshot.payload)})
        )


class ValuesLayer(OptedInLayer):
    """Bind the real store to a fixture provider that serves dimension values."""

    def get_semantic_view(
        self, name: str, additional_configuration: dict[str, Any]
    ) -> ValuesView:
        return ValuesView(self.adapter.snapshot())


@pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {"SEMANTIC_LAYERS": True},
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
            "SEMANTIC_LAYER_METADATA_NAMESPACE": "column-values",
        }
    ],
    indirect=True,
)
def test_column_values_refresh_rotates_cache_with_stable_view_identity(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    caplog: pytest.LogCaptureFixture,
    mocker: MockerFixture,
) -> None:
    """Warm T0, publish T1 and read new suggestions through the authorized route."""
    # Configure only this operation's private backend after app initialization,
    # which otherwise replaces the process-wide coordination singleton.
    mocker.patch.dict(
        app.config,
        {"DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"}},
    )
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="column-values", configuration="{}"
    )
    changed_on: datetime = datetime(2026, 1, 1)
    view: SemanticView = SemanticView(
        id=11,
        uuid=uuid4(),
        name="orders",
        semantic_layer=layer,
        configuration="{}",
        changed_on=changed_on,
        cache_timeout=300,
    )
    mocker.patch.dict(
        app.before_request_funcs,
        {None: [request_metadata_budget, *app.before_request_funcs.get(None, [])]},
    )
    backend: MemoryBackend = MemoryBackend()
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    mocker.patch.object(cache_manager, "_data_cache", cache)
    mocker.patch.dict(registry, {"column-values": ValuesLayer})
    mocker.patch(
        "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
        return_value=backend,
    )
    database: Mock = mocker.patch("superset.semantic_layers.metadata_binding.db")
    mock_metadata_revalidation(database, layer)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    access: Mock = mocker.patch.object(view, "raise_for_access")
    mocker.patch(
        "superset.datasource.api.security_manager.get_rls_cache_key", return_value=[]
    )
    values: Mock = mocker.patch.object(
        ValuesView, "get_values", autospec=True, side_effect=ValuesView.get_values
    )
    route: str = "/api/v1/datasource/semantic_view/11/column/country/values/"
    first: TestResponse = client.get(route)
    assert first.status_code == 200, caplog.text
    assert first.json is not None
    assert first.json["result"] == ["orders", "revenue"]
    assert first.headers["X-Cache-Status"] == "MISS"
    warm: TestResponse = client.get(route)
    assert warm.status_code == 200
    assert warm.headers["X-Cache-Status"] == "HIT"
    assert values.call_count == 1
    with app.test_request_context():
        request_metadata_budget()
        store: ScopedMetadataStore = connection_store(layer)
        store.refresh(lambda deadline: '["new-country"]', deadline=operation_deadline())
    refreshed: TestResponse = client.get(route)
    assert refreshed.status_code == 200
    assert refreshed.json is not None
    assert refreshed.json["result"] == ["new-country"]
    assert refreshed.headers["X-Cache-Status"] == "MISS"
    assert values.call_count == 2
    assert access.call_count == 3
    assert view.changed_on == changed_on
