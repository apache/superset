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

"""Unit tests for the get_dashboard_data MCP tool."""

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    BigNumberHeadline,
    ChartData,
    ChartError,
    ChartQueryResult,
    DataColumn,
    PerformanceMetadata,
)
from superset.utils import json

TOOL = "get_dashboard_data"
EXEC = "superset.mcp_service.dashboard.tool.get_dashboard_data.execute_chart_data"
DAO = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
PERM = "superset.mcp_service.auth.check_tool_permission"


@pytest.fixture
def mcp_server() -> object:
    return mcp


def _slice(chart_id: int, name: str, viz: str = "table") -> Mock:
    slc = Mock()
    slc.id = chart_id
    slc.slice_name = name
    slc.viz_type = viz
    return slc


def _dashboard(
    dash_id: int,
    title: str,
    slices: list[Mock],
    position_json: str | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = dash_id
    dashboard.dashboard_title = title
    dashboard.slices = slices
    dashboard.position_json = position_json
    return dashboard


_UNSET = object()


def _chart_data(
    chart_id: int,
    name: str,
    viz: str = "table",
    rows: list[dict[str, Any]] | None = None,
    query_results: list[ChartQueryResult] | None = None,
    total_rows: Any = _UNSET,
) -> ChartData:
    rows = rows if rows is not None else [{"country": "US", "cnt": 10}]
    resolved_total = len(rows) if total_rows is _UNSET else total_rows
    return ChartData(
        query_results=query_results,
        chart_id=chart_id,
        chart_name=name,
        chart_type=viz,
        columns=[
            DataColumn(
                name="country",
                display_name="Country",
                data_type="VARCHAR",
                sample_values=["US"],
                null_count=0,
                unique_count=1,
            )
        ],
        data=rows,
        row_count=len(rows),
        total_rows=resolved_total,
        data_freshness=None,
        summary=f"{name} summary",
        insights=[f"{name} insight"],
        data_quality={},
        recommended_visualizations=[],
        performance=PerformanceMetadata(query_duration_ms=1, cache_status="miss"),
    )


async def _call(client: Client, request: dict[str, Any]) -> dict[str, Any]:
    result = await client.call_tool(TOOL, {"request": request})
    return json.loads(result.content[0].text)


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_returns_compact_summary_per_chart(mock_dao, mock_exec, mcp_server):
    mock_dao.return_value = _dashboard(
        6, "FCC Survey", [_slice(56, "Gender"), _slice(99, "Age")]
    )
    mock_exec.side_effect = [_chart_data(56, "Gender"), _chart_data(99, "Age")]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    assert data["dashboard_id"] == 6
    assert data["chart_count"] == 2
    assert data["charts_returned"] == 2
    assert data["charts_truncated"] is False
    assert [c["chart_name"] for c in data["charts"]] == ["Gender", "Age"]

    first = data["charts"][0]
    assert first["columns"] == ["country"]
    assert first["sample_data"] == [{"country": "US", "cnt": 10}]
    assert first["row_count"] == 1
    # Shallow summary/insights fields were dropped to keep the payload lean.
    assert "summary" not in first
    assert "insights" not in first


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_big_number_headline_comes_from_the_chart_result_not_the_sample(
    mock_dao, mock_exec, mcp_server
):
    """The headline spans the whole series; sample_rows only trims what's shown."""
    rows = [{"__timestamp": i, "total": i} for i in range(1, 20)]
    big_number = _chart_data(108, "Total Sales (YTD)", "big_number", rows=rows)
    big_number.headline = BigNumberHeadline(
        value=190, aggregation="sum", rows_used=len(rows)
    )
    unavailable = _chart_data(109, "Other KPI", "big_number")
    unavailable.headline = BigNumberHeadline(
        aggregation="sum", reason="The fetch was truncated at the row limit."
    )
    mock_dao.return_value = _dashboard(
        13,
        "Sales",
        [
            _slice(108, "Total Sales (YTD)", "big_number"),
            _slice(109, "Other KPI", "big_number"),
            _slice(110, "Table"),
        ],
    )
    mock_exec.side_effect = [big_number, unavailable, _chart_data(110, "Table")]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 13, "sample_rows": 3})

    first, second, third = data["charts"]
    assert len(first["sample_data"]) == 3
    assert first["headline"] == {
        "value": 190,
        "aggregation": "sum",
        "rows_used": 19,
        "reason": None,
    }
    assert second["headline"]["value"] is None
    assert "truncated" in second["headline"]["reason"]
    assert third["headline"] is None


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_truncates_to_max_charts(mock_dao, mock_exec, mcp_server):
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(1, "a"), _slice(2, "b"), _slice(3, "c")]
    )
    mock_exec.side_effect = [_chart_data(1, "a"), _chart_data(2, "b")]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6, "max_charts": 2})

    assert data["chart_count"] == 3
    assert data["charts_returned"] == 2
    assert data["charts_truncated"] is True
    assert mock_exec.call_count == 2


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_applies_filters_only_to_scoped_chart(mock_dao, mock_exec, mcp_server):
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(56, "Gender"), _slice(99, "Age")]
    )
    mock_exec.side_effect = [_chart_data(56, "Gender"), _chart_data(99, "Age")]
    gender_filter = {"filters": [{"col": "gender", "op": "IN", "val": ["Female"]}]}

    async with Client(mcp_server) as client:
        data = await _call(
            client, {"identifier": 6, "applied_filters": {"56": gender_filter}}
        )

    by_id = {c["chart_id"]: c for c in data["charts"]}
    assert by_id[56]["filtered"] is True
    assert by_id[99]["filtered"] is False

    # Only the scoped chart's query received the extra_form_data.
    passed = {
        call.args[0].identifier: call.args[0].extra_form_data
        for call in mock_exec.call_args_list
    }
    assert passed[56] == gender_filter
    assert passed[99] is None
    # fetch_row_limit is the per-chart bound; pin that it reaches the query.
    assert {call.args[0].limit for call in mock_exec.call_args_list} == {100}


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_chart_error_is_recorded_not_fatal(mock_dao, mock_exec, mcp_server):
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(56, "Gender"), _slice(99, "Age")]
    )
    mock_exec.side_effect = [
        ChartError(error_type="DatasetNotAccessible", message="no access"),
        _chart_data(99, "Age"),
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    by_id = {c["chart_id"]: c for c in data["charts"]}
    assert by_id[56]["error"] == "no access"
    assert by_id[56]["sample_data"] == []
    assert by_id[99]["error"] is None
    assert by_id[99]["sample_data"] == [{"country": "US", "cnt": 10}]


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_malformed_filter_is_recorded_not_fatal(mock_dao, mock_exec, mcp_server):
    # A non-dict applied_filters value makes GetChartDataRequest raise inside the
    # per-chart loop; the except branch must record it as an error and keep going
    # rather than aborting the whole dashboard.
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(56, "Gender"), _slice(99, "Age")]
    )
    mock_exec.return_value = _chart_data(99, "Age")

    async with Client(mcp_server) as client:
        data = await _call(
            client, {"identifier": 6, "applied_filters": {"56": "not-a-dict"}}
        )

    by_id = {c["chart_id"]: c for c in data["charts"]}
    assert by_id[56]["error"] is not None
    assert by_id[56]["filtered"] is True
    # The malformed chart never reaches execute_chart_data; the other still runs.
    assert {call.args[0].identifier for call in mock_exec.call_args_list} == {99}
    assert by_id[99]["error"] is None


