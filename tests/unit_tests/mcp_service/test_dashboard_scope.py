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

"""Dashboard filter scope is a floor the model cannot lower or route around."""

import base64
import importlib
import inspect
import re
import zlib
from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    GetChartDataRequest,
    GetChartInfoRequest,
    GetChartPreviewRequest,
    GetChartSqlRequest,
)
from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
from superset.mcp_service.dashboard_scope import (
    apply_call_dashboard_scope,
    compose_extra_form_data,
    dashboard_constraints,
    DashboardConstraints,
    DashboardScope,
    decode_dashboard_scope,
    DEFINITION_CHANGING_TOOLS,
    HEADER_NAME,
    intersect_time_ranges,
    MAX_PAYLOAD_BYTES,
    MCPDashboardScopeError,
    REFUSAL_PREFIX,
    SCOPE_NEUTRAL_TOOLS,
    SCOPE_REWRITERS,
    scoped_dataset_query,
)
from superset.mcp_service.dataset.schemas import QueryDatasetRequest
from superset.mcp_service.semantic_layer.schemas import GetTableRequest
from superset.mcp_service.sql_lab.schemas import ExecuteSqlRequest
from superset.utils import json

DASHBOARD_ID = 7
CLIENT_A = {"col": "client", "op": "IN", "val": ["A"]}
CLIENT_B = {"col": "client", "op": "IN", "val": ["B"]}
REGION_EU = {"col": "region", "op": "==", "val": "EU"}

query_dataset_module = importlib.import_module(
    "superset.mcp_service.dataset.tool.query_dataset"
)
get_chart_data_module = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_data"
)


def encode(payload: Any) -> str:
    """Encode a payload exactly as the contract tells clients to."""
    raw = json.dumps(payload).encode()
    return base64.urlsafe_b64encode(zlib.compress(raw)).decode()


def scope_payload(
    chart_filters: dict[str, Any], dashboard_id: int = DASHBOARD_ID
) -> dict[str, Any]:
    return {"version": 1, "dashboard_id": dashboard_id, "chart_filters": chart_filters}


def make_scope(chart_filters: dict[int, Any]) -> DashboardScope:
    return DashboardScope(dashboard_id=DASHBOARD_ID, chart_filters=chart_filters)


@contextmanager
def scope_header(*values: str) -> Iterator[None]:
    """Stand in for the HTTP header FastMCP exposes on the current request."""
    with patch(
        "superset.mcp_service.dashboard_scope._scope_header_values",
        return_value=list(values),
    ):
        yield


@contextmanager
def dashboard(
    chart_ids: list[int],
    dashboard_id: int = DASHBOARD_ID,
    chart_datasets: dict[int, int] | None = None,
    chart_form_data: dict[int, dict[str, Any]] | None = None,
) -> Iterator[Any]:
    """Resolve a dashboard with each chart's dataset identity."""
    board = SimpleNamespace(
        id=dashboard_id,
        slices=[
            SimpleNamespace(
                id=chart_id,
                datasource_id=(chart_datasets or {}).get(chart_id, 3),
                datasource_type="table",
                form_data=(chart_form_data or {}).get(
                    chart_id, temporal_form_data("ds")
                ),
            )
            for chart_id in chart_ids
        ],
    )
    with patch(
        "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug", return_value=board
    ) as lookup:
        yield lookup


def temporal_form_data(*columns: str) -> dict[str, Any]:
    """Build chart state with named temporal filters, including inactive ones."""
    return {
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "operator": "TEMPORAL_RANGE",
                "subject": column,
                "comparator": "No filter",
            }
            for column in columns
        ]
    }


@contextmanager
def charts_exist() -> Iterator[None]:
    """Resolve every chart identifier to a chart with that numeric id."""
    with patch(
        "superset.mcp_service.chart.chart_helpers.find_chart_by_identifier",
        side_effect=lambda identifier: SimpleNamespace(id=int(identifier)),
    ):
        yield


def _column(name: str, is_dttm: bool = False) -> MagicMock:
    column = MagicMock()
    column.column_name = name
    column.is_dttm = is_dttm
    column.verbose_name = None
    column.type = "VARCHAR"
    column.groupby = True
    column.filterable = True
    column.description = None
    return column


def _metric(name: str) -> MagicMock:
    metric = MagicMock()
    metric.metric_name = name
    metric.verbose_name = None
    metric.expression = "COUNT(*)"
    metric.description = None
    metric.d3format = None
    return metric


def _dataset(columns: list[str] | None = None, main_dttm_col: str | None = "ds") -> Any:
    dataset = MagicMock()
    dataset.id = 3
    dataset.table_name = "orders"
    dataset.uuid = "uuid-3"
    dataset.main_dttm_col = main_dttm_col
    dataset.columns = [
        _column(name) for name in (columns or ["client", "region", "amount"])
    ] + [_column("ds", is_dttm=True)]
    dataset.metrics = [_metric("count")]
    return dataset


def _rewrite(tool_name: str, request: Any) -> Any:
    """Run the dispatch the auth hook runs, with the real tool's signature."""
    assert tool_name in SCOPE_REWRITERS
    signature = inspect.Signature(
        [inspect.Parameter("request", inspect.Parameter.POSITIONAL_OR_KEYWORD)]
    )
    args, kwargs = apply_call_dashboard_scope(
        tool_name, signature, (), {"request": request}
    )
    return (args or (kwargs.get("request"),))[0]


# ---------------------------------------------------------------------------
# Header decoding
# ---------------------------------------------------------------------------


def test_header_round_trips() -> None:
    scope = decode_dashboard_scope(
        encode(scope_payload({"11": {"filters": [CLIENT_A]}}))
    )
    assert scope.dashboard_id == DASHBOARD_ID
    assert scope.chart_filters == {11: {"filters": [CLIENT_A]}}
    assert scope.has_constraints


def test_header_accepts_missing_padding() -> None:
    value = encode(scope_payload({"11": {"filters": [CLIENT_A]}})).rstrip("=")
    assert decode_dashboard_scope(value).chart_filters == {11: {"filters": [CLIENT_A]}}


