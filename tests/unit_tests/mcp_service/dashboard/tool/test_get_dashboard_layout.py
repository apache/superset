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

"""Unit tests for the MCP get_dashboard_layout tool."""

from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client, FastMCP

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard.schemas import (
    _extract_layout_from_position,
)
from superset.utils import json


def _wrapped(value: str) -> str:
    return value


def _build_dashboard_mock(
    *,
    dashboard_id: int = 1,
    title: str = "Test Dashboard",
    uuid: str | None = "dashboard-uuid-1",
    position_json: str | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = dashboard_id
    dashboard.dashboard_title = title
    dashboard.uuid = uuid
    dashboard.position_json = position_json
    dashboard.slices = []
    return dashboard


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _simple_layout() -> str:
    return json.dumps(
        {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {
                "type": "ROOT",
                "id": "ROOT_ID",
                "children": ["GRID_ID"],
            },
            "GRID_ID": {
                "type": "GRID",
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "children": ["ROW-1"],
            },
            "ROW-1": {
                "type": "ROW",
                "id": "ROW-1",
                "parents": ["ROOT_ID", "GRID_ID"],
                "children": ["CHART-a"],
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
            },
            "CHART-a": {
                "type": "CHART",
                "id": "CHART-a",
                "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
                "children": [],
                "meta": {
                    "chartId": 42,
                    "sliceName": "Revenue Chart",
                    "width": 4,
                    "height": 50,
                },
            },
        }
    )


def _tabbed_layout() -> str:
    return json.dumps(
        {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {
                "type": "ROOT",
                "id": "ROOT_ID",
                "children": ["TABS-1"],
            },
            "TABS-1": {
                "type": "TABS",
                "id": "TABS-1",
                "parents": ["ROOT_ID"],
                "children": ["TAB-1", "TAB-2"],
                "meta": {},
            },
            "TAB-1": {
                "type": "TAB",
                "id": "TAB-1",
                "parents": ["ROOT_ID", "TABS-1"],
                "children": ["ROW-1"],
                "meta": {"text": "Overview"},
            },
            "ROW-1": {
                "type": "ROW",
                "id": "ROW-1",
                "parents": ["ROOT_ID", "TABS-1", "TAB-1"],
                "children": ["CHART-a"],
                "meta": {},
            },
            "CHART-a": {
                "type": "CHART",
                "id": "CHART-a",
                "parents": ["ROOT_ID", "TABS-1", "TAB-1", "ROW-1"],
                "children": [],
                "meta": {
                    "chartId": 10,
                    "sliceNameOverride": "Top KPIs",
                    "sliceName": "Top KPIs Source",
                    "width": 6,
                    "height": 40,
                },
            },
            "TAB-2": {
                "type": "TAB",
                "id": "TAB-2",
                "parents": ["ROOT_ID", "TABS-1"],
                "children": ["ROW-2"],
                "meta": {"text": "Details"},
            },
            "ROW-2": {
                "type": "ROW",
                "id": "ROW-2",
                "parents": ["ROOT_ID", "TABS-1", "TAB-2"],
                "children": ["CHART-b"],
                "meta": {},
            },
            "CHART-b": {
                "type": "CHART",
                "id": "CHART-b",
                "parents": ["ROOT_ID", "TABS-1", "TAB-2", "ROW-2"],
                "children": [],
                "meta": {
                    "chartId": 20,
                    "sliceName": "Detail Chart",
                    "width": 12,
                    "height": 60,
                },
            },
        }
    )


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_layout_basic(mock_find, mcp_server):
    mock_find.return_value = _build_dashboard_mock(position_json=_simple_layout())

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 1
    assert data["dashboard_title"] == _wrapped("Test Dashboard")
    assert data["uuid"] == "dashboard-uuid-1"
    assert data["has_layout"] is True
    assert data["tabs"] == []
    assert len(data["charts"]) == 1
    chart = data["charts"][0]
    assert chart["chart_id"] == 42
    assert chart["slice_name"] == _wrapped("Revenue Chart")
    assert chart["tab_id"] is None
    assert chart["tab_path"] == []
    assert chart["width"] == 4
    assert chart["height"] == 50


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_layout_tabbed(mock_find, mcp_server):
    mock_find.return_value = _build_dashboard_mock(
        title="Sales Overview", position_json=_tabbed_layout()
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["has_layout"] is True
    assert [t["id"] for t in data["tabs"]] == ["TAB-1", "TAB-2"]
    assert data["tabs"][0]["name"] == _wrapped("Overview")
    assert data["tabs"][0]["chart_ids"] == [10]
    assert data["tabs"][1]["name"] == _wrapped("Details")
    assert data["tabs"][1]["chart_ids"] == [20]

    charts_by_id = {c["chart_id"]: c for c in data["charts"]}
    assert charts_by_id[10]["slice_name"] == _wrapped("Top KPIs")
    assert charts_by_id[10]["tab_id"] == "TAB-1"
    assert charts_by_id[10]["tab_path"] == [_wrapped("Overview")]
    assert charts_by_id[20]["tab_id"] == "TAB-2"
    assert charts_by_id[20]["tab_path"] == [_wrapped("Details")]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_layout_empty(mock_find, mcp_server):
    mock_find.return_value = _build_dashboard_mock(position_json=None)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)

    assert data["has_layout"] is False
    assert data["tabs"] == []
    assert data["charts"] == []


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_layout_not_found(mock_find, mcp_server):
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 999}}
        )
        data = json.loads(result.content[0].text)

    assert data["error_type"] == "not_found"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
