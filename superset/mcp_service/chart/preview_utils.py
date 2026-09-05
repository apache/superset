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
import math
from copy import deepcopy
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List

from superset.mcp_service.chart.query_result import query_result_failure
from superset.mcp_service.chart.schemas import (
    ASCIIPreview,
    ChartError,
    TablePreview,
    VegaLitePreview,
)

logger = logging.getLogger(__name__)

SUPPORTED_FORM_DATA_PREVIEW_FORMATS = frozenset({"ascii", "table", "vega_lite"})


def _build_query_columns(form_data: Dict[str, Any]) -> list[str]:
    """Build query columns list from form_data, including both x_axis and groupby.

    Delegates to the shared builder so the MCP and dashboard-export paths stay in
    sync (single source of truth).
    """
    from superset.common.form_data_query_context import columns_from_form_data

    return columns_from_form_data(form_data)


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
        from superset.commands.chart.data.get_data_command import ChartDataCommand
        from superset.connectors.sqla.models import SqlaTable
        from superset.extensions import db

        dataset = db.session.get(SqlaTable, dataset_id)
        if not dataset:
            return ChartError(
                error=f"Dataset {dataset_id} not found", error_type="DatasetNotFound"
            )

        # Create query context through the chart-aware shared builder used by
        # saved/cached get_chart_data and compile validation.
        from superset.mcp_service.chart.chart_helpers import (
            build_query_context_from_form_data,
        )

        query_form_data = deepcopy(form_data)
        query_form_data["datasource"] = f"{dataset_id}__table"
        query_context_obj = build_query_context_from_form_data(
            query_form_data,
            row_limit=form_data.get("row_limit", 100),
            force=False,
        )

        # Execute query
        command = ChartDataCommand(query_context_obj)
        command.validate()
        result = command.run()

        if query_failure := query_result_failure(result):
            return query_failure

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
        logger.error("Preview generation from form data failed: %s", e)
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
        if math.isnan(val):
            val_str = "N/A"
        elif math.isfinite(val) and val.is_integer():
            # Integer-like float (e.g. 1988.0) — format without decimals
            val_str = str(int(val))
        elif abs(val) >= 1000000:
            val_str = f"{val:.2e}"  # Scientific notation for large numbers
        elif abs(val) >= 1000:
            val_str = f"{val:,.2f}"  # Thousands separator
        else:
            val_str = f"{val:g}"
    elif isinstance(val, int):
        val_str = str(val)
    elif val is None:
        val_str = "N/A"
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


def _gantt_metric_label(metric: Any) -> str | None:
    """Resolve a native metric result key like frontend ``getMetricLabel``."""
    if isinstance(metric, str) and metric:
        return metric
    if not isinstance(metric, dict) or not 0 < len(metric) <= 20:
        return None

    label = metric.get("label")
    if label:
        return label if isinstance(label, str) else None
    if label not in (None, ""):
        return None

    expression_type = metric.get("expressionType")
    if expression_type == "SIMPLE":
        aggregate = metric.get("aggregate")
        column = metric.get("column")
        if (
            not isinstance(aggregate, str)
            or not aggregate
            or len(aggregate) > 100
            or not isinstance(column, dict)
            or not 0 < len(column) <= 50
        ):
            return None
        column_name = column.get("columnName") or column.get("column_name")
        if not isinstance(column_name, str) or not column_name:
            return None
        return f"{aggregate}({column_name})"
    if expression_type == "SQL":
        sql_expression = metric.get("sqlExpression")
        if (
            isinstance(sql_expression, str)
            and sql_expression
            and len(sql_expression) <= 2000
        ):
            return sql_expression
    return None


def _gantt_result_field(field: Any, _field_name: str) -> str | None:
    """Resolve the query-result key using the frontend getColumnLabel contract."""
    if isinstance(field, str) and field:
        return field
    if not isinstance(field, dict) or not 0 < len(field) <= 20:
        return None
    label = field.get("label") or field.get("sqlExpression")
    return label if isinstance(label, str) and label else None