@pytest.mark.parametrize(
    "value",
    [
        "not base64 !!",
        base64.urlsafe_b64encode(b"plain, not zlib").decode(),
        base64.urlsafe_b64encode(zlib.compress(b"not json")).decode(),
        base64.urlsafe_b64encode(zlib.compress(b"x" * 100)[:-4]).decode(),
        encode(["not", "an", "object"]),
        encode({"version": 2, "dashboard_id": 1}),
        encode({"version": 1, "dashboard_id": "7"}),
        encode({"version": 1, "dashboard_id": True}),
        encode({"version": 1, "dashboard_id": 0}),
        encode(scope_payload({"chart-1": {}})),
        encode(scope_payload({"11": ["not", "an", "object"]})),
        encode(scope_payload({"11": {"filters": {"col": "x"}}})),
        encode({"version": 1, "dashboard_id": 7, "chart_filters": []}),
        encode(scope_payload({"11": {"filters": False}})),
        encode(scope_payload({"11": {"adhoc_filters": 0}})),
        encode(scope_payload({"11": {"adhoc_filters": ""}})),
        encode(scope_payload({"11": {"time_range": 123}})),
        encode(scope_payload({"11": {"time_range": ["Last week"]}})),
        encode(scope_payload({"11": {"granularity_sqla": {"col": "ds"}}})),
        encode(scope_payload({"11": {"time_column": 5}})),
        encode(scope_payload({"11": {"relative_start": False}})),
    ],
)
def test_malformed_header_is_refused(value: str) -> None:
    """A garbled scope never degrades to "no scope"."""
    with pytest.raises(MCPDashboardScopeError, match="malformed"):
        decode_dashboard_scope(value)


def test_null_filter_values_read_as_absent() -> None:
    scope = decode_dashboard_scope(
        encode(
            scope_payload(
                {"11": {"filters": None, "adhoc_filters": None, "time_range": None}}
            )
        )
    )
    assert not scope.has_constraints


def test_oversized_payload_is_refused_without_inflating_it() -> None:
    bomb = base64.urlsafe_b64encode(
        zlib.compress(b" " * (MAX_PAYLOAD_BYTES * 4))
    ).decode()
    with pytest.raises(MCPDashboardScopeError, match="too large"):
        decode_dashboard_scope(bomb)


def test_header_is_read_from_the_current_http_request() -> None:
    from starlette.requests import Request

    from superset.mcp_service.dashboard_scope import get_request_dashboard_scope

    value = encode(scope_payload({"11": {"filters": [CLIENT_A]}}))
    request = Request(
        {"type": "http", "headers": [(HEADER_NAME.lower().encode(), value.encode())]}
    )
    with patch("fastmcp.server.dependencies.get_http_request", return_value=request):
        scope = get_request_dashboard_scope()
    assert scope is not None
    assert scope.chart_filters == {11: {"filters": [CLIENT_A]}}


def test_transports_without_http_carry_no_scope() -> None:
    from superset.mcp_service.dashboard_scope import get_request_dashboard_scope

    with patch(
        "fastmcp.server.dependencies.get_http_request",
        side_effect=RuntimeError("No active HTTP request found."),
    ):
        assert get_request_dashboard_scope() is None


def test_repeated_header_is_refused() -> None:
    value = encode(scope_payload({"11": {"filters": [CLIENT_A]}}))
    with scope_header(value, value), pytest.raises(MCPDashboardScopeError):
        apply_call_dashboard_scope("list_charts", inspect.Signature(), (), {})


@pytest.mark.parametrize(
    "chart_filters",
    [
        {},
        {11: {}},
        {11: {"time_range": "No filter"}},
        {11: {"time_grain_sqla": "P1D"}},
    ],
)
def test_scope_without_row_constraints_changes_nothing(
    chart_filters: dict[int, Any],
) -> None:
    assert not make_scope(chart_filters).has_constraints
    payload = scope_payload({str(k): v for k, v in chart_filters.items()})
    request = QueryDatasetRequest(dataset_id=3, metrics=["count"])
    with scope_header(encode(payload)):
        assert _rewrite("query_dataset", request) is request


# ---------------------------------------------------------------------------
# (a) Model-supplied extra_form_data cannot drop or loosen the scope
# ---------------------------------------------------------------------------

SCOPE_EFD = {"filters": [CLIENT_A], "time_range": "Last quarter"}


@pytest.mark.parametrize("model_efd", [None, {}, {"filters": []}])
def test_empty_model_payload_keeps_the_scope(model_efd: Any) -> None:
    """The old shell behaviour skipped injection whenever the model sent
    extra_form_data, so ``{}`` shed the dashboard filters entirely."""
    assert compose_extra_form_data(SCOPE_EFD, model_efd) == SCOPE_EFD


def test_model_filters_are_and_composed_not_substituted() -> None:
    composed = compose_extra_form_data(SCOPE_EFD, {"filters": [REGION_EU, CLIENT_A]})
    assert composed["filters"] == [CLIENT_A, REGION_EU]
    assert composed["time_range"] == "Last quarter"


def test_model_filter_on_the_same_column_narrows_but_keeps_the_scope() -> None:
    composed = compose_extra_form_data(SCOPE_EFD, {"filters": [CLIENT_B]})
    assert composed["filters"] == [CLIENT_A, CLIENT_B]


@pytest.mark.parametrize(
    "model_efd",
    [
        {"time_range": "No filter"},
        {"time_range": "Last year"},
        {"granularity_sqla": "other_ds"},
        {"time_column": "other_ds"},
        {"filters": [{"col": "client", "op": "TEMPORAL_RANGE", "val": "Last year"}]},
        {"filters": {"col": "client"}},
    ],
)
def test_model_cannot_replace_row_constraints(model_efd: dict[str, Any]) -> None:
    with pytest.raises(MCPDashboardScopeError) as excinfo:
        compose_extra_form_data(SCOPE_EFD, model_efd)
    assert str(excinfo.value).startswith(REFUSAL_PREFIX)
    assert "No query was run." in str(excinfo.value)


def test_model_may_repeat_the_scope_and_change_presentation() -> None:
    composed = compose_extra_form_data(
        SCOPE_EFD, {**SCOPE_EFD, "time_grain_sqla": "P1W"}
    )
    assert composed == {**SCOPE_EFD, "time_grain_sqla": "P1W"}


def test_model_time_range_allowed_when_dashboard_sets_none() -> None:
    composed = compose_extra_form_data({"filters": [CLIENT_A]}, {"time_range": "2024"})
    assert composed == {"filters": [CLIENT_A], "time_range": "2024"}


TEMPORAL_CROSS_FILTER = {
    "filters": [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "2024-01-01 : 2024-02-01"}]
}


@pytest.mark.parametrize(
    "model_efd",
    [
        {"time_range": "No filter"},
        {"time_range": "Last year"},
        {"relative_end": "2015-01-01"},
        {"filters": [{"col": "other_ds", "op": "TEMPORAL_RANGE", "val": "x"}]},
    ],
)
def test_temporal_cross_filter_window_cannot_be_moved(
    model_efd: dict[str, Any],
) -> None:
    """A time-series cross-filter sends TEMPORAL_RANGE with no time_range, so
    the window must be protected without relying on a time_range key."""
    with pytest.raises(MCPDashboardScopeError):
        compose_extra_form_data(TEMPORAL_CROSS_FILTER, model_efd)


