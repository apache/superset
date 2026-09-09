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

from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
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
