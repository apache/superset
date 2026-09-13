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
from typing import Any, Dict, List

from superset.mcp_service.chart.query_result import (
    metric_result_label,
    normalize_gauge_query_result,
    query_result_failure,
)
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

        from superset.mcp_service.chart.chart_helpers import (
            build_query_context_from_form_data,
        )

        query_form_data = deepcopy(form_data)
        query_form_data["datasource"] = f"{dataset_id}__table"
        query_form_data["datasource_id"] = dataset_id
        query_form_data["datasource_type"] = "table"
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
        result = normalize_gauge_query_result(result, form_data)
        if isinstance(result, ChartError):
            return result
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
) -> ASCIIPreview | ChartError:
    """Generate ASCII preview from raw data."""
    viz_type = form_data.get("viz_type", "table")

    # Handle different chart types
    if viz_type == "gauge_chart":
        content_or_error = generate_gauge_ascii_preview(data, form_data)
        if isinstance(content_or_error, ChartError):
            return content_or_error
        content = content_or_error
    elif viz_type in ["bar", "dist_bar", "column"]:
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


_GAUGE_COLORS = (
    "#1FA8C9",
    "#454E7C",
    "#5AC189",
    "#FF7F44",
    "#666666",
    "#E04355",
    "#FCC700",
    "#A868B7",
)


def _gauge_column_label(column: Any) -> str | None:
    """Resolve the result label for a native QueryFormColumn."""
    if isinstance(column, str) and column:
        return column
    if not isinstance(column, dict) or not 0 < len(column) <= 20:
        return None
    label = (
        column.get("label")
        or column.get("sqlExpression")
        or column.get("column_name")
        or column.get("columnName")
    )
    return label if isinstance(label, str) and label else None


def _parse_gauge_number_list(value: Any, field_name: str) -> list[float]:
    """Parse a bounded comma-separated Gauge control."""
    if value in (None, ""):
        return []
    if not isinstance(value, str) or len(value) > 1000:
        raise ValueError(f"Gauge {field_name} must be a bounded string")
    try:
        parsed = [float(part.strip()) for part in value.split(",")]
    except ValueError as ex:
        raise ValueError(
            f"Gauge {field_name} must be a comma-separated list of numbers"
        ) from ex
    if not all(math.isfinite(number) for number in parsed):
        raise ValueError(f"Gauge {field_name} values must be finite")
    return parsed


