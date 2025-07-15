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
from unittest.mock import Mock, patch, call
import pytest
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartInfo, ChartError, ChartAvailableFiltersResponse,
    EchartsTimeseriesLineChartCreateRequest,
    EchartsTimeseriesBarChartCreateRequest,
    EchartsAreaChartCreateRequest,
    TableChartCreateRequest,
)
from superset.mcp_service.tools.chart import (
    list_charts, get_chart_info, get_chart_available_filters, create_chart_simple, create_chart
)
from superset.mcp_service.pydantic_schemas.chart_schemas import CreateSimpleChartRequest
from superset.daos.chart import ChartDAO

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestChartTools:
    """Test chart-related MCP tools"""

    @patch('superset.daos.chart.ChartDAO.list')
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
        chart._mapping = {
            'id': chart.id,
            'slice_name': chart.slice_name,
            'viz_type': chart.viz_type,
            'datasource_name': chart.datasource_name,
            'datasource_type': chart.datasource_type,
            'url': chart.url,
            'description': chart.description,
            'cache_timeout': chart.cache_timeout,
            'form_data': chart.form_data,
            'query_context': chart.query_context,
            'changed_by_name': chart.changed_by_name,
            'changed_on': chart.changed_on,
            'changed_on_humanized': chart.changed_on_humanized,
            'created_by_name': chart.created_by_name,
            'created_on': chart.created_on,
            'created_on_humanized': chart.created_on_humanized,
            'tags': chart.tags,
            'owners': chart.owners,
        }
        mock_list.return_value = ([chart], 1)
        result = list_charts()
        assert result.count == 1
        assert result.charts[0].slice_name == "Test Chart"
        assert result.charts[0].viz_type == "bar"

    @patch('superset.daos.chart.ChartDAO.list')
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
        chart._mapping = {
            'id': chart.id,
            'slice_name': chart.slice_name,
            'viz_type': chart.viz_type,
            'datasource_name': chart.datasource_name,
            'datasource_type': chart.datasource_type,
            'url': chart.url,
            'description': chart.description,
            'cache_timeout': chart.cache_timeout,
            'form_data': chart.form_data,
            'query_context': chart.query_context,
            'changed_by_name': chart.changed_by_name,
            'changed_on': chart.changed_on,
            'changed_on_humanized': chart.changed_on_humanized,
            'created_by_name': chart.created_by_name,
            'created_on': chart.created_on,
            'created_on_humanized': chart.created_on_humanized,
            'tags': chart.tags,
            'owners': chart.owners,
        }
        mock_list.return_value = ([chart], 1)
        result = list_charts(search="search_chart")
        assert result.count == 1
        assert result.charts[0].slice_name == "search_chart"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_chart"
        assert "slice_name" in kwargs["search_columns"]
        assert "viz_type" in kwargs["search_columns"]
        assert "datasource_name" in kwargs["search_columns"]

    @patch('superset.daos.chart.ChartDAO.list')
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

    @patch('superset.daos.chart.ChartDAO.list')
    def test_list_charts_api_error(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        with pytest.raises(Exception) as excinfo:
            list_charts()
        assert "API request failed" in str(excinfo.value)

    @patch('superset.daos.chart.ChartDAO.find_by_id')
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
        mock_info.return_value = chart  # Only the chart object
        result = get_chart_info(1)
        assert result.slice_name == "Test Chart"

    @patch('superset.daos.chart.ChartDAO.find_by_id')
    def test_get_chart_info_not_found(self, mock_info):
        mock_info.return_value = None  # Not found returns None
        result = get_chart_info(999)
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
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

    def _mock_chart(self, id=1, viz_type="echarts_timeseries_line"):
        from unittest.mock import Mock
        chart = Mock()
        chart.id = id
        chart.slice_name = "Test Chart"
        chart.viz_type = viz_type
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = f"/chart/{id}"
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
        return chart

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    @patch('superset.mcp_service.tools.chart.create_chart.CreateChartCommand')
    def test_create_chart_echarts_line_full_fields(self, mock_cmd_cls, mock_run):
        mock_cmd = Mock()
        mock_cmd.run.return_value = self._mock_chart(id=123, viz_type="echarts_timeseries_line")
        mock_cmd_cls.return_value = mock_cmd
        req = EchartsTimeseriesLineChartCreateRequest(
            slice_name="Line Chart",
            datasource_id=1,
            x_axis="ds",
            x_axis_sort="ds",
            metrics=["sum__value"],
            groupby=["region"],
            contribution_mode="row",
            filters=[{"col": "region", "opr": "eq", "value": "West"}],
            series_limit=10,
            orderby=[["sum__value", False]],
            row_limit=100,
            truncate_metric=True,
            show_empty_columns=False,
        )
        resp = create_chart(req)
        assert resp.chart is not None
        assert resp.chart.viz_type == "echarts_timeseries_line"
        assert resp.error is None
        mock_cmd_cls.assert_called_once()
        chart_data = mock_cmd_cls.call_args[0][0]
        import json
        params = json.loads(chart_data["params"])
        assert "x_axis" in params
        assert "x_axis_sort" in params
        assert "contributionMode" in params
        assert "series_limit" in params
        assert "orderby" in params
        assert "row_limit" in params
        assert "truncate_metric" in params
        assert "show_empty_columns" in params 

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_echarts_timeseries_line_success(self, mock_run):
        mock_run.return_value = self._mock_chart(id=101, viz_type="echarts_timeseries_line")
        req = EchartsTimeseriesLineChartCreateRequest(
            slice_name="Line Chart",
            x_axis="ds",
            datasource_id=1,
            metrics=["sum__sales"],
            groupby=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
        )
        resp = create_chart(req)
        assert resp.chart is not None
        assert resp.chart.viz_type == "echarts_timeseries_line"
        assert resp.error is None
        mock_run.assert_called_once()

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_echarts_timeseries_bar_success(self, mock_run):
        mock_run.return_value = self._mock_chart(id=102, viz_type="echarts_timeseries_bar")
        req = EchartsTimeseriesBarChartCreateRequest(
            slice_name="Bar Chart",
            x_axis="ds",
            datasource_id=1,
            metrics=["sum__sales"],
            groupby=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
        )
        resp = create_chart(req)
        assert resp.chart is not None
        assert resp.chart.viz_type == "echarts_timeseries_bar"
        assert resp.error is None
        mock_run.assert_called_once()

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_echarts_area_success(self, mock_run):
        mock_run.return_value = self._mock_chart(id=103, viz_type="echarts_area")
        req = EchartsAreaChartCreateRequest(
            slice_name="Area Chart",
            x_axis="ds",
            datasource_id=1,
            metrics=["sum__sales"],
            groupby=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
        )
        resp = create_chart(req)
        assert resp.chart is not None
        assert resp.chart.viz_type == "echarts_area"
        assert resp.error is None
        mock_run.assert_called_once()

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_table_success(self, mock_run):
        chart = Mock()
        chart.id = 104
        chart.slice_name = "Table Chart"
        chart.viz_type = "table"
        chart.datasource_name = "test_ds"
        chart.datasource_type = "table"
        chart.url = "/chart/104"
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
        chart.to_model = lambda: ChartInfo(
            id=chart.id,
            slice_name=chart.slice_name,
            viz_type=chart.viz_type,
            datasource_name=chart.datasource_name,
            datasource_type=chart.datasource_type,
            url=chart.url,
            description=chart.description,
            cache_timeout=chart.cache_timeout,
            form_data=chart.form_data,
            query_context=chart.query_context,
            changed_by_name=chart.changed_by_name,
            changed_on=chart.changed_on,
            changed_on_humanized=chart.changed_on_humanized,
            created_by_name=chart.created_by_name,
            created_on=chart.created_on,
            created_on_humanized=chart.created_on_humanized,
            tags=chart.tags,
            owners=chart.owners,
        )
        mock_run.return_value = chart
        req = TableChartCreateRequest(
            slice_name="Table Chart",
            viz_type="table",
            datasource_id=1,
            all_columns=["region", "sales"],
            metrics=["sum__sales"],
            groupby=["region"],
            adhoc_filters=[{"col": "year", "opr": "eq", "value": 2024}],
            order_by_cols=[],
            row_limit=100,
            order_desc=True,
        )
        result = create_chart(request=req)
        assert result.chart is not None
        assert result.chart.slice_name == "Table Chart"
        assert result.chart.viz_type == "table"

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    def test_create_chart_error(self, mock_run):
        mock_run.side_effect = Exception("Chart creation failed")
        req = EchartsTimeseriesLineChartCreateRequest(
            slice_name="Fail Chart",
            x_axis="ds",
            datasource_id=1,
            metrics=["sum__sales"],
            groupby=["region"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
        )
        result = create_chart(req)
        assert result.error is not None
        assert "Chart creation failed" in result.error 

    @patch('superset.commands.chart.create.CreateChartCommand.run')
    @patch('superset.mcp_service.tools.chart.create_chart.CreateChartCommand')
    def test_create_chart_echarts_line_full_fields(self, mock_cmd_cls, mock_run):
        mock_cmd = Mock()
        mock_cmd.run.return_value = self._mock_chart(id=123, viz_type="echarts_timeseries_line")
        mock_cmd_cls.return_value = mock_cmd
        req = EchartsTimeseriesLineChartCreateRequest(
            slice_name="Line Chart",
            datasource_id=1,
            x_axis="ds",
            x_axis_sort="ds",
            metrics=["sum__value"],
            groupby=["region"],
            contribution_mode="row",
            filters=[{"col": "region", "opr": "eq", "value": "West"}],
            series_limit=10,
            orderby=[["sum__value", False]],
            row_limit=100,
            truncate_metric=True,
            show_empty_columns=False,
        )
        resp = create_chart(req)
        assert resp.chart is not None
        assert resp.chart.viz_type == "echarts_timeseries_line"
        assert resp.error is None
        mock_cmd_cls.assert_called_once()
        chart_data = mock_cmd_cls.call_args[0][0]
        import json
        params = json.loads(chart_data["params"])
        assert "x_axis" in params
        assert "x_axis_sort" in params
        assert "contributionMode" in params
        assert "series_limit" in params
        assert "orderby" in params
        assert "row_limit" in params
        assert "truncate_metric" in params
        assert "show_empty_columns" in params 