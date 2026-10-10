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
    # The explicit scope applies on top of the preserved permalink state, even
    # when it selects a tab other than the permalink's active tab.
    if options.get("tabs_only"):
        assert data["scope"] == {
            "tabs_only": True,
            "tab_id": None,
            "untabbed_only": False,
        }
        assert [tab["id"] for tab in data["tab_tree"]] == ["TAB-1", "TAB-2"]
        assert data["charts"] == []
    elif options.get("tab"):
        assert data["scope"] == {
            "tabs_only": False,
            "tab_id": "TAB-1",
            "untabbed_only": False,
        }
        assert [tab["id"] for tab in data["tabs"]] == ["TAB-1"]
        assert [chart["chart_id"] for chart in data["charts"]] == [10]
    else:
        assert data["scope"] is None
        assert [chart["chart_id"] for chart in data["charts"]] == [10, 20]


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
    assert len(data["tab_tree"]) == 114
    assert data["tabs"] == []
    assert data["charts"] == []
    assert data["untabbed_chart_count"] == 4
    assert data["scope"] == {"tabs_only": True, "tab_id": None, "untabbed_only": False}
    tabs = {tab["id"]: tab for tab in data["tab_tree"]}
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
    assert all("chart_ids" not in tab for tab in data["tab_tree"])
    # Master guards exact UTF-8 bytes; also bound the legacy bytes/4 estimate.
    response_bytes = get_response_size_bytes(ToolResult(content=result.content))
    assert response_bytes < 25_000
    assert response_bytes / 4 < 20_000 / 3


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize(
    "tab, tab_id",
    [
        ("TAB-group-0", "TAB-group-0"),
        ("Group 0", "TAB-group-0"),
        ("TAB-leaf-0", "TAB-leaf-0"),
        ("Detail 0", "TAB-leaf-0"),
    ],
)
@pytest.mark.asyncio
async def test_layout_tab_filter_large_tree(
    mock_find: Mock,
    mcp_server: FastMCP,
    large_tabbed_layout: str,
    tab: str,
    tab_id: str,
) -> None:
    """IDs and exact titles select only a tab and its descendants."""
    mock_find.return_value = _build_dashboard_mock(position_json=large_tabbed_layout)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": tab}}
        )
    data = json.loads(result.content[0].text)
    leaves = range(0, 100, 14) if tab_id == "TAB-group-0" else [0]
    expected_chart_ids = {leaf * 4 + offset for leaf in leaves for offset in range(4)}
    assert {chart["chart_id"] for chart in data["charts"]} == expected_chart_ids
    assert len(data["tabs"]) == (9 if len(expected_chart_ids) == 32 else 1)
    assert all(
        chart["width"] == 6 and chart["height"] == 40 for chart in data["charts"]
    )
    assert data["charts"][0]["tab_path"] == ["Group 0", "Detail 0"]
    assert data["scope"] == {
        "tabs_only": False,
        "tab_id": tab_id,
        "untabbed_only": False,
    }
    assert data["tab_tree"] == []


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
        "tab_tree": [],
        "untabbed_chart_count": 0,
        "scope": None,
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
    assert data["tabs"] == []
    assert len(data["tab_tree"]) == 1
    assert data["tab_tree"][0]["depth"] == 1
    assert data["tab_tree"][0]["parent_tab_id"] == "TAB-group-0"
    assert data["scope"] == {
        "tabs_only": True,
        "tab_id": "TAB-leaf-0",
        "untabbed_only": False,
    }


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
    """Tab discovery without tabs offers recovery instead of an empty layout."""
    mock_find.return_value = _build_dashboard_mock(position_json=position)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tabs_only": True}}
        )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "tab_not_found"
    assert "no tabs" in data["error"]
    assert "untabbed_only=true" in data["error"]
    assert "full layout" in data["error"]
    assert "charts" not in data


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize("tab", ["", "   "])
@pytest.mark.asyncio
async def test_layout_rejects_blank_tab(
    mock_find: Mock, mcp_server: FastMCP, tab: str
) -> None:
    """Blank selectors return actionable errors through the MCP client."""
    mock_find.return_value = _build_dashboard_mock(position_json=_tabbed_layout())
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": tab}}
        )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "tab_not_found"
    assert "tab must not be blank" in data["error"]
    assert "tabs_only=true" in data["error"]
    assert "charts" not in data