@pytest.mark.parametrize("key", ["relative_start", "relative_end"])
def test_relative_anchor_cannot_shift_the_dashboard_window(key: str) -> None:
    with pytest.raises(MCPDashboardScopeError):
        compose_extra_form_data(SCOPE_EFD, {key: "2015-01-01"})


def test_adhoc_temporal_column_cannot_target_a_scoped_column() -> None:
    adhoc_column = {"sqlExpression": "client", "label": "client"}
    with pytest.raises(MCPDashboardScopeError):
        compose_extra_form_data(
            {"filters": [CLIENT_A]},
            {"filters": [{"col": adhoc_column, "op": "TEMPORAL_RANGE", "val": "x"}]},
        )


def test_resending_the_scope_is_not_a_model_change() -> None:
    """The current client also injects the chart's own filters; an exact
    repeat of the scope (temporal cross-filter included) is accepted."""
    assert (
        compose_extra_form_data(TEMPORAL_CROSS_FILTER, dict(TEMPORAL_CROSS_FILTER))
        == TEMPORAL_CROSS_FILTER
    )


def test_unrelated_temporal_filter_allowed_when_dashboard_sets_no_window() -> None:
    other = {"col": "shipped_ds", "op": "TEMPORAL_RANGE", "val": "Last week"}
    composed = compose_extra_form_data({"filters": [CLIENT_A]}, {"filters": [other]})
    assert composed["filters"] == [CLIENT_A, other]


# ---------------------------------------------------------------------------
# Dashboard-wide constraints for dataset and SQL paths
# ---------------------------------------------------------------------------


def test_constraints_union_consistent_chart_filters() -> None:
    scope = make_scope(
        {
            11: {"filters": [CLIENT_A, REGION_EU], "time_range": "Last week"},
            12: {"filters": [CLIENT_A], "time_range": "Last week"},
            # A cross-filter emitter lacks its own clause; still consistent.
            13: {"filters": [REGION_EU]},
        }
    )
    constraints = dashboard_constraints(scope)
    assert sorted(c["col"] for c in constraints.clauses) == ["client", "region"]
    assert constraints.time_range == "Last week"
    assert constraints.time_column is None


def test_simple_adhoc_filters_count_as_clauses() -> None:
    scope = make_scope(
        {
            11: {
                "adhoc_filters": [
                    {
                        "expressionType": "SIMPLE",
                        "clause": "WHERE",
                        "subject": "client",
                        "operator": "IN",
                        "comparator": ["A"],
                    }
                ]
            }
        }
    )
    assert dashboard_constraints(scope).clauses == (CLIENT_A,)


@pytest.mark.parametrize(
    "chart_filters",
    [
        {11: {"filters": [CLIENT_A]}, 12: {"filters": [CLIENT_B]}},
        {11: {"time_range": "Last week"}, 12: {"time_range": "Last year"}},
        {
            11: {"time_range": "Last week", "granularity_sqla": "ds"},
            12: {"time_range": "Last week", "granularity_sqla": "shipped_ds"},
        },
        {11: {"adhoc_filters": [{"expressionType": "SIMPLE", "clause": 1}]}},
        {11: {"adhoc_filters": [{"expressionType": "SQL", "sqlExpression": "1=1"}]}},
        {11: {"filters": [{"col": "client", "op": "TEMPORAL_RANGE", "val": "x"}]}},
        {11: {"filters": [{"col": {"sqlExpression": "a"}, "op": "==", "val": 1}]}},
        {11: {"filters": [{"col": "client", "op": "IN", "val": [{"x": 1}]}]}},
        {11: {"filters": [CLIENT_A], "relative_start": "now"}},
    ],
)
def test_ambiguous_or_unsupported_constraints_refuse(
    chart_filters: dict[int, Any],
) -> None:
    with pytest.raises(MCPDashboardScopeError):
        dashboard_constraints(make_scope(chart_filters))


def test_time_range_intersection() -> None:
    assert intersect_time_ranges("Last week", None) == "Last week"
    assert intersect_time_ranges("Last week", "Last week") == "Last week"
    assert (
        intersect_time_ranges(
            "2024-01-01T00:00:00 : 2024-03-01T00:00:00",
            "2024-02-01T00:00:00 : 2024-06-01T00:00:00",
        )
        == "2024-02-01T00:00:00 : 2024-03-01T00:00:00"
    )
    assert (
        intersect_time_ranges("2024-01-01T00:00:00 : ", " : 2024-02-01T00:00:00")
        == "2024-01-01T00:00:00 : 2024-02-01T00:00:00"
    )
    # "No filter" from the model adds no bound, so it cannot widen the window.
    assert intersect_time_ranges("Last week", "No filter") == "Last week"
    with pytest.raises(MCPDashboardScopeError, match="does not overlap"):
        intersect_time_ranges(
            "2024-01-01T00:00:00 : 2024-02-01T00:00:00",
            "2025-01-01T00:00:00 : 2025-02-01T00:00:00",
        )


def _dataset_query(
    constraints: DashboardConstraints, **overrides: Any
) -> tuple[list[dict[str, Any]], str | None, str | None]:
    params: dict[str, Any] = {
        "subject": "dataset 'orders'",
        "columns": {"client", "region", "ds", "other_ds"},
        "temporal_columns": {"ds", "other_ds"},
        "main_dttm_col": "ds",
        "filters": [],
        "time_range": None,
        "time_column": None,
    }
    params.update(overrides)
    return scoped_dataset_query(constraints, **params)


def test_dataset_query_ands_scope_after_model_filters() -> None:
    constraints = DashboardConstraints((CLIENT_A,), "Last week", "ds")
    filters, time_range, time_column = _dataset_query(
        constraints, filters=[REGION_EU], time_range="Last month"
    )
    assert filters == [REGION_EU, CLIENT_A]
    assert time_column == "ds"
    assert time_range is not None
    assert " : " in time_range


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"columns": {"region", "ds"}}, "no column 'client'"),
        ({"temporal_columns": set()}, "no datetime column"),
        ({"time_column": "other_ds", "time_range": "Last year"}, "cannot be combined"),
        (
            {"filters": [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last year"}]},
            "TEMPORAL_RANGE",
        ),
    ],
)
def test_dataset_query_refuses_what_it_cannot_apply(
    overrides: dict[str, Any], message: str
) -> None:
    constraints = DashboardConstraints((CLIENT_A,), "Last week", "ds")
    with pytest.raises(MCPDashboardScopeError, match=message):
        _dataset_query(constraints, **overrides)


