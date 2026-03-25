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
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    AxisConfig,
    ColumnRef,
    FilterConfig,
    GenerateExploreLinkRequest,
    LegendConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.common.error_schemas import DatasetContext

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


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


@pytest.fixture(autouse=True)
def mock_webdriver_baseurl(app_context):
    """Mock WEBDRIVER_BASEURL_USER_FRIENDLY for consistent test URLs."""
    from flask import current_app

    original_value = current_app.config.get("WEBDRIVER_BASEURL_USER_FRIENDLY")
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "http://localhost:9001/"
    yield
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = original_value


def _mock_dataset(id: int = 1) -> Mock:
    """Create a mock dataset object with columns and db_engine_spec."""
    from superset.utils.core import ColumnSpec, GenericDataType

    # Create mock column that appears temporal
    mock_column = Mock()
    mock_column.column_name = "date"
    mock_column.type = "TIMESTAMP"

    # Create mock db_engine_spec
    mock_db_engine_spec = Mock()
    mock_column_spec = ColumnSpec(
        sqla_type=Mock(), generic_type=GenericDataType.TEMPORAL, is_dttm=True
    )
    mock_db_engine_spec.get_column_spec.return_value = mock_column_spec

    # Create mock database
    mock_database = Mock()
    mock_database.db_engine_spec = mock_db_engine_spec

    # Create dataset with all required attributes
    dataset = Mock()
    dataset.id = id
    dataset.columns = [mock_column]
    dataset.database = mock_database
    return dataset