def _gantt_temporal_value(value: Any) -> float | None:  # noqa: C901
    """Return a comparable millisecond timestamp for one bounded date value."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        try:
            converted = float(value)
        except OverflowError:
            return None
        return converted if math.isfinite(converted) else None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.min)
    elif isinstance(value, str) and 0 < len(value) <= 128:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.combine(date.fromisoformat(value), time.min)
            except ValueError:
                return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    try:
        return parsed.timestamp() * 1000
    except (OverflowError, OSError, ValueError):
        return None


def _is_valid_gantt_category(value: Any) -> bool:
    """Return whether a category can produce a stable, visible nominal label."""
    if value is None or isinstance(value, bool):
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float)):
        try:
            return math.isfinite(float(value))
        except OverflowError:
            return False
    return False


def _generate_gantt_vega_lite_preview(  # noqa: C901
    data: Any, form_data: Dict[str, Any]
) -> VegaLitePreview | ChartError:
    """Validate all Gantt rows and build the shared interval-bar preview."""
    if not isinstance(data, list):
        return ChartError(
            error="Gantt result data is not an array of rows.",
            error_type="InvalidGanttResult",
        )
    start = _gantt_result_field(form_data.get("start_time"), "start_time")
    end = _gantt_result_field(form_data.get("end_time"), "end_time")
    category = _gantt_result_field(form_data.get("y_axis"), "y_axis")
    if not all((start, end, category)):
        return ChartError(
            error=(
                "Gantt Vega-Lite preview requires valid start_time, end_time, "
                "and y_axis form-data column references."
            ),
            error_type="InvalidGanttFormData",
        )
    assert isinstance(start, str)
    assert isinstance(end, str)
    assert isinstance(category, str)
    if len({start.casefold(), end.casefold(), category.casefold()}) != 3:
        return ChartError(
            error=(
                "Gantt start_time, end_time, and y_axis must resolve to distinct "
                "query-result fields."
            ),
            error_type="InvalidGanttFormData",
        )

    series_value = form_data.get("series")
    series = (
        _gantt_result_field(series_value, "series")
        if series_value is not None
        else None
    )
    if series_value is not None and series is None:
        return ChartError(
            error="Gantt series must be a valid column reference.",
            error_type="InvalidGanttFormData",
        )

    raw_tooltip_columns = form_data.get("tooltip_columns") or []
    raw_tooltip_metrics = form_data.get("tooltip_metrics") or []
    if not isinstance(raw_tooltip_columns, list) or len(raw_tooltip_columns) > 50:
        return ChartError(
            error="Gantt tooltip_columns must contain at most 50 column references.",
            error_type="InvalidGanttFormData",
        )
    if not isinstance(raw_tooltip_metrics, list) or len(raw_tooltip_metrics) > 50:
        return ChartError(
            error="Gantt tooltip_metrics must contain at most 50 metric references.",
            error_type="InvalidGanttFormData",
        )
    tooltip_columns: list[str] = []
    for index, field in enumerate(raw_tooltip_columns):
        label = _gantt_result_field(field, f"tooltip_columns[{index}]")
        if label is None:
            return ChartError(
                error=(
                    f"Gantt tooltip_columns[{index}] must be a valid column reference."
                ),
                error_type="InvalidGanttFormData",
            )
        tooltip_columns.append(label)
    tooltip_metrics: list[str] = []
    for index, metric in enumerate(raw_tooltip_metrics):
        label = _gantt_metric_label(metric)
        if label is None:
            return ChartError(
                error=(
                    f"Gantt tooltip_metrics[{index}] must expose a non-empty "
                    "result label."
                ),
                error_type="InvalidGanttFormData",
            )
        tooltip_metrics.append(label)

    required = {start, end, category, *tooltip_columns, *tooltip_metrics}
    if series:
        required.add(series)
    for index, row in enumerate(data):
        if not isinstance(row, dict):
            return ChartError(
                error=f"Gantt result row {index} is not an object.",
                error_type="InvalidGanttResult",
            )
        missing = required - row.keys()
        if missing:
            return ChartError(
                error=(
                    f"Gantt result row {index} is missing required output fields: "
                    f"{', '.join(sorted(missing))}."
                ),
                error_type="InvalidGanttResult",
            )
        start_value = _gantt_temporal_value(row[start])
        if start_value is None:
            return ChartError(
                error=(
                    f"Gantt result row {index} has an invalid temporal value for "
                    f"{start}."
                ),
                error_type="InvalidGanttResult",
            )
        end_value = _gantt_temporal_value(row[end])
        if end_value is None:
            return ChartError(
                error=(
                    f"Gantt result row {index} has an invalid temporal value for {end}."
                ),
                error_type="InvalidGanttResult",
            )
        if end_value < start_value:
            return ChartError(
                error=(
                    f"Gantt result row {index} ends before it starts: "
                    f"{end} is earlier than {start}."
                ),
                error_type="InvalidGanttResult",
            )
        if not _is_valid_gantt_category(row[category]):
            return ChartError(
                error=(
                    f"Gantt result row {index} has an invalid category value for "
                    f"{category}."
                ),
                error_type="InvalidGanttResult",
            )

    tooltip_fields: list[dict[str, str]] = [
        {"field": category, "type": "nominal"},
        {"field": start, "type": "temporal"},
        {"field": end, "type": "temporal"},
    ]
    for field in ([series] if series else []) + tooltip_columns:
        if isinstance(field, str) and field not in {
            item["field"] for item in tooltip_fields
        }:
            tooltip_fields.append({"field": field, "type": "nominal"})
    for label in tooltip_metrics:
        if label not in {item["field"] for item in tooltip_fields}:
            tooltip_fields.append({"field": label, "type": "quantitative"})

    encoding: dict[str, Any] = {
        "x": {
            "field": start,
            "type": "temporal",
            "title": form_data.get("x_axis_title"),
        },
        "x2": {"field": end},
        "y": {
            "field": category,
            "type": "nominal",
            "title": form_data.get("y_axis_title") or category,
        },
        "tooltip": tooltip_fields,
    }
    if series:
        encoding["color"] = {"field": series, "type": "nominal", "title": series}
        if form_data.get("subcategories"):
            encoding["yOffset"] = {"field": series, "type": "nominal"}

    return VegaLitePreview(
        specification={
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "data": {"values": data},
            "mark": {"type": "bar", "tooltip": True},
            "encoding": encoding,
            "width": "container",
            "height": 400,
        },
        data_url=None,
        supports_streaming=False,
    )


def _generate_vega_lite_preview_from_data(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview | ChartError:
    """Generate Vega-Lite preview from raw data and form_data."""
    viz_type = form_data.get("viz_type", "table")
    if viz_type == "gantt_chart":
        return _generate_gantt_vega_lite_preview(data, form_data)

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
