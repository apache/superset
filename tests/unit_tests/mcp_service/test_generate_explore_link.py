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
Comprehensive unit tests for MCP generate_explore_link tool
"""

import logging
from unittest.mock import patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    GenerateExploreLinkRequest,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


class TestGenerateExploreLink:
    """Comprehensive tests for generate_explore_link MCP tool."""

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_minimal(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for minimal table chart."""
        mock_create_form_data.return_value = "test_form_data_key_123"

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="region")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert (
                result.data["url"] == "/explore/?form_data_key=test_form_data_key_123"
            )
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_with_features(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for table chart with features."""
        mock_create_form_data.return_value = "comprehensive_key_456"

        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Sales Region"),
                ColumnRef(name="revenue", label="Total Revenue", aggregate="SUM"),
                ColumnRef(name="orders", label="Order Count", aggregate="COUNT"),
            ],
            filters=[
                FilterConfig(column="year", op="=", value="2024"),
                FilterConfig(column="status", op="!=", value="cancelled"),
            ],
            sort_by=["revenue", "orders"],
        )
        request = GenerateExploreLinkRequest(dataset_id="5", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=comprehensive_key_456"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_line_chart_explore_link(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for line chart."""
        mock_create_form_data.return_value = "line_chart_key_789"

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date", label="Date"),
            y=[
                ColumnRef(name="sales", label="Daily Sales", aggregate="SUM"),
                ColumnRef(name="orders", label="Order Count", aggregate="COUNT"),
            ],
            kind="line",
            group_by=ColumnRef(name="region", label="Sales Region"),
            x_axis=AxisConfig(title="Time Period", format="smart_date"),
            y_axis=AxisConfig(title="Sales Metrics", format="$,.2f"),
            legend=LegendConfig(show=True, position="bottom"),
        )
        request = GenerateExploreLinkRequest(dataset_id="3", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=line_chart_key_789"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_bar_chart_explore_link(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for bar chart."""
        mock_create_form_data.return_value = "bar_chart_key_abc"

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="product_category", label="Category"),
            y=[ColumnRef(name="revenue", label="Revenue", aggregate="SUM")],
            kind="bar",
            group_by=ColumnRef(name="quarter", label="Quarter"),
            y_axis=AxisConfig(title="Revenue ($)", format="$,.0f"),
        )
        request = GenerateExploreLinkRequest(dataset_id="7", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=bar_chart_key_abc"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_area_chart_explore_link(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for area chart."""
        mock_create_form_data.return_value = "area_chart_key_def"

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="month", label="Month"),
            y=[
                ColumnRef(
                    name="cumulative_sales", label="Cumulative Sales", aggregate="SUM"
                )
            ],
            kind="area",
            legend=LegendConfig(show=False),
        )
        request = GenerateExploreLinkRequest(dataset_id="2", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=area_chart_key_def"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_scatter_chart_explore_link(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link for scatter chart."""
        mock_create_form_data.return_value = "scatter_chart_key_ghi"

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="price", label="Unit Price"),
            y=[ColumnRef(name="quantity", label="Quantity Sold", aggregate="SUM")],
            kind="scatter",
            group_by=ColumnRef(name="product_type", label="Product Type"),
            x_axis=AxisConfig(title="Price ($)", format="$,.2f"),
            y_axis=AxisConfig(title="Quantity", format=",.0f"),
        )
        request = GenerateExploreLinkRequest(dataset_id="4", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=scatter_chart_key_ghi"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_cache_failure_fallback(
        self, mock_create_form_data, mcp_server
    ):
        """Test fallback when form_data cache creation fails."""
        mock_create_form_data.side_effect = Exception("Cache storage failed")

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            # Should fallback to basic URL format
            assert result.data["error"] is None
            assert (
                result.data["url"] == "/explore/?datasource_type=table&datasource_id=1"
            )

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_database_lock_fallback(
        self, mock_create_form_data, mcp_server
    ):
        """Test fallback when database is locked."""
        from sqlalchemy.exc import OperationalError

        mock_create_form_data.side_effect = OperationalError(
            "database is locked", None, None
        )

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales")],
            kind="line",
        )
        request = GenerateExploreLinkRequest(dataset_id="5", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            # Should fallback to basic dataset URL
            assert result.data["error"] is None
            assert (
                result.data["url"] == "/explore/?datasource_type=table&datasource_id=5"
            )

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_columns(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link with many columns."""
        mock_create_form_data.return_value = "many_columns_key"

        # Create 15 columns
        columns = [
            ColumnRef(
                name=f"metric_{i}",
                label=f"Metric {i}",
                aggregate="SUM" if i % 2 == 0 else "COUNT",
            )
            for i in range(15)
        ]

        config = TableChartConfig(chart_type="table", columns=columns)
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=many_columns_key"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_filters(
        self, mock_create_form_data, mcp_server
    ):
        """Test generating explore link with many filters."""
        mock_create_form_data.return_value = "many_filters_key"

        # Create 12 filters
        filters = [
            FilterConfig(
                column=f"filter_col_{i}",
                op="=" if i % 3 == 0 else "!=",
                value=f"value_{i}",
            )
            for i in range(12)
        ]

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="x_col"),
            y=[ColumnRef(name="y_col")],
            kind="bar",
            filters=filters,
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=many_filters_key"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_explore_link_url_format_consistency(
        self, mock_create_form_data, mcp_server
    ):
        """Test that all generated URLs follow consistent format."""
        mock_create_form_data.return_value = "consistency_test_key"

        configs = [
            TableChartConfig(chart_type="table", columns=[ColumnRef(name="col1")]),
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                kind="line",
            ),
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                kind="bar",
            ),
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                kind="area",
            ),
            XYChartConfig(
                chart_type="xy",
                x=ColumnRef(name="x"),
                y=[ColumnRef(name="y")],
                kind="scatter",
            ),
        ]

        for i, config in enumerate(configs):
            request = GenerateExploreLinkRequest(dataset_id=str(i + 1), config=config)

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_explore_link", {"request": request.model_dump()}
                )

                # All URLs should follow the same format
                assert (
                    result.data["url"] == "/explore/?form_data_key=consistency_test_key"
                )
                assert result.data["error"] is None

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_dataset_id_types(
        self, mock_create_form_data, mcp_server
    ):
        """Test explore link generation with different dataset_id formats."""
        mock_create_form_data.return_value = "dataset_test_key"

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )

        # Test various dataset_id formats
        dataset_ids = ["1", "42", "999", "123456789"]

        for dataset_id in dataset_ids:
            request = GenerateExploreLinkRequest(dataset_id=dataset_id, config=config)
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_explore_link", {"request": request.model_dump()}
                )
                assert result.data["error"] is None
                assert result.data["url"] == "/explore/?form_data_key=dataset_test_key"

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_complex_configuration(
        self, mock_create_form_data, mcp_server
    ):
        """Test explore link generation with complex chart configuration."""
        mock_create_form_data.return_value = "complex_config_key"

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="timestamp", label="Time"),
            y=[
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
                ColumnRef(name="orders", label="Orders", aggregate="COUNT"),
                ColumnRef(name="profit", label="Profit", aggregate="AVG"),
            ],
            kind="line",
            group_by=ColumnRef(name="region", label="Region"),
            x_axis=AxisConfig(title="Time Period", format="smart_date"),
            y_axis=AxisConfig(title="Metrics", format="$,.2f", scale="linear"),
            legend=LegendConfig(show=True, position="bottom"),
            filters=[
                FilterConfig(column="status", op="=", value="active"),
                FilterConfig(column="date", op=">=", value="2024-01-01"),
                FilterConfig(column="revenue", op=">", value="1000"),
            ],
        )
        request = GenerateExploreLinkRequest(dataset_id="10", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["url"] == "/explore/?form_data_key=complex_config_key"
            mock_create_form_data.assert_called_once()

    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_fallback_url_different_datasets(
        self, mock_create_form_data, mcp_server
    ):
        """Test fallback URLs are correct for different dataset IDs."""
        mock_create_form_data.side_effect = Exception(
            "Always fail for fallback testing"
        )

        config = TableChartConfig(chart_type="table", columns=[ColumnRef(name="col")])

        dataset_ids = ["1", "5", "100", "999"]

        for dataset_id in dataset_ids:
            request = GenerateExploreLinkRequest(dataset_id=dataset_id, config=config)
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_explore_link", {"request": request.model_dump()}
                )

                # Should fallback to basic URL with correct dataset_id
                expected_url = (
                    f"/explore/?datasource_type=table&datasource_id={dataset_id}"
                )
                assert result.data["error"] is None
                assert result.data["url"] == expected_url
