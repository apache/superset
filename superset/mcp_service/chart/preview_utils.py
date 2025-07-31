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
Preview utilities for chart generation without saving.

This module provides utilities for generating chart previews
from form data without requiring a saved chart object.
"""

import logging
from typing import Any, Dict, List

from superset.charts.data.api import ChartDataCommand
from superset.charts.data.query_context import QueryContext
from superset.mcp_service.schemas.chart_schemas import (
    ASCIIPreview,
    ChartError,
    TablePreview,
    VegaLitePreview,
)

logger = logging.getLogger(__name__)


def generate_preview_from_form_data(
    form_data: Dict[str, Any], dataset_id: int, preview_format: str
) -> Any:
    """
    Generate preview from form data without a saved chart.

    Args:
        form_data: Chart configuration form data
        dataset_id: Dataset ID
        preview_format: Preview format (ascii, table, etc.)

    Returns:
        Preview object or ChartError
    """
    try:
        # Execute query to get data
        from superset.connectors.sqla.models import SqlaTable
        from superset.extensions import db

        dataset = db.session.query(SqlaTable).get(dataset_id)
        if not dataset:
            return ChartError(
                error=f"Dataset {dataset_id} not found", error_type="DatasetNotFound"
            )

        # Create query context from form data
        query_context = {
            "datasource": {"id": dataset_id, "type": "table"},
            "queries": [
                {
                    "columns": form_data.get("columns", []),
                    "metrics": form_data.get("metrics", []),
                    "orderby": form_data.get("orderby", []),
                    "row_limit": form_data.get("row_limit", 100),
                    "filters": form_data.get("adhoc_filters", []),
                    "time_range": form_data.get("time_range", "No filter"),
                }
            ],
        }

        # Execute query
        query_context_obj = QueryContext(**query_context)
        command = ChartDataCommand(query_context_obj)
        result = command.run()

        if not result or not result.get("queries"):
            return ChartError(
                error="No data returned from query", error_type="EmptyResult"
            )

        query_result = result["queries"][0]
        data = query_result.get("data", [])

        # Generate preview based on format
        if preview_format == "ascii":
            return _generate_ascii_preview_from_data(data, form_data)
        elif preview_format == "table":
            return _generate_table_preview_from_data(data, form_data)
        elif preview_format == "vega_lite":
            return _generate_vega_lite_preview_from_data(data, form_data)
        else:
            return ChartError(
                error=f"Unsupported preview format: {preview_format}",
                error_type="UnsupportedFormat",
            )

    except Exception as e:
        logger.error(f"Preview generation from form data failed: {e}")
        return ChartError(
            error=f"Failed to generate preview: {str(e)}", error_type="PreviewError"
        )


def _generate_ascii_preview_from_data(
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> ASCIIPreview:
    """Generate ASCII preview from raw data."""
    viz_type = form_data.get("viz_type", "table")

    # Handle different chart types
    if viz_type in ["bar", "dist_bar", "column"]:
        content = _generate_safe_ascii_bar_chart(data)
    elif viz_type in ["line", "area"]:
        content = _generate_safe_ascii_line_chart(data)
    elif viz_type == "pie":
        content = _generate_safe_ascii_pie_chart(data)
    else:
        content = _generate_safe_ascii_table(data)

    return ASCIIPreview(
        ascii_content=content, width=80, height=20, supports_color=False
    )


def _calculate_column_widths(
    display_columns: List[str], data: List[Dict[str, Any]]
) -> Dict[str, int]:
    """Calculate optimal width for each column."""
    column_widths = {}
    for col in display_columns:
        # Start with column name length
        max_width = len(str(col))

        # Check data values to determine width
        for row in data[:20]:  # Sample first 20 rows
            val = row.get(col, "")
            if isinstance(val, float):
                val_str = f"{val:.2f}"
            elif isinstance(val, int):
                val_str = str(val)
            else:
                val_str = str(val)
            max_width = max(max_width, len(val_str))

        # Set reasonable bounds
        column_widths[col] = min(max(max_width, 8), 25)
    return column_widths


def _format_value(val: Any, width: int) -> str:
    """Format a value based on its type."""
    if isinstance(val, float):
        if abs(val) >= 1000000:
            val_str = f"{val:.2e}"  # Scientific notation for large numbers
        elif abs(val) >= 1000:
            val_str = f"{val:,.2f}"  # Thousands separator
        else:
            val_str = f"{val:.2f}"
    elif isinstance(val, int):
        if abs(val) >= 1000:
            val_str = f"{val:,}"  # Thousands separator
        else:
            val_str = str(val)
    elif val is None:
        val_str = "NULL"
    else:
        val_str = str(val)

    # Truncate if too long
    if len(val_str) > width:
        val_str = val_str[: width - 2] + ".."
    return val_str


def _generate_table_preview_from_data(
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> TablePreview:
    """Generate table preview from raw data with improved formatting."""
    if not data:
        return TablePreview(
            table_data="No data available", row_count=0, supports_sorting=False
        )

    # Get columns
    columns = list(data[0].keys()) if data else []

    # Determine optimal column widths and how many columns to show
    max_columns = 8  # Show more columns than before
    display_columns = columns[:max_columns]

    # Calculate optimal width for each column
    column_widths = _calculate_column_widths(display_columns, data)

    # Format table with proper alignment
    lines = ["Table Preview", "=" * 80]

    # Header with dynamic width
    header_parts = []
    separator_parts = []
    for col in display_columns:
        width = column_widths[col]
        col_name = str(col)
        if len(col_name) > width:
            col_name = col_name[: width - 2] + ".."
        header_parts.append(f"{col_name:<{width}}")
        separator_parts.append("-" * width)

    lines.append(" | ".join(header_parts))
    lines.append("-+-".join(separator_parts))

    # Data rows with proper formatting
    rows_shown = min(len(data), 15)  # Show more rows
    for row in data[:rows_shown]:
        row_parts = []
        for col in display_columns:
            width = column_widths[col]
            val = row.get(col, "")
            val_str = _format_value(val, width)
            row_parts.append(f"{val_str:<{width}}")
        lines.append(" | ".join(row_parts))

    # Summary information
    if len(data) > rows_shown:
        lines.append(f"... and {len(data) - rows_shown} more rows")

    if len(columns) > max_columns:
        lines.append(f"... and {len(columns) - max_columns} more columns")

    lines.append("")
    lines.append(f"Total: {len(data)} rows × {len(columns)} columns")

    return TablePreview(
        table_data="\n".join(lines), row_count=len(data), supports_sorting=True
    )


def _generate_safe_ascii_bar_chart(data: List[Dict[str, Any]]) -> str:
    """Generate ASCII bar chart with proper error handling."""
    if not data:
        return "No data available for bar chart"

    lines = ["ASCII Bar Chart", "=" * 50]

    # Extract values safely
    values = []
    labels = []

    for row in data[:10]:
        label = None
        value = None

        for _, val in row.items():
            if isinstance(val, (int, float)) and not _is_nan(val) and value is None:
                value = val
            elif isinstance(val, str) and label is None:
                label = val

        if value is not None:
            values.append(value)
            labels.append(label or f"Item {len(values)}")

    if not values:
        return "No numeric data found for bar chart"

    # Generate bars
    max_val = max(values)
    if max_val == 0:
        return "All values are zero"

    for label, value in zip(labels, values, strict=False):
        bar_length = int((value / max_val) * 30)
        bar = "█" * bar_length
        lines.append(f"{label[:10]:>10} |{bar:<30} {value:.2f}")

    return "\n".join(lines)


def _generate_safe_ascii_line_chart(data: List[Dict[str, Any]]) -> str:
    """Generate ASCII line chart with proper NaN handling."""
    if not data:
        return "No data available for line chart"

    lines = ["ASCII Line Chart", "=" * 50]
    values = _extract_numeric_values_safe(data)

    if not values:
        return "No valid numeric data found for line chart"

    range_str = _format_range_display(values)
    lines.append(range_str)

    sparkline = _generate_sparkline_safe(values)
    lines.append(sparkline)

    return "\n".join(lines)


def _extract_numeric_values_safe(data: List[Dict[str, Any]]) -> List[float]:
    """Extract numeric values safely from data."""
    values = []
    for row in data[:20]:
        for _, val in row.items():
            if isinstance(val, (int, float)) and not _is_nan(val):
                values.append(val)
                break
    return values


def _format_range_display(values: List[float]) -> str:
    """Format range display safely."""
    min_val = min(values)
    max_val = max(values)

    if _is_nan(min_val) or _is_nan(max_val):
        return "Range: Unable to calculate"
    else:
        return f"Range: {min_val:.2f} to {max_val:.2f}"


def _generate_sparkline_safe(values: List[float]) -> str:
    """Generate sparkline from values."""
    if not values:
        return ""

    min_val = min(values)

    if (max_val := max(values)) != min_val:
        sparkline = ""
        for val in values:
            normalized = (val - min_val) / (max_val - min_val)
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
        return sparkline
    else:
        return "─" * len(values)  # Flat line if all values are same


def _generate_safe_ascii_pie_chart(data: List[Dict[str, Any]]) -> str:
    """Generate ASCII pie chart representation."""
    if not data:
        return "No data available for pie chart"

    lines = ["ASCII Pie Chart", "=" * 50]

    # Extract values and labels
    values = []
    labels = []

    for row in data[:8]:  # Limit slices
        label = None
        value = None

        for _, val in row.items():
            if isinstance(val, (int, float)) and not _is_nan(val) and value is None:
                value = val
            elif isinstance(val, str) and label is None:
                label = val

        if value is not None and value > 0:
            values.append(value)
            labels.append(label or f"Slice {len(values)}")

    if not values:
        return "No valid data for pie chart"

    # Calculate percentages
    total = sum(values)
    if total == 0:
        return "Total is zero"

    for label, value in zip(labels, values, strict=False):
        percentage = (value / total) * 100
        bar_length = int(percentage / 3)  # Scale to fit
        bar = "●" * bar_length
        lines.append(f"{label[:15]:>15}: {bar} {percentage:.1f}%")

    return "\n".join(lines)


def _generate_safe_ascii_table(data: List[Dict[str, Any]]) -> str:
    """Generate ASCII table with safe formatting."""
    if not data:
        return "No data available"

    lines = ["Data Table", "=" * 50]

    # Get columns
    columns = list(data[0].keys()) if data else []

    # Format header
    header = " | ".join(str(col)[:10] for col in columns[:5])
    lines.append(header)
    lines.append("-" * len(header))

    # Format rows
    for row in data[:10]:
        row_str = " | ".join(str(row.get(col, ""))[:10] for col in columns[:5])
        lines.append(row_str)

    if len(data) > 10:
        lines.append(f"... {len(data) - 10} more rows")

    return "\n".join(lines)


def _is_nan(value: Any) -> bool:
    """Check if a value is NaN."""
    try:
        import math

        return math.isnan(float(value))
    except (ValueError, TypeError):
        return False


def _generate_vega_lite_preview_from_data(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview:
    """Generate Vega-Lite preview from raw data and form_data."""
    viz_type = form_data.get("viz_type", "table")

    # Map Superset viz types to Vega-Lite marks
    viz_to_mark = {
        "echarts_timeseries_line": "line",
        "echarts_timeseries_bar": "bar",
        "echarts_area": "area",
        "echarts_timeseries_scatter": "point",
        "bar": "bar",
        "line": "line",
        "area": "area",
        "scatter": "point",
        "pie": "arc",
        "table": "text",
    }

    mark = viz_to_mark.get(viz_type, "bar")

    # Basic Vega-Lite spec
    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"values": data},
        "mark": mark,
    }

    # Get x_axis and metrics from form_data
    x_axis = form_data.get("x_axis")
    metrics = form_data.get("metrics", [])
    groupby = form_data.get("groupby", [])

    # Build encoding based on available fields
    encoding = {}

    # Handle X-axis
    if x_axis and x_axis in (data[0] if data else {}):
        # Detect field type from data
        field_type = "nominal"  # default
        if data and len(data) > 0:
            sample_val = data[0].get(x_axis)
            if isinstance(sample_val, str):
                # Check if it's a date/time
                if any(char in str(sample_val) for char in ["-", "/", ":"]):
                    field_type = "temporal"
                else:
                    field_type = "nominal"
            elif isinstance(sample_val, (int, float)):
                field_type = "quantitative"

        encoding["x"] = {
            "field": x_axis,
            "type": field_type,
            "title": x_axis,
        }

    # Handle Y-axis (metrics)
    if metrics and data:
        # Find the first metric column in the data
        metric_col = None
        for col in data[0].keys():
            # Check if this is a metric column (usually has aggregation in name)
            if any(
                agg in str(col).upper()
                for agg in ["SUM", "AVG", "COUNT", "MIN", "MAX", "TOTAL"]
            ):
                metric_col = col
                break
            # Or check if it's numeric
            elif isinstance(data[0].get(col), (int, float)):
                metric_col = col
                break

        if metric_col:
            encoding["y"] = {
                "field": metric_col,
                "type": "quantitative",
                "title": metric_col,
            }

    # Handle color encoding for groupby
    if groupby and len(groupby) > 0 and groupby[0] in (data[0] if data else {}):
        encoding["color"] = {
            "field": groupby[0],
            "type": "nominal",
            "title": groupby[0],
        }

    # Special handling for pie charts
    if mark == "arc" and data:
        # For pie charts, we need theta encoding
        if "y" in encoding:
            encoding["theta"] = encoding.pop("y")
            encoding["theta"]["stack"] = True
        if "x" in encoding:
            # Use x as color for pie
            encoding["color"] = {
                "field": encoding["x"]["field"],
                "type": "nominal",
            }
            del encoding["x"]

    # Add encoding to spec
    if encoding:
        spec["encoding"] = encoding

    # Add responsive sizing - Vega-Lite supports "container" as a special width value
    spec["width"] = "container"
    spec["height"] = 400  # type: ignore

    # Add interactivity
    if mark in ["line", "point", "bar", "area"]:
        spec["selection"] = {
            "highlight": {
                "type": "single",
                "on": "mouseover",
                "empty": "none",
            }
        }

    return VegaLitePreview(
        specification=spec,
        data_url=None,
        supports_streaming=False,
    )
