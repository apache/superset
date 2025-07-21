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
Unit tests for MCP chart tools (list_charts, get_chart_info,
get_chart_available_filters)
"""

import json
import logging
from unittest.mock import Mock, patch

import fastmcp.exceptions
import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp

# Updated imports for new tool structure
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartInfo,
    EchartsAreaChartCreateRequest,
    EchartsTimeseriesBarChartCreateRequest,
    EchartsTimeseriesLineChartCreateRequest,
    TableChartCreateRequest,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_basic(mock_list, mcp_server):
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
    chart._mapping = {
        "id": chart.id,
        "slice_name": chart.slice_name,
        "viz_type": chart.viz_type,
        "datasource_name": chart.datasource_name,
        "datasource_type": chart.datasource_type,
        "url": chart.url,
        "description": chart.description,
        "cache_timeout": chart.cache_timeout,
        "form_data": chart.form_data,
        "query_context": chart.query_context,
        "changed_by_name": chart.changed_by_name,
        "changed_on": chart.changed_on,
        "changed_on_humanized": chart.changed_on_humanized,
        "created_by_name": chart.created_by_name,
        "created_on": chart.created_on,
        "created_on_humanized": chart.created_on_humanized,
        "tags": chart.tags,
        "owners": chart.owners,
    }
    mock_list.return_value = ([chart], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_charts", {"page": 1, "page_size": 10})
        charts = result.data.charts
        assert len(charts) == 1
        assert charts[0].slice_name == "Test Chart"
        assert charts[0].viz_type == "bar"


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_with_search(mock_list, mcp_server):
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
    chart._mapping = {
        "id": chart.id,
        "slice_name": chart.slice_name,
        "viz_type": chart.viz_type,
        "datasource_name": chart.datasource_name,
        "datasource_type": chart.datasource_type,
        "url": chart.url,
        "description": chart.description,
        "cache_timeout": chart.cache_timeout,
        "form_data": chart.form_data,
        "query_context": chart.query_context,
        "changed_by_name": chart.changed_by_name,
        "changed_on": chart.changed_on,
        "changed_on_humanized": chart.changed_on_humanized,
        "created_by_name": chart.created_by_name,
        "created_on": chart.created_on,
        "created_on_humanized": chart.created_on_humanized,
        "tags": chart.tags,
        "owners": chart.owners,
    }
    mock_list.return_value = ([chart], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_charts", {"search": "search_chart", "page": 1, "page_size": 10}
        )
        charts = result.data.charts
        assert len(charts) == 1
        assert charts[0].slice_name == "search_chart"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_chart"
        assert "slice_name" in kwargs["search_columns"]
        assert "viz_type" in kwargs["search_columns"]
        assert "datasource_name" in kwargs["search_columns"]


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_with_filters(mock_list, mcp_server):
    mock_list.return_value = ([], 0)
    filters = [
        {"col": "slice_name", "opr": "sw", "value": "Sales"},
        {"col": "viz_type", "opr": "eq", "value": "bar"},
    ]
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_charts",
            {
                "filters": filters,
                "select_columns": ["id", "slice_name"],
                "order_column": "changed_on",
                "order_direction": "desc",
                "page": 1,
                "page_size": 50,
            },
        )
        assert result.data.count == 0
        assert result.data.charts == []


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_api_error(mock_list, mcp_server):
    mock_list.side_effect = fastmcp.exceptions.ToolError("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(fastmcp.exceptions.ToolError) as excinfo:
            await client.call_tool("list_charts", {"page": 1, "page_size": 10})
        assert "API request failed" in str(excinfo.value)


@patch("superset.daos.chart.ChartDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_chart_info_success(mock_info, mcp_server):
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
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_chart_info", {"chart_id": 1})
        assert result.data["slice_name"] == "Test Chart"


@patch("superset.daos.chart.ChartDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_chart_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_chart_info", {"chart_id": 999})
        assert result.data["error_type"] == "not_found"


@pytest.mark.xfail(
    reason="MCP protocol bug: dict fields named column_operators are deserialized as "
    "custom types (Column_Operators). TODO: revisit after protocol fix."
)
@pytest.mark.asyncio
async def test_get_chart_available_filters_success(mcp_server):
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_chart_available_filters", {})
        assert hasattr(result.data, "column_operators")
        assert isinstance(result.data.column_operators, dict)


@pytest.mark.asyncio
async def test_get_chart_available_filters_exception_handling(mcp_server):
    # No exception expected in normal operation
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_chart_available_filters", {})
        assert hasattr(result.data, "column_operators")


def _mock_chart(id=1, viz_type="echarts_timeseries_line", form_data=None):
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
    chart.form_data = form_data or {}
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


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_line_full_fields(mock_run, mcp_server):
    mock_cmd = Mock()
    mock_cmd.run.return_value = _mock_chart(id=123, viz_type="echarts_timeseries_line")
    mock_run.return_value = mock_cmd.run.return_value
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
    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": req.model_dump()})
        assert resp.data.chart is not None
        assert resp.data.chart.viz_type == "echarts_timeseries_line"
        assert resp.data.error is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_timeseries_line_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=101, viz_type="echarts_timeseries_line")
    req = EchartsTimeseriesLineChartCreateRequest(
        slice_name="Line Chart",
        x_axis="ds",
        datasource_id=1,
        metrics=["sum__sales"],
        groupby=["region"],
        filters=[{"col": "year", "opr": "eq", "value": 2024}],
    )
    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": req.dict()})
        assert resp.data.chart is not None
        assert resp.data.chart.viz_type == "echarts_timeseries_line"
        assert resp.data.error is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_timeseries_bar_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=102, viz_type="echarts_timeseries_bar")
    req = EchartsTimeseriesBarChartCreateRequest(
        slice_name="Bar Chart",
        x_axis="ds",
        datasource_id=1,
        metrics=["sum__sales"],
        groupby=["region"],
        filters=[{"col": "year", "opr": "eq", "value": 2024}],
    )
    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": req.dict()})
        assert resp.data.chart is not None
        assert resp.data.chart.viz_type == "echarts_timeseries_bar"
        assert resp.data.error is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_area_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=103, viz_type="echarts_area")
    req = EchartsAreaChartCreateRequest(
        slice_name="Area Chart",
        x_axis="ds",
        datasource_id=1,
        metrics=["sum__sales"],
        groupby=["region"],
        filters=[{"col": "year", "opr": "eq", "value": 2024}],
    )
    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": req.dict()})
        assert resp.data.chart is not None
        assert resp.data.chart.viz_type == "echarts_area"
        assert resp.data.error is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_table_success(mock_run, mcp_server):
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
    async with Client(mcp_server) as client:
        result = await client.call_tool("create_chart", {"request": req.dict()})
        assert result.data.chart is not None
        assert result.data.chart.slice_name == "Table Chart"
        assert result.data.chart.viz_type == "table"


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_error(mock_run, mcp_server):
    mock_run.side_effect = fastmcp.exceptions.ToolError("Chart creation failed")
    req = EchartsTimeseriesLineChartCreateRequest(
        slice_name="Fail Chart",
        x_axis="ds",
        datasource_id=1,
        metrics=["sum__sales"],
        groupby=["region"],
        filters=[{"col": "year", "opr": "eq", "value": 2024}],
    )
    async with Client(mcp_server) as client:
        result = await client.call_tool("create_chart", {"request": req.dict()})
        assert result.data.error is not None
        assert "Chart creation failed" in result.data.error


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_line_with_all_options(mock_run, mcp_server):
    # Arrange
    mock_chart = Mock()
    mock_chart.id = 101
    mock_chart.slice_name = "ECharts Line All Options"
    mock_chart.viz_type = "echarts_timeseries_line"
    mock_chart.datasource_name = "test_ds"
    mock_chart.datasource_type = "table"
    mock_chart.url = "/chart/101"
    mock_chart.description = "desc"
    mock_chart.cache_timeout = 60
    mock_chart.form_data = {}
    mock_chart.query_context = {}
    mock_chart.changed_by_name = "admin"
    mock_chart.changed_on = None
    mock_chart.changed_on_humanized = "1 day ago"
    mock_chart.created_by_name = "admin"
    mock_chart.created_on = None
    mock_chart.created_on_humanized = "2 days ago"
    mock_chart.tags = []
    mock_chart.owners = []
    mock_run.return_value = mock_chart

    req = EchartsTimeseriesLineChartCreateRequest(
        slice_name="ECharts Line All Options",
        viz_type="echarts_timeseries_line",
        datasource_id=1,
        datasource_type="table",
        x_axis="ds",
        metrics=["sum__value"],
        groupby=["region"],
        stack=True,
        area=True,
        smooth=True,
        show_value=True,
        color_scheme="supersetColors",
        legend_type="scroll",
        legend_orientation="horizontal",
        tooltip_sorting="value_desc",
        y_axis_format=",.2f",
        y_axis_bounds=[0, 100],
        x_axis_time_format="%Y-%m-%d",
        rich_tooltip=True,
        extra_options={"custom_option": 123, "another_option": "abc"},
    )
    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": req.model_dump()})
        assert resp.data.chart is not None
        assert resp.data.chart.viz_type == "echarts_timeseries_line"
        assert resp.data.error is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_echarts_line_duplicate_column_removal(mock_run, mcp_server):
    # The backend should remove 'date' from groupby, so only 'region' remains
    expected_form_data = {"groupby": ["region"]}
    mock_chart = _mock_chart(
        id=105, viz_type="echarts_timeseries_line", form_data=expected_form_data
    )
    mock_run.return_value = mock_chart
    req = EchartsTimeseriesLineChartCreateRequest(
        slice_name="Line Chart No Duplicate",
        datasource_id=1,
        datasource_type="table",
        x_axis="date",
        metrics=["sum__value"],
        groupby=["date", "region"],  # Duplicate x_axis in groupby
    )
    async with Client(mcp_server) as client:
        result = await client.call_tool("create_chart", {"request": req.model_dump()})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert "error" not in data or not data["error"]
        # The groupby in the chart's form_data should not include 'date'
        chart = data["chart"]
        form_data = chart.get("form_data")
        if isinstance(form_data, str):
            import json as _json

            form_data = _json.loads(form_data)
        groupby = form_data.get("groupby", [])
        assert "date" not in groupby
        assert "region" in groupby