class TestGenerateExploreLink:
    """Comprehensive tests for generate_explore_link MCP tool."""

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_minimal(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for minimal table chart."""
        mock_create_form_data.return_value = "test_form_data_key_123"
        mock_find_dataset.return_value = _mock_dataset(id=1)

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
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=test_form_data_key_123"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_with_features(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for table chart with features."""
        mock_create_form_data.return_value = "comprehensive_key_456"
        mock_find_dataset.return_value = _mock_dataset(id=5)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=comprehensive_key_456"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_line_chart_explore_link(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for line chart."""
        mock_create_form_data.return_value = "line_chart_key_789"
        mock_find_dataset.return_value = _mock_dataset(id=3)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=line_chart_key_789"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_bar_chart_explore_link(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for bar chart."""
        mock_create_form_data.return_value = "bar_chart_key_abc"
        mock_find_dataset.return_value = _mock_dataset(id=7)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=bar_chart_key_abc"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_area_chart_explore_link(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for area chart."""
        mock_create_form_data.return_value = "area_chart_key_def"
        mock_find_dataset.return_value = _mock_dataset(id=2)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=area_chart_key_def"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_scatter_chart_explore_link(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for scatter chart."""
        mock_create_form_data.return_value = "scatter_chart_key_ghi"
        mock_find_dataset.return_value = _mock_dataset(id=4)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=scatter_chart_key_ghi"
            )
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
                result.data["url"]
                == "http://localhost:9001/explore/?datasource_type=table&datasource_id=1"
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
                result.data["url"]
                == "http://localhost:9001/explore/?datasource_type=table&datasource_id=5"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_columns(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link with many columns."""
        mock_create_form_data.return_value = "many_columns_key"
        mock_find_dataset.return_value = _mock_dataset(id=1)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=many_columns_key"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_filters(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test generating explore link with many filters."""
        mock_create_form_data.return_value = "many_filters_key"
        mock_find_dataset.return_value = _mock_dataset(id=1)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=many_filters_key"
            )
            mock_create_form_data.assert_called_once()

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_explore_link_url_format_consistency(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test that all generated URLs follow consistent format."""
        mock_create_form_data.return_value = "consistency_test_key"
        mock_find_dataset.return_value = _mock_dataset(id=1)

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
                    result.data["url"]
                    == "http://localhost:9001/explore/?form_data_key=consistency_test_key"
                )
                assert result.data["error"] is None

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_dataset_id_types(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test explore link generation with different dataset_id formats."""
        mock_create_form_data.return_value = "dataset_test_key"
        mock_find_dataset.return_value = _mock_dataset(id=1)

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
                assert (
                    result.data["url"]
                    == "http://localhost:9001/explore/?form_data_key=dataset_test_key"
                )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_complex_configuration(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test explore link generation with complex chart configuration."""
        mock_create_form_data.return_value = "complex_config_key"
        mock_find_dataset.return_value = _mock_dataset(id=10)

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
            assert (
                result.data["url"]
                == "http://localhost:9001/explore/?form_data_key=complex_config_key"
            )
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
                expected_url = f"http://localhost:9001/explore/?datasource_type=table&datasource_id={dataset_id}"
                assert result.data["error"] is None
                assert result.data["url"] == expected_url

    @pytest.mark.asyncio
    async def test_generate_explore_link_tool_exception_handling(self, mcp_server):
        """Test that tool-level exceptions are properly handled and return error."""
        import sys

        # Get the actual module object from sys.modules (not via __init__.py which
        # returns the function)
        explore_module = sys.modules[
            "superset.mcp_service.explore.tool.generate_explore_link"
        ]

        original_func = explore_module.map_config_to_form_data

        def raise_error(*args, **kwargs):
            raise ValueError("Invalid config structure")

        explore_module.map_config_to_form_data = raise_error
        try:
            config = TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="test_col")]
            )
            request = GenerateExploreLinkRequest(dataset_id="1", config=config)

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "generate_explore_link", {"request": request.model_dump()}
                )

                # Should return error response with empty URL
                assert result.data["url"] == ""
                assert result.data["form_data"] == {}
                assert result.data["form_data_key"] is None
                assert "Invalid config structure" in result.data["error"]
        finally:
            # Restore original function
            explore_module.map_config_to_form_data = original_func

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_returns_form_data_key(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test that form_data_key is properly extracted from URL."""
        mock_create_form_data.return_value = "extracted_form_key_xyz"
        mock_find_dataset.return_value = _mock_dataset(id=1)

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="region")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert result.data["form_data_key"] == "extracted_form_key_xyz"
            assert "form_data_key=extracted_form_key_xyz" in result.data["url"]

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_generate_explore_link_returns_form_data(
        self, mock_create_form_data, mock_find_dataset, mcp_server
    ):
        """Test that form_data dict is returned for external rendering."""
        mock_create_form_data.return_value = "form_data_test_key"
        mock_find_dataset.return_value = _mock_dataset(id=1)

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            assert "form_data" in result.data
            assert isinstance(result.data["form_data"], dict)
            assert result.data["form_data"].get("viz_type") == "echarts_timeseries_line"
            assert result.data["form_data"].get("x_axis") == "date"
            # Verify datasource field format: "{dataset_id}__table"
            assert result.data["form_data"].get("datasource") == "1__table"


class TestGenerateExploreLinkColumnNormalization:
    """Tests that generate_explore_link normalizes column names.

    This verifies the fix where user-provided column names in wrong case
    (e.g., 'order_date') are normalized to the canonical dataset name
    (e.g., 'OrderDate') before being used in form_data.
    """

    @patch(
        "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator._get_dataset_context"
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_xy_chart_x_axis_normalized_in_form_data(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """x-axis column name in wrong case is normalized in form_data."""
        mock_create_form_data.return_value = "norm_test_key_1"
        mock_find_dataset.return_value = _mock_dataset(id=18)
        mock_get_context.return_value = DatasetContext(
            id=18,
            table_name="Vehicle Sales",
            schema="public",
            database_name="examples",
            available_columns=[
                {"name": "OrderDate", "type": "DATE", "is_temporal": True},
                {"name": "Sales", "type": "FLOAT", "is_numeric": True},
            ],
            available_metrics=[],
        )

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
        )
        request = GenerateExploreLinkRequest(dataset_id="18", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            # x-axis should be normalized from 'orderdate' to 'OrderDate'
            assert result.data["form_data"]["x_axis"] == "OrderDate"

    @patch(
        "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator._get_dataset_context"
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_filter_column_normalized_in_form_data(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """Filter column name in wrong case is normalized in adhoc_filters."""
        mock_create_form_data.return_value = "norm_test_key_2"
        mock_find_dataset.return_value = _mock_dataset(id=18)
        mock_get_context.return_value = DatasetContext(
            id=18,
            table_name="Vehicle Sales",
            schema="public",
            database_name="examples",
            available_columns=[
                {"name": "OrderDate", "type": "DATE", "is_temporal": True},
                {"name": "Sales", "type": "FLOAT", "is_numeric": True},
            ],
            available_metrics=[],
        )

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
            filters=[
                FilterConfig(column="orderdate", op=">", value="2023-01-01"),
            ],
        )
        request = GenerateExploreLinkRequest(dataset_id="18", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            form_data = result.data["form_data"]
            # x-axis normalized
            assert form_data["x_axis"] == "OrderDate"
            # filter subject normalized to match x-axis
            adhoc_filters = form_data.get("adhoc_filters", [])
            assert len(adhoc_filters) == 1
            assert adhoc_filters[0]["subject"] == "OrderDate"

    @patch(
        "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator._get_dataset_context"
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
    )
    @pytest.mark.asyncio
    async def test_normalization_fallback_when_dataset_not_found(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """When dataset context is unavailable, original names pass through."""
        mock_create_form_data.return_value = "norm_test_key_3"
        mock_find_dataset.return_value = _mock_dataset(id=99)
        mock_get_context.return_value = None

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="orderdate"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            kind="line",
        )
        request = GenerateExploreLinkRequest(dataset_id="99", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.data["error"] is None
            # original names should pass through unchanged
            assert result.data["form_data"]["x_axis"] == "orderdate"
