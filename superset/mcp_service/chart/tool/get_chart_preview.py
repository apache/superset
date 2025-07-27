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
MCP tool: get_chart_preview
"""

import logging
from typing import Any, List, Protocol

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartError,
    ChartPreview,
    GetChartPreviewRequest,
)

logger = logging.getLogger(__name__)


class ChartLike(Protocol):
    """Protocol for chart-like objects with required attributes for preview."""

    id: int
    slice_name: str | None
    viz_type: str | None
    datasource_id: int
    datasource_type: str
    params: str | None
    digest: str
    uuid: Any


class PreviewFormatStrategy:
    """Base class for preview format strategies."""

    def __init__(self, chart: ChartLike, request: GetChartPreviewRequest) -> None:
        self.chart = chart
        self.request = request

    def generate(self) -> ChartPreview | ChartError:
        """Generate preview in the specific format."""
        raise NotImplementedError


class URLPreviewStrategy(PreviewFormatStrategy):
    """Generate URL-based image preview."""

    def generate(self) -> ChartPreview | ChartError:
        try:
            from flask import g

            from superset.utils.screenshots import ChartScreenshot
            from superset.utils.urls import get_url_path

            chart_url = get_url_path("Superset.slice", slice_id=self.chart.id)
            screenshot = ChartScreenshot(chart_url, self.chart.digest)

            window_size = (self.request.width or 800, self.request.height or 600)
            image_data = screenshot.get_screenshot(user=g.user, window_size=window_size)

            if image_data:
                # Use the MCP service screenshot URL
                preview_url = (
                    f"http://localhost:5008/screenshot/chart/{self.chart.id}.png"
                )

                return ChartPreview(
                    chart_id=self.chart.id,
                    chart_name=self.chart.slice_name or f"Chart {self.chart.id}",
                    chart_type=self.chart.viz_type or "unknown",
                    format="url",
                    explore_url=f"http://localhost:8088/explore/?slice_id={self.chart.id}",
                    preview_url=preview_url,
                    width=self.request.width or 800,
                    height=self.request.height or 600,
                    chart_description=(
                        f"Chart image: "
                        f"{self.chart.slice_name or f'Chart {self.chart.id}'}"
                        f" ({self.chart.viz_type})"
                    ),
                )
            else:
                return ChartError(
                    error=f"Could not generate screenshot for chart {self.chart.id}",
                    error_type="ScreenshotError",
                )
        except Exception as e:
            logger.error(f"URL preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate URL preview: {str(e)}", error_type="URLError"
            )


class Base64PreviewStrategy(PreviewFormatStrategy):
    """Generate base64 encoded image preview."""

    def generate(self) -> ChartPreview | ChartError:
        try:
            import base64

            from flask import g

            from superset.utils.screenshots import ChartScreenshot
            from superset.utils.urls import get_url_path

            chart_url = get_url_path("Superset.slice", slice_id=self.chart.id)
            screenshot = ChartScreenshot(chart_url, self.chart.digest)

            window_size = (self.request.width or 800, self.request.height or 600)
            image_data = screenshot.get_screenshot(user=g.user, window_size=window_size)

            if image_data:
                base64_image = base64.b64encode(image_data).decode("utf-8")
                data_uri = f"data:image/png;base64,{base64_image}"

                return ChartPreview(
                    chart_id=self.chart.id,
                    chart_name=self.chart.slice_name or f"Chart {self.chart.id}",
                    chart_type=self.chart.viz_type or "unknown",
                    format="base64",
                    explore_url=f"http://localhost:8088/explore/?slice_id={self.chart.id}",
                    preview_url=data_uri,
                    width=self.request.width or 800,
                    height=self.request.height or 600,
                    chart_description=(
                        f"Base64 encoded PNG of "
                        f"{self.chart.slice_name or f'Chart {self.chart.id}'}"
                    ),
                )
            else:
                return ChartError(
                    error="Failed to generate base64 image", error_type="Base64Error"
                )
        except Exception as e:
            logger.error(f"Base64 preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate base64 preview: {str(e)}",
                error_type="Base64Error",
            )


class ASCIIPreviewStrategy(PreviewFormatStrategy):
    """Generate ASCII art preview."""

    def generate(self) -> ChartPreview | ChartError:
        try:
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.utils import json as utils_json

            form_data = utils_json.loads(self.chart.params) if self.chart.params else {}

            logger.info(f"Chart form_data keys: {list(form_data.keys())}")
            logger.info(f"Chart viz_type: {self.chart.viz_type}")

            # Build query for chart data
            x_axis_config = form_data.get("x_axis")
            groupby_columns = form_data.get("groupby", [])
            metrics = form_data.get("metrics", [])

            columns = groupby_columns.copy()
            if x_axis_config and isinstance(x_axis_config, str):
                columns.append(x_axis_config)
            elif x_axis_config and isinstance(x_axis_config, dict):
                if "column_name" in x_axis_config:
                    columns.append(x_axis_config["column_name"])

            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": columns,
                        "metrics": metrics,
                        "row_limit": 50,
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=False,
            )

            command = ChartDataCommand(query_context)
            result = command.run()

            data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                data = result["queries"][0].get("data", [])

            ascii_chart = generate_ascii_chart(
                data,
                self.chart.viz_type or "table",
                self.request.ascii_width or 80,
                self.request.ascii_height or 20,
            )

            return ChartPreview(
                chart_id=self.chart.id,
                chart_name=self.chart.slice_name or f"Chart {self.chart.id}",
                chart_type=self.chart.viz_type or "unknown",
                format="ascii",
                explore_url=f"http://localhost:8088/explore/?slice_id={self.chart.id}",
                ascii_chart=ascii_chart,
                width=self.request.ascii_width or 80,
                height=self.request.ascii_height or 20,
                chart_description=(
                    f"ASCII representation of "
                    f"{self.chart.slice_name or f'Chart {self.chart.id}'} "
                    f"({self.chart.viz_type}) - showing {len(data)} data points"
                ),
            )

        except Exception as e:
            logger.error(f"ASCII preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate ASCII preview: {str(e)}",
                error_type="ASCIIError",
            )


class TablePreviewStrategy(PreviewFormatStrategy):
    """Generate table preview of chart data."""

    def generate(self) -> ChartPreview | ChartError:
        try:
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.utils import json as utils_json

            form_data = utils_json.loads(self.chart.params) if self.chart.params else {}

            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": form_data.get("groupby", []),
                        "metrics": form_data.get("metrics", []),
                        "row_limit": 20,
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=False,
            )

            command = ChartDataCommand(query_context)
            result = command.run()

            data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                data = result["queries"][0].get("data", [])

            table_data = _generate_ascii_table(data, 120)

            return ChartPreview(
                chart_id=self.chart.id,
                chart_name=self.chart.slice_name or f"Chart {self.chart.id}",
                chart_type=self.chart.viz_type or "unknown",
                format="table",
                explore_url=f"http://localhost:8088/explore/?slice_id={self.chart.id}",
                table_data=table_data,
                chart_description=(
                    f"Data table for "
                    f"{self.chart.slice_name or f'Chart {self.chart.id}'} "
                    f"- {len(data)} rows"
                ),
            )

        except Exception as e:
            logger.error(f"Table preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate table preview: {str(e)}",
                error_type="TableError",
            )


class PreviewFormatGenerator:
    """Factory for generating different preview formats."""

    STRATEGIES = {
        "url": URLPreviewStrategy,
        "base64": Base64PreviewStrategy,
        "ascii": ASCIIPreviewStrategy,
        "table": TablePreviewStrategy,
    }

    def __init__(self, chart: ChartLike, request: GetChartPreviewRequest) -> None:
        self.chart = chart
        self.request = request

    def generate(self) -> ChartPreview | ChartError:
        """Generate preview using the appropriate strategy."""
        strategy_class = self.STRATEGIES.get(self.request.format)

        if not strategy_class:
            return ChartError(
                error=f"Unsupported preview format: {self.request.format}",
                error_type="UnsupportedFormat",
            )

        strategy = strategy_class(self.chart, self.request)
        return strategy.generate()


def generate_ascii_chart(
    data: List[Any], chart_type: str, width: int = 80, height: int = 20
) -> str:
    """Generate ASCII art chart from data."""
    if not data or len(data) == 0:
        return "No data available for ASCII chart"

    try:
        logger.info(
            f"generate_ascii_chart: chart_type={chart_type}, data_rows={len(data)}"
        )

        # Generate appropriate ASCII chart based on type
        if chart_type in ["bar", "column", "echarts_timeseries_bar"]:
            logger.info("Generating bar chart")
            return _generate_ascii_bar_chart(data, width, height)
        elif chart_type in ["line", "echarts_timeseries_line"]:
            logger.info("Generating line chart")
            return _generate_ascii_line_chart(data, width, height)
        elif chart_type in ["scatter", "echarts_timeseries_scatter"]:
            logger.info("Generating scatter chart")
            return _generate_ascii_scatter_chart(data, width, height)
        else:
            # Default to table format for unsupported chart types
            logger.info(f"Unsupported chart type '{chart_type}', falling back to table")
            return _generate_ascii_table(data, width)
    except Exception as e:
        logger.error(f"ASCII chart generation failed: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"ASCII chart generation failed: {str(e)}"


def _generate_ascii_bar_chart(data: List[Any], width: int, height: int) -> str:
    """Generate ASCII bar chart."""
    if not data:
        return "No data for bar chart"

    lines = []
    lines.append("ASCII Bar Chart")
    lines.append("=" * min(width, 50))

    # Extract numeric values for bars
    values = []
    labels = []

    for row in data[:10]:  # Limit to 10 bars for readability
        if isinstance(row, dict):
            # Find numeric and string values
            numeric_val = None
            label_val = None

            for _key, val in row.items():
                if isinstance(val, (int, float)) and numeric_val is None:
                    numeric_val = val
                elif isinstance(val, str) and label_val is None:
                    label_val = val

            if numeric_val is not None:
                values.append(numeric_val)
                labels.append(label_val or f"Item {len(values)}")

    if not values:
        return "No numeric data found for bar chart"

    # Normalize values to fit in chart
    max_val = max(values) if values else 1

    for label, value in zip(labels, values, strict=False):
        # Calculate bar length (max 30 chars)
        bar_length = int((value / max_val) * 30) if max_val > 0 else 0
        bar = "█" * bar_length
        lines.append(f"{label[:10]:>10} |{bar:<30} {value}")

    return "\n".join(lines)


def _generate_ascii_line_chart(data: List[Any], width: int, height: int) -> str:
    """Generate ASCII line chart."""
    if not data:
        return "No data for line chart"

    lines = []
    lines.append("ASCII Line Chart")
    lines.append("=" * min(width, 50))

    # Extract values for plotting
    values = _extract_numeric_values(data)

    if not values:
        return "No numeric data found for line chart"

    # Generate sparkline
    sparkline_data = _create_sparkline(values)
    lines.extend(sparkline_data)

    return "\n".join(lines)


def _extract_numeric_values(data: List[Any]) -> List[float]:
    """Extract numeric values from data for line chart."""
    values = []
    for row in data[:20]:  # Limit points
        if isinstance(row, dict):
            for _key, val in row.items():
                if isinstance(val, (int, float)):
                    values.append(val)
                    break
    return values


def _create_sparkline(values: List[float]) -> List[str]:
    """Create sparkline visualization from values."""
    if len(values) <= 1:
        return []

    max_val = max(values)
    min_val = min(values)
    range_val = max_val - min_val if max_val != min_val else 1

    sparkline = ""
    for val in values:
        normalized = (val - min_val) / range_val
        if normalized < 0.2:
            sparkline += "▁"
        elif normalized < 0.4:
            sparkline += "▂"
        elif normalized < 0.6:
            sparkline += "▄"
        elif normalized < 0.8:
            sparkline += "▆"
        else:
            sparkline += "█"

    return [f"Range: {min_val:.2f} to {max_val:.2f}", sparkline]


def _generate_ascii_scatter_chart(data: List[Any], width: int, height: int) -> str:
    """Generate ASCII scatter plot."""
    if not data:
        return "No data for scatter chart"

    lines = []
    lines.append("ASCII Scatter Plot")
    lines.append("=" * min(width, 50))

    # Extract data points
    x_values, y_values, x_column, y_column = _extract_scatter_data(data)

    # Debug info
    lines.extend(_create_debug_info(x_values, y_values, x_column, y_column, data))

    # Check if we have enough data
    if len(x_values) < 2:
        return _generate_ascii_table(data, width)

    # Add axis info
    lines.extend(_create_axis_info(x_values, y_values, x_column, y_column))

    # Create and render grid
    grid = _create_scatter_grid(x_values, y_values, width, height)
    lines.extend(_render_scatter_grid(grid, x_values, y_values, width, height))

    return "\n".join(lines)


def _extract_scatter_data(
    data: List[Any],
) -> tuple[List[float], List[float], str | None, str | None]:
    """Extract X,Y data from scatter chart data."""
    x_values = []
    y_values = []
    x_column = None
    y_column = None
    numeric_columns = []

    if data and isinstance(data[0], dict):
        # Find the first two numeric columns
        for key, val in data[0].items():
            if isinstance(val, (int, float)) and not (
                isinstance(val, float) and (val != val)
            ):  # Exclude NaN
                numeric_columns.append(key)

        if len(numeric_columns) >= 2:
            x_column = numeric_columns[0]
            y_column = numeric_columns[1]

            # Extract X,Y pairs
            for row in data[:50]:  # Limit for ASCII display
                if isinstance(row, dict):
                    x_val = row.get(x_column)
                    y_val = row.get(y_column)
                    # Check for valid numbers (not NaN)
                    if (
                        isinstance(x_val, (int, float))
                        and isinstance(y_val, (int, float))
                        and not (
                            isinstance(x_val, float) and (x_val != x_val)
                        )  # Not NaN
                        and not (isinstance(y_val, float) and (y_val != y_val))
                    ):  # Not NaN
                        x_values.append(x_val)
                        y_values.append(y_val)

    return x_values, y_values, x_column, y_column


def _create_debug_info(
    x_values: List[float],
    y_values: List[float],
    x_column: str | None,
    y_column: str | None,
    data: List[Any],
) -> List[str]:
    """Create debug information lines for scatter chart."""
    numeric_columns = []
    if data and isinstance(data[0], dict):
        for key, val in data[0].items():
            if isinstance(val, (int, float)) and not (
                isinstance(val, float) and (val != val)
            ):
                numeric_columns.append(key)

    return [
        f"DEBUG: Found {len(numeric_columns)} numeric columns: {numeric_columns}",
        f"DEBUG: X column: {x_column}, Y column: {y_column}",
        f"DEBUG: Valid X,Y pairs: {len(x_values)}",
    ]


def _create_axis_info(
    x_values: List[float],
    y_values: List[float],
    x_column: str | None,
    y_column: str | None,
) -> List[str]:
    """Create axis information lines."""
    return [
        f"X-axis: {x_column} (range: {min(x_values):.2f} to {max(x_values):.2f})",
        f"Y-axis: {y_column} (range: {min(y_values):.2f} to {max(y_values):.2f})",
        f"Showing {len(x_values)} data points",
        "",
    ]


def _create_scatter_grid(
    x_values: List[float], y_values: List[float], width: int, height: int
) -> List[List[str]]:
    """Create and populate the scatter plot grid."""
    plot_width = min(40, width - 10)
    plot_height = min(15, height - 8)

    # Normalize values to fit in grid
    x_min, x_max = min(x_values), max(x_values)
    y_min, y_max = min(y_values), max(y_values)
    x_range = x_max - x_min if x_max != x_min else 1
    y_range = y_max - y_min if y_max != y_min else 1

    # Create grid
    grid = [[" " for _ in range(plot_width)] for _ in range(plot_height)]

    # Plot points
    for x, y in zip(x_values, y_values, strict=False):
        try:
            grid_x = int(((x - x_min) / x_range) * (plot_width - 1))
            grid_y = int(((y - y_min) / y_range) * (plot_height - 1))
            grid_y = plot_height - 1 - grid_y  # Flip Y axis for display

            if 0 <= grid_x < plot_width and 0 <= grid_y < plot_height:
                if grid[grid_y][grid_x] == " ":
                    grid[grid_y][grid_x] = "•"
                else:
                    grid[grid_y][grid_x] = "█"  # Multiple points
        except (ValueError, OverflowError):
            # Skip points that can't be converted to integers (NaN, inf, etc.)
            continue

    return grid


def _render_scatter_grid(
    grid: List[List[str]],
    x_values: List[float],
    y_values: List[float],
    width: int,
    height: int,
) -> List[str]:
    """Render the scatter plot grid with axes and labels."""
    lines = []
    plot_width = min(40, width - 10)
    plot_height = min(15, height - 8)

    x_min, x_max = min(x_values), max(x_values)
    y_min, y_max = min(y_values), max(y_values)
    y_range = y_max - y_min if y_max != y_min else 1

    # Add Y-axis labels and plot
    for i, row in enumerate(grid):
        y_val = y_max - (i / (plot_height - 1)) * y_range if plot_height > 1 else y_max
        y_label = f"{y_val:.1f}" if abs(y_val) < 1000 else f"{y_val:.0f}"
        lines.append(f"{y_label:>6} |{''.join(row)}")

    # Add X-axis
    x_axis_line = " " * 7 + "+" + "-" * plot_width
    lines.append(x_axis_line)

    # Add X-axis labels
    x_left_label = f"{x_min:.1f}" if abs(x_min) < 1000 else f"{x_min:.0f}"
    x_right_label = f"{x_max:.1f}" if abs(x_max) < 1000 else f"{x_max:.0f}"
    x_labels = (
        " " * 8
        + x_left_label
        + " " * (plot_width - len(x_left_label) - len(x_right_label))
        + x_right_label
    )
    lines.append(x_labels)

    return lines


def _generate_ascii_table(data: List[Any], width: int) -> str:
    """Generate ASCII table from data."""
    if not data:
        return "No data for table"

    lines = []
    lines.append("Data Table")
    lines.append("=" * min(width, 50))

    # Get column headers from first row
    if isinstance(data[0], dict):
        headers = list(data[0].keys())[:5]  # Limit columns

        # Header row
        header_row = " | ".join(f"{h[:10]:>10}" for h in headers)
        lines.append(header_row)
        lines.append("-" * len(header_row))

        # Data rows (limit to first 10)
        for row in data[:10]:
            values = []
            for header in headers:
                val = row.get(header, "")
                if isinstance(val, float):
                    values.append(f"{val:.2f}")
                else:
                    values.append(str(val)[:10])

            data_row = " | ".join(f"{v:>10}" for v in values)
            lines.append(data_row)

    return "\n".join(lines)


def _get_chart_preview_internal(
    request: GetChartPreviewRequest,
) -> ChartPreview | ChartError:
    """
    Get a visual preview of a chart with URLs for LLM embedding.

    This tool generates or retrieves URLs for chart images that can be
    displayed directly in LLM clients. The URLs point to Superset's
    screenshot endpoints for proper image serving.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Returns a ChartPreview with Superset URLs for the chart image or
    ChartError on error.
    """
    try:
        from superset.daos.chart import ChartDAO

        # Find the chart
        chart = None
        if isinstance(request.identifier, int) or (
            isinstance(request.identifier, str) and request.identifier.isdigit()
        ):
            chart_id = (
                int(request.identifier)
                if isinstance(request.identifier, str)
                else request.identifier
            )
            chart = ChartDAO.find_by_id(chart_id)
        else:
            # Try UUID lookup using DAO flexible method
            chart = ChartDAO.find_by_id(request.identifier, id_column="uuid")

        if not chart:
            return ChartError(
                error=f"No chart found with identifier: {request.identifier}",
                error_type="NotFound",
            )

        logger.info(
            f"Generating preview for chart {chart.id} in {request.format} format: "
            f"{chart.slice_name}"
        )

        # Handle different preview formats using strategy pattern
        preview_generator = PreviewFormatGenerator(chart, request)
        return preview_generator.generate()

    except Exception as e:
        logger.error(f"Error in get_chart_preview: {e}")
        return ChartError(
            error=f"Failed to get chart preview: {str(e)}", error_type="InternalError"
        )


@mcp.tool
@mcp_auth_hook
def get_chart_preview(request: GetChartPreviewRequest) -> ChartPreview | ChartError:
    """
    Get a visual preview of a chart with URLs for LLM embedding.

    This tool generates or retrieves URLs for chart images that can be
    displayed directly in LLM clients. The URLs point to Superset's
    screenshot endpoints for proper image serving.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Returns a ChartPreview with Superset URLs for the chart image or
    ChartError on error.
    """
    return _get_chart_preview_internal(request)
