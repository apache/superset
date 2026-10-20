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

"""Non-dimension filters fail instead of returning silently unfiltered data."""

from collections.abc import Callable
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, PropertyMock

import pandas as pd
import pyarrow as pa
import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    Operator,
    PredicateType,
    SemanticQuery,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticViewFeature
from werkzeug.test import TestResponse

from superset.charts.data.dashboard_filter_context import apply_dashboard_filter_context
from superset.common.query_context_processor import QueryCacheManager
from superset.constants import CacheRegion
from superset.exceptions import QueryObjectValidationError
from superset.mcp_service.chart.chart_helpers import (
    merge_extra_form_data_filters_into_query,
)
from superset.semantic_layers.mapper import (
    _get_group_limit_filters,
    map_query_object,
    validate_query_object,
    ValidatedQueryObject,
)
from superset.semantic_layers.models import SemanticView
from superset.utils.core import QueryObjectFilterClause


@pytest.fixture
def metric_view(mocker: MockerFixture) -> tuple[SemanticView, MagicMock]:
    """Use real host metadata/query mapping with an observable provider boundary."""
    provider: MagicMock = MagicMock(selection_identity_version=None)
    provider.uid.return_value = "metric-filter-view"
    provider.features = frozenset()
    provider.get_dimensions.return_value = {
        Dimension("category", "category", pa.string()),
    }
    provider.get_metrics.return_value = {
        Metric("total_amount", "total_amount", pa.int64(), "SUM(amount)"),
    }
    provider.get_table.return_value = SemanticResult(
        requests=[],
        results=pa.table({"category": ["Books"], "total_amount": [7]}),
    )
    view: SemanticView = SemanticView(id=73, name="Orders", cache_timeout=-1)
    mocker.patch.object(
        SemanticView, "implementation", new_callable=PropertyMock, return_value=provider
    )
    mocker.patch.object(
        SemanticView,
        "result_cache_version",
        new_callable=PropertyMock,
        return_value=None,
    )
    mocker.patch.object(
        SemanticView,
        "metadata_generation",
        new_callable=PropertyMock,
        return_value="metric-filter-test-generation",
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    return view, provider


METRIC_FILTER_ERROR: str = "is a metric; semantic views only filter on dimensions"
MISSING_FILTER_ERROR: str = "is not in this semantic view"
REFUSED_CHART_FILTERS: list[tuple[str, str]] = [
    ("total_amount", METRIC_FILTER_ERROR),
    ("missing_column", MISSING_FILTER_ERROR),
]


def _request(filters: list[QueryObjectFilterClause]) -> dict[str, Any]:
    """Build an ordinary synchronous JSON chart-data request."""
    return {
        "datasource": {"id": 73, "type": "semantic_view"},
        "queries": [
            {"columns": ["category"], "metrics": ["total_amount"], "filters": filters},
        ],
        "result_type": "full",
        "result_format": "json",
    }


@pytest.mark.parametrize("group_limit", [False, True])
def test_chart_data_fetch_values_predicate_without_configured_predicate(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    group_limit: bool,
) -> None:
    """An absent optional predicate must not fail or discard explicit filters."""
    payload: dict[str, Any] = _request(
        [{"col": "category", "op": "==", "val": "Books"}]
    )
    payload["queries"][0]["apply_fetch_values_predicate"] = True
    if group_limit:
        metric_view[1].features = frozenset({SemanticViewFeature.GROUP_LIMIT})
        payload["queries"][0].update(
            series_limit=1,
            series_columns=["category"],
        )

    response: TestResponse = client.post("/api/v1/chart/data", json=payload)

    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == [
        {"category": "Books", "total_amount": 7}
    ]
    query: SemanticQuery = metric_view[1].get_table.call_args.args[0]
    expected_filters: set[Filter] = {
        Filter(
            type=PredicateType.WHERE,
            column=next(iter(metric_view[1].get_dimensions())),
            operator=Operator.EQUALS,
            value="Books",
        )
    }
    assert query.filters == expected_filters
    if group_limit:
        assert query.group_limit is not None
        assert query.group_limit.filters is None  # Inherit the main query filters.


def test_group_limit_fetch_values_predicate_without_configured_predicate(
    metric_view: tuple[SemanticView, MagicMock],
) -> None:
    """Separate inner bounds also tolerate the absent optional predicate."""
    dimension: Dimension = next(iter(metric_view[1].get_dimensions()))
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=metric_view[0],
        apply_fetch_values_predicate=True,
        inner_from_dttm=datetime(2025, 10, 1),
        inner_to_dttm=datetime(2025, 10, 2),
        filters=[{"col": "category", "op": "==", "val": "Books"}],
    )
    assert _get_group_limit_filters(query, {dimension.name: dimension}) == {
        Filter(
            type=PredicateType.WHERE,
            column=dimension,
            operator=Operator.EQUALS,
            value="Books",
        )
    }


