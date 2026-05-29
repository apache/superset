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

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard.schemas import (
    _extract_layout_from_position,
)
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json


def _wrapped(value: str) -> str:
    return f"{LLM_CONTEXT_OPEN_DELIMITER}\n{value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"


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