def test_dataset_query_refuses_a_scope_clause_superset_would_drop() -> None:
    """QueryContextFactory drops filters on the granularity column."""
    constraints = DashboardConstraints(
        ({"col": "ds", "op": ">=", "val": "2024-01-01"},), None, None
    )
    with pytest.raises(MCPDashboardScopeError, match="would be dropped"):
        _dataset_query(constraints, time_range="Last year")


# ---------------------------------------------------------------------------
# Dispatch: classification and default deny
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_every_registered_tool_is_classified() -> None:
    """A new tool must be classified before it can run under a scope; the
    runtime default (refuse) covers extension tools this test cannot see."""
    names = {tool.name for tool in await mcp.list_tools(run_middleware=False)}
    classified = set(SCOPE_REWRITERS) | SCOPE_NEUTRAL_TOOLS
    assert names - classified == set()
    assert set(SCOPE_REWRITERS) & SCOPE_NEUTRAL_TOOLS == set()


@pytest.mark.parametrize(
    "tool_name", ["some_extension.read_rows", "a_future_data_tool"]
)
def test_unclassified_tools_are_refused_under_scope(tool_name: str) -> None:
    with (
        scope_header(encode(scope_payload({"11": {"filters": [CLIENT_A]}}))),
        pytest.raises(MCPDashboardScopeError, match="does not support dashboard"),
    ):
        apply_call_dashboard_scope(tool_name, inspect.Signature(), (), {})


@pytest.mark.parametrize("tool_name", ["list_charts", "get_catalog"])
def test_neutral_tools_pass_untouched(tool_name: str) -> None:
    kwargs = {"request": {"page": 1}}
    with scope_header(encode(scope_payload({"11": {"filters": [CLIENT_A]}}))):
        assert apply_call_dashboard_scope(
            tool_name, inspect.Signature(), (), kwargs
        ) == ((), kwargs)


def test_no_header_never_touches_the_call() -> None:
    kwargs = {"request": {"dataset_id": 3}}
    with (
        scope_header(),
        patch("superset.mcp_service.dataset.dataset_utils.resolve_dataset") as lookup,
    ):
        assert apply_call_dashboard_scope(
            "query_dataset", inspect.Signature(), (), kwargs
        ) == ((), kwargs)
    lookup.assert_not_called()


def test_malformed_header_refuses_even_neutral_tools() -> None:
    with scope_header("%%%"), pytest.raises(MCPDashboardScopeError, match="malformed"):
        apply_call_dashboard_scope("list_charts", inspect.Signature(), (), {})


# ---------------------------------------------------------------------------
# (b) Each covered tool receives the scope
# ---------------------------------------------------------------------------

CHART_SCOPE = scope_payload({"11": {"filters": [CLIENT_A], "time_range": "Last week"}})


@pytest.mark.parametrize("tool_name", ["query_dataset", "get_table"])
def test_dataset_time_window_uses_chart_temporal_column(tool_name: str) -> None:
    """A time-only native filter must retain the chart's temporal target."""
    dataset = _dataset(main_dttm_col="created_at")
    dataset.columns.extend(
        [_column("created_at", is_dttm=True), _column("order_date", is_dttm=True)]
    )
    request = (
        QueryDatasetRequest(dataset_id=3, metrics=["count"])
        if tool_name == "query_dataset"
        else GetTableRequest(dataset_id=3, metrics=["count"])
    )
    with (
        scope_header(
            encode(
                scope_payload(
                    {
                        "11": {"time_range": "Last week"},
                        "12": {"time_range": "Last week"},
                    }
                )
            )
        ),
        dashboard(
            [11, 12],
            chart_form_data={
                11: temporal_form_data("order_date"),
                12: temporal_form_data("order_date"),
            },
        ),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=dataset,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
    ):
        rewritten = _rewrite(tool_name, request)
    assert rewritten.time_column == "order_date"


@pytest.mark.parametrize("tool_name", ["query_dataset", "get_table"])
@pytest.mark.parametrize(
    "chart_form_data",
    [
        {11: temporal_form_data("ds"), 12: temporal_form_data("other_ds")},
        {11: temporal_form_data(), 12: temporal_form_data()},
        {11: temporal_form_data("ds"), 12: temporal_form_data()},
        {11: temporal_form_data("ds", "other_ds"), 12: temporal_form_data("ds")},
    ],
)
def test_dataset_time_window_refuses_ambiguous_chart_targets(
    tool_name: str, chart_form_data: dict[int, dict[str, Any]]
) -> None:
    """Missing targets, including on just one affected chart, never use defaults."""
    request = (
        QueryDatasetRequest(dataset_id=3, metrics=["count"], time_column="ds")
        if tool_name == "query_dataset"
        else GetTableRequest(dataset_id=3, metrics=["count"], time_column="ds")
    )
    with (
        scope_header(
            encode(
                scope_payload(
                    {
                        "11": {"time_range": "Last week"},
                        "12": {"time_range": "Last week"},
                    }
                )
            )
        ),
        dashboard([11, 12], chart_form_data=chart_form_data),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=_dataset(),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
        pytest.raises(MCPDashboardScopeError, match="time.*column") as excinfo,
    ):
        _rewrite(tool_name, request)
    assert "No query was run." in str(excinfo.value)


def test_unresolved_constraint_time_column_never_uses_dataset_default() -> None:
    with pytest.raises(MCPDashboardScopeError, match="no resolved time-filter column"):
        _dataset_query(DashboardConstraints((), "Last week", None))


def test_chart_temporal_resolution_honors_overrides_without_mutation() -> None:
    form_data = temporal_form_data("other_ds")
    scope = make_scope({11: {"time_range": "Last week", "granularity_sqla": "ds"}})
    with dashboard([11], chart_form_data={11: form_data}):
        assert dashboard_constraints(scope, dataset_ids={3}).time_column == "ds"
    assert form_data == temporal_form_data("other_ds")


@pytest.mark.parametrize(
    "saved_filters",
    [
        None,
        False,
        1,
        "invalid",
        {},
        {"operator": "TEMPORAL_RANGE"},
        [None],
        [False],
        [1],
        ["invalid"],
        [[]],
    ],
)
@pytest.mark.parametrize(
    "overrides",
    [{}, {"granularity_sqla": "ds"}, {"filters": [CLIENT_A]}],
)
def test_chart_temporal_resolution_refuses_malformed_saved_filters(
    saved_filters: Any, overrides: dict[str, Any]
) -> None:
    """Malformed saved filters must refuse before merging dashboard overrides."""
    form_data = {"granularity_sqla": "ds", "adhoc_filters": saved_filters}
    original = json.dumps(form_data)
    scope = make_scope({11: {"time_range": "Last week", **overrides}})
    with (
        dashboard([11], chart_form_data={11: form_data}),
        pytest.raises(
            MCPDashboardScopeError, match="malformed saved filters"
        ) as excinfo,
    ):
        dashboard_constraints(scope, dataset_ids={3})
    assert "No query was run." in str(excinfo.value)
    assert json.dumps(form_data) == original