@patch(DAO)
@pytest.mark.asyncio
async def test_dashboard_not_found_returns_error(mock_dao, mcp_server):
    mock_dao.side_effect = Exception("nope")

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 999})

    assert data["error_type"] == "DashboardNotFound"
    assert "999" in data["error"]


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_selects_charts_in_layout_reading_order(mock_dao, mock_exec, mcp_server):
    # Layout places chart 99 before chart 56, opposite the slice order.
    position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {
                "id": "GRID_ID",
                "type": "GRID",
                "children": ["CHART-b", "CHART-a"],
            },
            "CHART-a": {
                "id": "CHART-a",
                "type": "CHART",
                "meta": {"chartId": 56},
                "children": [],
            },
            "CHART-b": {
                "id": "CHART-b",
                "type": "CHART",
                "meta": {"chartId": 99},
                "children": [],
            },
        }
    )
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(56, "Gender"), _slice(99, "Age")], position_json=position_json
    )
    mock_exec.side_effect = [_chart_data(99, "Age")]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6, "max_charts": 1})

    # With max_charts=1, the layout-first chart (99) is the one selected.
    assert data["charts_returned"] == 1
    assert data["charts"][0]["chart_id"] == 99
    # Assert on the slice actually queried, not the mocked result's id, so a
    # broken _order_by_layout (unchanged or reversed) cannot pass.
    assert mock_exec.call_args.args[0].identifier == 99


