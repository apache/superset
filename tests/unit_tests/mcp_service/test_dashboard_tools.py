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
Unit tests for MCP dashboard tools (list_dashboards, get_dashboard_info,
get_dashboard_available_filters)
"""

import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.mcp_app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_basic(mock_list, mcp_server):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = "test-dashboard"
    dashboard.url = "/dashboard/1"
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.owners = []
    dashboard.slices = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "owners": dashboard.owners,
        "charts": [],
    }
    mock_list.return_value = ([dashboard], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_dashboards", {"page": 1, "page_size": 10})
        dashboards = result.data.dashboards
        assert len(dashboards) == 1
        assert dashboards[0].dashboard_title == "Test Dashboard"
        assert dashboards[0].published is True


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_with_filters(mock_list, mcp_server):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Filtered Dashboard"
    dashboard.slug = "filtered-dashboard"
    dashboard.url = "/dashboard/2"
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.owners = []
    dashboard.slices = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "owners": dashboard.owners,
        "charts": [],
    }
    mock_list.return_value = ([dashboard], 1)
    async with Client(mcp_server) as client:
        filters = [
            {"col": "dashboard_title", "opr": "sw", "value": "Sales"},
            {"col": "published", "opr": "eq", "value": True},
        ]
        result = await client.call_tool(
            "list_dashboards",
            {
                "filters": filters,
                "select_columns": ["id", "dashboard_title"],
                "order_column": "changed_on",
                "order_direction": "desc",
                "page": 1,
                "page_size": 50,
            },
        )
        assert result.data.count == 1
        assert result.data.dashboards[0].dashboard_title == "Filtered Dashboard"


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_with_string_filters(mock_list, mcp_server):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "String Filter Dashboard"
    dashboard.slug = "string-filter-dashboard"
    dashboard.url = "/dashboard/3"
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.owners = []
    dashboard.slices = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "owners": dashboard.owners,
        "charts": [],
    }
    mock_list.return_value = ([dashboard], 1)
    async with Client(mcp_server) as client:
        filters = '[{"col": "dashboard_title", "opr": "sw", "value": "Sales"}]'
        import fastmcp

        with pytest.raises(fastmcp.exceptions.ToolError) as excinfo:
            await client.call_tool("list_dashboards", {"filters": filters})
        assert "Input validation error" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_api_error(mock_list, mcp_server):
    mock_list.side_effect = ToolError("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:
            await client.call_tool("list_dashboards", {})
        assert "API request failed" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_with_search(mock_list, mcp_server):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "search_dashboard"
    dashboard.slug = "search-dashboard"
    dashboard.url = "/dashboard/1"
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.owners = []
    dashboard.slices = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "owners": dashboard.owners,
        "charts": [],
    }
    mock_list.return_value = ([dashboard], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_dashboards", {"search": "search_dashboard"}
        )
        assert result.data.count == 1
        assert result.data.dashboards[0].dashboard_title == "search_dashboard"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_dashboard"
        assert "dashboard_title" in kwargs["search_columns"]
        assert "slug" in kwargs["search_columns"]


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.list")
async def test_list_dashboards_with_simple_filters(mock_list, mcp_server):
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        filters = [
            {"col": "dashboard_title", "opr": "eq", "value": "Sales"},
            {"col": "published", "opr": "eq", "value": True},
        ]
        result = await client.call_tool("list_dashboards", {"filters": filters})
        assert hasattr(result.data, "count")


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
async def test_get_dashboard_info_success(mock_info, mcp_server):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = "test-dashboard"
    dashboard.description = "Test description"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.position_json = None
    dashboard.published = True
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by = None
    dashboard.changed_by = None
    dashboard.uuid = None
    dashboard.url = "/dashboard/1"
    dashboard.thumbnail_url = None
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "url": dashboard.url,
        "published": dashboard.published,
        "changed_by_name": dashboard.changed_by_name,
        "changed_on": dashboard.changed_on,
        "changed_on_humanized": dashboard.changed_on_humanized,
        "created_by_name": dashboard.created_by_name,
        "created_on": dashboard.created_on,
        "created_on_humanized": dashboard.created_on_humanized,
        "tags": dashboard.tags,
        "owners": dashboard.owners,
        "charts": [],
    }
    mock_info.return_value = dashboard  # Only the dashboard object
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dashboard_info", {"dashboard_id": 1})
        assert result.data["dashboard_title"] == "Test Dashboard"


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
async def test_get_dashboard_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dashboard_info", {"dashboard_id": 999})
        assert result.data["error_type"] == "not_found"


@pytest.mark.asyncio
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
async def test_get_dashboard_info_access_denied(mock_info, mcp_server):
    mock_info.return_value = None  # Access denied returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dashboard_info", {"dashboard_id": 1})
        assert result.data["error_type"] == "not_found"


@pytest.mark.xfail(
    reason="MCP protocol bug: dict fields named column_operators are deserialized as "
    "custom types (Column_Operators). TODO: revisit after protocol fix."
)
@pytest.mark.asyncio
async def test_get_dashboard_available_filters_success(mcp_server):
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dashboard_available_filters", {})
        assert hasattr(result.data, "column_operators")
        assert isinstance(result.data.column_operators, dict)


@pytest.mark.asyncio
async def test_get_dashboard_available_filters_exception_handling(mcp_server):
    # No exception expected in normal operation
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dashboard_available_filters", {})
        assert hasattr(result.data, "column_operators")
