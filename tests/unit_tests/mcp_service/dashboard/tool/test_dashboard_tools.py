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
Unit tests for MCP dashboard tools (list_dashboards, get_dashboard_info)
"""

import logging
from importlib import import_module
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from flask import g

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard.schemas import (
    ListDashboardsRequest,
)
from superset.mcp_service.dashboard.tool.get_dashboard_info import (
    _refresh_request_user_for_permalink_access,
)
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
get_dashboard_info_module = import_module(
    "superset.mcp_service.dashboard.tool.get_dashboard_info"
)


def _wrapped(value: str) -> str:
    return f"{LLM_CONTEXT_OPEN_DELIMITER}\n{value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
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
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = "test-dashboard-uuid-1"
    dashboard.thumbnail_url = None
    dashboard.roles = []
    dashboard.charts = []
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
        request = ListDashboardsRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        dashboards = data["dashboards"]
        assert len(dashboards) == 1
        assert dashboards[0]["dashboard_title"] == _wrapped("Test Dashboard")
        assert dashboards[0]["slug"] == "test-dashboard"
        # Note: published is not in minimal default columns (id, dashboard_title,
        # slug, url, changed_on_humanized) - use select_columns to include it

        assert "url" in data["columns_requested"]
        assert "slug" in data["columns_requested"]
        assert "changed_on_humanized" in data["columns_requested"]
        assert "url" in data["columns_loaded"]
        assert "slug" in data["columns_loaded"]


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
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
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = None
    dashboard.thumbnail_url = None
    dashboard.roles = []
    dashboard.charts = []
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
        request = ListDashboardsRequest(
            filters=filters,
            select_columns=["id", "dashboard_title"],
            order_column="changed_on",
            order_direction="desc",
            page=1,
            page_size=50,
        )
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["count"] == 1
        assert data["dashboards"][0]["dashboard_title"] == _wrapped(
            "Filtered Dashboard"
        )


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_with_string_filters(mock_list, mcp_server):
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:  # noqa: F841
        filters = '[{"col": "dashboard_title", "opr": "sw", "value": "Sales"}]'

        # Test that string filters are now properly parsed to objects
        request = ListDashboardsRequest(filters=filters)
        assert len(request.filters) == 1
        assert request.filters[0].col == "dashboard_title"
        assert request.filters[0].opr == "sw"
        assert request.filters[0].value == "Sales"


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_api_error(mock_list, mcp_server):
    mock_list.side_effect = ToolError("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            request = ListDashboardsRequest()
            await client.call_tool("list_dashboards", {"request": request.model_dump()})
        assert "API request failed" in str(excinfo.value)


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
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
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = None
    dashboard.thumbnail_url = None
    dashboard.roles = []
    dashboard.charts = []
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
        request = ListDashboardsRequest(search="search_dashboard")
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["count"] == 1
        assert data["dashboards"][0]["dashboard_title"] == _wrapped("search_dashboard")
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_dashboard"
        assert "dashboard_title" in kwargs["search_columns"]
        assert "slug" in kwargs["search_columns"]


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_with_simple_filters(mock_list, mcp_server):
    mock_list.return_value = ([], 0)
    async with Client(mcp_server) as client:
        filters = [
            {"col": "dashboard_title", "opr": "eq", "value": "Sales"},
            {"col": "published", "opr": "eq", "value": True},
        ]
        request = ListDashboardsRequest(filters=filters)
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert "count" in data


@patch(
    "superset.mcp_service.dashboard.schemas.user_can_view_data_model_metadata",
    return_value=True,
)
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_success(
    mock_info, mock_can_view_data_model_metadata, mcp_server
):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = "test-dashboard"
    dashboard.description = "Test description"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = "Certified by data team"
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "native-filter-1",
                    "name": "Region Filter",
                    "filterType": "filter_select",
                    "targets": [{"column": {"name": "region"}, "datasetId": 12}],
                }
            ]
        }
    )
    dashboard.published = True
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by = None
    dashboard.changed_by = None
    dashboard.uuid = "dashboard-uuid-1"
    dashboard.url = "/dashboard/1"
    dashboard.thumbnail_url = None
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []
    dashboard.charts = []
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
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": 1}}
        )
        assert result.data["dashboard_title"] == _wrapped("Test Dashboard")
        assert result.data["description"] == _wrapped("Test description")
        assert result.data["certification_details"] == _wrapped(
            "Certified by data team"
        )
        assert result.data["slug"] == "test-dashboard"
        assert result.data["url"].endswith("/dashboard/1")
        assert result.data["uuid"] == "dashboard-uuid-1"
        assert result.data["native_filters"][0]["id"] == "native-filter-1"
        assert result.data["native_filters"][0]["name"] == _wrapped("Region Filter")
        assert result.data["native_filters"][0]["targets"] == [
            {"column": {"name": _wrapped("region")}, "datasetId": 12}
        ]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_permalink_does_not_double_sanitize(
    mock_info, mcp_server
):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = "test-dashboard"
    dashboard.description = "Test description"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = "Certified by data team"
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "native-filter-1",
                    "name": "Region Filter",
                    "filterType": "filter_select",
                    "targets": [{"column": {"name": "region"}, "datasetId": 12}],
                }
            ]
        }
    )
    dashboard.published = True
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by = None
    dashboard.changed_by = None
    dashboard.uuid = "dashboard-uuid-1"
    dashboard.url = "/dashboard/1"
    dashboard.thumbnail_url = None
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []
    dashboard.charts = []
    mock_info.return_value = dashboard
    permalink_value = {
        "dashboardId": "1",
        "state": {
            "dataMask": {
                "native-filter-1": {
                    "filterState": {"label": "EMEA"},
                    "extraFormData": {
                        "filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]
                    },
                }
            },
            "activeTabs": ["TAB-1"],
        },
    }

    with (
        patch(
            "superset.mcp_service.dashboard.schemas.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch.object(
            get_dashboard_info_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch.object(
            get_dashboard_info_module,
            "_get_permalink_state",
            return_value=permalink_value,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_dashboard_info",
                {"request": {"identifier": 1, "permalink_key": "permalink-1"}},
            )

    assert result.data["dashboard_title"] == _wrapped("Test Dashboard")
    assert result.data["description"] == _wrapped("Test description")
    assert result.data["certification_details"] == _wrapped("Certified by data team")
    assert result.data["native_filters"][0]["name"] == _wrapped("Region Filter")
    assert result.data["permalink_key"] == "permalink-1"
    assert result.data["is_permalink_state"] is True
    assert result.data["filter_state"]["dataMask"]["native-filter-1"]["filterState"][
        "label"
    ] == _wrapped("EMEA")
    assert result.data["filter_state"]["dataMask"]["native-filter-1"]["extraFormData"][
        "filters"
    ][0]["val"][0] == _wrapped("EMEA")
    assert result.data["filter_state"]["activeTabs"][0] == _wrapped("TAB-1")


def test_refresh_request_user_for_permalink_access(
    app,
):
    refreshed_user = Mock()
    refreshed_user.username = "admin"
    refreshed_user.roles = []
    refreshed_user.groups = []

    current_user = Mock()
    current_user.username = "admin"
    current_user.email = None
    current_user.is_anonymous = False

    with (
        patch.object(
            get_dashboard_info_module,
            "load_user_with_relationships",
            return_value=refreshed_user,
        ) as mock_load_user_with_relationships,
        app.test_request_context("/mcp"),
    ):
        g.user = current_user
        _refresh_request_user_for_permalink_access()

        mock_load_user_with_relationships.assert_called_once_with(username="admin")
        assert g.user is refreshed_user


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": 999}}
        )
        assert result.data["error_type"] == "not_found"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_access_denied(mock_info, mcp_server):
    mock_info.return_value = None  # Access denied returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": 1}}
        )
        assert result.data["error_type"] == "not_found"


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_does_not_expose_access_list_or_roles(
    mock_info, mcp_server
):
    creator = Mock()
    creator.username = "workspace-admin"

    owner_role = Mock()
    owner_role.name = "Primary Contributor"
    owner = Mock()
    owner.id = 2
    owner.username = "daniel"
    owner.first_name = "Daniel"
    owner.last_name = "Watania"
    owner.email = "daniel.watania@preset.io"
    owner.active = True
    owner.roles = [owner_role]

    dashboard_role = Mock()
    dashboard_role.id = 3
    dashboard_role.name = "PresetAlpha"
    dashboard_role.permissions = []

    chart = Mock()
    chart.id = 10
    chart.slice_name = "Chart with owner"
    chart.viz_type = "table"
    chart.datasource_name = "examples"
    chart.datasource_type = "table"
    chart.description = None
    chart.cache_timeout = None
    chart.changed_by_name = None
    chart.changed_by = None
    chart.changed_on = None
    chart.created_by_name = None
    chart.created_by = None
    chart.created_on = None
    chart.uuid = None
    chart.tags = []
    chart.owners = [owner]

    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Customer Success Home Dashboard"
    dashboard.slug = "customer-success-home"
    dashboard.description = None
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
    dashboard.created_by = creator
    dashboard.changed_by = creator
    dashboard.uuid = None
    dashboard.url = "/dashboard/1"
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = [chart]
    dashboard.owners = [owner]
    dashboard.tags = []
    dashboard.roles = [dashboard_role]

    mock_info.return_value = dashboard

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": 1}}
        )

    assert result.data["dashboard_title"] == _wrapped("Customer Success Home Dashboard")
    assert "created_by" not in result.data
    assert "changed_by" not in result.data
    assert "owners" not in result.data
    assert "roles" not in result.data
    assert "created_by" not in result.data["charts"][0]
    assert "changed_by" not in result.data["charts"][0]
    assert "owners" not in result.data["charts"][0]


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_restricted_user_redacts_data_model_metadata(
    mock_info,
    mcp_server,
):
    chart = Mock()
    chart.id = 10
    chart.slice_name = "Revenue by Deal Size"
    chart.viz_type = "echarts_timeseries_bar"
    chart.datasource_name = "Vehicle Sales"
    chart.description = None
    chart.tags = []

    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Sales Dashboard"
    dashboard.slug = "sales"
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-product-line",
                    "name": "Product Line",
                    "filterType": "filter_select",
                    "targets": [
                        {"column": {"name": "product_line"}, "datasetId": 3},
                    ],
                },
            ],
            "cross_filters_enabled": True,
        }
    )
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
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = [chart]
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []

    mock_info.return_value = dashboard

    with patch(
        "superset.mcp_service.dashboard.schemas.user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_dashboard_info",
                {"request": {"identifier": 1}},
            )

    assert result.data["dashboard_title"] == _wrapped("Sales Dashboard")
    assert result.data["charts"][0]["slice_name"] == _wrapped("Revenue by Deal Size")
    assert result.data["charts"][0]["viz_type"] == "echarts_timeseries_bar"
    assert result.data["charts"][0]["datasource_name"] is None
    assert result.data["native_filters"][0]["name"] == _wrapped("Product Line")
    assert result.data["native_filters"][0]["targets"] == []


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_dashboard_info_restricted_user_redacts_permalink_filter_state(
    mock_info,
    mcp_server,
):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Sales Dashboard"
    dashboard.slug = "sales"
    dashboard.description = None
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
    dashboard.created_on_humanized = None
    dashboard.changed_on_humanized = None
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []

    mock_info.return_value = dashboard

    permalink_value = {
        "dashboardId": "1",
        "state": {
            "dataMask": {
                "NATIVE_FILTER-product-line": {
                    "extraFormData": {
                        "filters": [
                            {
                                "col": "product_line",
                                "op": "IN",
                                "val": ["Classic Cars"],
                                "datasetId": 3,
                            }
                        ],
                    },
                    "filterState": {"value": ["Classic Cars"]},
                },
            },
            "chartStates": {
                "42": {
                    "state": {
                        "columnState": [{"colId": "customer_email"}],
                        "filterModel": {"revenue": {"filter": 100}},
                    },
                },
            },
            "activeTabs": ["TAB-products"],
        },
    }

    with (
        patch(
            "superset.mcp_service.dashboard.schemas.user_can_view_data_model_metadata",
            return_value=False,
        ),
        patch.object(
            get_dashboard_info_module,
            "user_can_view_data_model_metadata",
            return_value=False,
        ),
        patch.object(
            get_dashboard_info_module,
            "_get_permalink_state",
            return_value=permalink_value,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_dashboard_info",
                {"request": {"identifier": 1, "permalink_key": "abc123"}},
            )

    assert result.data["permalink_key"] == "abc123"
    assert result.data["is_permalink_state"] is True
    assert result.data["filter_state"] == {"activeTabs": [_wrapped("TAB-products")]}


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_omits_requested_user_directory_fields(
    mock_list, mcp_server
):
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Customer Success Home Dashboard"
    dashboard.slug = "customer-success-home"
    dashboard.url = "/dashboard/1"
    dashboard.published = True
    dashboard.changed_by_name = "workspace-admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = None
    dashboard.created_by_name = "workspace-admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = None
    dashboard.tags = []
    dashboard.owners = [Mock()]
    dashboard.slices = []
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.position_json = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = "test-dashboard-uuid-1"
    dashboard.roles = [Mock()]
    dashboard._mapping = {}
    mock_list.return_value = ([dashboard], 1)

    async with Client(mcp_server) as client:
        request = ListDashboardsRequest(
            page=1,
            page_size=10,
            select_columns=[
                "id",
                "dashboard_title",
                "owners",
                "roles",
                "created_by",
                "changed_by",
            ],
        )
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )

    data = json.loads(result.content[0].text)
    dashboard_data = data["dashboards"][0]
    assert dashboard_data == {
        "id": 1,
        "dashboard_title": _wrapped("Customer Success Home Dashboard"),
    }
    for field in ("owners", "roles", "created_by", "changed_by"):
        assert field not in data["columns_requested"]
        assert field not in data["columns_loaded"]
        assert field not in data["columns_available"]


# TODO (Phase 3+): Add tests for get_dashboard_available_filters tool


@patch("superset.mcp_service.mcp_core.ModelGetInfoCore._find_object")
@pytest.mark.asyncio
async def test_get_dashboard_info_by_uuid(mock_find_object, mcp_server):
    """Test getting dashboard info using UUID identifier."""
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Test Dashboard UUID"
    dashboard.slug = "test-dashboard-uuid"
    dashboard.description = "Test description"
    dashboard.css = ""
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = "{}"
    dashboard.published = True
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by = None
    dashboard.changed_by = None
    dashboard.uuid = "c3d4e5f6-g7h8-9012-cdef-gh3456789012"
    dashboard.url = "/dashboard/1"
    dashboard.thumbnail_url = None
    dashboard.created_on_humanized = "2 days ago"
    dashboard.changed_on_humanized = "1 day ago"
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []

    mock_find_object.return_value = dashboard
    async with Client(mcp_server) as client:
        uuid_str = "c3d4e5f6-g7h8-9012-cdef-gh3456789012"
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": uuid_str}}
        )
        assert result.data["dashboard_title"] == _wrapped("Test Dashboard UUID")


@patch("superset.mcp_service.mcp_core.ModelGetInfoCore._find_object")
@pytest.mark.asyncio
async def test_get_dashboard_info_by_slug(mock_find_object, mcp_server):
    """Test getting dashboard info using slug identifier."""
    dashboard = Mock()
    dashboard.id = 2
    dashboard.dashboard_title = "Test Dashboard Slug"
    dashboard.slug = "test-dashboard-slug"
    dashboard.description = "Test description"
    dashboard.css = ""
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = "{}"
    dashboard.published = True
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by = None
    dashboard.changed_by = None
    dashboard.uuid = "d4e5f6g7-h8i9-0123-defg-hi4567890123"
    dashboard.url = "/dashboard/2"
    dashboard.thumbnail_url = None
    dashboard.created_on_humanized = "2 days ago"
    dashboard.changed_on_humanized = "1 day ago"
    dashboard.slices = []
    dashboard.owners = []
    dashboard.tags = []
    dashboard.roles = []

    mock_find_object.return_value = dashboard
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_dashboard_info", {"request": {"identifier": "test-dashboard-slug"}}
        )
        assert result.data["dashboard_title"] == _wrapped("Test Dashboard Slug")


@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_custom_uuid_slug_columns(mock_list, mcp_server):
    """Test that custom column selection includes UUID and slug when explicitly
    requested."""
    dashboard = Mock()
    dashboard.id = 1
    dashboard.dashboard_title = "Custom Columns Dashboard"
    dashboard.slug = "custom-dashboard"
    dashboard.uuid = "test-custom-uuid-123"
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
    dashboard.description = None
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.thumbnail_url = None
    dashboard.roles = []
    dashboard.charts = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "uuid": dashboard.uuid,
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
        request = ListDashboardsRequest(
            select_columns=["id", "dashboard_title", "uuid", "slug"],
            page=1,
            page_size=10,
        )
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        dashboards = data["dashboards"]
        assert len(dashboards) == 1
        assert dashboards[0]["dashboard_title"] == _wrapped("Custom Columns Dashboard")
        assert dashboards[0]["uuid"] == "test-custom-uuid-123"
        assert dashboards[0]["slug"] == "custom-dashboard"


@patch(
    "superset.mcp_service.dashboard.schemas.user_can_view_data_model_metadata",
    return_value=True,
)
@patch("superset.daos.dashboard.DashboardDAO.list")
@pytest.mark.asyncio
async def test_list_dashboards_sanitizes_dashboard_descriptions_and_filter_text(
    mock_list, mock_can_view_data_model_metadata, mcp_server
):
    dashboard = Mock()
    dashboard.id = 3
    dashboard.dashboard_title = "Quarterly Dashboard"
    dashboard.slug = "quarterly-dashboard"
    dashboard.uuid = "uuid-quarterly-3"
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
    dashboard.description = "Summarize revenue trends"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = "Approved by finance"
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "native-filter-2",
                    "name": "Market Filter",
                    "filterType": "filter_select",
                    "targets": [{"column": {"name": "market"}, "datasetId": 44}],
                }
            ]
        }
    )
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.thumbnail_url = None
    dashboard.roles = []
    dashboard.charts = []
    dashboard._mapping = {
        "id": dashboard.id,
        "dashboard_title": dashboard.dashboard_title,
        "slug": dashboard.slug,
        "uuid": dashboard.uuid,
        "url": dashboard.url,
        "description": dashboard.description,
        "certification_details": dashboard.certification_details,
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
        request = ListDashboardsRequest(
            select_columns=[
                "id",
                "dashboard_title",
                "description",
                "certification_details",
                "native_filters",
                "slug",
                "uuid",
                "url",
            ],
            page=1,
            page_size=10,
        )
        result = await client.call_tool(
            "list_dashboards", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        dashboard_payload = data["dashboards"][0]

        assert dashboard_payload["dashboard_title"] == _wrapped("Quarterly Dashboard")
        assert dashboard_payload["description"] == _wrapped("Summarize revenue trends")
        assert dashboard_payload["certification_details"] == _wrapped(
            "Approved by finance"
        )
        assert dashboard_payload["native_filters"][0]["id"] == "native-filter-2"
        assert dashboard_payload["native_filters"][0]["name"] == _wrapped(
            "Market Filter"
        )
        assert dashboard_payload["native_filters"][0]["targets"] == [
            {"column": {"name": _wrapped("market")}, "datasetId": 44}
        ]
        assert dashboard_payload["slug"] == "quarterly-dashboard"
        assert dashboard_payload["uuid"] == "uuid-quarterly-3"
        assert dashboard_payload["url"].endswith(
            "/superset/dashboard/quarterly-dashboard/"
        )

        assert "uuid" in data["columns_requested"]
        assert "slug" in data["columns_requested"]
        assert "uuid" in data["columns_loaded"]
        assert "slug" in data["columns_loaded"]


class TestDashboardDefaultColumnFiltering:
    """Test default column filtering behavior for dashboards."""

    def test_minimal_default_columns_constant(self):
        """Test that minimal default columns are properly defined."""
        from superset.mcp_service.common.schema_discovery import (
            DASHBOARD_DEFAULT_COLUMNS,
        )

        assert set(DASHBOARD_DEFAULT_COLUMNS) == {
            "id",
            "dashboard_title",
            "slug",
            "description",
            "certified_by",
            "certification_details",
            "url",
            "changed_on",
            "changed_on_humanized",
        }

        # Heavy columns should NOT be in defaults
        assert "charts" not in DASHBOARD_DEFAULT_COLUMNS
        assert "published" not in DASHBOARD_DEFAULT_COLUMNS
        assert "native_filters" not in DASHBOARD_DEFAULT_COLUMNS
        assert "cross_filters_enabled" not in DASHBOARD_DEFAULT_COLUMNS
        assert "uuid" not in DASHBOARD_DEFAULT_COLUMNS

    def test_empty_select_columns_default(self):
        """Test that select_columns defaults to empty list which triggers
        minimal defaults in tool."""
        request = ListDashboardsRequest()
        assert request.select_columns == []

    def test_explicit_select_columns(self):
        """Test that explicit select_columns can include non-default columns."""
        request = ListDashboardsRequest(
            select_columns=["id", "dashboard_title", "published", "charts"]
        )
        assert "published" in request.select_columns
        assert "charts" in request.select_columns
        # These are explicitly requested, not defaults
        assert len(request.select_columns) == 4

    @patch("superset.daos.dashboard.DashboardDAO.list")
    @pytest.mark.asyncio
    async def test_default_columns_in_response(self, mock_list, mcp_server):
        """Test that minimal default columns appear in response metadata."""
        dashboard = Mock()
        dashboard.id = 1
        dashboard.dashboard_title = "Test Dashboard"
        dashboard.slug = "test-dashboard"
        dashboard.uuid = "test-uuid-123"
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
        dashboard.description = None
        dashboard.css = None
        dashboard.certified_by = None
        dashboard.certification_details = None
        dashboard.json_metadata = None
        dashboard.is_managed_externally = False
        dashboard.external_url = None
        dashboard.thumbnail_url = None
        dashboard.roles = []
        dashboard.charts = []
        mock_list.return_value = ([dashboard], 1)

        async with Client(mcp_server) as client:
            request = ListDashboardsRequest(page=1, page_size=10)
            result = await client.call_tool(
                "list_dashboards", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

            # Verify columns_requested uses minimal defaults
            assert "id" in data["columns_requested"]
            assert "dashboard_title" in data["columns_requested"]
            assert "slug" in data["columns_requested"]
            assert "url" in data["columns_requested"]
            assert "changed_on_humanized" in data["columns_requested"]

            # Verify heavy columns are NOT in columns_loaded by default
            assert "native_filters" not in data["columns_loaded"]
            assert "cross_filters_enabled" not in data["columns_loaded"]


class TestDashboardSortableColumns:
    """Test sortable columns configuration for dashboard tools."""

    def test_dashboard_sortable_columns_definition(self):
        """Test that dashboard sortable columns are properly defined."""
        from superset.mcp_service.dashboard.tool.list_dashboards import (
            SORTABLE_DASHBOARD_COLUMNS,
        )

        assert SORTABLE_DASHBOARD_COLUMNS == [
            "id",
            "dashboard_title",
            "slug",
            "published",
            "changed_on",
            "created_on",
        ]
        # Ensure no computed properties are included
        assert "changed_on_delta_humanized" not in SORTABLE_DASHBOARD_COLUMNS
        assert "changed_by_name" not in SORTABLE_DASHBOARD_COLUMNS
        assert "uuid" not in SORTABLE_DASHBOARD_COLUMNS

    @patch("superset.daos.dashboard.DashboardDAO.list")
    @pytest.mark.asyncio
    async def test_list_dashboards_with_valid_order_column(self, mock_list, mcp_server):
        """Test list_dashboards with valid order column."""
        mock_list.return_value = ([], 0)

        async with Client(mcp_server) as client:
            # Test with valid sortable column
            request = ListDashboardsRequest(
                order_column="dashboard_title", order_direction="desc"
            )
            result = await client.call_tool(
                "list_dashboards", {"request": request.model_dump()}
            )

            # Verify the DAO was called with the correct order column
            mock_list.assert_called_once()
            call_args = mock_list.call_args[1]
            assert call_args["order_column"] == "dashboard_title"
            assert call_args["order_direction"] == "desc"

            data = json.loads(result.content[0].text)
            assert data["count"] == 0
            assert data["dashboards"] == []

    def test_sortable_columns_in_docstring(self):
        """Test that sortable columns are documented in tool docstring."""
        from superset.mcp_service.dashboard.tool.list_dashboards import (
            list_dashboards,
            SORTABLE_DASHBOARD_COLUMNS,
        )

        # Check list_dashboards docstring for sortable columns documentation
        assert list_dashboards.__doc__ is not None
        assert "Sortable columns for order_column:" in list_dashboards.__doc__
        for col in SORTABLE_DASHBOARD_COLUMNS:
            assert col in list_dashboards.__doc__