@pytest.mark.parametrize("saved_filters", [None, False, 1, "invalid", {}, [None]])
def test_chart_temporal_resolution_refuses_malformed_secondary_saved_filters(
    saved_filters: Any,
) -> None:
    """Dashboard filter appends also require well-formed secondary filter lists."""
    form_data = {**temporal_form_data("ds"), "adhoc_filters_b": saved_filters}
    scope = make_scope({11: {"time_range": "Last week", "filters": [CLIENT_A]}})
    with (
        dashboard([11], chart_form_data={11: form_data}),
        pytest.raises(MCPDashboardScopeError, match="malformed saved filters"),
    ):
        dashboard_constraints(scope, dataset_ids={3})


@pytest.mark.parametrize(
    "saved_form_data",
    [
        {"granularity_sqla": "ds"},
        {"granularity_sqla": "ds", "time_range": "Last year"},
        {"time_column": "ds"},
        {**temporal_form_data("ds"), "granularity_sqla": "ds"},
        temporal_form_data("ds"),
    ],
)
def test_time_column_override_supersedes_saved_legacy_target(
    saved_form_data: dict[str, Any],
) -> None:
    """A Time column native filter overrides granularity_sqla, which the merge
    writes to ``granularity``; the chart's query uses that column, so the saved
    legacy key must not count as a second time column."""
    original = json.dumps(saved_form_data)
    scope = make_scope(
        {11: {"time_range": "Last week", "granularity_sqla": "other_ts"}}
    )
    with dashboard([11], chart_form_data={11: saved_form_data}):
        assert dashboard_constraints(scope, dataset_ids={3}).time_column == "other_ts"
    assert json.dumps(saved_form_data) == original


def test_saved_granularity_takes_precedence_over_granularity_sqla() -> None:
    """The query object reads ``granularity`` before ``granularity_sqla``."""
    scope = make_scope({11: {"time_range": "Last week"}})
    form_data = {"granularity": "other_ts", "granularity_sqla": "ds"}
    with dashboard([11], chart_form_data={11: form_data}):
        assert dashboard_constraints(scope, dataset_ids={3}).time_column == "other_ts"


@pytest.mark.parametrize(
    ("saved_form_data", "overrides"),
    [
        # A time_column override names a column other than the saved target.
        ({"granularity_sqla": "ds"}, {"time_column": "shipped_ds"}),
        # Two saved legacy targets that no override supersedes.
        ({"granularity_sqla": "ds", "time_column": "shipped_ds"}, {}),
    ],
)
def test_legacy_time_targets_that_disagree_are_refused(
    saved_form_data: dict[str, Any], overrides: dict[str, Any]
) -> None:
    scope = make_scope({11: {"time_range": "Last week", **overrides}})
    with (
        dashboard([11], chart_form_data={11: saved_form_data}),
        pytest.raises(MCPDashboardScopeError, match="no single time-filter column"),
    ):
        dashboard_constraints(scope, dataset_ids={3})


def test_legacy_chart_time_column_is_resolved() -> None:
    scope = make_scope({11: {"time_range": "Last week"}})
    with dashboard([11], chart_form_data={11: {"granularity_sqla": "other_ds"}}):
        assert dashboard_constraints(scope, dataset_ids={3}).time_column == "other_ds"


def test_time_window_cannot_be_mapped_to_dataset_outside_dashboard() -> None:
    with (
        dashboard([11], chart_datasets={11: 4}),
        pytest.raises(MCPDashboardScopeError, match="no chart"),
    ):
        dashboard_constraints(
            make_scope({11: {"time_range": "Last week"}}), dataset_ids={3}
        )


@pytest.mark.parametrize("tool_name", ["query_dataset", "get_table"])
def test_no_dashboard_time_window_needs_no_chart_temporal_target(
    tool_name: str,
) -> None:
    """Row-only dashboard filters leave the model's time filtering unchanged."""
    request = (
        QueryDatasetRequest(dataset_id=3, metrics=["count"], time_range="Last week")
        if tool_name == "query_dataset"
        else GetTableRequest(dataset_id=3, metrics=["count"], time_range="Last week")
    )
    with (
        scope_header(encode(scope_payload({"11": {"filters": [CLIENT_A]}}))),
        dashboard([11], chart_form_data={11: temporal_form_data()}),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=_dataset(),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
    ):
        rewritten = _rewrite(tool_name, request)
    assert rewritten.time_range == "Last week"
    assert rewritten.time_column is None
    assert [(f.col, f.op, f.val) for f in rewritten.filters] == [
        ("client", "IN", ["A"])
    ]


def test_time_column_resolution_ignores_unaffected_charts() -> None:
    """Time-filter exclusions and charts on other datasets do not create conflicts."""
    scope = make_scope(
        {11: {"time_range": "Last week"}, 13: {"time_range": "Last week"}}
    )
    with dashboard(
        [11, 12, 13],
        chart_datasets={11: 3, 12: 3, 13: 4},
        chart_form_data={
            11: temporal_form_data("ds"),
            12: temporal_form_data(),
            13: temporal_form_data("other_ds"),
        },
    ):
        assert dashboard_constraints(scope, dataset_ids={3}).time_column == "ds"


@pytest.mark.parametrize(
    ("tool_name", "request_model"),
    [
        ("get_chart_data", GetChartDataRequest(identifier=11, extra_form_data={})),
        (
            "get_chart_preview",
            GetChartPreviewRequest(identifier=11, format="table", extra_form_data={}),
        ),
        ("get_chart_sql", GetChartSqlRequest(identifier=11)),
        ("get_chart_info", GetChartInfoRequest(identifier=11, extra_form_data={})),
    ],
)
def test_chart_tools_receive_the_chart_scope(
    tool_name: str, request_model: Any
) -> None:
    with scope_header(encode(CHART_SCOPE)), charts_exist(), dashboard([11, 12]):
        rewritten = _rewrite(tool_name, request_model)
    assert rewritten.extra_form_data == {
        "filters": [CLIENT_A],
        "time_range": "Last week",
    }


def test_chart_on_dashboard_without_filters_is_unfiltered() -> None:
    request = GetChartDataRequest(
        identifier=12, extra_form_data={"filters": [CLIENT_B]}
    )
    with scope_header(encode(CHART_SCOPE)), charts_exist(), dashboard([11, 12]):
        rewritten = _rewrite("get_chart_data", request)
    assert rewritten.extra_form_data == {"filters": [CLIENT_B]}