def _prepare_gauge_preview(  # noqa: C901
    data: Any, form_data: Dict[str, Any]
) -> tuple[list[dict[str, Any]], dict[str, Any]] | ChartError:
    """Validate Gauge rows and derive display values used by both previews."""
    normalized = normalize_gauge_query_result(
        {"queries": [{"data": data}]}, {**form_data, "viz_type": "gauge_chart"}
    )
    if isinstance(normalized, ChartError):
        return normalized
    data = normalized["queries"][0]["data"]
    metric_label = metric_result_label(form_data.get("metric"))
    if not isinstance(data, list) or metric_label is None:
        return ChartError(
            error="Gauge preview requires rows and a metric result label.",
            error_type="InvalidGaugeFormData",
        )

    raw_groupby = form_data.get("groupby") or []
    if isinstance(raw_groupby, str):
        raw_groupby = [raw_groupby]
    if not isinstance(raw_groupby, list) or len(raw_groupby) > 10:
        return ChartError(
            error="Gauge groupby must contain at most 10 column references.",
            error_type="InvalidGaugeFormData",
        )
    group_labels: list[str] = []
    for index, column in enumerate(raw_groupby):
        label = _gauge_column_label(column)
        if label is None:
            return ChartError(
                error=f"Gauge groupby[{index}] has no resolvable result label.",
                error_type="InvalidGaugeFormData",
            )
        group_labels.append(label)

    values = [float(row[metric_label]) for row in data]

    def numeric_bound(field_name: str) -> float | None:
        value = form_data.get(field_name)
        if value in (None, ""):
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise ValueError(f"Gauge {field_name} must be numeric")
        try:
            converted = float(value)
        except ValueError as ex:
            raise ValueError(f"Gauge {field_name} must be numeric") from ex
        if not math.isfinite(converted):
            raise ValueError(f"Gauge {field_name} must be finite")
        return converted

    try:
        minimum = numeric_bound("min_val")
        maximum = numeric_bound("max_val")
        interval_bounds = _parse_gauge_number_list(
            form_data.get("intervals", ""), "intervals"
        )
        color_indices = _parse_gauge_number_list(
            form_data.get("interval_color_indices", ""),
            "interval_color_indices",
        )
    except ValueError as ex:
        return ChartError(error=str(ex), error_type="InvalidGaugeFormData")

    configured_minimum, configured_maximum = minimum, maximum

    # Match transformProps auto-range semantics: twice the extrema including 0.
    if minimum is None:
        minimum = 2 * min([*values, 0]) if values else 0
    if maximum is None:
        maximum = 2 * max([*values, 0]) if values else 1
    if configured_minimum is None and configured_maximum is None and minimum == maximum:
        maximum = minimum + 1
    if minimum >= maximum:
        return ChartError(
            error=(
                f"Gauge preview range is invalid: min_val {minimum:g} must be "
                f"less than max_val {maximum:g}."
            ),
            error_type="InvalidGaugeRange",
        )
    if any(
        left >= right
        for left, right in zip(interval_bounds, interval_bounds[1:], strict=False)
    ):
        return ChartError(
            error="Gauge intervals must be strictly increasing.",
            error_type="InvalidGaugeFormData",
        )
    if any(
        (configured_minimum is not None and bound <= configured_minimum)
        or (configured_maximum is not None and bound > configured_maximum)
        for bound in interval_bounds
    ):
        return ChartError(
            error="Gauge intervals must fall within the configured min/max range.",
            error_type="InvalidGaugeFormData",
        )
    if color_indices and len(color_indices) != len(interval_bounds):
        return ChartError(
            error="Gauge interval colors must match the number of interval bounds.",
            error_type="InvalidGaugeFormData",
        )
    if any(index < 1 or not index.is_integer() for index in color_indices):
        return ChartError(
            error="Gauge interval color indices must be positive integers.",
            error_type="InvalidGaugeFormData",
        )

    currency = form_data.get("currency_format")
    if currency is not None and not isinstance(currency, dict):
        return ChartError(
            error="Gauge currency_format must be an object.",
            error_type="InvalidGaugeFormData",
        )
    number_format = form_data.get("number_format", "SMART_NUMBER")
    value_formatter = form_data.get("value_formatter", "{value}")
    if not isinstance(number_format, str) or not isinstance(value_formatter, str):
        return ChartError(
            error="Gauge number_format and value_formatter must be strings.",
            error_type="InvalidGaugeFormData",
        )
    from superset.utils.number_format import format_number_with_config

    decorated: list[dict[str, Any]] = []
    for row_index, row in enumerate(data):
        value = float(row[metric_label])
        group = (
            ", ".join(f"{label}: {row.get(label)}" for label in group_labels) or "Value"
        )
        formatted = format_number_with_config(number_format, currency, value)
        decorated.append(
            {
                **row,
                "__mcp_gauge_group": group,
                "__mcp_gauge_ratio": (value - minimum) / (maximum - minimum),
                "__mcp_gauge_display": value_formatter.replace(
                    "{value}", str(formatted), 1
                ),
                "__mcp_gauge_row": row_index,
            }
        )

    colors = [
        _GAUGE_COLORS[(int(index) - 1) % len(_GAUGE_COLORS)] for index in color_indices
    ] or list(_GAUGE_COLORS[: max(1, len(interval_bounds))])
    return decorated, {
        "metric_label": metric_label,
        "group_labels": group_labels,
        "minimum": minimum,
        "maximum": maximum,
        "interval_bounds": interval_bounds,
        "interval_colors": colors,
    }


def generate_gauge_ascii_preview(
    data: Any, form_data: Dict[str, Any], width: int = 80
) -> str | ChartError:
    """Render a bounded dial-like ASCII Gauge using the configured value format."""
    prepared = _prepare_gauge_preview(data, form_data)
    if isinstance(prepared, ChartError):
        return prepared
    decorated, metadata = prepared
    minimum = metadata["minimum"]
    maximum = metadata["maximum"]
    lines = [
        "Gauge Chart",
        f"Range: {minimum:g} to {maximum:g}",
    ]
    if metadata["interval_bounds"]:
        lines.append(
            "Intervals: "
            + ", ".join(f"{value:g}" for value in metadata["interval_bounds"])
        )
    if not decorated:
        lines.append("No data available")
        return "\n".join(lines)

    width = min(max(width, 40), 200)
    bar_width = max(10, min(40, width - 38))
    for row in decorated[:10]:
        ratio = min(1.0, max(0.0, row["__mcp_gauge_ratio"]))
        filled = round(ratio * bar_width)
        bar = "█" * filled + "░" * (bar_width - filled)
        label = str(row["__mcp_gauge_group"])
        lines.append(f"{label[:20]:>20} [{bar}] {row['__mcp_gauge_display']}")
    return "\n".join(lines)


