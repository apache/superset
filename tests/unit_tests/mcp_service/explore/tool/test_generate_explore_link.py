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

import importlib
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

# The package ``__init__.py`` re-exports the ``generate_explore_link`` tool
# function under the same dotted path as the module, so mock.patch's string
# lookup of ``...generate_explore_link.<attr>`` can resolve to the function
# on some Python versions. Hold a direct module reference for ``patch.object``.
generate_explore_link_module = importlib.import_module(
    "superset.mcp_service.explore.tool.generate_explore_link"
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

_PERMALINK_PATCH = (
    "superset.commands.explore.permalink.create.CreateExplorePermalinkCommand.run"
)
_FORM_DATA_PATCH = (
    "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run"
)


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
def mock_event_logger():
    """Skip event-logger DB writes so a bad logs FK doesn't poison the
    session for FastMCP's response serialization on the success path."""
    with patch("superset.utils.log.DBEventLogger.log", return_value=None):
        yield


@pytest.fixture(autouse=True)
def mock_dataset_access_granted():
    """Grant dataset access by default; tests that need a denial override this."""
    with patch.object(
        generate_explore_link_module, "has_dataset_access", return_value=True
    ):
        yield


@pytest.fixture(autouse=True)
def mock_validation_passes():
    """Skip Tier-1 dataset validation by default so Mock datasets don't trip the
    real validator. Individual tests that exercise validation override this."""
    from superset.mcp_service.chart.compile import CompileResult

    with patch.object(
        generate_explore_link_module,
        "validate_and_compile",
        return_value=CompileResult(success=True),
    ):
        yield


@pytest.fixture(autouse=True)
def mock_webdriver_baseurl(app_context):
    """Mock WEBDRIVER_BASEURL_USER_FRIENDLY for consistent test URLs."""
    from flask import current_app

    original_value = current_app.config.get("WEBDRIVER_BASEURL_USER_FRIENDLY")
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = "http://localhost:9001/"
    yield
    current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = original_value


@pytest.fixture(autouse=True)
def mock_permalink_creation():
    """Create durable permalink by default.

    Override in individual tests that need fallback-to-form_data_key or
    fallback-to-basic-URL behaviour by patching _PERMALINK_PATCH to raise.
    """
    with patch(_PERMALINK_PATCH, return_value="test_permalink_key"):
        yield


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
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_minimal(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for minimal table chart."""
        mock_find_dataset.return_value = _mock_dataset(id=1)

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="region")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )
            assert result.structured_content["permalink_key"] == "test_permalink_key"
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["chart_type_label"] == "table chart"

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_table_explore_link_with_features(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for table chart with features."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )
            assert result.structured_content["permalink_key"] == "test_permalink_key"
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["chart_type_label"] == "table chart"

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_ag_grid_table_explore_link_label(
        self, mock_find_dataset, mcp_server
    ) -> None:
        """Test generating explore link reports AG Grid table label."""
        mock_find_dataset.return_value = _mock_dataset(id=1)

        config = TableChartConfig(
            chart_type="table",
            viz_type="ag-grid-table",
            columns=[ColumnRef(name="region")],
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["chart_type_label"]
                == "interactive table chart"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_line_chart_explore_link(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for line chart."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )
            assert result.structured_content["chart_type_label"] is None

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_bar_chart_explore_link(self, mock_find_dataset, mcp_server):
        """Test generating explore link for bar chart."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_area_chart_explore_link(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for area chart."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_scatter_chart_explore_link(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link for scatter chart."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch(_PERMALINK_PATCH)
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(_FORM_DATA_PATCH)
    @pytest.mark.asyncio
    async def test_generate_explore_link_permalink_fails_fallback_to_form_data_key(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_create_permalink,
        mcp_server,
    ):
        """When permalink creation fails, fall back to ephemeral form_data_key URL."""
        from superset.explore.permalink.exceptions import (
            ExplorePermalinkCreateFailedError,
        )

        mock_find_dataset.return_value = _mock_dataset(id=1)
        mock_create_permalink.side_effect = ExplorePermalinkCreateFailedError(
            "DB unavailable"
        )
        mock_create_form_data.return_value = "fallback_form_data_key"

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/?form_data_key=fallback_form_data_key"
            )
            assert (
                result.structured_content["form_data_key"] == "fallback_form_data_key"
            )
            assert result.structured_content["permalink_key"] is None
            mock_create_form_data.assert_called_once()

    @patch(_PERMALINK_PATCH)
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(_FORM_DATA_PATCH)
    @pytest.mark.asyncio
    async def test_generate_explore_link_both_fail_fallback_to_basic_url(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_create_permalink,
        mcp_server,
    ):
        """When both permalink and form_data_key fail, fall back to basic URL."""
        from superset.commands.exceptions import CommandException
        from superset.explore.permalink.exceptions import (
            ExplorePermalinkCreateFailedError,
        )

        mock_find_dataset.return_value = _mock_dataset(id=1)
        mock_create_permalink.side_effect = ExplorePermalinkCreateFailedError(
            "DB unavailable"
        )
        mock_create_form_data.side_effect = CommandException("Cache storage failed")

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None
            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/?datasource_type=table&datasource_id=1"
            )

    @patch(_PERMALINK_PATCH)
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(_FORM_DATA_PATCH)
    @pytest.mark.asyncio
    async def test_generate_explore_link_database_lock_fallback(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_create_permalink,
        mcp_server,
    ):
        """When permalink fails with SQLAlchemy error, fall back to form_data_key."""
        from sqlalchemy.exc import OperationalError

        mock_find_dataset.return_value = _mock_dataset(id=5)
        mock_create_permalink.side_effect = OperationalError(
            "database is locked", None, None
        )
        mock_create_form_data.return_value = "lock_fallback_key"

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

            assert result.structured_content["error"] is None
            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/?form_data_key=lock_fallback_key"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_columns(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link with many columns."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_with_many_filters(
        self, mock_find_dataset, mcp_server
    ):
        """Test generating explore link with many filters."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_explore_link_url_format_consistency(
        self, mock_find_dataset, mcp_server
    ):
        """Test that all generated URLs follow consistent permalink format."""
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

                # All URLs should follow the same permalink format
                assert (
                    result.structured_content["url"]
                    == "http://localhost:9001/explore/p/test_permalink_key/"
                )
                assert result.structured_content["error"] is None
                assert result.structured_content["success"] is True

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_dataset_id_types(
        self, mock_find_dataset, mcp_server
    ):
        """Test explore link generation with different dataset_id formats."""
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
                assert result.structured_content["error"] is None
                assert result.structured_content["success"] is True
                assert (
                    result.structured_content["url"]
                    == "http://localhost:9001/explore/p/test_permalink_key/"
                )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_complex_configuration(
        self, mock_find_dataset, mcp_server
    ):
        """Test explore link generation with complex chart configuration."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/p/test_permalink_key/"
            )

    @patch(_PERMALINK_PATCH)
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @patch(_FORM_DATA_PATCH)
    @pytest.mark.asyncio
    async def test_fallback_url_different_datasets(
        self,
        mock_create_form_data,
        mock_find_dataset,
        mock_create_permalink,
        mcp_server,
    ):
        """When both fallbacks fail, basic URL uses the correct dataset_id."""
        from superset.commands.exceptions import CommandException
        from superset.explore.permalink.exceptions import (
            ExplorePermalinkCreateFailedError,
        )

        mock_find_dataset.return_value = _mock_dataset(id=1)
        mock_create_permalink.side_effect = ExplorePermalinkCreateFailedError(
            "Always fail for fallback testing"
        )
        mock_create_form_data.side_effect = CommandException(
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
                    f"http://localhost:9001/explore/?datasource_type=table"
                    f"&datasource_id={dataset_id}"
                )
                assert result.structured_content["error"] is None
                assert result.structured_content["success"] is True
                assert result.structured_content["url"] == expected_url

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_tool_exception_handling(
        self, mock_find_dataset, mcp_server
    ):
        """Test that tool-level exceptions are properly handled and return error."""
        mock_find_dataset.return_value = _mock_dataset(id=1)
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
                assert result.structured_content["url"] == ""
                assert result.structured_content["form_data"] == {}
                assert result.structured_content["form_data_key"] is None
                assert result.structured_content["permalink_key"] is None
                assert result.structured_content["chart_type_label"] is None
                assert result.structured_content["success"] is False
                error = result.structured_content["error"]
                assert error["error_type"] == "generation_failed"
                # ``details`` is the static, sanitized message; the raw
                # exception text ("Invalid config structure") is kept
                # only in the server-side log, not echoed to the client.
                assert "check server logs" in error["details"]
                assert "Invalid config structure" not in error["details"]
        finally:
            # Restore original function
            explore_module.map_config_to_form_data = original_func

    @patch(_PERMALINK_PATCH)
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_returns_permalink_key(
        self, mock_find_dataset, mock_create_permalink, mcp_server
    ):
        """Test that permalink_key is properly extracted from the durable URL."""
        mock_create_permalink.return_value = "extracted_permalink_xyz"
        mock_find_dataset.return_value = _mock_dataset(id=1)

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="region")]
        )
        request = GenerateExploreLinkRequest(dataset_id="1", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None
            assert result.structured_content["success"] is True
            assert (
                result.structured_content["permalink_key"] == "extracted_permalink_xyz"
            )
            assert result.structured_content["form_data_key"] is None
            assert "extracted_permalink_xyz" in result.structured_content["url"]
            assert result.structured_content["url"] == (
                "http://localhost:9001/explore/p/extracted_permalink_xyz/"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_returns_form_data(
        self, mock_find_dataset, mcp_server
    ):
        """Test that form_data dict is returned for external rendering."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            assert "form_data" in result.structured_content
            assert isinstance(result.structured_content["form_data"], dict)
            assert (
                result.structured_content["form_data"].get("viz_type")
                == "echarts_timeseries_line"
            )
            assert result.structured_content["form_data"].get("x_axis") == "date"
            # Verify datasource field format: "{dataset_id}__table"
            assert (
                result.structured_content["form_data"].get("datasource") == "1__table"
            )

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_nonexistent_dataset(
        self, mock_find_dataset, mcp_server
    ):
        """Test nonexistent dataset_id returns error instead of broken URL."""
        mock_find_dataset.return_value = None

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = GenerateExploreLinkRequest(dataset_id="99999", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["url"] == ""
            assert result.structured_content["form_data"] == {}
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["permalink_key"] is None
            assert result.structured_content["chart_type_label"] is None
            assert result.structured_content["success"] is False
            error = result.structured_content["error"]
            assert error["error_type"] == "dataset_not_found"
            assert "Dataset not found: 99999" in error["message"]
            assert "list_datasets" in error["details"]

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_without_config(
        self, mock_find_dataset, mcp_server
    ):
        """Omitting config returns a default dataset explore URL through
        the same typed ``GenerateExploreLinkResponse`` shape as every
        other code path. ``success=True`` and ``error=None`` so callers
        cannot mistake a no-config response for a failure."""
        mock_find_dataset.return_value = _mock_dataset(id=42)

        request = GenerateExploreLinkRequest(dataset_id="42")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["error"] is None
            assert result.structured_content["success"] is True
            assert (
                result.structured_content["url"]
                == "http://localhost:9001/explore/?datasource_type=table"
                "&datasource_id=42"
            )
            assert result.structured_content["form_data"] == {}
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["permalink_key"] is None
            assert result.structured_content["chart_type_label"] is None

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_without_config_missing_dataset(
        self, mock_find_dataset, mcp_server
    ):
        """Omitting config still surfaces a dataset-not-found error
        through the structured error object — not as a substring on a
        dict, which is the bug this test originally hid."""
        mock_find_dataset.return_value = None

        request = GenerateExploreLinkRequest(dataset_id="99999")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["url"] == ""
            assert result.structured_content["form_data"] == {}
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["permalink_key"] is None
            assert result.structured_content["chart_type_label"] is None
            assert result.structured_content["success"] is False
            error = result.structured_content["error"]
            assert error["error_type"] == "dataset_not_found"
            assert "Dataset not found: 99999" in error["message"]

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_generate_explore_link_nonexistent_uuid_dataset(
        self, mock_find_dataset, mcp_server
    ):
        """Test that nonexistent UUID dataset_id returns structured error."""
        mock_find_dataset.return_value = None

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="test_col")]
        )
        request = GenerateExploreLinkRequest(
            dataset_id="00000000-0000-0000-0000-000000000000", config=config
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["url"] == ""
            assert result.structured_content["form_data"] == {}
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["permalink_key"] is None
            assert result.structured_content["chart_type_label"] is None
            assert result.structured_content["success"] is False
            error = result.structured_content["error"]
            assert error["error_type"] == "dataset_not_found"
            assert "Dataset not found" in error["message"]


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
    @pytest.mark.asyncio
    async def test_xy_chart_x_axis_normalized_in_form_data(
        self,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """x-axis column name in wrong case is normalized in form_data."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            # x-axis should be normalized from 'orderdate' to 'OrderDate'
            assert result.structured_content["form_data"]["x_axis"] == "OrderDate"

    @patch(
        "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator._get_dataset_context"
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_filter_column_normalized_in_form_data(
        self,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """Filter column name in wrong case is normalized in adhoc_filters."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            form_data = result.structured_content["form_data"]
            # x-axis normalized
            assert form_data["x_axis"] == "OrderDate"
            # filter subject normalized to match x-axis
            adhoc_filters = form_data.get("adhoc_filters", [])
            # User filter + auto-added TEMPORAL_RANGE for temporal x-axis
            assert len(adhoc_filters) == 2
            assert adhoc_filters[0]["subject"] == "OrderDate"
            assert adhoc_filters[0]["operator"] == ">"
            assert adhoc_filters[1]["operator"] == "TEMPORAL_RANGE"
            assert adhoc_filters[1]["subject"] == "OrderDate"

    @patch(
        "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator._get_dataset_context"
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_normalization_fallback_when_dataset_not_found(
        self,
        mock_find_dataset,
        mock_get_context,
        mcp_server,
    ):
        """When dataset context is unavailable, original names pass through."""
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

            assert result.structured_content["error"] is None

            assert result.structured_content["success"] is True
            # original names should pass through unchanged
            assert result.structured_content["form_data"]["x_axis"] == "orderdate"


class TestGenerateExploreLinkValidation:
    """Tier-1 validation gate (DatasetValidator) and dataset access checks."""

    @pytest.fixture(autouse=True)
    def mock_validation_passes(self):
        """Override the module-level autouse patch so each test in this class
        can stub ``validate_and_compile`` itself. The fixture name MUST match
        the module-level fixture for pytest's override-by-name to take effect.
        """
        return

    @patch(_PERMALINK_PATCH)
    @patch.object(generate_explore_link_module, "validate_and_compile")
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_validation_failure_returns_structured_error(
        self,
        mock_find_dataset,
        mock_validate,
        mock_create_permalink,
        mcp_server,
    ):
        """Non-existent column → structured ChartGenerationError with suggestions,
        and CreateExplorePermalinkCommand must NOT be called (no cache write)."""
        from superset.mcp_service.chart.compile import CompileResult
        from superset.mcp_service.common.error_schemas import ChartGenerationError

        mock_find_dataset.return_value = _mock_dataset(id=3)
        mock_validate.return_value = CompileResult(
            success=False,
            error="Column 'num_boys' does not exist in dataset",
            error_code="CHART_VALIDATION_FAILED",
            tier="validation",
            error_obj=ChartGenerationError(
                error_type="invalid_column",
                message="Column 'num_boys' does not exist in dataset",
                details="Available columns: ds, gender, name, num, sum_boys",
                suggestions=["sum_boys"],
                error_code="CHART_VALIDATION_FAILED",
            ),
        )

        config = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="ds"),
            y=[ColumnRef(name="num_boys", aggregate="SUM")],
            kind="line",
        )
        request = GenerateExploreLinkRequest(dataset_id="3", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["url"] == ""
            assert result.structured_content["form_data_key"] is None
            assert result.structured_content["permalink_key"] is None
            assert result.structured_content["chart_type_label"] is None
            assert result.structured_content["success"] is False
            error = result.structured_content["error"]
            assert isinstance(error, dict)
            assert error["error_code"] == "CHART_VALIDATION_FAILED"
            assert "sum_boys" in error["suggestions"]
            mock_create_permalink.assert_not_called()

    @patch(_PERMALINK_PATCH)
    @patch.object(
        generate_explore_link_module, "has_dataset_access", return_value=False
    )
    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_dataset_access_denied_short_circuits(
        self,
        mock_find_dataset,
        unused_access_mock,
        mock_create_permalink,
        mcp_server,
    ):
        """has_dataset_access=False blocks the tool before any permalink write."""
        mock_find_dataset.return_value = _mock_dataset(id=3)

        config = TableChartConfig(
            chart_type="table", columns=[ColumnRef(name="region")]
        )
        request = GenerateExploreLinkRequest(dataset_id="3", config=config)

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "generate_explore_link", {"request": request.model_dump()}
            )

            assert result.structured_content["url"] == ""
            assert result.structured_content["chart_type_label"] is None
            assert result.structured_content["success"] is False
            error = result.structured_content["error"]
            # error_type lets programmatic callers distinguish, while the
            # user-facing message still avoids leaking dataset existence.
            assert error["error_type"] == "permission_denied"
            assert "Dataset not found" in error["message"]
            mock_create_permalink.assert_not_called()