def test_uuid_identifier_resolves_to_the_chart_scope() -> None:
    request = GetChartDataRequest(identifier="0f9c6a5e-9d1d-4f38-8b8f-3f2c0d6b1e11")
    with (
        scope_header(encode(CHART_SCOPE)),
        patch(
            "superset.mcp_service.chart.chart_helpers.find_chart_by_identifier",
            return_value=SimpleNamespace(id=11),
        ),
        dashboard([11]),
    ):
        rewritten = _rewrite("get_chart_data", request)
    assert rewritten.extra_form_data["filters"] == [CLIENT_A]


def test_chart_off_the_dashboard_is_refused_for_data_but_not_description() -> None:
    with scope_header(encode(CHART_SCOPE)), charts_exist(), dashboard([11]):
        with pytest.raises(MCPDashboardScopeError, match="not on the scoped"):
            _rewrite("get_chart_data", GetChartDataRequest(identifier=99))
        with pytest.raises(MCPDashboardScopeError, match="not on the scoped"):
            _rewrite(
                "get_chart_preview",
                GetChartPreviewRequest(identifier=99, format="ascii"),
            )
        info = GetChartInfoRequest(identifier=99)
        assert _rewrite("get_chart_info", info) is info
        url_preview = GetChartPreviewRequest(identifier=99, format="url")
        assert _rewrite("get_chart_preview", url_preview) is url_preview


def test_unresolvable_identifier_is_refused_for_data() -> None:
    """get_chart_preview falls back to reading an unknown identifier as a
    form_data_key, so "not found" must refuse rather than pass through."""
    with (
        scope_header(encode(CHART_SCOPE)),
        patch(
            "superset.mcp_service.chart.chart_helpers.find_chart_by_identifier",
            return_value=None,
        ),
    ):
        for request in (
            GetChartPreviewRequest(identifier="cached-key", format="vega_lite"),
            GetChartDataRequest(identifier="cached-key"),
        ):
            with pytest.raises(MCPDashboardScopeError, match="not an accessible"):
                _rewrite(_tool_for(request), request)
        info = GetChartInfoRequest(identifier="cached-key")
        assert _rewrite("get_chart_info", info) is info


def _tool_for(request: Any) -> str:
    return {
        GetChartPreviewRequest: "get_chart_preview",
        GetChartDataRequest: "get_chart_data",
    }[type(request)]


@pytest.mark.parametrize(
    ("tool_name", "request_model"),
    [
        ("get_chart_data", GetChartDataRequest(identifier=11, form_data_key="k")),
        (
            "get_chart_preview",
            GetChartPreviewRequest(identifier=11, form_data_key="k", format="table"),
        ),
    ],
)
def test_unsaved_state_on_a_dashboard_chart_is_refused(
    tool_name: str, request_model: Any
) -> None:
    """Cached Explore state can query any dataset; the chart id it was opened
    from does not describe it."""
    with (
        scope_header(encode(CHART_SCOPE)),
        charts_exist(),
        dashboard([11]),
        pytest.raises(MCPDashboardScopeError, match="unsaved chart state"),
    ):
        _rewrite(tool_name, request_model)


def test_unsaved_chart_data_is_refused() -> None:
    with scope_header(encode(CHART_SCOPE)), pytest.raises(MCPDashboardScopeError):
        _rewrite("get_chart_data", GetChartDataRequest(form_data_key="abc"))


def test_inaccessible_scoped_dashboard_refuses() -> None:
    from superset.commands.dashboard.exceptions import DashboardNotFoundError

    with (
        scope_header(encode(CHART_SCOPE)),
        charts_exist(),
        patch(
            "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
            side_effect=DashboardNotFoundError(),
        ),
        pytest.raises(MCPDashboardScopeError, match="not accessible"),
    ):
        _rewrite("get_chart_data", GetChartDataRequest(identifier=99))


def test_dashboard_data_composes_every_chart() -> None:
    request = GetDashboardDataRequest(
        identifier=DASHBOARD_ID,
        applied_filters={"11": {}, "12": {"filters": [REGION_EU]}, "99": {"x": 1}},
    )
    with scope_header(encode(CHART_SCOPE)), dashboard([11, 12]):
        rewritten = _rewrite("get_dashboard_data", request)
    assert rewritten.applied_filters == {
        "11": {"filters": [CLIENT_A], "time_range": "Last week"},
        "12": {"filters": [REGION_EU]},
    }


def test_dashboard_data_for_another_dashboard_is_refused() -> None:
    with (
        scope_header(encode(CHART_SCOPE)),
        dashboard([11], dashboard_id=8),
        pytest.raises(MCPDashboardScopeError, match="not the scoped dashboard"),
    ):
        _rewrite("get_dashboard_data", GetDashboardDataRequest(identifier=8))


@pytest.mark.parametrize("both_charts_filtered", [False, True])
def test_dataset_query_keeps_a_clause_one_dataset_chart_lacks(
    both_charts_filtered: bool,
) -> None:
    """A chart on the queried dataset with no clause for a column (a native
    filter scoped away from it, or a cross-filter emitter) never removes that
    clause: the dataset answer narrows to the filtered charts, never widens."""
    chart_filters: dict[str, Any] = {"11": {"filters": [CLIENT_A]}}
    if both_charts_filtered:
        chart_filters["12"] = {"filters": [CLIENT_A]}
    request = QueryDatasetRequest(dataset_id=3, metrics=["count"])
    with (
        scope_header(encode(scope_payload(chart_filters))),
        dashboard([11, 12], chart_datasets={11: 3, 12: 3}),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=_dataset(),
        ),
    ):
        rewritten = _rewrite("query_dataset", request)
    assert [f.model_dump() for f in rewritten.filters] == [CLIENT_A]


def test_query_dataset_receives_the_dashboard_constraints() -> None:
    request = QueryDatasetRequest(
        dataset_id=3,
        metrics=["count"],
        filters=[{"col": "region", "op": "==", "val": "EU"}],
    )
    with (
        scope_header(encode(CHART_SCOPE)),
        dashboard([11]),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=_dataset(),
        ),
    ):
        rewritten = _rewrite("query_dataset", request)
    assert [f.model_dump() for f in rewritten.filters] == [REGION_EU, CLIENT_A]
    assert rewritten.time_range == "Last week"
    assert rewritten.time_column == "ds"


def test_get_table_receives_the_dashboard_constraints() -> None:
    request = GetTableRequest(dataset_id=3, metrics=["count"])
    with (
        scope_header(encode(CHART_SCOPE)),
        dashboard([11]),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
    ):
        rewritten = _rewrite("get_table", request)
    assert [(f.col, f.op, f.val) for f in rewritten.filters] == [
        ("client", "IN", ["A"])
    ]
    assert rewritten.time_range == "Last week"
    assert rewritten.time_column == "ds"