def generate_gauge_vega_lite_preview(  # noqa: C901
    data: Any, form_data: Dict[str, Any]
) -> VegaLitePreview | ChartError:
    """Build a Gauge-specific layered radial Vega-Lite preview."""
    prepared = _prepare_gauge_preview(data, form_data)
    if isinstance(prepared, ChartError):
        return prepared
    decorated, metadata = prepared
    start_angle = form_data.get("start_angle", 225)
    end_angle = form_data.get("end_angle", -45)

    def finite_angle(value: Any) -> float | None:
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            return None
        try:
            converted = float(value)
        except ValueError:
            return None
        return converted if math.isfinite(converted) else None

    numeric_start_angle = finite_angle(start_angle)
    numeric_end_angle = finite_angle(end_angle)
    if numeric_start_angle is None or numeric_end_angle is None:
        return ChartError(
            error="Gauge start_angle and end_angle must be finite numbers.",
            error_type="InvalidGaugeFormData",
        )

    angle_range = [math.radians(numeric_start_angle), math.radians(numeric_end_angle)]
    theta_scale = {"domain": [0, 1], "range": angle_range}
    metric_label = metadata["metric_label"]
    tooltip = [
        {"field": field, "type": "nominal"} for field in metadata["group_labels"]
    ]
    tooltip.extend(
        [
            {"field": metric_label, "type": "quantitative"},
            {"field": "__mcp_gauge_display", "type": "nominal", "title": "Value"},
        ]
    )
    progress_color: dict[str, Any]
    interval_bounds = metadata["interval_bounds"]
    if interval_bounds:
        progress_color = {
            "field": metric_label,
            "type": "quantitative",
            "scale": {
                "type": "threshold",
                "domain": interval_bounds[:-1],
                "range": metadata["interval_colors"],
            },
            "legend": None,
        }
    elif metadata["group_labels"]:
        progress_color = {
            "field": "__mcp_gauge_group",
            "type": "nominal",
            "legend": None,
        }
    else:
        progress_color = {"value": _GAUGE_COLORS[0]}

    inner_radius, outer_radius = 55, 82
    pointer_radius = (inner_radius + outer_radius) / 2
    background_layers: list[dict[str, Any]] = []
    previous_ratio = 0.0
    for bound, color in zip(interval_bounds, metadata["interval_colors"], strict=False):
        # Automatic bounds can put configured thresholds outside the visible dial.
        ratio = min(
            1.0,
            max(
                0.0,
                (bound - metadata["minimum"])
                / (metadata["maximum"] - metadata["minimum"]),
            ),
        )
        if ratio <= previous_ratio:
            continue
        background_layers.append(
            {
                "mark": {
                    "type": "arc",
                    "innerRadius": inner_radius,
                    "outerRadius": outer_radius,
                    "color": color,
                    "opacity": 0.35,
                },
                "encoding": {
                    "theta": {
                        "datum": previous_ratio,
                        "type": "quantitative",
                        "scale": theta_scale,
                        "stack": None,
                    },
                    "theta2": {"datum": ratio},
                },
            }
        )
        previous_ratio = ratio
    if not background_layers:
        background_layers.append(
            {
                "mark": {
                    "type": "arc",
                    "innerRadius": inner_radius,
                    "outerRadius": outer_radius,
                    "color": "#D3D3D3",
                },
                "encoding": {
                    "theta": {
                        "datum": 1,
                        "type": "quantitative",
                        "scale": theta_scale,
                        "stack": None,
                    },
                    "theta2": {"datum": 0},
                },
            }
        )

    progress_layer = {
        "mark": {
            "type": "arc",
            "innerRadius": inner_radius,
            "outerRadius": outer_radius,
            "cornerRadius": 4 if form_data.get("round_cap") else 0,
            "tooltip": True,
        },
        "encoding": {
            "theta": {
                "field": "__mcp_gauge_ratio",
                "type": "quantitative",
                "scale": theta_scale,
                "stack": None,
            },
            "theta2": {"datum": 0},
            "color": progress_color,
            "tooltip": tooltip,
        },
    }
    facet_width, dial_height = 200, 300
    # Faceted value expressions cannot use the outer width/height signals.
    center_x = str(facet_width / 2) if metadata["group_labels"] else "width / 2"
    center_y = str(dial_height / 2) if metadata["group_labels"] else "height / 2"
    pointer_layer = {
        "transform": [
            {
                "calculate": (
                    f"{angle_range[0]} + datum.__mcp_gauge_ratio * "
                    f"({angle_range[1]} - {angle_range[0]})"
                ),
                "as": "__mcp_gauge_angle",
            },
        ],
        "mark": {"type": "rule", "strokeWidth": 3, "color": "#444"},
        "encoding": {
            "x": {"value": {"expr": center_x}},
            "y": {"value": {"expr": center_y}},
            "x2": {
                "value": {
                    "expr": (
                        f"{center_x} + {pointer_radius} * sin(datum.__mcp_gauge_angle)"
                    )
                }
            },
            "y2": {
                "value": {
                    "expr": (
                        f"{center_y} - {pointer_radius} * cos(datum.__mcp_gauge_angle)"
                    )
                }
            },
            "tooltip": tooltip,
        },
    }
    text_layer = {
        "mark": {"type": "text", "fontSize": form_data.get("font_size", 15)},
        "encoding": {"text": {"field": "__mcp_gauge_display", "type": "nominal"}},
    }
    layers: list[dict[str, Any]] = [*background_layers]
    if form_data.get("show_progress", True):
        layers.append(progress_layer)
    if form_data.get("show_pointer", True):
        layers.append(pointer_layer)
    layers.append(text_layer)
    unit_spec: dict[str, Any] = {"layer": layers}
    specification: dict[str, Any] = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"values": decorated},
        "width": "container",
        "height": dial_height,
        "usermeta": {
            "viz_type": "gauge_chart",
            "min_val": metadata["minimum"],
            "max_val": metadata["maximum"],
            "intervals": interval_bounds,
            "interval_color_indices": form_data.get("interval_color_indices", ""),
            "color_scheme": form_data.get("color_scheme"),
            "show_pointer": form_data.get("show_pointer", True),
            "show_progress": form_data.get("show_progress", True),
            "show_axis_tick": form_data.get("show_axis_tick", False),
            "show_split_line": form_data.get("show_split_line", False),
            "split_number": form_data.get("split_number", 10),
            "overlap": form_data.get("overlap", True),
            "round_cap": form_data.get("round_cap", False),
            "animation": form_data.get("animation", True),
            "font_size": form_data.get("font_size", 15),
            "number_format": form_data.get("number_format", "SMART_NUMBER"),
            "value_formatter": form_data.get("value_formatter", "{value}"),
        },
    }
    if metadata["group_labels"]:
        specification.pop("width")
        unit_spec["width"] = facet_width
        unit_spec["height"] = specification.pop("height")
        specification.update(
            {
                "facet": {
                    "field": "__mcp_gauge_group",
                    "type": "nominal",
                },
                "columns": min(3, max(1, len(decorated))),
                "spec": unit_spec,
            }
        )
    else:
        specification.update(unit_spec)
    return VegaLitePreview(
        specification=specification,
        data_url=None,
        supports_streaming=False,
    )


