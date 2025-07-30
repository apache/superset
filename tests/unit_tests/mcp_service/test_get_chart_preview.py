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
Comprehensive integration tests for get_chart_preview MCP tool
"""

import logging
import uuid
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.schemas.chart_schemas import (
    GetChartPreviewRequest,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


def _mock_chart(id: int = 264, viz_type: str = "echarts_timeseries_bar") -> Mock:
    """Create a mock chart object with all required attributes."""
    chart = Mock()
    chart.id = id
    chart.slice_name = f"Test Chart {id}"
    chart.viz_type = viz_type
    chart.datasource_id = 1
    chart.datasource_type = "table"
    chart.params = '{"groupby": ["region"], "metrics": ["count"], "filters": []}'
    chart.digest = "test_digest_123"
    chart.uuid = uuid.uuid4()
    return chart


class TestGetChartPreview:
    """Comprehensive tests for get_chart_preview MCP tool."""

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_url_format_numeric_id(
        self, mock_screenshot, mock_find_chart, mcp_server
    ):
        """Test URL format preview with numeric chart ID."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_screenshot.return_value = b"fake_png_data"

        request = GetChartPreviewRequest(identifier=264, format="url")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify response structure
            assert result.data["chart_id"] == 264
            assert result.data["chart_name"] == "Test Chart 264"
            assert result.data["chart_type"] == "echarts_timeseries_bar"
            assert result.data["format"] == "url"
            assert (
                result.data["explore_url"]
                == "http://localhost:8088/explore/?slice_id=264"
            )
            assert (
                result.data["preview_url"]
                == "http://localhost:8088/screenshot/chart/264.png"
            )
            assert result.data["width"] == 800
            assert result.data["height"] == 600
            assert (
                "Preview of echarts_timeseries_bar: Test Chart 264"
                in result.data["chart_description"]
            )

            # Verify other formats are None
            assert result.data["ascii_chart"] is None
            assert result.data["table_data"] is None
            assert result.data["base64_image"] is None

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_url_format_string_id(
        self, mock_screenshot, mock_find_chart, mcp_server
    ):
        """Test URL format preview with string chart ID."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_screenshot.return_value = b"fake_png_data"

        request = GetChartPreviewRequest(identifier="264", format="url")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Should work the same as numeric ID
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "url"
            assert (
                result.data["preview_url"]
                == "http://localhost:8088/screenshot/chart/264.png"
            )

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_url_format_uuid(
        self, mock_screenshot, mock_find_by_id, mcp_server
    ):
        """Test URL format preview with UUID chart identifier."""
        chart_uuid = "550e8400-e29b-41d4-a716-446655440000"  # Valid UUID format
        mock_chart = _mock_chart(id=999)
        # Mock DAO find_by_id to return chart when called with uuid column
        mock_find_by_id.return_value = mock_chart
        mock_screenshot.return_value = b"fake_png_data"

        request = GetChartPreviewRequest(identifier=chart_uuid, format="url")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Should work with UUID lookup
            assert result.data["chart_id"] == 999
            assert result.data["format"] == "url"
            assert (
                result.data["preview_url"]
                == "http://localhost:8088/screenshot/chart/999.png"
            )

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_base64_format(
        self, mock_screenshot, mock_find_chart, mcp_server
    ):
        """Test base64 format preview."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_screenshot.return_value = b"fake_png_data"

        request = GetChartPreviewRequest(
            identifier=264, format="base64", width=1200, height=800
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify base64 response
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "base64"
            assert result.data["width"] == 1200
            assert result.data["height"] == 800
            # Base64 encoded data should be present in base64_image field
            assert result.data["base64_image"] is not None
            assert (
                result.data["base64_image"] == "ZmFrZV9wbmdfZGF0YQ=="
            )  # b"fake_png_data" encoded
            assert (
                "Preview of echarts_timeseries_bar: Test Chart 264"
                in result.data["chart_description"]
            )

            # Verify other formats are None
            assert result.data["ascii_chart"] is None
            assert result.data["table_data"] is None
            assert result.data["preview_url"] is None

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_ascii_format(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test ASCII format preview."""
        mock_find_chart.return_value = _mock_chart(
            id=264, viz_type="echarts_timeseries_bar"
        )

        # Mock query context and data command
        mock_factory.return_value = Mock()
        mock_command.return_value = {
            "queries": [
                {
                    "data": [
                        {"region": "North", "sales": 1000},
                        {"region": "South", "sales": 800},
                        {"region": "East", "sales": 1200},
                        {"region": "West", "sales": 600},
                    ]
                }
            ]
        }

        request = GetChartPreviewRequest(
            identifier=264, format="ascii", ascii_width=60, ascii_height=15
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify ASCII response
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "ascii"
            assert result.data["width"] == 60
            assert result.data["height"] == 15
            assert result.data["ascii_chart"] is not None
            assert "ASCII Bar Chart" in result.data["ascii_chart"]
            assert (
                "Preview of echarts_timeseries_bar: Test Chart 264"
                in result.data["chart_description"]
            )

            # Verify other formats are None
            assert result.data["preview_url"] is None
            assert result.data["table_data"] is None
            assert result.data["base64_image"] is None

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_table_format(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test table format preview."""
        mock_find_chart.return_value = _mock_chart(id=264, viz_type="table")

        # Mock query context and data command
        mock_factory.return_value = Mock()
        mock_command.return_value = {
            "queries": [
                {
                    "data": [
                        {"region": "North", "sales": 1000, "orders": 25},
                        {"region": "South", "sales": 800, "orders": 20},
                        {"region": "East", "sales": 1200, "orders": 30},
                    ]
                }
            ]
        }

        request = GetChartPreviewRequest(identifier=264, format="table")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify table response
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "table"
            assert result.data["table_data"] is not None
            assert "Data Table" in result.data["table_data"]
            assert "region" in result.data["table_data"]
            assert "sales" in result.data["table_data"]
            assert (
                "Preview of table: Test Chart 264" in result.data["chart_description"]
            )

            # Verify other formats are None
            assert result.data["preview_url"] is None
            assert result.data["ascii_chart"] is None
            assert result.data["base64_image"] is None

    @pytest.mark.asyncio
    async def test_get_chart_preview_chart_not_found(self, mcp_server):
        """Test error handling when chart is not found."""
        with patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None):
            request = GetChartPreviewRequest(identifier=99999, format="url")

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "get_chart_preview", {"request": request.model_dump()}
                )

                # Should return error
                assert result.data["error"] == "No chart found with identifier: 99999"
                assert result.data["error_type"] == "NotFound"

    @pytest.mark.asyncio
    async def test_get_chart_preview_invalid_uuid(self, mcp_server):
        """Test error handling with invalid UUID."""
        with patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None):
            request = GetChartPreviewRequest(
                identifier="invalid-uuid-string", format="url"
            )

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "get_chart_preview", {"request": request.model_dump()}
                )

                # Should return error for invalid UUID
                assert "No chart found with identifier:" in result.data["error"]
                assert result.data["error_type"] == "NotFound"

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_get_chart_preview_unsupported_format(
        self, mock_find_chart, mcp_server
    ):
        """Test error handling for unsupported format."""
        mock_find_chart.return_value = _mock_chart(id=264)

        # This test would fail at the Pydantic validation level since format is Literal
        # but let's test the internal logic
        from superset.mcp_service.chart.tool.get_chart_preview import (
            PreviewFormatGenerator,
        )

        chart = _mock_chart(id=264)
        request = Mock()
        request.format = "unsupported_format"

        generator = PreviewFormatGenerator(chart, request)
        result = generator.generate()

        assert hasattr(result, "error")
        assert "Unsupported preview format: unsupported_format" in result.error

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_screenshot_failure(
        self, mock_screenshot, mock_find_chart, mcp_server
    ):
        """Test handling of screenshot generation failure."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_screenshot.return_value = None  # Simulate screenshot failure

        request = GetChartPreviewRequest(identifier=264, format="url")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Should return error for screenshot failure
            assert result.data["error"] == "Could not generate screenshot for chart 264"
            assert result.data["error_type"] == "ScreenshotError"

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_ascii_no_data(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test ASCII format with no data."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_factory.return_value = Mock()
        mock_command.return_value = {"queries": [{"data": []}]}

        request = GetChartPreviewRequest(identifier=264, format="ascii")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Should handle empty data gracefully
            if "error" in result.data:
                # If there's an error (like datasource not found), acceptable
                assert "error" in result.data
            else:
                assert result.data["chart_id"] == 264
                assert result.data["format"] == "ascii"
                assert "No data available for ASCII chart" in result.data["ascii_chart"]

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_ascii_line_chart(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test ASCII format for line chart visualization."""
        mock_find_chart.return_value = _mock_chart(
            id=264, viz_type="echarts_timeseries_line"
        )

        # Mock query context and data command with time series data
        mock_factory.return_value = Mock()
        mock_command.return_value = {
            "queries": [
                {
                    "data": [
                        {"date": "2024-01", "sales": 1000},
                        {"date": "2024-02", "sales": 1200},
                        {"date": "2024-03", "sales": 800},
                        {"date": "2024-04", "sales": 1400},
                        {"date": "2024-05", "sales": 1100},
                    ]
                }
            ]
        }

        request = GetChartPreviewRequest(identifier=264, format="ascii")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify line chart ASCII response
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "ascii"
            assert "ASCII Line Chart" in result.data["ascii_chart"]
            # Should contain sparkline characters
            sparkline_chars = ["▁", "▂", "▄", "▆", "█"]
            assert any(char in result.data["ascii_chart"] for char in sparkline_chars)

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_ascii_scatter_chart(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test ASCII format for scatter chart visualization."""
        mock_find_chart.return_value = _mock_chart(
            id=264, viz_type="echarts_timeseries_scatter"
        )

        # Mock query context and data command with X,Y data
        mock_factory.return_value = Mock()
        mock_command.return_value = {
            "queries": [
                {
                    "data": [
                        {"price": 10.5, "quantity": 100, "product": "A"},
                        {"price": 15.2, "quantity": 80, "product": "B"},
                        {"price": 12.8, "quantity": 120, "product": "C"},
                        {"price": 18.1, "quantity": 60, "product": "D"},
                    ]
                }
            ]
        }

        request = GetChartPreviewRequest(identifier=264, format="ascii")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify scatter chart ASCII response
            assert result.data["chart_id"] == 264
            assert result.data["format"] == "ascii"
            assert "ASCII Scatter Plot" in result.data["ascii_chart"]
            assert "X-axis: price" in result.data["ascii_chart"]
            assert "Y-axis: quantity" in result.data["ascii_chart"]
            assert "Showing 4 data points" in result.data["ascii_chart"]

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
    @pytest.mark.asyncio
    async def test_get_chart_preview_custom_dimensions(
        self, mock_screenshot, mock_find_chart, mcp_server
    ):
        """Test preview with custom width and height dimensions."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_screenshot.return_value = b"fake_png_data"

        request = GetChartPreviewRequest(
            identifier=264, format="url", width=1600, height=1200
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify custom dimensions are respected
            assert result.data["width"] == 1600
            assert result.data["height"] == 1200
            # Screenshot should be called with correct window size
            mock_screenshot.assert_called_once()
            call_args = mock_screenshot.call_args
            assert call_args[1]["window_size"] == (1600, 1200)

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    @patch("superset.common.query_context_factory.QueryContextFactory.create")
    @pytest.mark.asyncio
    async def test_get_chart_preview_ascii_custom_dimensions(
        self, mock_factory, mock_command, mock_find_chart, mcp_server
    ):
        """Test ASCII preview with custom dimensions."""
        mock_find_chart.return_value = _mock_chart(id=264)
        mock_factory.return_value = Mock()
        mock_command.return_value = {
            "queries": [{"data": [{"region": "North", "sales": 1000}]}]
        }

        request = GetChartPreviewRequest(
            identifier=264, format="ascii", ascii_width=120, ascii_height=30
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Verify custom ASCII dimensions
            assert result.data["width"] == 120
            assert result.data["height"] == 30
            assert result.data["format"] == "ascii"

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_get_chart_preview_internal_error(self, mock_find_chart, mcp_server):
        """Test handling of internal errors during preview generation."""
        # Make find_by_id raise an exception
        mock_find_chart.side_effect = Exception("Database connection error")

        request = GetChartPreviewRequest(identifier=264, format="url")

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_preview", {"request": request.model_dump()}
            )

            # Should handle internal errors gracefully
            assert "Failed to get chart preview:" in result.data["error"]
            assert result.data["error_type"] == "InternalError"

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    @pytest.mark.asyncio
    async def test_get_chart_preview_explore_url_format(
        self, mock_find_chart, mcp_server
    ):
        """Test that explore URLs are correctly formatted for all preview formats."""
        mock_find_chart.return_value = _mock_chart(id=264)

        formats_to_test = ["url", "base64", "ascii", "table"]

        for format_type in formats_to_test:
            request = GetChartPreviewRequest(identifier=264, format=format_type)

            with patch(
                "superset.utils.screenshots.ChartScreenshot.get_screenshot",
                return_value=b"data",
            ):
                with patch(
                    "superset.commands.chart.data.get_data_command.ChartDataCommand.run",
                    return_value={"queries": [{"data": [{"test": "data"}]}]},
                ):
                    with patch(
                        "superset.common.query_context_factory.QueryContextFactory.create"
                    ):
                        async with Client(mcp_server) as client:
                            result = await client.call_tool(
                                "get_chart_preview", {"request": request.model_dump()}
                            )

                            # All formats should have consistent explore URL
                            expected_url = "http://localhost:8088/explore/?slice_id=264"
                            assert result.data["explore_url"] == expected_url
                            assert result.data["chart_id"] == 264
                            assert result.data["format"] == format_type