@pytest.mark.parametrize("tool_name", ["query_dataset", "get_table"])
def test_dataset_queries_ignore_filters_scoped_to_other_datasets(
    tool_name: str,
) -> None:
    """Native filters excluded from a dataset's charts do not narrow its query."""
    request = (
        QueryDatasetRequest(dataset_id=3, metrics=["count"])
        if tool_name == "query_dataset"
        else GetTableRequest(dataset_id=3, metrics=["count"])
    )
    with (
        scope_header(encode(CHART_SCOPE)),
        dashboard([11, 12], chart_datasets={11: 4, 12: 3}),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=_dataset(),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
    ):
        assert _rewrite(tool_name, request) is request


def test_dataset_constraints_only_merge_matching_charts() -> None:
    """Different filters on another dataset do not make this dataset ambiguous."""
    scope = make_scope({11: {"filters": [CLIENT_A]}, 12: {"filters": [CLIENT_B]}})
    with dashboard([11, 12], chart_datasets={11: 3, 12: 4}):
        assert dashboard_constraints(scope, dataset_ids={3}).clauses == (CLIENT_A,)


def test_datasets_outside_dashboard_keep_dashboard_wide_constraints() -> None:
    """Unrelated datasets still require the dashboard-wide filters."""
    scope = make_scope({11: {"filters": [CLIENT_A]}})
    with dashboard([11], chart_datasets={11: 4}):
        assert dashboard_constraints(scope, dataset_ids={3}).clauses == (CLIENT_A,)


def test_get_table_semantic_views_are_refused() -> None:
    with (
        scope_header(encode(CHART_SCOPE)),
        pytest.raises(MCPDashboardScopeError, match="semantic views"),
    ):
        _rewrite("get_table", GetTableRequest(view_id=5, metrics=["count"]))


def test_execute_sql_receives_the_dashboard_constraints() -> None:
    request = ExecuteSqlRequest(database_id=1, sql="SELECT COUNT(*) FROM orders")
    scoped = request.model_copy(update={"sql": "SELECT 'scoped'"})
    with (
        scope_header(encode(CHART_SCOPE)),
        patch(
            "superset.mcp_service.dashboard_scope_sql.scope_execute_sql_request",
            return_value=scoped,
        ) as rewrite,
    ):
        assert _rewrite("execute_sql", request) is scoped
    scope = rewrite.call_args.args[1]
    assert scope.chart_filters == {
        11: {"filters": [CLIENT_A], "time_range": "Last week"}
    }


@pytest.mark.parametrize(
    ("tool_name", "request_dict"),
    [
        ("generate_chart", {"generate_preview": True, "preview_formats": ["table"]}),
        (
            "update_chart_preview",
            {"generate_preview": True, "preview_formats": ["ascii"]},
        ),
        ("update_chart", {"generate_preview": False, "preview_formats": ["vega_lite"]}),
        ("update_chart", {"generate_preview": False, "preview_formats": ["url"]}),
    ],
)
def test_authoring_data_previews_are_refused(
    tool_name: str, request_dict: dict[str, Any]
) -> None:
    with scope_header(encode(CHART_SCOPE)), pytest.raises(MCPDashboardScopeError):
        _rewrite(tool_name, request_dict)


@pytest.mark.parametrize(
    ("tool_name", "request_dict"),
    [
        ("generate_chart", {"generate_preview": True, "preview_formats": ["url"]}),
        ("generate_chart", {"generate_preview": False, "preview_formats": ["table"]}),
        ("update_chart", {"generate_preview": True, "preview_formats": ["table"]}),
    ],
)
def test_authoring_without_data_previews_is_allowed(
    tool_name: str, request_dict: dict[str, Any]
) -> None:
    with scope_header(encode(CHART_SCOPE)):
        assert _rewrite(tool_name, request_dict) is request_dict


@pytest.mark.parametrize("tool_name", DEFINITION_CHANGING_TOOLS)
def test_definition_changes_are_refused_under_scope(tool_name: str) -> None:
    """Adding a chart to the dashboard, re-pointing one, or defining a dataset
    (``SELECT 'A' AS client, ...``) would let a later read satisfy the captured
    filters without honoring them."""
    with (
        scope_header(encode(CHART_SCOPE)),
        pytest.raises(MCPDashboardScopeError, match="changes what charts"),
    ):
        _rewrite(tool_name, {"anything": True})


def test_definition_changes_are_allowed_without_a_scope() -> None:
    with scope_header():
        request = {"dataset_id": 3}
        assert _rewrite("update_dataset", request) is request


# ---------------------------------------------------------------------------
# End to end through the MCP server: the hook rewrites before the tool runs
# ---------------------------------------------------------------------------


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture
def mock_auth() -> Iterator[MagicMock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as get_user:
        get_user.return_value = Mock(id=1, username="admin")
        yield get_user


@pytest.mark.asyncio
async def test_get_chart_data_runs_with_scope_despite_empty_model_payload(
    mcp_server: FastMCP, mock_auth: MagicMock
) -> None:
    seen: list[Any] = []

    async def capture(request: Any, ctx: Any) -> Any:
        seen.append(request)
        raise RuntimeError("stop after capture")

    with (
        scope_header(encode(CHART_SCOPE)),
        charts_exist(),
        dashboard([11]),
        patch.object(get_chart_data_module, "execute_chart_data", side_effect=capture),
    ):
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "get_chart_data",
                    {"request": {"identifier": 11, "extra_form_data": {}}},
                )
    assert seen[0].extra_form_data == {"filters": [CLIENT_A], "time_range": "Last week"}


@pytest.mark.asyncio
async def test_refusal_reaches_the_client_verbatim(
    mcp_server: FastMCP, mock_auth: MagicMock
) -> None:
    with (
        scope_header(encode(CHART_SCOPE)),
        charts_exist(),
        dashboard([11]),
        patch.object(get_chart_data_module, "execute_chart_data") as execute,
    ):
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError) as excinfo:
                await client.call_tool(
                    "get_chart_data",
                    {
                        "request": {
                            "identifier": 11,
                            "extra_form_data": {"time_range": "No filter"},
                        }
                    },
                )
    execute.assert_not_called()
    assert REFUSAL_PREFIX in str(excinfo.value)
    assert "No query was run." in str(excinfo.value)


