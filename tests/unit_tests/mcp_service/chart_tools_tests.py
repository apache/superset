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
get_chart_available_filters, create_chart)
"""

import logging
from unittest.mock import Mock, patch

import fastmcp.exceptions
import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp

# Updated imports for new simplified schemas
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    AxisConfig,
    ChartInfo,
    ColumnRef,
    CreateChartRequest,
    FilterConfig,
    LegendConfig,
    ListChartsRequest,
    TableChartConfig,
    XYChartConfig,
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
        request = ListChartsRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_charts", {"request": request.model_dump()}
        )
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
        request = ListChartsRequest(search="search_chart", page=1, page_size=10)
        result = await client.call_tool(
            "list_charts", {"request": request.model_dump()}
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
        request = ListChartsRequest(
            filters=filters,
            select_columns=["id", "slice_name"],
            order_column="changed_on",
            order_direction="desc",
            page=1,
            page_size=50,
        )
        result = await client.call_tool(
            "list_charts",
            {"request": request.model_dump()},
        )
        assert result.data.count == 0
        assert result.data.charts == []


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_api_error(mock_list, mcp_server):
    mock_list.side_effect = fastmcp.exceptions.ToolError("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(fastmcp.exceptions.ToolError) as excinfo:  # noqa: PT012
            request = ListChartsRequest(page=1, page_size=10)
            await client.call_tool("list_charts", {"request": request.model_dump()})
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
        result = await client.call_tool(
            "get_chart_info", {"request": {"identifier": 1}}
        )
        assert result.data["slice_name"] == "Test Chart"


@patch("superset.daos.chart.ChartDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_chart_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_chart_info", {"request": {"identifier": 999}}
        )
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


def _mock_chart(id=1, viz_type="table", form_data=None):
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
async def test_create_chart_table_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=101, viz_type="table")

    # Create a simple table chart request
    config = TableChartConfig(
        chart_type="table",
        columns=[
            ColumnRef(name="region", label="Region"),
            ColumnRef(name="sales", label="Sales"),
        ],
        filters=[FilterConfig(column="year", op="=", value=2024)],
        sort_by=["sales"],
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "table"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_xy_line_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=102, viz_type="echarts_timeseries_line")

    # Create a simple line chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date", label="Date"),
        y=[ColumnRef(name="sales", label="Sales")],
        kind="line",
        group_by=ColumnRef(name="region", label="Region"),
        x_axis=AxisConfig(title="Date", scale="linear"),
        y_axis=AxisConfig(title="Sales", format="$,.2f"),
        legend=LegendConfig(show=True, position="right"),
        filters=[FilterConfig(column="year", op="=", value=2024)],
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_xy_bar_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=103, viz_type="echarts_timeseries_bar")

    # Create a simple bar chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region", label="Region"),
        y=[ColumnRef(name="sales", label="Sales")],
        kind="bar",
        x_axis=AxisConfig(title="Region"),
        y_axis=AxisConfig(title="Sales", format="$,.2f"),
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_xy_area_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=104, viz_type="echarts_area")

    # Create a simple area chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date", label="Date"),
        y=[ColumnRef(name="sales", label="Sales")],
        kind="area",
        group_by=ColumnRef(name="region", label="Region"),
        x_axis=AxisConfig(title="Date", scale="linear"),
        y_axis=AxisConfig(title="Sales", format="$,.2f"),
        legend=LegendConfig(show=True, position="right"),
        filters=[FilterConfig(column="year", op="=", value=2024)],
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_area"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_error(mock_run, mcp_server):
    mock_run.side_effect = Exception("Chart creation failed")

    config = TableChartConfig(
        chart_type="table", columns=[ColumnRef(name="region", label="Region")]
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "create_chart", {"request": request.model_dump()}
        )
        assert result.data["error"] is not None
        assert "Chart creation failed" in result.data["error"]


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_table_minimal(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=105, viz_type="table")

    # Minimal table chart with just required fields
    config = TableChartConfig(
        chart_type="table", columns=[ColumnRef(name="region", label="Region")]
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "table"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_xy_minimal(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=106, viz_type="echarts_timeseries_line")

    # Create a minimal line chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="count")],  # Simple metric
        kind="line",
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_with_simple_metrics(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=107, viz_type="echarts_timeseries_bar")

    # Test with simple metrics like "count", "sum", etc.
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region"),
        y=[
            ColumnRef(name="count"),  # Should be passed as simple string
            ColumnRef(name="sales"),  # Should be passed as complex object
        ],
        kind="bar",
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_with_sql_aggregators(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=108, viz_type="echarts_timeseries_line")

    # Test with SQL aggregators
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[
            ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ColumnRef(name="orders", aggregate="COUNT", label="Order Count"),
            ColumnRef(name="revenue", aggregate="AVG", label="Average Revenue"),
        ],
        kind="line",
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_comprehensive_metrics(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=109, viz_type="echarts_timeseries_bar")

    # Test comprehensive metric scenarios
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region"),
        y=[
            ColumnRef(name="count"),  # Simple string metric
            ColumnRef(
                name="sales", aggregate="SUM", label="Total Sales"
            ),  # SQL aggregator
            ColumnRef(
                name="revenue", aggregate="AVG", label="Average Revenue"
            ),  # SQL aggregator
            ColumnRef(
                name="orders", aggregate="COUNT", label="Order Count"
            ),  # SQL aggregator
            ColumnRef(
                name="profit", aggregate="MAX", label="Max Profit"
            ),  # SQL aggregator
        ],
        kind="bar",
        group_by=ColumnRef(name="category"),
        x_axis=AxisConfig(title="Region", format="string"),
        y_axis=AxisConfig(title="Values", format="$,.2f"),
        legend=LegendConfig(show=True, position="top"),
        filters=[
            FilterConfig(column="year", op="=", value=2024),
            FilterConfig(column="status", op="!=", value="cancelled"),
        ],
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_create_chart_xy_scatter_success(mock_run, mcp_server):
    mock_run.return_value = _mock_chart(id=110, viz_type="echarts_timeseries_scatter")

    # Create a scatter chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="order_date"),
        y=[ColumnRef(name="count")],  # Simple metric for scatter
        kind="scatter",
        group_by=ColumnRef(name="deal_size"),
        x_axis=AxisConfig(title="Order Date", format="smart_date"),
        y_axis=AxisConfig(title="Count", format="SMART_NUMBER"),
        legend=LegendConfig(show=True, position="top"),
        filters=[FilterConfig(column="year", op="=", value=2024)],
    )

    request = CreateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool("create_chart", {"request": request.model_dump()})
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_scatter"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.mcp_service.model_tools.ModelGetInfoTool._find_object")
@pytest.mark.asyncio
async def test_get_chart_info_by_uuid(mock_find_object, mcp_server):
    """Test getting chart info using UUID identifier."""
    chart = Mock()
    chart.id = 1
    chart.slice_name = "Test Chart UUID"
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

    mock_find_object.return_value = chart
    async with Client(mcp_server) as client:
        uuid_str = "b2c3d4e5-f6g7-8901-bcde-fg2345678901"
        result = await client.call_tool(
            "get_chart_info", {"request": {"identifier": uuid_str}}
        )
        assert result.data["slice_name"] == "Test Chart UUID"