def _mixed_layout() -> str:
    """A ROOT/GRID layout with one chart in a ROW above the tabs."""
    position = json.loads(_tabbed_layout())
    position["ROOT_ID"]["children"] = ["GRID_ID"]
    position["GRID_ID"] = {
        "type": "GRID",
        "id": "GRID_ID",
        "parents": ["ROOT_ID"],
        "children": ["ROW-top", "TABS-1"],
    }
    position["ROW-top"] = {
        "type": "ROW",
        "id": "ROW-top",
        "parents": ["ROOT_ID", "GRID_ID"],
        "children": ["CHART-u"],
        "meta": {},
    }
    position["CHART-u"] = {
        "type": "CHART",
        "id": "CHART-u",
        "parents": ["ROOT_ID", "GRID_ID", "ROW-top"],
        "children": [],
        "meta": {"chartId": 30, "sliceName": "Headline KPI", "width": 12},
    }
    return json.dumps(position)


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_untabbed_charts_are_reachable(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """Charts outside every tab are counted in every scope and selectable alone."""
    mock_find.return_value = _build_dashboard_mock(position_json=_mixed_layout())
    async with Client(mcp_server) as client:
        full = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_layout", {"request": {"identifier": 1}}
                )
            )
            .content[0]
            .text
        )
        summary = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_layout",
                    {"request": {"identifier": 1, "tabs_only": True}},
                )
            )
            .content[0]
            .text
        )
        untabbed = json.loads(
            (
                await client.call_tool(
                    "get_dashboard_layout",
                    {"request": {"identifier": 1, "untabbed_only": True}},
                )
            )
            .content[0]
            .text
        )

    assert {chart["chart_id"] for chart in full["charts"]} == {10, 20, 30}
    assert full["untabbed_chart_count"] == 1
    assert summary["untabbed_chart_count"] == 1
    assert [tab["id"] for tab in summary["tab_tree"]] == ["TAB-1", "TAB-2"]
    assert untabbed["untabbed_chart_count"] == 1
    assert untabbed["tabs"] == []
    assert untabbed["scope"] == {
        "tabs_only": False,
        "tab_id": None,
        "untabbed_only": True,
    }
    assert untabbed["charts"] == [
        {
            "chart_id": 30,
            "slice_name": "Headline KPI",
            "tab_id": None,
            "tab_path": [],
            "width": 12,
            "height": None,
        }
    ]
    # Scoping only removes placements; it never adds one the full layout lacks.
    assert all(chart in full["charts"] for chart in untabbed["charts"])


