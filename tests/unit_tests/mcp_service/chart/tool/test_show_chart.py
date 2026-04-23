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

"""
Unit tests for the ``show_chart`` MCP tool.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.utils import json


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture
def mock_chart():
    chart = MagicMock()
    chart.id = 42
    chart.uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    chart.slice_name = "Sales by region"
    chart.viz_type = "bar"
    chart.datasource_id = 7
    chart.datasource_type = "table"
    chart.params = json.dumps({"viz_type": "bar", "metrics": ["count"]})
    return chart


@pytest.mark.asyncio
async def test_show_chart_tool_registered(mcp_server):
    """The ``show_chart`` tool should register with the MCP server."""
    tools = await mcp_server.list_tools()
    names = {t.name for t in tools}
    assert "show_chart" in names


@pytest.mark.asyncio
async def test_show_chart_declares_ui_resource(mcp_server):
    """The tool should advertise the ``ui://superset/chart-viewer`` resource."""
    tool = await mcp_server.get_tool("show_chart")
    meta = getattr(tool, "meta", None) or {}
    assert meta.get("ui", {}).get("resourceUri") == "ui://superset/chart-viewer"


@pytest.mark.asyncio
async def test_show_chart_not_found(mcp_server):
    """When the identifier doesn't resolve to a chart, return a structured error."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "nope"}}
            )
    data = json.loads(result.content[0].text)
    assert data["error"] == "Chart not found: nope"
    assert data["chart_id"] == 0
    assert data["explore_url"] == ""


@pytest.mark.asyncio
async def test_show_chart_access_denied(mcp_server, mock_chart):
    """When the user cannot access the chart, return a structured error."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        mock_sm.can_access_chart.return_value = False
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "42"}}
            )
    data = json.loads(result.content[0].text)
    assert data["error"] == "You do not have access to this chart"
    assert data["chart_id"] == 42
    assert data["guest_token"] == ""


@pytest.mark.asyncio
async def test_show_chart_success_no_overrides(mcp_server, mock_chart):
    """Happy path: mints a guest token and returns an explore URL with slice_id."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
    ):
        mock_sm.can_access_chart.return_value = True
        mock_sm.create_guest_access_token.return_value = b"signed.jwt.token"
        mock_sm.parse_jwt_guest_token.return_value = {"exp": 1234567890.0}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart", {"request": {"identifier": "42"}}
            )

    data = json.loads(result.content[0].text)
    assert data["error"] is None
    assert data["chart_id"] == 42
    assert data["chart_uuid"] == str(mock_chart.uuid)
    assert data["viz_type"] == "bar"
    assert data["guest_token"] == "signed.jwt.token"  # noqa: S105
    assert data["expires_at"] == 1234567890.0
    assert data["form_data_key"] is None
    assert "slice_id=42" in data["explore_url"]
    assert "standalone=1" in data["explore_url"]
    assert "guest_token=signed.jwt.token" in data["explore_url"]

    # Sanity-check: resources claim scoped to this chart's uuid
    call_kwargs = mock_sm.create_guest_access_token.call_args.kwargs
    assert call_kwargs["resources"] == [{"type": "chart", "id": str(mock_chart.uuid)}]
    assert call_kwargs["rls"] == []


@pytest.mark.asyncio
async def test_show_chart_success_with_overrides(mcp_server, mock_chart):
    """With overrides, a form_data_key is cached and embedded in the URL."""
    with (
        patch(
            "superset.mcp_service.chart.tool.show_chart.find_chart_by_identifier",
            return_value=mock_chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.security_manager",
            new_callable=MagicMock,
        ) as mock_sm,
        patch(
            "superset.mcp_service.chart.tool.show_chart.get_superset_base_url",
            return_value="http://superset.test",
        ),
        patch(
            "superset.mcp_service.chart.tool.show_chart.generate_explore_link",
            return_value="http://superset.test/explore/?form_data_key=CACHEKEY",
        ),
    ):
        mock_sm.can_access_chart.return_value = True
        mock_sm.create_guest_access_token.return_value = "tok"
        mock_sm.parse_jwt_guest_token.return_value = {"exp": 1.0}

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "show_chart",
                {
                    "request": {
                        "identifier": "42",
                        "overrides": {"time_range": "Last week"},
                    }
                },
            )

    data = json.loads(result.content[0].text)
    assert data["error"] is None
    assert data["form_data_key"] == "CACHEKEY"
    assert "form_data_key=CACHEKEY" in data["explore_url"]