@pytest.mark.parametrize("options", [{}, {"tabs_only": True}, {"tab": "TAB-1"}])
@pytest.mark.asyncio
async def test_get_dashboard_layout_resolves_shared_permalink(
    mock_permalink, mock_find, mcp_server, options
):
    mock_permalink.return_value = (
        "shared-key",
        {
            "dashboardId": "42",
            "state": {
                "activeTabs": ["TAB-2"],
                "dataMask": {"FILTER-1": {"filterState": {"value": "EMEA"}}},
            },
        },
    )
    mock_find.return_value = _build_dashboard_mock(
        dashboard_id=42, position_json=_tabbed_layout()
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {
                "request": {
                    "identifier": "https://example.test/superset/dashboard/p/shared-key/",
                    **options,
                }
            },
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["permalink_key"] == "shared-key"
    assert data["is_permalink_state"] is True
    assert data["filter_state"]["activeTabs"] == [_wrapped("TAB-2")]
    assert mock_find.call_args_list[-1].args == (42,)


@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
@pytest.mark.asyncio
async def test_get_dashboard_layout_invalid_permalink_is_actionable(
    mock_permalink, mcp_server
):
    mock_permalink.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"permalink_key": "expired-key"}}
        )
        data = json.loads(result.content[0].text)

    assert data["error_type"] == "permalink_not_found"
    assert "fresh shared dashboard link" in data["error"]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
@pytest.mark.asyncio
async def test_get_dashboard_layout_identifier_takes_precedence_over_permalink(
    mock_permalink, mock_find, mcp_server
):
    mock_permalink.return_value = (
        "dashboard-20-key",
        {"dashboardId": "20", "state": {"activeTabs": ["TAB-20"]}},
    )
    mock_find.return_value = _build_dashboard_mock(
        dashboard_id=10, position_json=_tabbed_layout()
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 10, "permalink_key": "dashboard-20-key"}},
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 10
    assert data["is_permalink_state"] is False
    mock_find.assert_called_once_with(10, query_options=None)


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@patch("superset.mcp_service.dashboard.permalink.get_dashboard_permalink")
@pytest.mark.asyncio
async def test_get_dashboard_layout_permalink_with_uuid_dashboard_id(
    mock_permalink, mock_find, mcp_server
):
    """CreateDashboardPermalinkCommand stores dashboardId as the dashboard UUID,
    so an explicit identifier plus that permalink must still yield filter state.
    """
    dashboard_uuid = "3f1a2b6c-9d4e-4f80-9c2a-7b1d5e6f8a90"
    mock_permalink.return_value = (
        "uuid-key",
        {"dashboardId": dashboard_uuid, "state": {"activeTabs": ["TAB-2"]}},
    )
    mock_find.return_value = _build_dashboard_mock(
        dashboard_id=42, uuid=dashboard_uuid, position_json=_tabbed_layout()
    )

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 42, "permalink_key": "uuid-key"}},
        )
        data = json.loads(result.content[0].text)

    assert data["id"] == 42
    assert data["is_permalink_state"] is True
    assert data["permalink_key"] == "uuid-key"
    assert data["filter_state"]["activeTabs"] == [_wrapped("TAB-2")]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@patch(
    "superset.mcp_service.dashboard.permalink.get_dashboard_permalink",
    return_value=None,
)
@pytest.mark.asyncio
async def test_get_dashboard_layout_unknown_slug_keeps_not_found_error(
    mock_permalink, mock_find, mcp_server
):
    """A plain slug typo keeps its own not-found error instead of asking the
    user for a shared link they never mentioned.
    """
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": "sales-dashbord"}}
        )
        data = json.loads(result.content[0].text)

    assert data["error_type"] == "not_found"
    assert "sales-dashbord" in data["error"]
    assert "fresh shared dashboard link" not in data["error"]


