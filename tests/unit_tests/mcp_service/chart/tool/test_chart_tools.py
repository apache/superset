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
get_chart_available_filters, generate_chart)
"""

import logging
from unittest.mock import MagicMock, Mock, patch

import fastmcp.exceptions
import pytest
from fastmcp import Client

# Updated imports for new simplified schemas
from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ChartInfo,
    ColumnRef,
    FilterConfig,
    GenerateChartRequest,
    LegendConfig,
    ListChartsRequest,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.mcp_app import mcp

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
    chart.uuid = "test-chart-uuid-1"
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
        assert charts[0].uuid == "test-chart-uuid-1"
        assert charts[0].viz_type == "bar"

        # Verify UUID is in default columns (charts don't have slugs)
        assert "uuid" in result.data.columns_requested
        assert "uuid" in result.data.columns_loaded


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
        assert "description" in kwargs["search_columns"]


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
        result = await client.call_tool("get_chart_available_filters", {"request": {}})
        assert hasattr(result.data, "column_operators")
        assert isinstance(result.data.column_operators, dict)


@pytest.mark.asyncio
async def test_get_chart_available_filters_exception_handling(mcp_server):
    # No exception expected in normal operation
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_chart_available_filters", {"request": {}})
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


def _mock_dataset(id: int = 1) -> Mock:
    """Create a mock dataset object with all required attributes for validation."""
    dataset = Mock()
    dataset.id = id
    dataset.table_name = "test_table"
    dataset.schema = "public"

    # Create mock database
    mock_database = Mock()
    mock_database.database_name = "test_db"
    dataset.database = mock_database

    # Create mock columns with all required attributes
    mock_columns = []
    column_names = ["region", "sales", "date", "year", "category", "quantity"]
    for name in column_names:
        mock_col = Mock()
        mock_col.column_name = name
        mock_col.type = "varchar" if name in ["region", "category"] else "integer"
        mock_col.description = f"Mock {name} column"
        mock_col.is_dttm = name == "date"
        mock_col.python_date_format = None
        mock_col.verbose_name = None
        mock_columns.append(mock_col)

    dataset.columns = mock_columns
    dataset.metrics = []  # No metrics for simplicity

    return dataset


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_table_success(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=101, viz_type="table")
    mock_find_dataset.return_value = _mock_dataset(id=1)

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

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "table"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_xy_line_success(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=102, viz_type="echarts_timeseries_line")
    mock_find_dataset.return_value = _mock_dataset(id=1)

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

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_xy_bar_success(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=103, viz_type="echarts_timeseries_bar")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Create a simple bar chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region", label="Region"),
        y=[ColumnRef(name="sales", label="Sales")],
        kind="bar",
        x_axis=AxisConfig(title="Region"),
        y_axis=AxisConfig(title="Sales", format="$,.2f"),
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_xy_area_success(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=104, viz_type="echarts_area")
    mock_find_dataset.return_value = _mock_dataset(id=1)

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

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_area"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_error(mock_run, mock_find_dataset, mcp_server):
    mock_run.side_effect = Exception("Chart creation failed")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    config = TableChartConfig(
        chart_type="table", columns=[ColumnRef(name="region", label="Region")]
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        # The result should contain error information
        assert result.data is not None
        # generate_chart returns error response on chart creation failure
        assert result.data.get("success") is False
        assert result.data.get("error") is not None
        # The error message should be in the error dict
        error_msg = str(result.data.get("error", {}))
        assert (
            "Chart creation failed" in error_msg
            or "CHART_GENERATION_FAILED" in error_msg
        )


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_table_minimal(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=105, viz_type="table")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Minimal table chart with just required fields
    config = TableChartConfig(
        chart_type="table", columns=[ColumnRef(name="region", label="Region")]
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "table"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_xy_minimal(mock_run, mock_find_dataset, mcp_server):
    mock_run.return_value = _mock_chart(id=106, viz_type="echarts_timeseries_line")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Create a minimal line chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="sales")],  # Use existing column in mock dataset
        kind="line",
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_with_simple_metrics(
    mock_run, mock_find_dataset, mcp_server
):
    mock_run.return_value = _mock_chart(id=107, viz_type="echarts_timeseries_bar")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Test with simple metrics like "count", "sum", etc.
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region"),
        y=[
            ColumnRef(name="quantity"),  # Use existing column in mock dataset
            ColumnRef(name="sales"),  # Should be passed as complex object
        ],
        kind="bar",
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_with_sql_aggregators(
    mock_run, mock_find_dataset, mcp_server
):
    mock_run.return_value = _mock_chart(id=108, viz_type="echarts_timeseries_line")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Test with SQL aggregators
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[
            ColumnRef(name="sales", aggregate="SUM", label="Total Sales"),
            ColumnRef(name="quantity", aggregate="COUNT", label="Quantity Count"),
            ColumnRef(name="sales", aggregate="AVG", label="Average Sales"),
        ],
        kind="line",
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_line"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_comprehensive_metrics(
    mock_run, mock_find_dataset, mcp_server
):
    mock_run.return_value = _mock_chart(id=109, viz_type="echarts_timeseries_bar")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Test comprehensive metric scenarios
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="region"),
        y=[
            ColumnRef(name="quantity"),  # Use existing column
            ColumnRef(
                name="sales", aggregate="SUM", label="Total Sales"
            ),  # SQL aggregator
            ColumnRef(
                name="sales", aggregate="AVG", label="Average Sales"
            ),  # SQL aggregator with same column
            ColumnRef(
                name="quantity", aggregate="COUNT", label="Quantity Count"
            ),  # SQL aggregator
            ColumnRef(
                name="sales", aggregate="MAX", label="Max Sales"
            ),  # SQL aggregator
        ],
        kind="bar",
        group_by=ColumnRef(name="category"),
        x_axis=AxisConfig(title="Region", format="string"),
        y_axis=AxisConfig(title="Values", format=",.0f"),
        legend=LegendConfig(show=True, position="top"),
        filters=[
            FilterConfig(column="year", op="=", value=2024),
            FilterConfig(column="category", op="!=", value="cancelled"),
        ],
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        # Debug the response if there's an error
        if resp.data.get("error"):
            print(f"Error in response: {resp.data['error']}")
            print(f"Full response: {resp.data}")
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_bar"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@patch("superset.commands.chart.create.CreateChartCommand.run")
@pytest.mark.asyncio
async def test_generate_chart_xy_scatter_success(
    mock_run, mock_find_dataset, mcp_server
):
    mock_run.return_value = _mock_chart(id=110, viz_type="echarts_timeseries_scatter")
    mock_find_dataset.return_value = _mock_dataset(id=1)

    # Create a scatter chart request
    config = XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="date"),
        y=[ColumnRef(name="sales")],  # Use existing column for scatter
        kind="scatter",
        group_by=ColumnRef(name="category"),
        x_axis=AxisConfig(title="Date", format="smart_date"),
        y_axis=AxisConfig(title="Sales", format="SMART_NUMBER"),
        legend=LegendConfig(show=True, position="top"),
        filters=[FilterConfig(column="year", op="=", value=2024)],
    )

    request = GenerateChartRequest(dataset_id="1", config=config)

    async with Client(mcp_server) as client:
        resp = await client.call_tool(
            "generate_chart", {"request": request.model_dump()}
        )
        assert resp.data["chart"] is not None
        assert resp.data["chart"]["viz_type"] == "echarts_timeseries_scatter"
        assert resp.data["error"] is None
        mock_run.assert_called_once()


@patch("superset.mcp_service.mcp_core.ModelGetInfoCore._find_object")
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


@patch("superset.daos.chart.ChartDAO.list")
@pytest.mark.asyncio
async def test_list_charts_custom_uuid_columns(mock_list, mcp_server):
    """Test that custom column selection includes UUID when explicitly requested."""
    chart = Mock()
    chart.id = 1
    chart.slice_name = "Custom Columns Chart"
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
    chart.uuid = "test-custom-chart-uuid"
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
        "uuid": chart.uuid,
        "tags": chart.tags,
        "owners": chart.owners,
    }
    mock_list.return_value = ([chart], 1)
    async with Client(mcp_server) as client:
        request = ListChartsRequest(
            select_columns=["id", "slice_name", "uuid"], page=1, page_size=10
        )
        result = await client.call_tool(
            "list_charts", {"request": request.model_dump()}
        )
        charts = result.data.charts
        assert len(charts) == 1
        assert charts[0].uuid == "test-custom-chart-uuid"

        # Verify custom columns include UUID
        assert "uuid" in result.data.columns_requested
        assert "uuid" in result.data.columns_loaded


class TestChartSortableColumns:
    """Test sortable columns configuration for chart tools."""

    def test_chart_sortable_columns_definition(self):
        """Test that chart sortable columns are properly defined."""
        from superset.mcp_service.chart.tool.list_charts import SORTABLE_CHART_COLUMNS

        assert SORTABLE_CHART_COLUMNS == [
            "id",
            "slice_name",
            "viz_type",
            "datasource_name",
            "description",
            "changed_on",
            "created_on",
        ]
        # Ensure no computed properties are included
        assert "changed_on_delta_humanized" not in SORTABLE_CHART_COLUMNS
        assert "changed_by_name" not in SORTABLE_CHART_COLUMNS
        assert "uuid" not in SORTABLE_CHART_COLUMNS

    @patch("superset.daos.chart.ChartDAO")
    @patch("superset.mcp_service.auth.get_user_from_request")
    def test_list_charts_with_valid_order_column(self, mock_get_user, mock_chart_dao):
        """Test list_charts with valid order column."""
        from superset.mcp_service.chart.tool.list_charts import list_charts

        mock_get_user.return_value = MagicMock(id=1)
        mock_tool = MagicMock()
        mock_tool.run_tool.return_value = MagicMock(charts=[], count=0)

        with patch(
            "superset.mcp_service.chart.tool.list_charts.ModelListCore",
            return_value=mock_tool,
        ):
            # Test with valid sortable column
            request = ListChartsRequest(
                order_column="slice_name", order_direction="asc"
            )
            list_charts.fn(request)

            # Verify the tool was called with the correct order column
            mock_tool.run_tool.assert_called_once()
            call_args = mock_tool.run_tool.call_args[1]
            assert call_args["order_column"] == "slice_name"
            assert call_args["order_direction"] == "asc"

    def test_sortable_columns_in_docstring(self):
        """Test that sortable columns are documented in tool docstring."""
        from superset.mcp_service.chart.tool.list_charts import (
            list_charts,
            SORTABLE_CHART_COLUMNS,
        )

        # Check list_charts docstring (stored in description after @mcp.tool)
        assert hasattr(list_charts, "description")
        assert "Sortable columns for order_column:" in list_charts.description
        for col in SORTABLE_CHART_COLUMNS:
            assert col in list_charts.description