def test_layout_untabbed_count_is_distinct_charts() -> None:
    """untabbed_chart_count counts distinct charts; untabbed_only lists placements."""
    from superset.mcp_service.utils.response_size_utils import (
        format_size_limit_error,
    )

    position = json.loads(_mixed_layout())
    position["ROW-top"]["children"] = ["CHART-u", "CHART-u2", "CHART-none"]
    position["CHART-u2"] = {
        **position["CHART-u"],
        "id": "CHART-u2",
    }
    position["CHART-none"] = {
        "type": "CHART",
        "id": "CHART-none",
        "parents": ["ROOT_ID", "GRID_ID", "ROW-top"],
        "children": [],
        "meta": {"sliceName": "Unsaved"},
    }
    position_json = json.dumps(position)

    full = _scoped_payload(position_json)
    untabbed = _scoped_payload(position_json, untabbed_only=True)
    assert full["untabbed_chart_count"] == 1
    assert [chart["chart_id"] for chart in untabbed["charts"]] == [30, 30, None]

    message = format_size_limit_error(
        tool_name="get_dashboard_layout",
        params={"request": {"identifier": 1}},
        actual_bytes=200_000,
        max_bytes=100_000,
        response=full,
    )
    assert "outside every tab (1 distinct chart)." in message


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_untabbed_only_on_untabbed_dashboard(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """On a dashboard without tabs, untabbed_only is the full chart list."""
    mock_find.return_value = _build_dashboard_mock(position_json=_simple_layout())
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 1, "untabbed_only": True}},
        )
    data = json.loads(result.content[0].text)
    assert [chart["chart_id"] for chart in data["charts"]] == [42]
    assert data["untabbed_chart_count"] == 1


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_tab_on_untabbed_dashboard_does_not_loop(
    mock_find: Mock, mcp_server: FastMCP
) -> None:
    """Selecting a tab on an untabbed dashboard must not point back at tabs_only."""
    mock_find.return_value = _build_dashboard_mock(position_json=_simple_layout())
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout", {"request": {"identifier": 1, "tab": "TAB-1"}}
        )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "tab_not_found"
    assert "no tabs" in data["error"]
    assert "tabs_only" not in data["error"]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.parametrize(
    "options", [{"tabs_only": True}, {"tab": "TAB-1"}, {"tab": "X", "tabs_only": True}]
)
@pytest.mark.asyncio
async def test_layout_rejects_untabbed_only_with_tab_options(
    mock_find: Mock, mcp_server: FastMCP, options: dict[str, Any]
) -> None:
    """Conflicting scopes reach the client as actionable errors, not validation text."""
    mock_find.return_value = _build_dashboard_mock(position_json=_mixed_layout())
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 1, "untabbed_only": True, **options}},
        )
    data = json.loads(result.content[0].text)
    assert data["error_type"] == "invalid_scope"
    assert "untabbed_only cannot be combined" in data["error"]
    assert "Drop tab and tabs_only" in data["error"]
    assert "drop untabbed_only" in data["error"]
    assert "charts" not in data


def _scoped_payload(position_json: str, **options: Any) -> dict[str, Any]:
    from superset.mcp_service.dashboard.schemas import (
        dashboard_layout_serializer,
        DashboardLayout,
        GetDashboardLayoutRequest,
    )
    from superset.mcp_service.dashboard.tool.get_dashboard_layout import (
        _scope_layout,
    )

    layout = _scope_layout(
        dashboard_layout_serializer(_build_dashboard_mock(position_json=position_json)),
        GetDashboardLayoutRequest(identifier=1, **options),
    )
    assert isinstance(layout, DashboardLayout)
    return layout.model_dump(mode="json")


@pytest.mark.parametrize(
    "layout_name, options, expected, unexpected",
    [
        (
            "large",
            {},
            [
                "tabs_only=true",
                'tab="<ID or title>"',
                "untabbed_only=true",
                "outside every tab (4 distinct charts)",
            ],
            [],
        ),
        (
            "tabbed",
            {},
            ["tabs_only=true", 'tab="<ID or title>"'],
            ["untabbed_only"],
        ),
        (
            "simple",
            {},
            ["no tabs", "list_charts", "'dashboards'", "value: 1"],
            ["tabs_only=true", "untabbed_only"],
        ),
        (
            "large",
            {"tabs_only": True},
            ["Keep tabs_only=true", '"TAB-group-0"', '"TAB-group-4", ...'],
            ["TAB-leaf"],
        ),
        (
            "large",
            {"tab": "TAB-group-0"},
            ['"TAB-leaf-0"', "nested tab ID", "Add tabs_only=true"],
            ["no nested tabs"],
        ),
        (
            "large",
            {"tab": "TAB-group-0", "tabs_only": True},
            ['"TAB-leaf-0"', "nested tab ID"],
            ["Add tabs_only=true", "no nested tabs"],
        ),
        (
            "large",
            {"tab": "TAB-leaf-0"},
            ["no nested tabs", "tab cannot narrow it", "list_charts"],
            ["Pass a nested tab ID", 'tab="<ID or title>"'],
        ),
        (
            "large",
            {"tab": "Detail 0", "tabs_only": True},
            ["no nested tabs", "cannot be narrowed further by tab"],
            ["Pass a nested tab ID", "Keep tabs_only=true"],
        ),
        (
            "mixed",
            {"untabbed_only": True},
            ["cannot be narrowed further", "list_charts"],
            ["tabs_only=true", "Pass a nested tab ID"],
        ),
    ],
)
def test_layout_oversized_hint_follows_scope(
    large_tabbed_layout: str,
    layout_name: str,
    options: dict[str, Any],
    expected: list[str],
    unexpected: list[str],
) -> None:
    """Each oversized scope suggests only a narrower scope that actually exists."""
    from superset.mcp_service.utils.response_size_utils import (
        format_size_limit_error,
    )

    position_json = {
        "large": large_tabbed_layout,
        "tabbed": _tabbed_layout(),
        "simple": _simple_layout(),
        "mixed": _mixed_layout(),
    }[layout_name]
    message = format_size_limit_error(
        tool_name="get_dashboard_layout",
        params={"request": {"identifier": 1, **options}},
        actual_bytes=200_000,
        max_bytes=100_000,
        response=_scoped_payload(position_json, **options),
    )
    for text in expected:
        assert text in message
    for text in unexpected:
        assert text not in message


