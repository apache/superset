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
Unit tests for MCP dashboard tools (list_dashboards, get_dashboard_info, get_dashboard_available_filters)
"""
import logging
from unittest.mock import Mock, patch
import pytest
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    DashboardAvailableFilters, DashboardError, DashboardInfo, DashboardList,
)
from superset.mcp_service.tools.dashboard import (
    get_dashboard_available_filters, get_dashboard_info, list_dashboards,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestDashboardTools:
    """Test dashboard-related MCP tools"""

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_basic(self, mock_list):
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
        mock_list.return_value = ([dashboard], 1)

        result = list_dashboards()
        assert result.count == 1
        assert result.total_count == 1
        assert result.dashboards[0].dashboard_title == "Test Dashboard"
        assert result.dashboards[0].published is True
        assert result.dashboards[0].changed_by == "admin"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_with_filters(self, mock_list):
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
        mock_list.return_value = ([dashboard], 1)
        filters = [
            {"col": "dashboard_title", "opr": "sw", "value": "Sales"},
            {"col": "published", "opr": "eq", "value": True}
        ]
        result = list_dashboards(
            filters=filters,
            select_columns=["id", "dashboard_title"],
            order_column="changed_on",
            order_direction="desc",
            page=1,
            page_size=50
        )
        assert result.count == 1
        assert result.dashboards[0].dashboard_title == "Filtered Dashboard"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_with_string_filters(self, mock_list):
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
        mock_list.return_value = ([dashboard], 1)
        filters = '[{"col": "dashboard_title", "opr": "sw", "value": "Sales"}]'
        result = list_dashboards(filters=filters)
        assert result.count == 1
        assert result.dashboards[0].dashboard_title == "String Filter Dashboard"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_api_error(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        with pytest.raises(Exception) as excinfo:
            list_dashboards()
        assert "API request failed" in str(excinfo.value)

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_with_search(self, mock_list):
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
        mock_list.return_value = ([dashboard], 1)
        result = list_dashboards(search="search_dashboard")
        assert result.count == 1
        assert result.dashboards[0].dashboard_title == "search_dashboard"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_dashboard"
        assert "dashboard_title" in kwargs["search_columns"]
        assert "slug" in kwargs["search_columns"]

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_with_simple_filters(self, mock_list):
        mock_list.return_value = ([], 0)
        filters = [{"col": "dashboard_title", "opr": "eq", "value": "Sales"}, {"col": "published", "opr": "eq", "value": True}]
        result = list_dashboards(filters=filters)
        assert hasattr(result, 'count')

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.info')
    def test_get_dashboard_info_success(self, mock_info):
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
        mock_info.return_value = (dashboard, None, None)
        result = get_dashboard_info(1)
        assert isinstance(result, DashboardInfo)
        assert result.id == 1
        assert result.dashboard_title == "Test Dashboard"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.info')
    def test_get_dashboard_info_not_found(self, mock_info):
        mock_info.return_value = (None, "not_found", "Dashboard not found")
        result = get_dashboard_info(999)
        assert isinstance(result, DashboardError)
        assert result.error == "Dashboard not found"
        assert result.error_type == "not_found"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.info')
    def test_get_dashboard_info_access_denied(self, mock_info):
        mock_info.return_value = (None, "access_denied", "Access denied")
        result = get_dashboard_info(1)
        assert isinstance(result, DashboardError)
        assert result.error == "Access denied"
        assert result.error_type == "access_denied"

    def test_get_dashboard_available_filters_success(self):
        result = get_dashboard_available_filters()
        assert isinstance(result, DashboardAvailableFilters)
        assert "dashboard_title" in result.filters
        assert "eq" in result.operators
        assert "dashboard_title" in result.columns or "id" in result.columns

    def test_get_dashboard_available_filters_exception_handling(self):
        result = get_dashboard_available_filters()
        assert isinstance(result, DashboardAvailableFilters)
        assert hasattr(result, "filters")
        assert hasattr(result, "operators")
        assert hasattr(result, "columns") 