@pytest.mark.asyncio
async def test_query_dataset_builds_the_scoped_query(
    mcp_server: FastMCP, mock_auth: MagicMock
) -> None:
    captured: list[dict[str, Any]] = []

    def capture_create(**kwargs: Any) -> MagicMock:
        captured.extend(kwargs.get("queries", []))
        return MagicMock()

    dataset = _dataset()
    with (
        scope_header(encode(CHART_SCOPE)),
        dashboard([11]),
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=dataset,
        ),
        patch.object(query_dataset_module, "resolve_dataset", return_value=dataset),
        patch.object(
            query_dataset_module, "user_can_view_data_model_metadata", return_value=True
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.validate"
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
            return_value={"queries": [{"data": [{"count": 1}], "colnames": ["count"]}]},
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory.create",
            side_effect=capture_create,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "query_dataset",
                {"request": {"dataset_id": 3, "metrics": ["count"], "filters": []}},
            )

    (query,) = captured
    assert CLIENT_A in query["filters"]
    assert {"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last week"} in query["filters"]
    assert query["granularity"] == "ds"
    # The response reports the dashboard filters it applied.
    applied = json.loads(result.content[0].text)["applied_filters"]
    assert CLIENT_A in applied


@pytest.mark.asyncio
async def test_retry_carries_the_scope_again(
    mcp_server: FastMCP, mock_auth: MagicMock
) -> None:
    """The header rides every request, so a retried call is scoped too."""
    seen: list[Any] = []

    async def capture(request: Any, ctx: Any) -> Any:
        seen.append(request)
        raise RuntimeError("tool failed")

    with (
        scope_header(encode(CHART_SCOPE)),
        charts_exist(),
        dashboard([11]),
        patch.object(get_chart_data_module, "execute_chart_data", side_effect=capture),
    ):
        async with Client(mcp_server) as client:
            for payload in (
                {"identifier": 11},
                {"identifier": 11, "extra_form_data": {}},
            ):
                with pytest.raises(ToolError):
                    await client.call_tool("get_chart_data", {"request": payload})
    assert [r.extra_form_data["filters"] for r in seen] == [[CLIENT_A], [CLIENT_A]]


# ---------------------------------------------------------------------------
# (c) A cache hit cannot bypass the scope
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_response_cache_is_bypassed_for_scoped_calls() -> None:
    from fastmcp.server.middleware.caching import ResponseCachingMiddleware

    from superset.mcp_service.caching import _bypass_dashboard_scoped_calls

    server = FastMCP("cache-test")
    calls: list[int] = []

    @server.tool
    def rows() -> int:
        calls.append(1)
        return len(calls)

    server.add_middleware(_bypass_dashboard_scoped_calls(ResponseCachingMiddleware()))
    async with Client(server) as client:
        first = (await client.call_tool("rows", {})).data
        assert (await client.call_tool("rows", {})).data == first  # cached
        with scope_header(encode(CHART_SCOPE)):
            scoped = (await client.call_tool("rows", {})).data
            assert scoped != first  # an unscoped cached result is never served
            assert (await client.call_tool("rows", {})).data != scoped  # nor stored
        assert (await client.call_tool("rows", {})).data == first
    assert len(calls) == 3


@pytest.mark.asyncio
async def test_response_cache_is_kept_for_a_scope_without_constraints() -> None:
    """A dashboard with no active filters is a no-op scope, so caching stays."""
    from fastmcp.server.middleware.caching import ResponseCachingMiddleware

    from superset.mcp_service.caching import _bypass_dashboard_scoped_calls

    server = FastMCP("cache-test")
    calls: list[int] = []

    @server.tool
    def rows() -> int:
        calls.append(1)
        return len(calls)

    server.add_middleware(_bypass_dashboard_scoped_calls(ResponseCachingMiddleware()))
    async with Client(server) as client:
        first = (await client.call_tool("rows", {})).data
        with scope_header(encode(scope_payload({"11": {"time_range": "No filter"}}))):
            assert (await client.call_tool("rows", {})).data == first
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_response_cache_is_bypassed_for_a_malformed_scope() -> None:
    """An undecodable header never reads the cache, so the tool call refuses."""
    from fastmcp.server.middleware.caching import ResponseCachingMiddleware

    from superset.mcp_service.caching import _bypass_dashboard_scoped_calls

    server = FastMCP("cache-test")

    @server.tool
    def rows() -> int:
        apply_call_dashboard_scope("get_chart_info", inspect.Signature(), (), {})
        return 1

    server.add_middleware(_bypass_dashboard_scoped_calls(ResponseCachingMiddleware()))
    async with Client(server) as client:
        assert (await client.call_tool("rows", {})).data == 1
        with scope_header("not-a-scope"):
            with pytest.raises(ToolError, match="malformed"):
                await client.call_tool("rows", {})
            with scope_header("not-a-scope", "not-a-scope"):
                with pytest.raises(ToolError, match="malformed"):
                    await client.call_tool("rows", {})


def test_scoped_query_has_a_different_query_cache_key() -> None:
    """The rewrite lands in the query object, so the chart-data cache key (which
    hashes the query object) differs and an unscoped entry cannot be hit."""
    from superset.common.query_object import QueryObject

    def cache_key(filters: list[Any]) -> str | None:
        return QueryObject(metrics=["count"], columns=[], filters=filters).cache_key()

    unscoped = cache_key([])
    scoped_filters, _, _ = _dataset_query(DashboardConstraints((CLIENT_A,), None, None))
    assert cache_key(scoped_filters) != unscoped


def _refusal_texts(module: Any) -> list[str]:
    """Literal text of every MCPDashboardScopeError built in ``module``."""
    import ast

    tree = ast.parse(inspect.getsource(module))
    constants = {
        target.id: node.value.value
        for node in tree.body
        if isinstance(node, ast.Assign)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
        for target in node.targets
        if isinstance(target, ast.Name)
    }
    texts = []
    for node in ast.walk(tree):
        if not (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "MCPDashboardScopeError"
        ):
            continue
        parts = []
        for arg in ast.walk(node):
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                parts.append(arg.value)
            elif isinstance(arg, ast.Name) and arg.id in constants:
                parts.append(constants[arg.id])
        texts.append(" ".join(parts))
    return texts


def test_refusals_never_suggest_clearing_dashboard_filters() -> None:
    """A refusal keeps the request within the filters, never around them."""
    from superset.mcp_service import dashboard_scope, dashboard_scope_sql

    texts = [
        *_refusal_texts(dashboard_scope),
        *_refusal_texts(dashboard_scope_sql),
    ]
    assert len(texts) > 20
    forbidden = re.compile(
        r"\b(clear|remov|disabl|bypass|turn\w* off|lift|reset|ignor)\w*"
        r"|change the dashboard filter|outside the filtered dashboard",
        re.IGNORECASE,
    )
    offending = [text for text in texts if forbidden.search(text)]
    assert offending == []
