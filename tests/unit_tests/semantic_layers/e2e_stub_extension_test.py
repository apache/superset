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

from collections.abc import Callable, Iterator
from typing import Any, TypeVar
from uuid import uuid4

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    Operator,
    OrFilter,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC
from werkzeug.test import TestResponse

from superset.semantic_layers.models import (
    SemanticLayer as SemanticLayerModel,
)
from superset.semantic_layers.transport import build_provider_transport
from tests.unit_tests.semantic_layers.conftest import make_execution_context, STUB_TYPE


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
    stub_layer: type[Any],
) -> None:
    """The stub carries the extension-prefixed type that seeding code uses."""
    assert vars(stub_layer)["name"] == "E2E Semantic Stub"
    assert {
        view.name
        for view in stub_layer.from_configuration(
            {},
            cache_token="test",  # noqa: S106
            context=make_execution_context(),
            transport=build_provider_transport(),
        ).get_semantic_views({})
    } == {"orders"}


def test_stub_rejects_configuration_and_unknown_views(
    stub_layer: type[SemanticLayer[Any, Any]],
) -> None:
    """Typos in seeding fail at creation instead of producing an empty view."""
    context = make_execution_context()
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        stub_layer.from_configuration(
            {"account": "unexpected"},
            cache_token="test",  # noqa: S106
            context=context,
            transport=build_provider_transport(),
        )
    with pytest.raises(ValueError, match="no semantic view"):
        stub_layer.from_configuration(
            {},
            cache_token="test",  # noqa: S106
            context=context,
            transport=build_provider_transport(),
        ).get_semantic_view("missing", {})


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


_FilterT = TypeVar("_FilterT")


class _OrderedFilters(set[_FilterT]):
    """Exercise both legal set iteration orders without depending on hash seeds."""

    def __init__(self, filters: tuple[_FilterT, ...]) -> None:
        super().__init__(filters)
        self._ordered: tuple[_FilterT, ...] = filters

    def __iter__(self) -> Iterator[_FilterT]:
        return iter(self._ordered)


@pytest.mark.parametrize("entrypoint", ["table", "values", "row_count"])
@pytest.mark.parametrize("invalid_first", [False, True])
@pytest.mark.parametrize("invalid_kind", ["operator", "predicate", "column"])
def test_unsupported_filter_is_rejected_even_when_other_filter_matches_no_rows(
    stub_view: SemanticViewABC,
    entrypoint: str,
    invalid_first: bool,
    invalid_kind: str,
) -> None:
    """Empty results must not hide an unsupported predicate in any filter order."""
    dimensions: dict[str, Dimension] = {d.id: d for d in stub_view.get_dimensions()}
    metric: Metric = next(iter(stub_view.get_metrics()))
    empty: Filter = Filter(
        PredicateType.WHERE, dimensions["region"], Operator.IN, ("North",)
    )
    invalid: Filter = Filter(
        PredicateType.HAVING if invalid_kind == "predicate" else PredicateType.WHERE,
        metric if invalid_kind == "column" else dimensions["category"],
        Operator.LIKE if invalid_kind == "operator" else Operator.EQUALS,
        "B%",
    )
    ordered: tuple[Filter, ...] = (
        (invalid, empty) if invalid_first else (empty, invalid)
    )
    filters: set[Filter] = _OrderedFilters(ordered)
    query: SemanticQuery = SemanticQuery(
        metrics=[metric],
        dimensions=[dimensions["category"]],
        filters=_OrderedFilters(ordered),
    )
    execute: Callable[[], SemanticResult] = {
        "values": lambda: stub_view.get_values(dimensions["category"], filters),
        "row_count": lambda: stub_view.get_row_count(query),
        "table": lambda: stub_view.get_table(query),
    }[entrypoint]
    with pytest.raises(SemanticQueryRejectedError) as excinfo:
        execute()
    assert excinfo.value.code == SemanticQueryErrorCode.UNSUPPORTED_QUERY


def test_supported_filter_can_return_an_empty_result(
    client: FlaskClient, full_api_access: None, stub_view: SemanticViewABC
) -> None:
    """The host still accepts a supported predicate that matches no stub rows."""
    response: TestResponse = _chart_data(
        client, [{"col": "region", "op": "IN", "val": ["North"]}]
    )
    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == []


def test_or_filter_group_is_rejected(stub_view: SemanticViewABC) -> None:
    """The stub cannot evaluate OR groups, so it refuses instead of crashing."""
    region: Dimension = next(d for d in stub_view.get_dimensions() if d.id == "region")
    group: OrFilter = OrFilter(
        frozenset(
            {
                Filter(PredicateType.WHERE, region, Operator.EQUALS, "East"),
                Filter(PredicateType.WHERE, region, Operator.EQUALS, "West"),
            }
        )
    )
    query: SemanticQuery = SemanticQuery(
        metrics=list(stub_view.get_metrics()), dimensions=[region], filters={group}
    )
    with pytest.raises(SemanticQueryRejectedError) as excinfo:
        stub_view.get_table(query)
    assert excinfo.value.code == SemanticQueryErrorCode.UNSUPPORTED_QUERY