def test_extract_layout_handles_invalid_json():
    tabs, charts = _extract_layout_from_position("{ not json")
    assert tabs == []
    assert charts == []


def test_extract_layout_handles_missing_root():
    tabs, charts = _extract_layout_from_position(json.dumps({"FOO": {"type": "ROW"}}))
    assert tabs == []
    assert charts == []


def test_get_dashboard_info_omitted_fields_references_layout_tool():
    """The position_json omission message must point agents at get_dashboard_layout."""
    from superset.mcp_service.dashboard.schemas import _build_omitted_fields

    omitted = _build_omitted_fields(
        json_metadata_str=None, position_json_str='{"ROOT_ID": {}}'
    )
    assert "get_dashboard_layout" in omitted["position_json"]


@pytest.fixture
def large_tabbed_layout() -> str:
    """Generate 114 nested tabs and 404 charts without storing a large fixture."""
    position: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "children": ["TABS-root"]},
        "TABS-root": {
            "type": "TABS",
            "children": [f"TAB-group-{i}" for i in range(14)],
        },
    }
    for group in range(14):
        position[f"TAB-group-{group}"] = {
            "type": "TAB",
            "meta": {"text": f"Group {group}"},
            "children": [f"TABS-group-{group}"],
        }
        position[f"TABS-group-{group}"] = {
            "type": "TABS",
            "children": [f"TAB-leaf-{i}" for i in range(group, 100, 14)],
        }
    for leaf in range(100):
        position[f"TAB-leaf-{leaf}"] = {
            "type": "TAB",
            "meta": {"text": f"Detail {leaf}"},
            "children": [f"CHART-{i}" for i in range(leaf * 4, leaf * 4 + 4)],
        }
    position["ROW-shared"] = {
        "type": "ROW",
        "children": [f"CHART-{i}" for i in range(400, 404)],
    }
    position["ROOT_ID"]["children"].append("ROW-shared")
    for chart in range(404):
        position[f"CHART-{chart}"] = {
            "type": "CHART",
            "meta": {
                "chartId": chart,
                "sliceName": f"Chart {chart}: " + "Detailed metric description " * 12,
                "width": 6,
                "height": 40,
            },
        }
    return json.dumps(position)


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_tabs_only_large_tree(
    mock_find: Mock, mcp_server: FastMCP, large_tabbed_layout: str
) -> None:
    """All tabs fit comfortably under the guard without any chart positions."""
    from fastmcp.tools.tool import ToolResult

    from superset.mcp_service.utils.response_size_utils import get_response_size_bytes

    mock_find.return_value = _build_dashboard_mock(position_json=large_tabbed_layout)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tabs_only": True}}
        )
    data = json.loads(result.content[0].text)
    assert len(data["tabs"]) == 114
    assert data["charts"] == []
    tabs = {tab["id"]: tab for tab in data["tabs"]}
    assert tabs["TAB-group-0"] == {
        "id": "TAB-group-0",
        "name": "Group 0",
        "parent_tab_id": None,
        "depth": 0,
        "chart_count": 32,
    }
    assert tabs["TAB-leaf-0"] == {
        "id": "TAB-leaf-0",
        "name": "Detail 0",
        "parent_tab_id": "TAB-group-0",
        "depth": 1,
        "chart_count": 4,
    }
    assert all("chart_ids" not in tab for tab in data["tabs"])
    # Master guards exact UTF-8 bytes; also bound the legacy bytes/4 estimate.
    response_bytes = get_response_size_bytes(ToolResult(content=result.content))
    assert response_bytes < 25_000
    assert response_bytes / 4 < 20_000 / 3


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize("tab", ["TAB-group-0", "Group 0", "TAB-leaf-0", "Detail 0"])
@pytest.mark.asyncio
async def test_layout_tab_filter_large_tree(
    mock_find: Mock, mcp_server: FastMCP, large_tabbed_layout: str, tab: str
) -> None:
    """IDs and exact titles select only a tab and its descendants."""
    mock_find.return_value = _build_dashboard_mock(position_json=large_tabbed_layout)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": tab}}
        )
    data = json.loads(result.content[0].text)
    leaves = range(0, 100, 14) if tab in ("TAB-group-0", "Group 0") else [0]
    expected_chart_ids = {leaf * 4 + offset for leaf in leaves for offset in range(4)}
    assert {chart["chart_id"] for chart in data["charts"]} == expected_chart_ids
    assert len(data["tabs"]) == (9 if len(expected_chart_ids) == 32 else 1)
    assert all(
        chart["width"] == 6 and chart["height"] == 40 for chart in data["charts"]
    )
    assert data["charts"][0]["tab_path"] == ["Group 0", "Detail 0"]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_default_response_unchanged(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """Omitting scope options preserves the complete existing response shape."""
    dashboard = _build_dashboard_mock(position_json=_tabbed_layout())
    mock_find.return_value = dashboard
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1}}
        )
    assert json.loads(result.content[0].text) == {
        "id": 1,
        "dashboard_title": "Test Dashboard",
        "uuid": "dashboard-uuid-1",
        "has_layout": True,
        "permalink_key": None,
        "filter_state": None,
        "is_permalink_state": False,
        "tabs": [
            {
                "id": "TAB-1",
                "name": "Overview",
                "parent_tab_id": None,
                "chart_ids": [10],
            },
            {
                "id": "TAB-2",
                "name": "Details",
                "parent_tab_id": None,
                "chart_ids": [20],
            },
        ],
        "charts": [
            {
                "chart_id": 10,
                "slice_name": "Top KPIs",
                "tab_id": "TAB-1",
                "tab_path": ["Overview"],
                "width": 6,
                "height": 40,
            },
            {
                "chart_id": 20,
                "slice_name": "Detail Chart",
                "tab_id": "TAB-2",
                "tab_path": ["Details"],
                "width": 12,
                "height": 60,
            },
        ],
    }


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_tabs_only_with_filter(
    mock_find: Mock, mcp_server: FastMCP, large_tabbed_layout: str
) -> None:
    """Summary mode composes with tab scoping and keeps absolute depth."""
    mock_find.return_value = _build_dashboard_mock(position_json=large_tabbed_layout)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 1, "tabs_only": True, "tab": "Detail 0"}},
        )
    data = json.loads(result.content[0].text)
    assert data["charts"] == []
    assert len(data["tabs"]) == 1
    assert data["tabs"][0]["depth"] == 1
    assert data["tabs"][0]["parent_tab_id"] == "TAB-group-0"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize(
    "tab, error_type", [("Missing", "tab_not_found"), ("Same", "ambiguous_tab")]
)
@pytest.mark.asyncio
async def test_layout_tab_filter_errors(
    mock_find: Mock, mcp_server: FastMCP, tab: str, error_type: str
) -> None:
    """Do not silently choose among duplicate titles or fall back to a full layout."""
    position = json.loads(_tabbed_layout())
    position["TAB-1"]["meta"]["text"] = "Same"
    position["TAB-2"]["meta"]["text"] = "Same"
    mock_find.return_value = _build_dashboard_mock(position_json=json.dumps(position))
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": tab}}
        )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == error_type
    assert "tabs_only" in data["error"]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_tab_id_precedes_title_and_filters_placements(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """A chart reused in another tab must not leak that tab's placement."""
    position = json.loads(_tabbed_layout())
    position["TAB-2"]["meta"]["text"] = "TAB-1"
    position["CHART-b"]["meta"]["chartId"] = 10
    mock_find.return_value = _build_dashboard_mock(position_json=json.dumps(position))
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": "TAB-1"}}
        )
    data = json.loads(result.content[0].text)
    assert [tab["id"] for tab in data["tabs"]] == ["TAB-1"]
    assert len(data["charts"]) == 1
    assert data["charts"][0]["tab_id"] == "TAB-1"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize("position", [None, "{}", "invalid", _simple_layout()])
