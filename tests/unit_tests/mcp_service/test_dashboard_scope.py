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
def dashboard(chart_ids: list[int], dashboard_id: int = DASHBOARD_ID) -> Iterator[Any]:
    board = SimpleNamespace(
        id=dashboard_id, slices=[SimpleNamespace(id=chart_id) for chart_id in chart_ids]
    )
    with patch(
        "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug", return_value=board
    ) as lookup:
        yield lookup


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
    ],
)
def test_malformed_header_is_refused(value: str) -> None:
    """A garbled scope never degrades to "no scope"."""
    with pytest.raises(MCPDashboardScopeError, match="malformed"):
        decode_dashboard_scope(value)


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
    constraints = DashboardConstraints((CLIENT_A,), "Last week", None)
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
        ({"main_dttm_col": None}, "no main datetime column"),
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
    constraints = DashboardConstraints((CLIENT_A,), "Last week", None)
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


def test_neutral_tools_pass_untouched() -> None:
    kwargs = {"request": {"page": 1}}
    with scope_header(encode(scope_payload({"11": {"filters": [CLIENT_A]}}))):
        assert apply_call_dashboard_scope(
            "list_charts", inspect.Signature(), (), kwargs
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


def test_query_dataset_receives_the_dashboard_constraints() -> None:
    request = QueryDatasetRequest(
        dataset_id=3,
        metrics=["count"],
        filters=[{"col": "region", "op": "==", "val": "EU"}],
    )
    with (
        scope_header(encode(CHART_SCOPE)),
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
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
    ):
        rewritten = _rewrite("get_table", request)
    assert [(f.col, f.op, f.val) for f in rewritten.filters] == [
        ("client", "IN", ["A"])
    ]
    assert rewritten.time_range == "Last week"
    assert rewritten.time_column == "ds"


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
    constraints = rewrite.call_args.args[1]
    assert constraints.clauses == (CLIENT_A,)
    assert constraints.time_range == "Last week"


@pytest.mark.parametrize(
    ("tool_name", "request_dict"),
    [
        ("generate_chart", {"generate_preview": True, "preview_formats": ["table"]}),
        (
            "update_chart_preview",
            {"generate_preview": True, "preview_formats": ["ascii"]},
        ),
        ("update_chart", {"generate_preview": False, "preview_formats": ["vega_lite"]}),
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


def test_scoped_query_has_a_different_query_cache_key() -> None:
    """The rewrite lands in the query object, so the chart-data cache key (which
    hashes the query object) differs and an unscoped entry cannot be hit."""
    from superset.common.query_object import QueryObject

    def cache_key(filters: list[Any]) -> str | None:
        return QueryObject(metrics=["count"], columns=[], filters=filters).cache_key()

    unscoped = cache_key([])
    scoped_filters, _, _ = _dataset_query(DashboardConstraints((CLIENT_A,), None, None))
    assert cache_key(scoped_filters) != unscoped