# Bubble stores its metrics under x/y/size and its dimensions under
# entity/series, so the generic spec builder below finds neither.
BUBBLE_VIZ_TYPES: frozenset[str] = frozenset({"bubble", "bubble_v2"})


def _metric_field_name(metric: Any) -> str | None:
    """Return the result-set column a form_data metric produces."""
    if isinstance(metric, str):
        return metric
    if isinstance(metric, dict):
        label = metric.get("label")
        if isinstance(label, str) and label:
            return label
    return None


def generate_bubble_vega_lite_preview(
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview:
    """Build a Bubble-specific Vega-Lite preview.

    x and y position each bubble, size sets its area and the series (or the
    entity when no series is set) colors it — mirroring the frontend Bubble
    encoding rather than the generic x-axis/metrics layout.
    """
    sample = data[0] if data else {}
    encoding: Dict[str, Any] = {}

    for channel in ("x", "y", "size"):
        field = _metric_field_name(form_data.get(channel))
        if field and field in sample:
            encoding[channel] = {
                "field": field,
                "type": "quantitative",
                "title": field,
            }

    entity = form_data.get("entity")
    color_field = form_data.get("series") or entity
    if isinstance(color_field, str) and color_field in sample:
        encoding["color"] = {
            "field": color_field,
            "type": "nominal",
            "title": color_field,
        }

    tooltip = [
        {"field": enc["field"], "type": enc["type"]} for enc in encoding.values()
    ]
    if isinstance(entity, str) and entity in sample and entity != color_field:
        tooltip.insert(0, {"field": entity, "type": "nominal"})

    spec: Dict[str, Any] = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"values": data},
        "mark": "circle",
        "width": "container",
        "height": 400,
    }
    if encoding:
        if tooltip:
            encoding["tooltip"] = tooltip
        spec["encoding"] = encoding

    return VegaLitePreview(
        specification=spec,
        data_url=None,
        supports_streaming=False,
    )


def _generate_vega_lite_preview_from_data(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview | ChartError:
    """Generate Vega-Lite preview from raw data and form_data."""
    viz_type = form_data.get("viz_type", "table")
    if viz_type == "gauge_chart":
        return generate_gauge_vega_lite_preview(data, form_data)
    if viz_type in BUBBLE_VIZ_TYPES:
        return generate_bubble_vega_lite_preview(data, form_data)

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