@pytest.mark.asyncio
async def test_layout_tabs_only_without_tabs(
    mock_find: Mock, mcp_server: FastMCP, position: str | None
) -> None:
    """Untabbed and malformed layouts have no summary entries or positions."""
    mock_find.return_value = _build_dashboard_mock(position_json=position)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tabs_only": True}}
        )
    data = json.loads(result.content[0].text)
    assert data["tabs"] == []
    assert data["charts"] == []


@pytest.mark.parametrize("tab", ["", "   "])
def test_layout_rejects_blank_tab(tab: str) -> None:
    """A blank tab selector is not an implicit full-layout request."""
    from pydantic import ValidationError

    from superset.mcp_service.dashboard.schemas import GetDashboardLayoutRequest

    with pytest.raises(ValidationError, match="tab must not be blank"):
        GetDashboardLayoutRequest(identifier=1, tab=tab)


@pytest.mark.asyncio
async def test_layout_oversized_guard_hint(large_tabbed_layout: str) -> None:
    """The real guard points oversized layout callers at supported scope options."""
    from unittest.mock import AsyncMock

    from fastmcp.exceptions import ToolError
    from fastmcp.tools.tool import ToolResult
    from mcp.types import TextContent

    from superset.mcp_service.dashboard.schemas import dashboard_layout_serializer
    from superset.mcp_service.middleware import ResponseSizeGuardMiddleware
    from superset.mcp_service.utils.response_size_utils import get_response_size_bytes

    layout = dashboard_layout_serializer(
        _build_dashboard_mock(position_json=large_tabbed_layout)
    )
    assert len(layout.tabs) == 114
    assert len(layout.charts) == 404
    response = ToolResult(
        content=[TextContent(type="text", text=layout.model_dump_json())]
    )
    assert get_response_size_bytes(response) > 80_000
    middleware = ResponseSizeGuardMiddleware(max_bytes=80_000)
    context = Mock()
    context.message.name = "get_dashboard_layout"
    context.message.arguments = {"request": {"identifier": 1}}
    with (
        patch("superset.mcp_service.middleware.get_user_id", return_value=1),
        patch("superset.mcp_service.middleware.event_logger"),
        pytest.raises(ToolError) as exc_info,
    ):
        await middleware.on_call_tool(context, AsyncMock(return_value=response))
    message = str(exc_info.value)
    assert "Response too large" in message
    assert "tabs_only=true" in message
    assert 'tab="<ID or title>"' in message


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize("tabs_only", [False, True])
@pytest.mark.asyncio
async def test_layout_empty_tab(
    mock_find: Mock, mcp_server: FastMCP, tabs_only: bool
) -> None:
    """A valid empty tab remains discoverable and can be selected."""
    position = json.loads(_tabbed_layout())
    position["TAB-1"]["children"] = []
    mock_find.return_value = _build_dashboard_mock(position_json=json.dumps(position))
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 1, "tab": "TAB-1", "tabs_only": tabs_only}},
        )
    data = json.loads(result.content[0].text)
    assert data["charts"] == []
    assert len(data["tabs"]) == 1
    if tabs_only:
        assert data["tabs"][0]["chart_count"] == 0
    else:
        assert data["tabs"][0]["chart_ids"] == []
