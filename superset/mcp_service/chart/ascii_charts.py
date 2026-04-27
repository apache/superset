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
ASCII chart rendering functions for MCP chart previews.

Pure rendering functions that take data in and return strings out.
No dependencies on MCP tools, FastMCP Context, or request objects.
"""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


def generate_ascii_chart(
    data: list[Any], chart_type: str, width: int = 80, height: int = 20
) -> str:
    """Generate ASCII art chart from data."""
    if not data:
        return "No data available for ASCII chart"

    try:
        # Clamp to safe minimums to prevent negative plot sizes
        width = max(width, 21)
        height = max(height, 9)

        logger.debug(
            "generate_ascii_chart: chart_type=%s, data_rows=%s", chart_type, len(data)
        )

        if chart_type in ["bar", "column", "echarts_timeseries_bar"]:
            return _generate_ascii_bar_chart(data, width, height)
        elif chart_type in ["line", "echarts_timeseries_line"]:
            return _generate_ascii_line_chart(data, width, height)
        elif chart_type in ["scatter", "echarts_timeseries_scatter"]:
            return _generate_ascii_scatter_chart(data, width, height)
        else:
            logger.debug(
                "Unsupported chart type '%s', falling back to table", chart_type
            )
            return generate_ascii_table(data, width)
    except (TypeError, ValueError, KeyError, IndexError) as e:
        logger.error("ASCII chart generation failed: %s", e, exc_info=True)
        return "ASCII chart generation failed"


def _generate_ascii_bar_chart(data: list[Any], width: int, height: int) -> str:
    """Generate enhanced ASCII bar chart with horizontal and vertical options."""
    if not data:
        return "No data for bar chart"

    # Extract numeric values for bars
    values = []
    labels = []

    for row in data[:12]:  # Increased limit for better charts
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

    # Decide between horizontal and vertical based on label lengths
    avg_label_length = sum(len(str(label)) for label in labels) / len(labels)
    use_horizontal = avg_label_length > 8 or len(values) > 8

    if use_horizontal:
        return _generate_horizontal_bar_chart(values, labels, width)
    else:
        return _generate_vertical_bar_chart(values, labels, width, height)


def _generate_horizontal_bar_chart(
    values: list[float], labels: list[str], width: int
) -> str:
    """Generate horizontal ASCII bar chart."""
    lines = []
    lines.append("📊 Horizontal Bar Chart")
    lines.append("═" * min(width, 60))

    max_val = max(values) if values else 1
    min_val = min(values) if values else 0
    max_bar_width = min(40, width - 20)  # Leave space for labels and values

    # Add scale indicator
    lines.append(f"Scale: {min_val:.1f} ────────────── {max_val:.1f}")
    lines.append("")

    for label, value in zip(labels, values, strict=False):
        # Calculate bar length
        if max_val > min_val:
            normalized = (value - min_val) / (max_val - min_val)
            bar_length = max(1, int(normalized * max_bar_width))
        else:
            bar_length = 1

        # Create bar with gradient effect
        bar = _create_gradient_bar(bar_length, value, max_val)

        # Format value
        if abs(value) >= 1000000:
            value_str = f"{value / 1000000:.1f}M"
        elif abs(value) >= 1000:
            value_str = f"{value / 1000:.1f}K"
        else:
            value_str = f"{value:.1f}"

        # Truncate label if too long
        display_label = label[:15] if len(label) > 15 else label
        lines.append(f"{display_label:>15} ▐{bar:<{max_bar_width}} {value_str}")

    return "\n".join(lines)


def _generate_vertical_bar_chart(  # noqa: C901
    values: list[float], labels: list[str], width: int, height: int
) -> str:
    """Generate vertical ASCII bar chart."""
    lines = []
    lines.append("📊 Vertical Bar Chart")
    lines.append("═" * min(width, 60))

    max_val = max(values) if values else 1
    min_val = min(values) if values else 0
    chart_height = min(15, height - 8)  # Leave space for title and labels

    # Create the chart grid
    grid = []
    for _ in range(chart_height):
        grid.append([" "] * len(values))

    # Fill the bars
    for col, value in enumerate(values):
        if max_val > min_val:
            normalized = (value - min_val) / (max_val - min_val)
            bar_height = max(1, int(normalized * chart_height))
        else:
            bar_height = 1

        # Fill from bottom up
        for row_idx in range(chart_height - bar_height, chart_height):
            if row_idx < len(grid):
                # Use different characters for height effect
                if row_idx == chart_height - bar_height:
                    grid[row_idx][col] = "▀"  # Top of bar
                elif row_idx == chart_height - 1:
                    grid[row_idx][col] = "█"  # Bottom of bar
                else:
                    grid[row_idx][col] = "█"  # Middle of bar

    # Add Y-axis scale
    for i, row_data in enumerate(grid):
        y_val = (
            max_val - (i / (chart_height - 1)) * (max_val - min_val)
            if chart_height > 1
            else max_val
        )
        if abs(y_val) >= 1000:
            y_label = f"{y_val:.0f}"
        else:
            y_label = f"{y_val:.1f}"
        lines.append(f"{y_label:>6} ┤ " + "".join(f"{cell:^3}" for cell in row_data))

    # Add X-axis
    lines.append("       └" + "───" * len(values))

    # Add labels
    label_line = "        "
    for label in labels:
        short_label = label[:3] if len(label) > 3 else label
        label_line += f"{short_label:^3}"
    lines.append(label_line)

    return "\n".join(lines)


def _create_gradient_bar(length: int, value: float, max_val: float) -> str:
    """Create a gradient bar with visual effects."""
    if length <= 0:
        return ""

    # Create gradient effect based on value intensity
    intensity = value / max_val if max_val > 0 else 0

    if intensity > 0.8:
        # High values - solid bars
        return "█" * length
    elif intensity > 0.6:
        # Medium-high values - mostly solid with some texture
        return "█" * (length - 1) + "▉" if length > 1 else "█"
    elif intensity > 0.4:
        # Medium values - mixed texture
        return "▊" * length
    elif intensity > 0.2:
        # Low-medium values - lighter texture
        return "▋" * length
    else:
        # Low values - lightest texture
        return "▌" * length


def _generate_ascii_line_chart(data: list[Any], width: int, height: int) -> str:
    """Generate enhanced ASCII line chart with trend analysis."""
    if not data:
        return "No data for line chart"

    lines = []
    lines.append("📈 Line Chart with Trend Analysis")
    lines.append("═" * min(width, 60))

    # Extract values and labels for plotting
    values, labels = _extract_time_series_data(data)

    if not values:
        return "No numeric data found for line chart"

    # Generate enhanced line chart
    if len(values) >= 3:
        lines.extend(_create_enhanced_line_chart(values, labels, width, height))
    else:
        # Fallback to sparkline for small datasets
        sparkline_data = _create_sparkline(values)
        lines.extend(sparkline_data)

    # Add trend analysis
    trend_analysis = _analyze_trend(values)
    lines.append("")
    lines.append("📊 Trend Analysis:")
    lines.extend(trend_analysis)

    return "\n".join(lines)


def _extract_time_series_data(data: list[Any]) -> tuple[list[float], list[str]]:
    """Extract time series data with labels."""
    values = []
    labels = []

    for row in data[:20]:  # Limit points for readability
        if isinstance(row, dict):
            # Find the first numeric value and first string/date value
            numeric_val = None
            label_val = None

            for key, val in row.items():
                if isinstance(val, (int, float)) and numeric_val is None:
                    numeric_val = val
                elif isinstance(val, str) and label_val is None:
                    # Use the key name if it looks like a date/time field
                    if any(
                        date_word in key.lower()
                        for date_word in ["date", "time", "month", "day", "year"]
                    ):
                        label_val = str(val)[:10]  # Truncate long dates
                    else:
                        label_val = str(val)[:8]  # Truncate long strings

            if numeric_val is not None:
                values.append(numeric_val)
                labels.append(label_val or f"P{len(values)}")

    return values, labels


def _create_enhanced_line_chart(
    values: list[float], labels: list[str], width: int, height: int
) -> list[str]:
    """Create an enhanced ASCII line chart with better visualization."""
    lines = []
    chart_width = min(50, width - 15)
    chart_height = min(12, height - 8)

    if len(values) < 2:
        return ["Insufficient data for line chart"]

    # Normalize values to chart height
    min_val = min(values)
    max_val = max(values)
    val_range = max_val - min_val if max_val != min_val else 1

    # Create chart grid
    grid = [[" " for _ in range(chart_width)] for _ in range(chart_height)]

    # Plot the line with connecting segments
    prev_x, prev_y = None, None

    for i, value in enumerate(values):
        # Map to grid coordinates
        x = int((i / (len(values) - 1)) * (chart_width - 1)) if len(values) > 1 else 0
        y = chart_height - 1 - int(((value - min_val) / val_range) * (chart_height - 1))

        # Ensure coordinates are within bounds
        x = max(0, min(x, chart_width - 1))
        y = max(0, min(y, chart_height - 1))

        # Mark the point
        grid[y][x] = "●"

        # Draw line segment to previous point
        if prev_x is not None and prev_y is not None:
            _draw_line_segment(grid, prev_x, prev_y, x, y, chart_width, chart_height)

        prev_x, prev_y = x, y

    # Render the chart with Y-axis labels
    for i, row in enumerate(grid):
        y_val = (
            max_val - (i / (chart_height - 1)) * val_range
            if chart_height > 1
            else max_val
        )
        if abs(y_val) >= 1000:
            y_label = f"{y_val:.0f}"
        else:
            y_label = f"{y_val:.1f}"
        lines.append(f"{y_label:>8} ┤ " + "".join(row))

    # Add X-axis
    lines.append("         └" + "─" * chart_width)

    # Add selected X-axis labels (show every few labels to avoid crowding)
    label_line = "          "
    step = max(1, len(labels) // 6)  # Show max 6 labels
    for i in range(0, len(labels), step):
        pos = int((i / (len(values) - 1)) * (chart_width - 1)) if len(values) > 1 else 0
        # Add spacing to position the label
        while len(label_line) - 10 < pos:
            label_line += " "
        label_line += labels[i][:8]

    lines.append(label_line)

    return lines


def _draw_line_segment(
    grid: list[list[str]], x1: int, y1: int, x2: int, y2: int, width: int, height: int
) -> None:
    """Draw a line segment between two points using Bresenham-like algorithm."""
    # Simple line drawing - connect points with line characters
    if x1 == x2:  # Vertical line
        start_y, end_y = sorted([y1, y2])
        for y in range(start_y + 1, end_y):
            if 0 <= y < height and 0 <= x1 < width:
                grid[y][x1] = "│"
    elif y1 == y2:  # Horizontal line
        start_x, end_x = sorted([x1, x2])
        for x in range(start_x + 1, end_x):
            if 0 <= y1 < height and 0 <= x < width:
                grid[y1][x] = "─"
    else:  # Diagonal line - use simple interpolation
        steps = max(abs(x2 - x1), abs(y2 - y1))
        for step in range(1, steps):
            x = x1 + int((x2 - x1) * step / steps)
            y = y1 + int((y2 - y1) * step / steps)
            if 0 <= x < width and 0 <= y < height:
                if abs(x2 - x1) > abs(y2 - y1):
                    grid[y][x] = "─"
                else:
                    grid[y][x] = "│"


def _analyze_trend(values: list[float]) -> list[str]:
    """Analyze trend in the data."""
    if len(values) < 2:
        return ["• Insufficient data for trend analysis"]

    analysis = []

    # Calculate basic statistics
    first_val = values[0]
    last_val = values[-1]
    min_val = min(values)
    max_val = max(values)
    avg_val = sum(values) / len(values)

    # Overall trend
    if last_val > first_val * 1.1:
        trend_icon = "📈"
        trend_desc = "Strong upward trend"
    elif last_val > first_val * 1.05:
        trend_icon = "📊"
        trend_desc = "Moderate upward trend"
    elif last_val < first_val * 0.9:
        trend_icon = "📉"
        trend_desc = "Strong downward trend"
    elif last_val < first_val * 0.95:
        trend_icon = "📊"
        trend_desc = "Moderate downward trend"
    else:
        trend_icon = "➡️"
        trend_desc = "Relatively stable"

    analysis.append(f"• {trend_icon} {trend_desc}")
    analysis.append(f"• Range: {min_val:.1f} to {max_val:.1f} (avg: {avg_val:.1f})")

    # Volatility
    if len(values) >= 3:
        changes = [abs(values[i] - values[i - 1]) for i in range(1, len(values))]
        avg_change = sum(changes) / len(changes)
        volatility = "High" if avg_change > (max_val - min_val) * 0.1 else "Low"
        analysis.append(f"• Volatility: {volatility}")

    return analysis


def _create_sparkline(values: list[float]) -> list[str]:
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

    # Safe formatting to avoid NaN display
    if _is_nan_value(min_val) or _is_nan_value(max_val):
        return ["Range: Unable to calculate from data", sparkline]
    else:
        return [f"Range: {min_val:.2f} to {max_val:.2f}", sparkline]


def _is_nan_value(value: Any) -> bool:
    """Check if a value is NaN or invalid."""
    try:
        return math.isnan(float(value))
    except (ValueError, TypeError):
        return True


def _generate_ascii_scatter_chart(data: list[Any], width: int, height: int) -> str:
    """Generate ASCII scatter plot."""
    if not data:
        return "No data for scatter chart"

    lines = []
    lines.append("ASCII Scatter Plot")
    lines.append("=" * min(width, 50))

    # Extract data points
    x_values, y_values, x_column, y_column = _extract_scatter_data(data)

    # Log debug info server-side only
    logger.debug(
        "Scatter chart: x_column=%s, y_column=%s, valid_pairs=%d",
        x_column,
        y_column,
        len(x_values),
    )

    # Check if we have enough data
    if len(x_values) < 2:
        return generate_ascii_table(data, width)

    # Add axis info
    lines.extend(_create_axis_info(x_values, y_values, x_column, y_column))

    # Create and render grid
    grid = _create_scatter_grid(x_values, y_values, width, height)
    lines.extend(_render_scatter_grid(grid, x_values, y_values, width, height))

    return "\n".join(lines)


def _extract_scatter_data(
    data: list[Any],
) -> tuple[list[float], list[float], str | None, str | None]:
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


def _create_axis_info(
    x_values: list[float],
    y_values: list[float],
    x_column: str | None,
    y_column: str | None,
) -> list[str]:
    """Create axis information lines."""
    return [
        f"X-axis: {x_column} (range: {min(x_values):.2f} to {max(x_values):.2f})",
        f"Y-axis: {y_column} (range: {min(y_values):.2f} to {max(y_values):.2f})",
        f"Showing {len(x_values)} data points",
        "",
    ]


def _create_scatter_grid(
    x_values: list[float], y_values: list[float], width: int, height: int
) -> list[list[str]]:
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
        except (ValueError, OverflowError):
            # Skip points that can't be converted to integers (NaN, inf, etc.)
            continue
        grid_y = plot_height - 1 - grid_y  # Flip Y axis for display

        if 0 <= grid_x < plot_width and 0 <= grid_y < plot_height:
            if grid[grid_y][grid_x] == " ":
                grid[grid_y][grid_x] = "•"
            else:
                grid[grid_y][grid_x] = "█"  # Multiple points

    return grid


def _render_scatter_grid(
    grid: list[list[str]],
    x_values: list[float],
    y_values: list[float],
    width: int,
    height: int,
) -> list[str]:
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


def generate_ascii_table(data: list[Any], width: int) -> str:
    """Generate enhanced ASCII table with better formatting."""
    if not data:
        return "No data for table"

    lines = []
    lines.append("📋 Data Table")
    lines.append("═" * min(width, 70))

    # Get column headers from first row
    if isinstance(data[0], dict):
        # Select best columns to display
        all_headers = list(data[0].keys())
        headers = _select_display_columns(all_headers, data, max_cols=6)

        # Calculate optimal column widths
        col_widths = _calculate_column_widths(headers, data, width)

        # Create enhanced header
        lines.append(_create_table_header(headers, col_widths))
        lines.append(_create_table_separator(col_widths))

        # Add data rows with better formatting
        row_count = min(15, len(data))  # Show more rows
        for i, row in enumerate(data[:row_count]):
            formatted_row = _format_table_row(row, headers, col_widths)
            lines.append(formatted_row)

            # Add separator every 5 rows for readability
            if i > 0 and (i + 1) % 5 == 0 and i < row_count - 1:
                lines.append(_create_light_separator(col_widths))

        # Add footer with stats
        lines.append(_create_table_separator(col_widths))
        lines.append(f"📊 Showing {row_count} of {len(data)} rows")

        # Add column summaries for numeric columns
        numeric_summaries = _create_numeric_summaries(data, headers)
        if numeric_summaries:
            lines.append("")
            lines.append("📈 Numeric Summaries:")
            lines.extend(numeric_summaries)

    return "\n".join(lines)


def _select_display_columns(
    all_headers: list[str], data: list[Any], max_cols: int = 6
) -> list[str]:
    """Select the most interesting columns to display."""
    if len(all_headers) <= max_cols:
        return all_headers

    # Prioritize columns by interest level
    priority_scores = {}

    for header in all_headers:
        score = 0
        header_lower = header.lower()

        # Higher priority for common business fields
        if any(word in header_lower for word in ["name", "title", "id"]):
            score += 10
        if any(
            word in header_lower
            for word in ["amount", "price", "cost", "revenue", "sales"]
        ):
            score += 8
        if any(word in header_lower for word in ["date", "time", "created", "updated"]):
            score += 6
        if any(word in header_lower for word in ["count", "total", "sum", "avg"]):
            score += 5

        # Check data variety (more variety = more interesting)
        sample_values = [
            str(row.get(header, "")) for row in data[:10] if isinstance(row, dict)
        ]
        unique_values = len(set(sample_values))
        if unique_values > 1:
            score += min(unique_values, 5)

        priority_scores[header] = score

    # Return top scoring columns
    sorted_headers = sorted(
        all_headers, key=lambda h: priority_scores.get(h, 0), reverse=True
    )
    return sorted_headers[:max_cols]


def _calculate_column_widths(
    headers: list[str], data: list[Any], total_width: int
) -> list[int]:
    """Calculate optimal column widths based on content."""
    if not headers:
        return []

    # Start with minimum widths based on header lengths
    min_widths = [max(8, min(len(h) + 2, 15)) for h in headers]

    # Check actual data to adjust widths
    for row in data[:10]:  # Sample first 10 rows
        if isinstance(row, dict):
            for i, header in enumerate(headers):
                val = row.get(header, "")
                if isinstance(val, float):
                    content_len = len(f"{val:.2f}")
                elif isinstance(val, int):
                    content_len = len(str(val))
                else:
                    content_len = len(str(val))

                min_widths[i] = max(min_widths[i], min(content_len + 1, 20))

    # Distribute remaining space proportionally
    used_width = sum(min_widths) + len(headers) * 3  # Account for separators
    available_width = min(total_width - 10, 80)  # Leave margins

    if used_width < available_width:
        # Distribute extra space
        extra_space = available_width - used_width
        for i in range(len(min_widths)):
            min_widths[i] += extra_space // len(min_widths)

    return min_widths


def _create_table_header(headers: list[str], widths: list[int]) -> str:
    """Create formatted table header."""
    formatted_headers = []
    for header, width in zip(headers, widths, strict=False):
        # Truncate and center header
        display_header = header[: width - 2] if len(header) > width - 2 else header
        formatted_headers.append(f"{display_header:^{width}}")

    return (
        "┌"
        + "┬".join("─" * w for w in widths)
        + "┐\n│"
        + "│".join(formatted_headers)
        + "│"
    )


def _create_table_separator(widths: list[int]) -> str:
    """Create table separator line."""
    return "├" + "┼".join("─" * w for w in widths) + "┤"


def _create_light_separator(widths: list[int]) -> str:
    """Create light separator line."""
    return "├" + "┼".join("┈" * w for w in widths) + "┤"


def _format_table_row(
    row: dict[str, Any], headers: list[str], widths: list[int]
) -> str:
    """Format a single table row."""
    formatted_values = []

    for header, width in zip(headers, widths, strict=False):
        val = row.get(header, "")

        # Format value based on type
        if isinstance(val, float):
            if abs(val) >= 1000000:
                formatted_val = f"{val / 1000000:.1f}M"
            elif abs(val) >= 1000:
                formatted_val = f"{val / 1000:.1f}K"
            else:
                formatted_val = f"{val:.2f}"
        elif isinstance(val, int):
            if abs(val) >= 1000000:
                formatted_val = f"{val // 1000000}M"
            elif abs(val) >= 1000:
                formatted_val = f"{val // 1000}K"
            else:
                formatted_val = str(val)
        else:
            formatted_val = str(val)

        # Truncate if too long
        if len(formatted_val) > width - 2:
            formatted_val = formatted_val[: width - 5] + "..."

        # Align numbers right, text left
        if isinstance(val, (int, float)):
            formatted_values.append(f"{formatted_val:>{width - 2}}")
        else:
            formatted_values.append(f"{formatted_val:<{width - 2}}")

    return "│ " + " │ ".join(formatted_values) + " │"


def _create_numeric_summaries(data: list[Any], headers: list[str]) -> list[str]:
    """Create summaries for numeric columns."""
    summaries = []

    for header in headers:
        # Collect numeric values
        values = []
        for row in data:
            if isinstance(row, dict):
                val = row.get(header)
                if isinstance(val, (int, float)):
                    values.append(val)

        if len(values) >= 2:
            min_val = min(values)
            max_val = max(values)
            avg_val = sum(values) / len(values)

            if abs(avg_val) >= 1000:
                avg_str = f"{avg_val / 1000:.1f}K"
            else:
                avg_str = f"{avg_val:.1f}"

            summaries.append(
                f"  {header}: avg={avg_str}, range={min_val:.1f}-{max_val:.1f}"
            )

    return summaries