@pytest.mark.parametrize(
    "options, expected",
    [
        ({}, ["tabs_only=true", "untabbed_only=true", "outside every tab."]),
        ({"tabs_only": True}, ['pass tab="<top-level tab ID>"']),
        ({"tab": "TAB-1"}, ["If this tab has nested tabs", "list_charts"]),
        ({"untabbed_only": True}, ["cannot be narrowed further"]),
    ],
)
def test_layout_oversized_hint_without_payload(
    options: dict[str, Any], expected: list[str]
) -> None:
    """When the payload is unavailable, the hint relies on the request alone."""
    from superset.mcp_service.utils.response_size_utils import (
        format_size_limit_error,
    )

    message = format_size_limit_error(
        tool_name="get_dashboard_layout",
        params={"request": {"identifier": 1, **options}},
        actual_bytes=200_000,
        max_bytes=100_000,
    )
    for text in expected:
        assert text in message


@pytest.mark.parametrize(
    "layout_name, expected, unexpected",
    [
        ("large", ["tabs_only=true", 'tab="<ID or title>"'], ["no tabs"]),
        ("simple", ["no tabs", "list_charts"], ["tabs_only=true"]),
    ],
)
@pytest.mark.asyncio
async def test_layout_oversized_guard_hint(
    large_tabbed_layout: str,
    layout_name: str,
    expected: list[str],
    unexpected: list[str],
) -> None:
    """The real guard hands the blocked layout to the hint, so it knows the tabs."""
    from unittest.mock import AsyncMock

    from fastmcp.exceptions import ToolError
    from fastmcp.tools.tool import ToolResult
    from mcp.types import TextContent

    from superset.mcp_service.dashboard.schemas import dashboard_layout_serializer
    from superset.mcp_service.middleware import ResponseSizeGuardMiddleware

    position_json = large_tabbed_layout if layout_name == "large" else _simple_layout()
    layout = dashboard_layout_serializer(
        _build_dashboard_mock(position_json=position_json)
    )
    response = ToolResult(
        content=[TextContent(type="text", text=layout.model_dump_json())]
    )
    middleware = ResponseSizeGuardMiddleware(max_bytes=100)
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
    for text in expected:
        assert text in message
    for text in unexpected:
        assert text not in message


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_layout_logs_scoped_counts(
    mock_find: Mock, mcp_server: FastMCP, large_tabbed_layout: str
) -> None:
    """The retrieval log reports what was returned, not the unscoped layout."""
    mock_find.return_value = _build_dashboard_mock(position_json=large_tabbed_layout)
    messages: list[str] = []

    async def log_handler(message: Any) -> None:
        data = message.data
        messages.append(data.get("msg", "") if isinstance(data, dict) else str(data))

    async with Client(mcp_server, log_handler=log_handler) as client:
        await client.call_tool(
            "get_dashboard_layout",
            {"request": {"identifier": 1, "tab": "TAB-leaf-0"}},
        )
    retrieved = [m for m in messages if "Dashboard layout retrieved" in m]
    assert len(retrieved) == 1
    assert "tab_count=1," in retrieved[0]
    assert "chart_count=4," in retrieved[0]
    assert "'tab_id': 'TAB-leaf-0'" in retrieved[0]


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
    if tabs_only:
        assert len(data["tab_tree"]) == 1
        assert data["tab_tree"][0]["chart_count"] == 0
    else:
        assert len(data["tabs"]) == 1
        assert data["tabs"][0]["chart_ids"] == []