@pytest.mark.parametrize(("column", "error"), REFUSED_CHART_FILTERS)
@pytest.mark.parametrize("mixed", [False, True])
def test_chart_data_rejects_non_dimension_filters(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    mixed: bool,
    column: str,
    error: str,
) -> None:
    """Chart-defined metric or missing-column predicates refuse the request."""
    provider: MagicMock = metric_view[1]
    filters: list[QueryObjectFilterClause] = (
        [
            {"col": "category", "op": "==", "val": "Books"},
        ]
        if mixed
        else []
    )
    filters.append({"col": column, "op": ">=", "val": 999999})

    response: TestResponse = client.post("/api/v1/chart/data", json=_request(filters))

    assert response.status_code == 400, response.json
    assert column in str(response.json)
    assert error in str(response.json)
    provider.get_table.assert_not_called()
    provider.get_row_count.assert_not_called()


@pytest.mark.parametrize(("column", "error"), REFUSED_CHART_FILTERS)
def test_invalid_filter_is_rejected_before_result_cache(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    mocker: MockerFixture,
    column: str,
    error: str,
) -> None:
    """A cached partially filtered result cannot bypass column validation."""
    metric_view[0].cache_timeout = 600
    backend: MagicMock = MagicMock()
    backend.get.return_value = {
        "df": pd.DataFrame({"category": ["Books"], "total_amount": [7]}),
        "query": "historical partially filtered result",
        "dttm": "2026-10-08T00:00:00",
        "applied_filter_columns": ["category"],
        "rejected_filter_columns": [],
    }
    mocker.patch.dict(
        "superset.common.utils.query_cache_manager._cache", {CacheRegion.DATA: backend}
    )
    cache_get: MagicMock = mocker.spy(QueryCacheManager, "get")
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request(
            [
                {"col": "category", "op": "==", "val": "Books"},
                {"col": column, "op": ">=", "val": 999999},
            ]
        ),
    )
    assert response.status_code == 400, response.json
    assert error in str(response.json)
    cache_get.assert_not_called()
    backend.get.assert_not_called()
    metric_view[1].get_table.assert_not_called()


@pytest.mark.parametrize(("column", "error"), REFUSED_CHART_FILTERS)
@pytest.mark.parametrize("entry", ["validation", "mapping"])
def test_direct_semantic_entry_rejects_non_dimension_filter(
    metric_view: tuple[SemanticView, MagicMock], entry: str, column: str, error: str
) -> None:
    """Direct mapper callers receive the same column-specific validation error."""
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=metric_view[0],
        columns=["category"],
        metrics=["total_amount"],
        filters=[{"col": column, "op": ">=", "val": 999999}],
    )
    entry_point: Callable[[ValidatedQueryObject], object] = (
        validate_query_object if entry == "validation" else map_query_object
    )
    raised: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError, match=error) as raised:
        entry_point(query)
    assert column in str(raised.value)


@pytest.mark.parametrize("same_named_metric", [False, True])
def test_dimension_filters_still_reach_provider(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    same_named_metric: bool,
) -> None:
    """An existing dimension remains filterable even if a metric shares its name."""
    provider: MagicMock = metric_view[1]
    if same_named_metric:
        provider.get_metrics.return_value.add(
            Metric("category_metric", "category", pa.int64(), "COUNT(*)")
        )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request([{"col": "category", "op": "==", "val": "Books"}]),
    )
    assert response.status_code == 200, response.json
    assert response.json is not None
    assert response.json["result"][0]["data"] == [
        {"category": "Books", "total_amount": 7},
    ]
    provider.get_table.assert_called_once()
    query: SemanticQuery = provider.get_table.call_args.args[0]
    assert response.json["result"][0]["applied_filters"] == [{"column": "category"}]
    assert query.filters == {
        Filter(
            PredicateType.WHERE,
            Dimension("category", "category", pa.string()),
            Operator.EQUALS,
            "Books",
        ),
    }


@pytest.mark.parametrize("column", ["country", "total_amount", "missing_column"])
@pytest.mark.parametrize("mixed", [False, True])
def test_incompatible_filter_is_reported_without_breaking_chart(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    column: str,
    mixed: bool,
) -> None:
    """Dashboard filters on columns the view lacks are skipped and reported."""
    filters: list[QueryObjectFilterClause] = [
        {"col": column, "op": "IN", "val": ["US"], "isExtra": True},
    ]
    if mixed:
        filters.append({"col": "category", "op": "==", "val": "Books"})
    response: TestResponse = client.post("/api/v1/chart/data", json=_request(filters))
    assert response.status_code == 200, response.json
    assert response.json is not None
    result: dict[str, Any] = response.json["result"][0]
    assert result["data"] == [{"category": "Books", "total_amount": 7}]
    assert result["rejected_filter_columns"] == [column]
    assert result["rejected_filters"][0]["column"] == column
    assert result["applied_filters"] == ([{"column": "category"}] if mixed else [])
    query: SemanticQuery = metric_view[1].get_table.call_args.args[0]
    assert query.filters is not None
    assert {f.column.name for f in query.filters if f.column} == (
        {"category"} if mixed else set()
    )


