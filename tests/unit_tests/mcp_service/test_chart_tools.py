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
Unit tests for MCP chart tools (list_charts, get_chart_info, get_chart_available_filters, create_chart_simple)
"""
import logging
from unittest.mock import Mock, patch
import pytest
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartInfo, ChartError, ChartAvailableFiltersResponse
)
from superset.mcp_service.tools.chart import (
    list_charts, get_chart_info, get_chart_available_filters, create_chart_simple
)
from superset.mcp_service.pydantic_schemas.chart_schemas import CreateSimpleChartRequest

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestChartTools:
    """Test chart-related MCP tools"""

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_charts_basic(self, mock_list):
        chart = Mock()
        chart.id = 1
        chart.slice_name = "Test Chart"
        chart.viz_type = "bar"
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = "/chart/1"
        chart.description = "desc"
        chart.cache_timeout = 60
        chart.form_data = {}
        chart.query_context = {}
        chart.changed_by_name = "admin"
        chart.changed_on = None
        chart.changed_on_humanized = "1 day ago"
        chart.created_by_name = "admin"
        chart.created_on = None
        chart.created_on_humanized = "2 days ago"
        chart.tags = []
        chart.owners = []
        mock_list.return_value = ([chart], 1)
        result = list_charts()
        assert result.count == 1
        assert result.charts[0].slice_name == "Test Chart"
        assert result.charts[0].viz_type == "bar"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_charts_with_search(self, mock_list):
        chart = Mock()
        chart.id = 1
        chart.slice_name = "search_chart"
        chart.viz_type = "bar"
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = "/chart/1"
        chart.description = "desc"
        chart.cache_timeout = 60
        chart.form_data = {}
        chart.query_context = {}
        chart.changed_by_name = "admin"
        chart.changed_on = None
        chart.changed_on_humanized = "1 day ago"
        chart.created_by_name = "admin"
        chart.created_on = None
        chart.created_on_humanized = "2 days ago"
        chart.tags = []
        chart.owners = []
        mock_list.return_value = ([chart], 1)
        result = list_charts(search="search_chart")
        assert result.count == 1
        assert result.charts[0].slice_name == "search_chart"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_chart"
        assert "slice_name" in kwargs["search_columns"]
        assert "viz_type" in kwargs["search_columns"]
        assert "datasource_name" in kwargs["search_columns"]

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_charts_with_filters(self, mock_list):
        mock_list.return_value = ([], 0)
        filters = [
            {"col": "slice_name", "opr": "sw", "value": "Sales"},
            {"col": "viz_type", "opr": "eq", "value": "bar"}
        ]
        result = list_charts(
            filters=filters,
            select_columns=["id", "slice_name"],
            order_column="changed_on",
            order_direction="desc",
            page=1,
            page_size=50
        )
        assert result.count == 0
        assert result.charts == []

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_charts_api_error(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        with pytest.raises(Exception) as excinfo:
            list_charts()
        assert "API request failed" in str(excinfo.value)

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.info')
    def test_get_chart_info_success(self, mock_info):
        chart = Mock()
        chart.id = 1
        chart.slice_name = "Test Chart"
        chart.viz_type = "bar"
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = "/chart/1"
        chart.description = "desc"
        chart.cache_timeout = 60
        chart.form_data = {}
        chart.query_context = {}
        chart.changed_by_name = "admin"
        chart.changed_on = None
        chart.changed_on_humanized = "1 day ago"
        chart.created_by_name = "admin"
        chart.created_on = None
        chart.created_on_humanized = "2 days ago"
        chart.tags = []
        chart.owners = []
        mock_info.return_value = (chart, None, None)
        result = get_chart_info(1)
        assert isinstance(result, ChartInfo)
        assert result.id == 1
        assert result.slice_name == "Test Chart"

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.info')
    def test_get_chart_info_not_found(self, mock_info):
        mock_info.return_value = (None, "not_found", "Chart not found")
        result = get_chart_info(999)
        assert isinstance(result, ChartError)
        assert result.error == "Chart not found"
        assert result.error_type == "not_found"

    def test_get_chart_available_filters_success(self):
        result = get_chart_available_filters()
        assert isinstance(result, ChartAvailableFiltersResponse)
        assert "slice_name" in result.filters
        assert "eq" in result.operators
        assert "slice_name" in result.columns or "id" in result.columns

    def test_get_chart_available_filters_exception_handling(self):
        result = get_chart_available_filters()
        assert isinstance(result, ChartAvailableFiltersResponse)
        assert hasattr(result, "filters")
        assert hasattr(result, "operators")
        assert hasattr(result, "columns")

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_simple_success(self, mock_run):
        chart = Mock()
        chart.id = 42
        chart.slice_name = "Created Chart"
        chart.viz_type = "bar"
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = "/chart/42"
        chart.description = "desc"
        chart.cache_timeout = 60
        chart.form_data = {}
        chart.query_context = {}
        chart.changed_by_name = "admin"
        chart.changed_on = None
        chart.changed_on_humanized = "1 day ago"
        chart.created_by_name = "admin"
        chart.created_on = None
        chart.created_on_humanized = "2 days ago"
        chart.tags = []
        chart.owners = []
        mock_run.return_value = chart
        req = CreateSimpleChartRequest(
            slice_name="Created Chart",
            viz_type="bar",
            datasource_id=1,
            metrics=["sum__sales"],
            dimensions=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
            description="A chart created by test",
            return_embed=True
        )
        result = create_chart_simple(request=req)
        assert result.chart is not None
        assert result.chart.slice_name == "Created Chart"
        assert result.embed_url is not None
        assert result.thumbnail_url is not None
        assert result.embed_html is not None

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_simple_error(self, mock_run):
        mock_run.side_effect = Exception("Chart creation failed")
        req = CreateSimpleChartRequest(
            slice_name="Fail Chart",
            viz_type="bar",
            datasource_id=1,
            metrics=["sum__sales"],
            dimensions=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
            description="A chart that fails",
            return_embed=False
        )
        result = create_chart_simple(request=req)
        assert result.error is not None
        assert "Chart creation failed" in result.error 