@patch("superset.mcp_service.dashboard.tool.get_dashboard_data.monotonic")
@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_stops_at_time_budget(mock_dao, mock_exec, mock_monotonic, mcp_server):
    # First monotonic() sets the deadline; the next read lands past it, so the
    # loop stops after the first chart. Patch the tool-local name so only the
    # tool's calls are mocked, never the process-wide time.monotonic.
    mock_monotonic.side_effect = [0.0, 100.0]
    mock_dao.return_value = _dashboard(
        6, "D", [_slice(1, "a"), _slice(2, "b"), _slice(3, "c")]
    )
    mock_exec.side_effect = [
        _chart_data(1, "a"),
        _chart_data(2, "b"),
        _chart_data(3, "c"),
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    # At least one chart is always attempted; the budget cuts off the rest.
    assert data["charts_returned"] == 1
    assert data["charts_truncated"] is True
    assert mock_exec.call_count == 1


def _deny_chart_only(func, **kwargs):
    # Let the Dashboard-gated tool through the framework gate; deny only the inner
    # Chart read check that get_dashboard_data performs before running queries.
    return getattr(func, "_class_permission_name", None) != "Chart"


@patch(PERM, side_effect=_deny_chart_only)
@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_denies_without_chart_permission(
    mock_dao, mock_exec, mock_perm, mcp_server
):
    # Composing get_chart_data's core must still enforce its Chart read gate, so a
    # principal with Dashboard read but not Chart read gets no chart data.
    mock_dao.return_value = _dashboard(6, "D", [_slice(56, "Gender")])

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    assert data["error_type"] == "ChartAccessDenied"
    mock_exec.assert_not_called()


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_preserves_multi_query_layers(mock_dao, mock_exec, mcp_server):
    # A multi-query chart (e.g. Mixed Timeseries) whose first layer is empty and
    # second has data must not be reported as empty, and both layers survive.
    mock_dao.return_value = _dashboard(6, "D", [_slice(56, "Mixed")])
    mock_exec.side_effect = [
        _chart_data(
            56,
            "Mixed",
            query_results=[
                ChartQueryResult(query_index=0, columns=[], data=[], row_count=0),
                ChartQueryResult(
                    query_index=1, columns=["y"], data=[{"y": 5}], row_count=1
                ),
            ],
        )
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    chart = data["charts"][0]
    # Headline sample comes from the non-empty layer, not the empty first one.
    assert chart["columns"] == ["y"]
    assert chart["sample_data"] == [{"y": 5}]
    # Both layers are preserved under queries.
    assert [q["query_index"] for q in chart["queries"]] == [0, 1]
    assert chart["queries"][1]["sample_data"] == [{"y": 5}]


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_flags_truncated_and_hides_capped_total(mock_dao, mock_exec, mcp_server):
    # Production shape: the upstream rowcount equals the capped fetch (100 rows,
    # total_rows=100, limit=100), which is the cap, not a real total. It must be
    # reported truncated with an unknown total, not as total_rows=100.
    mock_dao.return_value = _dashboard(6, "D", [_slice(56, "Big"), _slice(99, "Small")])
    mock_exec.side_effect = [
        _chart_data(56, "Big", rows=[{"n": i} for i in range(100)], total_rows=100),
        _chart_data(99, "Small", rows=[{"n": 1}]),
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    by_id = {c["chart_id"]: c for c in data["charts"]}
    assert by_id[56]["row_count"] == 100
    assert by_id[56]["truncated"] is True
    assert by_id[56]["total_rows"] is None
    # A complete fetch reports the real total and is not truncated.
    assert by_id[99]["truncated"] is False
    assert by_id[99]["total_rows"] == 1


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_preserves_authoritative_total_below_cap(mock_dao, mock_exec, mcp_server):
    # A known source total larger than the returned rows is preserved (not
    # overwritten by row_count) and flagged truncated, even below the fetch cap.
    mock_dao.return_value = _dashboard(6, "D", [_slice(56, "Partial")])
    mock_exec.side_effect = [
        _chart_data(56, "Partial", rows=[{"n": i} for i in range(5)], total_rows=12),
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    chart = data["charts"][0]
    assert chart["row_count"] == 5
    assert chart["total_rows"] == 12
    assert chart["truncated"] is True


@patch(EXEC, new_callable=AsyncMock)
@patch(DAO)
@pytest.mark.asyncio
async def test_truncation_surfaces_from_any_layer(mock_dao, mock_exec, mcp_server):
    # A capped non-headline layer must still flag the whole chart truncated, so a
    # consumer reading only the top-level fields is not misled.
    mock_dao.return_value = _dashboard(6, "D", [_slice(56, "Mixed")])
    mock_exec.side_effect = [
        _chart_data(
            56,
            "Mixed",
            query_results=[
                ChartQueryResult(
                    query_index=0, columns=["a"], data=[{"a": 1}], row_count=1
                ),
                ChartQueryResult(
                    query_index=1,
                    columns=["b"],
                    data=[{"b": i} for i in range(100)],
                    row_count=100,
                ),
            ],
        )
    ]

    async with Client(mcp_server) as client:
        data = await _call(client, {"identifier": 6})

    chart = data["charts"][0]
    # Headline is the first non-empty layer (0), but layer 1 is capped.
    assert chart["row_count"] == 1
    assert chart["truncated"] is True
    # Headline layer's own total is preserved; layer 1's cap drives truncated.
    assert chart["total_rows"] == 1
    assert chart["queries"][0]["truncated"] is False
    assert chart["queries"][1]["truncated"] is True


def test_rejects_bool_identifier():
    # bool is an int subclass; identifier=True must not coerce to dashboard 1.
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest

    with pytest.raises(ValidationError):
        GetDashboardDataRequest(identifier=True)
    assert GetDashboardDataRequest(identifier=6).identifier == 6


@pytest.mark.parametrize(
    "row_count,source_total,limit,expected",
    [
        (100, 100, 100, (None, True)),  # equal-at-cap: the cap, not a real total
        (5, 12, 100, (12, True)),  # known total above returned -> preserved
        (5, 5, 100, (5, False)),  # complete: source equals count
        (100, None, 100, (None, True)),  # capped, unknown total
        (1, None, 100, (1, False)),  # small, no source total
    ],
)
def test_completeness(row_count, source_total, limit, expected):
    from superset.mcp_service.dashboard.tool.get_dashboard_data import _completeness

    assert _completeness(row_count, source_total, limit) == expected


@pytest.mark.parametrize("chart_type", ["histogram", "histogram_v2"])
@pytest.mark.parametrize("with_metadata", [False, True])
def test_histogram_sample_exposes_input_fetch_limit(
    chart_type: str, with_metadata: bool
) -> None:
    """One output row is not evidence of full histogram input coverage."""
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    result = _chart_data(1, "Experience", viz=chart_type, rows=[{"0-10": 100}])
    if with_metadata:
        from superset.mcp_service.chart.tool.get_chart_data import (
            _with_query_post_processing,
        )

        result = _with_query_post_processing(
            result,
            SimpleNamespace(
                queries=[
                    SimpleNamespace(
                        row_limit=100, post_processing=[{"operation": "histogram"}]
                    )
                ]
            ),
        )
    request = GetDashboardDataRequest(identifier=1, fetch_row_limit=100, sample_rows=5)
    summary = _summarize_chart_data(result, None, request)
    assert summary.fetch_row_limit == 100
    assert summary.sample_rows_limit == 5
    assert summary.row_count == 1
    assert summary.truncated is True
    assert summary.total_rows is None
    assert summary.completeness_note is not None
    assert "input coverage is unverified" in summary.completeness_note


@pytest.mark.parametrize("fetch_row_limit", [3, 500])
@pytest.mark.parametrize("has_query_results", [False, True])
@pytest.mark.parametrize("with_metadata", [False, True])
def test_box_plot_sample_exposes_input_fetch_limit(
    fetch_row_limit: int, has_query_results: bool, with_metadata: bool
) -> None:
    """Collapsed box-plot statistics cannot prove input retrieval coverage."""
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    rows = [{"AVG(val)__count": 3, "AVG(val)__max": 249.5}]
    result = _chart_data(
        1,
        "Distribution",
        viz="box_plot",
        rows=rows,
        query_results=(
            [
                ChartQueryResult(
                    query_index=0,
                    columns=list(rows[0]),
                    data=rows,
                    row_count=1,
                    total_rows=1,
                )
            ]
            if has_query_results
            else None
        ),
    )
    if with_metadata:
        from superset.mcp_service.chart.tool.get_chart_data import (
            _with_query_post_processing,
        )

        result = _with_query_post_processing(
            result,
            SimpleNamespace(
                queries=[
                    SimpleNamespace(
                        row_limit=fetch_row_limit,
                        post_processing=[{"operation": "boxplot"}],
                    )
                ]
            ),
        )
    summary = _summarize_chart_data(
        result,
        None,
        GetDashboardDataRequest(identifier=1, fetch_row_limit=fetch_row_limit),
    )

    assert summary.fetch_row_limit == fetch_row_limit
    assert summary.row_count == 1
    assert summary.total_rows is None
    assert summary.truncated is True
    assert summary.completeness_note is not None
    assert "input coverage is unverified" in summary.completeness_note
    assert "fetch_row_limit" in summary.completeness_note
    assert "Histogram bins" not in summary.completeness_note


@pytest.mark.asyncio
@pytest.mark.parametrize("saved", [False, True])
async def test_timeseries_groupby_pivot_does_not_claim_complete_input(
    monkeypatch: pytest.MonkeyPatch, saved: bool
) -> None:
    """A real pivot of 500 capped rows into 50 timestamps cannot prove coverage."""
    import importlib

    import pandas as pd

    from superset.mcp_service.chart.chart_helpers import (
        build_query_dicts_from_form_data,
    )
    from superset.mcp_service.chart.response_preflight import (
        finalize_chart_data_response,
    )
    from superset.mcp_service.chart.schemas import GetChartDataRequest
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )
    from superset.utils import pandas_postprocessing

    module = importlib.import_module("superset.mcp_service.chart.tool.get_chart_data")
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "sqlite",
    )
    form_data = {
        "viz_type": "echarts_timeseries_line",
        "datasource": "1__table",
        "datasource_id": 1,
        "datasource_type": "table",
        "x_axis": "event_time",
        "metrics": ["value"],
        "groupby": ["category"],
        "row_limit": 500,
    }
    queries = build_query_dicts_from_form_data(form_data, 1, "table")
    assert "pivot" in [step["operation"] for step in queries[0]["post_processing"]]
    context = SimpleNamespace(
        queries=[
            SimpleNamespace(
                **query, filter=[], time_range=None, to_dict=Mock(return_value=query)
            )
            for query in queries
        ],
        form_data=form_data,
    )
    rows = pd.DataFrame(
        [
            {"event_time": timestamp, "category": str(category), "value": 1}
            for timestamp in range(50)
            for category in range(10)
        ]
    )
    assert len(rows) == 500

    class Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None:
            """Use a mocked command boundary, without a database."""

        def run(self) -> dict[str, Any]:
            """Execute the generated pipeline against the capped input."""
            frame = rows.copy()
            for step in self.query_context.queries[0].post_processing:
                frame = getattr(pandas_postprocessing, step["operation"])(
                    frame, **step.get("options", {})
                )
            assert len(frame) == 50
            return {
                "queries": [
                    {
                        "data": frame.to_dict(orient="records"),
                        "colnames": list(frame.columns),
                        "coltypes": [0] * len(frame.columns),
                        "rowcount": len(frame),
                    }
                ]
            }

    monkeypatch.setattr(
        "superset.commands.chart.data.get_data_command.ChartDataCommand", Command
    )
    monkeypatch.setattr(
        module, "build_query_context_from_form_data", lambda *_a, **_kw: context
    )
    request = GetChartDataRequest(identifier=1, limit=500)
    if saved:
        chart = SimpleNamespace(
            id=1,
            slice_name="Grouped timeseries",
            viz_type=form_data["viz_type"],
            datasource_id=1,
            datasource_type="table",
            params=json.dumps(form_data),
            query_context=json.dumps(
                {
                    "datasource": {"id": 1, "type": "table"},
                    "queries": queries,
                    "form_data": form_data,
                    "result_type": "full",
                    "result_format": "json",
                }
            ),
        )
        monkeypatch.setattr(
            module, "find_chart_by_identifier", lambda *_a, **_kw: chart
        )
        monkeypatch.setattr(
            module,
            "validate_chart_dataset",
            lambda *_a, **_kw: SimpleNamespace(is_valid=True, warnings=[], error=None),
        )
        monkeypatch.setattr(
            "superset.charts.schemas.ChartDataQueryContextSchema.load",
            lambda *_a, **_kw: context,
        )
        result = await module.execute_chart_data(request, AsyncMock())
    else:
        result = await module._query_from_form_data(form_data, request, AsyncMock())
        result = finalize_chart_data_response(result)
    assert isinstance(result, ChartData), result
    summary = _summarize_chart_data(
        result, None, GetDashboardDataRequest(identifier=1, fetch_row_limit=500)
    )
    assert summary.row_count == 50
    assert summary.total_rows is None
    assert summary.truncated is True
    assert summary.fetch_row_limit == 500
    assert summary.completeness_note is not None
    assert "post-processing" in summary.completeness_note
    assert "fetch_row_limit" in summary.completeness_note


@pytest.mark.parametrize(
    "operation",
    [
        "aggregate",
        "boxplot",
        "histogram",
        "pivot",
        "prophet",
        "resample",
        "rolling",
        "custom_row_filter",
    ],
)
@pytest.mark.parametrize("collapsed_layer", [0, 1])
@pytest.mark.parametrize("empty_primary", [False, True])
def test_collapsing_operations_mark_each_query_input_unverified(
    operation: str, collapsed_layer: int, empty_primary: bool
) -> None:
    """Do not infer coverage from any layer's transformed output count."""
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    layers = [
        ChartQueryResult(
            query_index=index,
            columns=["value"],
            data=[{"value": 1}],
            row_count=1,
            total_rows=1,
        )
        for index in range(2)
    ]
    if empty_primary:
        layers[0] = ChartQueryResult(
            query_index=0, columns=["value"], data=[], row_count=0, total_rows=0
        )
    result = _chart_data(1, "Mixed", viz="mixed_timeseries", query_results=layers)
    result._query_post_processing = [[], []]
    result._query_post_processing[collapsed_layer] = [operation, "flatten"]
    summary = _summarize_chart_data(
        result, None, GetDashboardDataRequest(identifier=1, fetch_row_limit=500)
    )
    assert summary.truncated is True
    assert summary.queries is not None
    for index, layer in enumerate(summary.queries):
        assert layer.truncated is (index == collapsed_layer)
        expected_total = 0 if empty_primary and index == 0 else 1
        assert layer.total_rows == (
            None if index == collapsed_layer else expected_total
        )
    primary_index = 1 if empty_primary else 0
    assert summary.total_rows == (None if collapsed_layer == primary_index else 1)
    assert summary.completeness_note is not None
    assert "post-processing" in summary.completeness_note


@pytest.mark.parametrize(
    "operation",
    [
        "compare",
        "contribution",
        "cum",
        "diff",
        "flatten",
        "geodetic_parse",
        "geohash_decode",
        "geohash_encode",
        "rank",
        "rename",
        "select",
        "sort",
    ],
)
def test_row_preserving_operations_keep_completeness_checks(operation: str) -> None:
    """Column/value/index-only transforms do not invalidate retrieval row counts."""
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    result = _chart_data(1, "Rows", viz="echarts_timeseries_line")
    result._query_post_processing = [[operation]]
    summary = _summarize_chart_data(
        result, None, GetDashboardDataRequest(identifier=1, fetch_row_limit=500)
    )
    assert summary.total_rows == 1
    assert summary.truncated is False
    assert summary.completeness_note is not None
    assert "use row_count, total_rows" in summary.completeness_note
    assert "_query_post_processing" not in result.model_dump()


def test_post_processing_classification_covers_registry() -> None:
    """New registry operations require an explicit audit but default to caution."""
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _ROW_PRESERVING_OPERATIONS,
    )
    from superset.utils.pandas_postprocessing import OPERATIONS

    assert set(OPERATIONS) == _ROW_PRESERVING_OPERATIONS | {
        "aggregate",
        "boxplot",
        "histogram",
        "pivot",
        "prophet",
        "resample",
        "rolling",
    }


def test_executed_post_processing_metadata_tracks_all_queries() -> None:
    """The internal handoff preserves query positions and stays off the wire."""
    from superset.mcp_service.chart.response_preflight import (
        finalize_chart_data_response,
    )
    from superset.mcp_service.chart.tool.get_chart_data import (
        _with_query_post_processing,
    )

    result = _chart_data(1, "Mixed", viz="mixed_timeseries")
    context = SimpleNamespace(
        queries=[
            SimpleNamespace(row_limit=100, post_processing=[{"operation": "sort"}]),
            SimpleNamespace(
                row_limit=10,
                post_processing=[{"operation": "rolling"}, {"operation": "flatten"}],
            ),
        ]
    )
    response = finalize_chart_data_response(
        _with_query_post_processing(result, context)
    )
    assert isinstance(response, ChartData)
    assert response._query_post_processing == [["sort"], ["rolling", "flatten"]]
    assert response._query_row_limits == [100, 10]
    assert "_query_row_limits" not in response.model_dump()
    assert "_query_row_limits" not in ChartData.model_json_schema()["properties"]
    assert "_query_post_processing" not in response.model_dump()
    assert "_query_post_processing" not in ChartData.model_json_schema()["properties"]


@pytest.mark.parametrize("columns", [[], ["category"]])
def test_pivot_completeness_respects_groupby(columns: list[str]) -> None:
    """An ungrouped timeseries pivot preserves the twelve input timestamps."""
    from superset.mcp_service.chart.tool.get_chart_data import (
        _with_query_post_processing,
    )
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    result = _chart_data(
        1,
        "Monthly",
        viz="echarts_timeseries_line",
        rows=[{"month": i, "value": i} for i in range(12)],
    )
    context = SimpleNamespace(
        queries=[
            SimpleNamespace(
                row_limit=100,
                post_processing=[
                    {
                        "operation": "pivot",
                        "options": {"index": ["month"], "columns": columns},
                    },
                    {"operation": "flatten"},
                ],
            )
        ]
    )
    result = _with_query_post_processing(result, context)
    summary = _summarize_chart_data(result, None, GetDashboardDataRequest(identifier=1))
    assert summary.truncated is bool(columns)
    assert summary.total_rows == (None if columns else 12)


def test_completeness_uses_executed_limit() -> None:
    """A server cap below the requested fetch limit must remain visible."""
    from superset.mcp_service.chart.tool.get_chart_data import (
        _with_query_post_processing,
    )
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    result = _chart_data(1, "Capped", rows=[{"value": i} for i in range(10)])
    result = _with_query_post_processing(
        result,
        SimpleNamespace(queries=[SimpleNamespace(row_limit=10, post_processing=[])]),
    )
    summary = _summarize_chart_data(
        result, None, GetDashboardDataRequest(identifier=1, fetch_row_limit=100)
    )
    assert summary.fetch_row_limit == 10
    assert summary.total_rows is None
    assert summary.truncated is True


def test_dashboard_completeness_guidance_is_shared() -> None:
    """Long population guidance must appear once rather than on every chart."""
    from superset.mcp_service.dashboard.schemas import (
        DashboardData,
        GetDashboardDataRequest,
    )
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    result = _chart_data(1, "Distribution", viz="histogram", rows=[{"count": 10}])
    chart = _summarize_chart_data(result, None, GetDashboardDataRequest(identifier=1))
    response = DashboardData(
        dashboard_id=1,
        dashboard_name="Example",
        chart_count=30,
        charts_returned=30,
        charts=[chart] * 30,
    )
    assert response.model_dump_json().count("source aggregates") == 1
    assert "unverified" in response.completeness_note
    assert len(chart.completeness_note or "") < 150


def test_multi_query_completeness_uses_each_executed_limit() -> None:
    """A capped secondary query must not borrow the primary query's limit."""
    from superset.mcp_service.chart.tool.get_chart_data import (
        _with_query_post_processing,
    )
    from superset.mcp_service.dashboard.schemas import GetDashboardDataRequest
    from superset.mcp_service.dashboard.tool.get_dashboard_data import (
        _summarize_chart_data,
    )

    layers = [
        ChartQueryResult(
            query_index=i,
            columns=["value"],
            data=[{"value": 1}],
            row_count=1,
            total_rows=1,
        )
        for i in range(2)
    ]
    result = _chart_data(1, "Mixed", query_results=layers)
    result = _with_query_post_processing(
        result,
        SimpleNamespace(
            queries=[
                SimpleNamespace(row_limit=10, post_processing=[]),
                SimpleNamespace(row_limit=1, post_processing=[]),
            ]
        ),
    )
    summary = _summarize_chart_data(result, None, GetDashboardDataRequest(identifier=1))
    assert summary.fetch_row_limit == 10
    assert summary.truncated is True
    assert summary.queries is not None
    assert summary.queries[0].truncated is False
    assert summary.queries[1].truncated is True
    assert summary.queries[1].total_rows is None
