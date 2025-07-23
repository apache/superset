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
Comprehensive unit tests for MCP create_chart tool
"""

import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    AxisConfig,
    ColumnRef,
    CreateChartRequest,
    FilterConfig,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


def _mock_chart(
    id: int = 1, viz_type: str = "table", slice_name: str = "Test Chart"
) -> Mock:
    """Create a mock chart object."""
    chart = Mock()
    chart.id = id
    chart.slice_name = slice_name
    chart.viz_type = viz_type
    return chart


class TestCreateChart:
    """Comprehensive tests for create_chart MCP tool."""

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_table_chart_minimal(self, mock_run, mcp_server):
        """Test creating a minimal table chart."""
        mock_run.return_value = _mock_chart(id=1, viz_type="table")

        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="col1")])
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["id"] == 1
            assert result.data["chart"]["viz_type"] == "table"
            assert result.data["chart"]["url"] == "/explore/?slice_id=1"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_table_chart_with_features(self, mock_run, mcp_server):
        """Test creating a table chart with multiple features."""
        mock_run.return_value = _mock_chart(id=2, viz_type="table")

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Total Sales", aggregate="SUM"),
                ColumnRef(name="profit", label="Profit", aggregate="AVG"),
            ],
            filters=[
                FilterConfig(column="year", op="=", value="2024"),
                FilterConfig(column="status", op="!=", value="cancelled"),
            ],
            sort_by=["sales", "profit"],
        )
        request = CreateChartRequest(dataset_id="5", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "table"
            assert result.data["chart"]["url"] == "/explore/?slice_id=2"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_line_chart(self, mock_run, mcp_server):
        """Test creating a line chart."""
        mock_run.return_value = _mock_chart(id=10, viz_type="echarts_timeseries_line")

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="value", aggregate="SUM")],
            kind="line",
        )
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "echarts_timeseries_line"
            assert result.data["chart"]["url"] == "/explore/?slice_id=10"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_bar_chart(self, mock_run, mcp_server):
        """Test creating a bar chart."""
        mock_run.return_value = _mock_chart(id=20, viz_type="echarts_timeseries_bar")

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="category"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="bar",
            group_by=ColumnRef(name="quarter"),
            y_axis=AxisConfig(title="Revenue ($)", format="$,.0f"),
        )
        request = CreateChartRequest(dataset_id="7", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "echarts_timeseries_bar"
            assert result.data["chart"]["url"] == "/explore/?slice_id=20"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_area_chart(self, mock_run, mcp_server):
        """Test creating an area chart."""
        mock_run.return_value = _mock_chart(id=30, viz_type="echarts_area")

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="month"),
            y=[ColumnRef(name="cumulative_sales", aggregate="SUM")],
            kind="area",
            legend=LegendConfig(show=False),
        )
        request = CreateChartRequest(dataset_id="2", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "echarts_area"
            assert result.data["chart"]["url"] == "/explore/?slice_id=30"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_scatter_chart(self, mock_run, mcp_server):
        """Test creating a scatter chart."""
        mock_run.return_value = _mock_chart(
            id=40, viz_type="echarts_timeseries_scatter"
        )

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price"),
            y=[ColumnRef(name="quantity", aggregate="SUM")],
            kind="scatter",
            group_by=ColumnRef(name="product_type"),
        )
        request = CreateChartRequest(dataset_id="4", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "echarts_timeseries_scatter"
            assert result.data["chart"]["url"] == "/explore/?slice_id=40"
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_with_complex_config(self, mock_run, mcp_server):
        """Test creating chart with complex configuration."""
        mock_run.return_value = _mock_chart(id=50, viz_type="echarts_timeseries_line")

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="timestamp", label="Time"),
            y=[
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
                ColumnRef(name="orders", label="Orders", aggregate="COUNT"),
            ],
            kind="line",
            group_by=ColumnRef(name="region", label="Region"),
            x_axis=AxisConfig(title="Time Period", format="smart_date"),
            y_axis=AxisConfig(title="Metrics", format="$,.2f", scale="linear"),
            legend=LegendConfig(show=True, position="bottom"),
            filters=[
                FilterConfig(column="status", op="=", value="active"),
                FilterConfig(column="date", op=">=", value="2024-01-01"),
            ],
        )
        request = CreateChartRequest(dataset_id="3", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["viz_type"] == "echarts_timeseries_line"
            assert result.data["chart"]["id"] == 50
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_command_failure(self, mock_run, mcp_server):
        """Test handling of CreateChartCommand failure."""
        mock_run.side_effect = Exception("Database connection failed")

        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="col1")])
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["chart"] is None
            assert result.data["error"] is not None
            assert "Database connection failed" in result.data["error"]

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_url_format_verification(self, mock_run, mcp_server):
        """Test that created chart returns proper explore URL format."""
        mock_run.return_value = _mock_chart(id=12345)

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            # Verify URL format is exactly as expected: /explore/?slice_id=<id>
            assert result.data["chart"]["url"] == "/explore/?slice_id=12345"
            assert result.data["chart"]["id"] == 12345

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_with_many_metrics(self, mock_run, mcp_server):
        """Test creating chart with many metrics."""
        mock_run.return_value = _mock_chart(id=100, viz_type="table")

        # Create 10 columns with different aggregates
        columns = [
            ColumnRef(name=f"metric_{i}", aggregate="SUM" if i % 2 == 0 else "COUNT")
            for i in range(10)
        ]

        config = TableChartConfig(chart_type="table", columns=columns)
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["id"] == 100
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_with_many_filters(self, mock_run, mcp_server):
        """Test creating chart with many filters."""
        mock_run.return_value = _mock_chart(id=101, viz_type="echarts_timeseries_bar")

        # Create 8 filters
        filters = [
            FilterConfig(
                column=f"filter_col_{i}",
                op="=" if i % 2 == 0 else "!=",
                value=f"value_{i}",
            )
            for i in range(8)
        ]

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x_col"),
            y=[ColumnRef(name="y_col")],
            kind="bar",
            filters=filters,
        )
        request = CreateChartRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_chart", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["chart"]["id"] == 101
            mock_run.assert_called_once()

    @patch("superset.commands.chart.create.CreateChartCommand.run")
    @pytest.mark.asyncio
    async def test_create_chart_dataset_id_types(self, mock_run, mcp_server):
        """Test chart creation with different dataset_id formats."""
        mock_run.return_value = _mock_chart(id=200)

        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="col1")])

        # Test various dataset_id formats
        dataset_ids = ["1", "999", "123456789"]

        for dataset_id in dataset_ids:
            request = CreateChartRequest(dataset_id=dataset_id, config=config)
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "create_chart", {"request": request.model_dump()}
                )
                assert result.data["error"] is None
                assert result.data["chart"]["id"] == 200