@pytest.mark.parametrize("column", ["category", "country", "total_amount"])
def test_filter_reporting_survives_result_cache_hit(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    mocker: MockerFixture,
    column: str,
) -> None:
    """Seeded applied-only and rejected-only entries render without recomputing."""
    metric_view[0].cache_timeout = 600
    backend: MagicMock = MagicMock()
    backend.get.return_value = {
        "df": pd.DataFrame({"category": ["Books"], "total_amount": [7]}),
        "query": "cached provider query",
        "dttm": "2026-10-08T00:00:00",
        "applied_filter_columns": [column] if column == "category" else [],
        "rejected_filter_columns": [] if column == "category" else [column],
    }
    mocker.patch.dict(
        "superset.common.utils.query_cache_manager._cache", {CacheRegion.DATA: backend}
    )
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request([{"col": column, "op": "IN", "val": ["US"], "isExtra": True}]),
    )
    assert response.status_code == 200, response.json
    assert response.json is not None
    result: dict[str, Any] = response.json["result"][0]
    assert result["is_cached"] is True
    assert result["rejected_filter_columns"] == (
        [] if column == "category" else [column]
    )
    assert result["applied_filters"] == (
        [{"column": column}] if column == "category" else []
    )
    metric_view[1].get_table.assert_not_called()


@pytest.mark.parametrize("value", ["No filter", "Aucun filtre", None])
def test_chart_no_op_time_range_on_missing_column_is_not_refused(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    value: str | None,
    mocker: MockerFixture,
) -> None:
    """Saving from a dashboard can store a "No filter" range on a foreign column;
    it constrains nothing, so it must not break the chart."""
    mocker.patch("superset.utils.date_parser._", return_value="Aucun filtre")
    filters: list[QueryObjectFilterClause] = [
        {"col": "ds", "op": "TEMPORAL_RANGE", "val": value},
    ]
    response: TestResponse = client.post("/api/v1/chart/data", json=_request(filters))
    assert response.status_code == 200, response.json
    metric_view[1].get_table.assert_called_once()


@pytest.mark.parametrize(
    "saved_range", [None, "No filter", "Aucun filtre", "2024-01-01 : 2024-06-01"]
)
@pytest.mark.parametrize("column", ["ds", "total_amount"])
@pytest.mark.parametrize("source", ["chart", "browser", "server", "mcp", "mismatched"])
def test_dashboard_time_override_preserves_foreign_filter_provenance(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    source: str,
    saved_range: str | None,
    column: str,
    mocker: MockerFixture,
) -> None:
    """Only saved unbounded predicates acquire dashboard time provenance."""
    mocker.patch("superset.utils.date_parser._", return_value="Aucun filtre")
    payload: dict[str, Any] = _request(
        [{"col": column, "op": "TEMPORAL_RANGE", "val": saved_range}]
    )
    time_range: str = "2025-01-01 : 2025-02-01"
    if source == "server":
        apply_dashboard_filter_context(payload, {"time_range": time_range})
    elif source == "mcp":
        # MCP get_chart_data merges the override into the saved query only.
        merge_extra_form_data_filters_into_query(
            payload["queries"][0], {"time_range": time_range}, 73, "semantic_view"
        )
    else:
        payload["queries"][0]["time_range"] = time_range
        if source in {"browser", "mismatched"}:
            payload["form_data"] = {
                "extra_form_data": {
                    "time_range": time_range if source == "browser" else "Last week"
                }
            }
    response: TestResponse = client.post("/api/v1/chart/data", json=payload)
    refused: bool = (
        source in {"chart", "mismatched"} or saved_range == "2024-01-01 : 2024-06-01"
    )
    assert response.status_code == (400 if refused else 200), response.json
    if refused:
        metric_view[1].get_table.assert_not_called()
    else:
        assert response.json is not None
        assert response.json["result"][0]["rejected_filter_columns"] == [column]
        metric_view[1].get_table.assert_called_once()
        query: SemanticQuery = metric_view[1].get_table.call_args.args[0]
        assert not query.filters


@pytest.mark.parametrize("value", ["No filter", "Aucun filtre", None])
def test_metric_no_op_time_range_is_still_refused(
    client: FlaskClient,
    full_api_access: None,
    metric_view: tuple[SemanticView, MagicMock],
    mocker: MockerFixture,
    value: str | None,
) -> None:
    """The no-op exception for missing columns does not relax metric refusal."""
    mocker.patch("superset.utils.date_parser._", return_value="Aucun filtre")
    response: TestResponse = client.post(
        "/api/v1/chart/data",
        json=_request([{"col": "total_amount", "op": "TEMPORAL_RANGE", "val": value}]),
    )
    assert response.status_code == 400, response.json
    assert METRIC_FILTER_ERROR in str(response.json)
    metric_view[1].get_table.assert_not_called()
