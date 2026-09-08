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
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Dict, List

from superset.mcp_service.chart.query_result import safe_exception_message
from superset.mcp_service.chart.schemas import (
    ASCIIPreview,
    ChartError,
    TablePreview,
    VegaLitePreview,
)

logger = logging.getLogger(__name__)

SUPPORTED_FORM_DATA_PREVIEW_FORMATS = frozenset({"ascii", "table", "vega_lite"})
_MAX_BULLET_FIELDS = 256
_MAX_BULLET_FIELD_BYTES = 1000
_MAX_BULLET_TEXT_BYTES = 2000
_MAX_BULLET_TOKENS = 256
_ENUM_SCALAR_TYPES = (str, int, float, bool, Decimal)


class BulletOutputError(ValueError):
    """A Bullet query result cannot be rendered without guessing its roles."""

    def __init__(self, message: str, error_type: str = "MalformedBulletOutput") -> None:
        super().__init__(message)
        self.error_type = error_type


@dataclass(frozen=True)
class BulletRenderModel:
    """Strict, frontend-aligned data and presentation roles for one preview."""

    rows: list[dict[str, Any]]
    metric_field: str
    dimensions: list[str]
    measures: list[float]
    ranges: list[float]
    range_labels: list[str]
    markers: list[float]
    marker_labels: list[str]
    marker_lines: list[float]
    marker_line_labels: list[str]
    y_axis_format: str
    show_labels: bool
    show_legend: bool


def _build_query_columns(form_data: Dict[str, Any]) -> list[str]:
    """Build query columns list from form_data, including both x_axis and groupby.

    Delegates to the shared builder so the MCP and dashboard-export paths stay in
    sync (single source of truth).
    """
    from superset.common.form_data_query_context import columns_from_form_data

    return columns_from_form_data(form_data)


def _generate_preview_from_form_data(
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
        if form_data.get("viz_type") == "bullet" and preview_format == "table":
            return ChartError(
                error=(
                    "Table previews cannot represent Bullet ranges, markers, "
                    "labels, and legend semantics"
                ),
                error_type="UnsupportedFormat",
            )

        # Execute query to get data
        from superset.charts.data.form_data import set_query_context_form_data
        from superset.commands.chart.data.get_data_command import ChartDataCommand
        from superset.connectors.sqla.models import SqlaTable
        from superset.extensions import db
        from superset.mcp_service.chart.chart_helpers import (
            build_query_context_from_form_data,
        )
        from superset.mcp_service.chart.query_result import query_result_data

        dataset = db.session.get(SqlaTable, dataset_id)
        if not dataset:
            return ChartError(
                error=f"Dataset {dataset_id} not found", error_type="DatasetNotFound"
            )

        query_form_data = dict(form_data)
        query_form_data["datasource"] = f"{dataset_id}__table"
        query_context_obj = build_query_context_from_form_data(
            query_form_data,
            row_limit=form_data.get("row_limit", 100),
            force=False,
        )

        # Seed the no-request-context form data used by virtual-dataset Jinja
        # macros, matching the chart-data and dataset-query MCP paths.
        set_query_context_form_data(query_context_obj, dataset_id, "table")

        # Execute query
        command = ChartDataCommand(query_context_obj)
        command.validate()
        result = command.run()

        queries_data, failure = query_result_data(
            result,
            temporal_json_numbers=form_data.get("viz_type") == "bullet",
        )
        if failure is not None:
            return failure

        if not queries_data:
            return ChartError(
                error="No data returned from query", error_type="EmptyResult"
            )

        data = queries_data[0]

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

    except BulletOutputError as ex:
        return ChartError(error=safe_exception_message(ex), error_type=ex.error_type)
    except Exception as e:
        error_text = safe_exception_message(e)
        logger.error("Preview generation from form data failed: %s", error_text)
        return ChartError(
            error=f"Failed to generate preview: {error_text}",
            error_type="PreviewError",
        )


def generate_preview_from_form_data(
    form_data: Dict[str, Any], dataset_id: int, preview_format: str
) -> Any:
    """Generate and preflight a complete unsaved preview content response."""
    from superset.mcp_service.chart.response_preflight import (
        preflight_chart_response,
    )

    result = _generate_preview_from_form_data(form_data, dataset_id, preview_format)
    return preflight_chart_response(result)


def _generate_ascii_preview_from_data(
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> ASCIIPreview:
    """Generate ASCII preview from raw data."""
    viz_type = form_data.get("viz_type", "table")

    # Handle different chart types
    if viz_type == "bullet":
        content = _generate_ascii_bullet_chart(data, form_data)
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


def _form_metric_label(metric: Any) -> str | None:
    """Return the result-column label for a native QueryFormMetric."""
    if type(metric) is str:
        return metric
    if type(metric) is not dict:
        return None
    if label := dict.get(metric, "label"):
        return label if type(label) is str else None
    if dict.get(metric, "expressionType") == "SQL":
        expression = dict.get(metric, "sqlExpression")
        return expression if type(expression) is str and expression else None
    column = dict.get(metric, "column")
    column_name = dict.get(column, "column_name") if type(column) is dict else column
    aggregate = dict.get(metric, "aggregate")
    if type(column_name) is str and type(aggregate) is str:
        return f"{aggregate}({column_name})"
    return None


def _form_column_label(column: Any) -> str | None:
    """Return the result-column label for a native QueryFormColumn."""
    if type(column) is str:
        return column
    if type(column) is not dict:
        return None
    for key in ("label", "column_name"):
        if type(value := dict.get(column, key)) is str and value:
            return value
    return None


def _canonical_result_field(label: str | None, row: Dict[str, Any]) -> str | None:
    """Resolve an exact or one unambiguous casefold result-field match."""
    if label is None:
        return None
    if label in dict.keys(row):
        return label
    matches = [
        field
        for field in dict.keys(row)
        if type(field) is str and field.casefold() == label.casefold()
    ]
    return matches[0] if len(matches) == 1 else None


def _require_result_field(label: str | None, row: dict[str, Any], role: str) -> str:
    """Resolve a role without falling back to an unrelated result field."""
    if not label:
        raise BulletOutputError(f"Bullet {role} has no declared result alias")
    if label in dict.keys(row):
        return label
    matches = sorted(
        field
        for field in dict.keys(row)
        if type(field) is str and field.casefold() == label.casefold()
    )
    if len(matches) == 1:
        return matches[0]
    if matches:
        raise BulletOutputError(
            f"Bullet {role} alias {label!r} is ambiguous; candidates: "
            f"{', '.join(matches)}"
        )
    raise BulletOutputError(
        f"Bullet {role} alias {label!r} is missing from query output"
    )


def _safe_enum_backing(value: Any) -> Any:
    """Extract Enum's stored value without public descriptors/conversions."""
    value_type = type(value)
    try:
        mro = type.__getattribute__(value_type, "__mro__")
    except (AttributeError, TypeError):  # pragma: no cover - normal types have MRO
        return value
    if type(mro) is not tuple or not any(base is Enum for base in mro):
        return value
    try:
        backing = object.__getattribute__(value, "_value_")
    except Exception as ex:
        raise BulletOutputError("Bullet output contains an unreadable enum") from ex
    if not any(type(backing) is allowed for allowed in _ENUM_SCALAR_TYPES):
        raise BulletOutputError("Bullet output contains an unsupported enum value")
    return backing


def _decimal_javascript_string(value: Decimal) -> str:
    """Render an exact binary64 spelling with JavaScript Number thresholds."""
    sign, digits_tuple, exponent = Decimal.as_tuple(value)
    if type(exponent) is not int:  # finite Decimals always have an integer exponent
        raise BulletOutputError("Bullet dimension contains a non-finite Decimal")
    if not any(digits_tuple):
        return "0"

    digits = "".join(str(digit) for digit in digits_tuple)
    adjusted = len(digits) + exponent - 1
    prefix = "-" if sign else ""
    if -6 <= adjusted < 21:
        point = len(digits) + exponent
        if point <= 0:
            text = f"0.{('0' * -point)}{digits}"
        elif point >= len(digits):
            text = digits + ("0" * (point - len(digits)))
        else:
            text = f"{digits[:point]}.{digits[point:]}"
        if "." in text:
            text = text.rstrip("0").rstrip(".")
        return prefix + text

    fraction = digits[1:].rstrip("0")
    coefficient = digits[0] + (f".{fraction}" if fraction else "")
    exponent_text = f"+{adjusted}" if adjusted >= 0 else str(adjusted)
    return f"{prefix}{coefficient}e{exponent_text}"


def _javascript_number_string(value: int | float | Decimal) -> str:
    """Apply JSON-number -> IEEE-754 Number -> JavaScript String semantics.

    Exact result scalars can retain precision that the frontend cannot: JSON
    parsing first rounds a numeric token to binary64, and ``String`` then emits
    the shortest round-tripping decimal with fixed notation for exponents in
    [-6, 20].  Converting exact builtin scalars to an exact builtin float keeps
    the path hook-free.  Python and JavaScript use the same shortest
    round-tripping binary64 digits; ``_decimal_javascript_string`` only adjusts
    the notation thresholds and exponent spelling.

    A finite integer or Decimal outside binary64's range becomes an infinity
    after JSON parsing, matching JavaScript.  Non-finite source values are
    rejected by the trusted scalar normalizer before this helper is called.
    """
    value_type = type(value)
    if value_type not in {int, float, Decimal}:
        raise BulletOutputError("Bullet dimension contains an unsupported number")
    if value_type is float and not math.isfinite(value):
        raise BulletOutputError("Bullet dimension contains a non-finite number")
    if isinstance(value, Decimal) and not Decimal.is_finite(value):
        raise BulletOutputError("Bullet dimension contains a non-finite Decimal")
    try:
        number = float(value)
    except OverflowError:
        number = -math.inf if value < 0 else math.inf

    if math.isinf(number):
        return "-Infinity" if number < 0 else "Infinity"
    if number == 0:
        # String(-0) is "0" even though JSON.parse preserves negative zero.
        return "0"
    return _decimal_javascript_string(Decimal(float.__repr__(number)))


def _bullet_category_value(  # noqa: C901
    value: Any, dimension: str, row_index: int
) -> tuple[Any, str]:
    """Return a JSON-safe value and bounded frontend ``String(value)`` text.

    The trusted scalar normalizer is type-exact and does not dispatch through
    application hooks.  Vega data retains the normalized Chart Data wire value
    (including epoch-ms temporal numbers); only the derived category key and
    ASCII label use the JavaScript-compatible text.
    """
    from superset.mcp_service.chart.query_result import (
        _bounded_utf8_length,
        _chart_data_duration_text,
        _chart_data_temporal_number,
        _is_chart_data_duration_scalar,
        _is_chart_data_temporal_scalar,
        _normalize_trusted_scalar,
    )

    normalized: Any
    reason: str | None
    if _is_chart_data_temporal_scalar(value):
        normalized, reason = _chart_data_temporal_number(value)
    elif _is_chart_data_duration_scalar(value):
        normalized, reason = _chart_data_duration_text(value)
    else:
        normalized, reason = _normalize_trusted_scalar(
            value, max_string_bytes=_MAX_BULLET_TEXT_BYTES
        )
    if reason is not None:
        if reason == "contains an unsupported or subclassed value":
            reason = "has an unsupported value type"
        elif "oversized string" in reason:
            reason = "exceeds the size limit"
        raise BulletOutputError(
            f"Bullet dimension {dimension!r} row {row_index} {reason}"
        )

    value_type = type(normalized)
    if normalized is None:
        text = "null"
    elif value_type is str:
        text = normalized
    elif value_type is bool:
        text = "true" if normalized else "false"
    elif value_type is int or value_type is float or value_type is Decimal:
        text = _javascript_number_string(normalized)
    else:
        raise BulletOutputError(
            f"Bullet dimension {dimension!r} row {row_index} has an "
            "unsupported value type"
        )

    if _bounded_utf8_length(text, _MAX_BULLET_TEXT_BYTES) is None:
        raise BulletOutputError(
            f"Bullet dimension {dimension!r} row {row_index} exceeds the size limit"
        )
    return normalized, text


def _bullet_number(value: Any, row_index: int, metric_field: str) -> float:
    """Apply the frontend's useful ``Number(value ?? 0)`` numeric subset."""
    value = _safe_enum_backing(value)
    if value is None:
        number = 0.0
    elif type(value) is bool:
        raise BulletOutputError(
            f"Bullet metric {metric_field!r} row {row_index} returned a boolean"
        )
    elif type(value) is int or type(value) is float or type(value) is Decimal:
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as ex:
            raise BulletOutputError(
                f"Bullet metric {metric_field!r} row {row_index} is not numeric"
            ) from ex
    elif type(value) is str:
        if len(value) > _MAX_BULLET_TEXT_BYTES:
            raise BulletOutputError(
                f"Bullet metric {metric_field!r} row {row_index} is not numeric"
            )
        stripped = value.strip()
        if not stripped:
            raise BulletOutputError(
                f"Bullet metric {metric_field!r} row {row_index} is not numeric"
            )
        try:
            number = float(Decimal(stripped))
        except (InvalidOperation, ValueError, OverflowError) as ex:
            raise BulletOutputError(
                f"Bullet metric {metric_field!r} row {row_index} returned "
                f"non-numeric text"
            ) from ex
    else:
        raise BulletOutputError(
            f"Bullet metric {metric_field!r} row {row_index} is not numeric"
        )
    if not math.isfinite(number):
        raise BulletOutputError(
            f"Bullet metric {metric_field!r} row {row_index} is NaN or infinite"
        )
    return number


def _bullet_string_tokens(value: Any) -> list[str]:
    """Parse labels exactly like the frontend's comma tokenizer."""
    from superset.mcp_service.chart.query_result import _truncate_utf8

    value = _safe_enum_backing(value)
    if value is None:
        return []
    if type(value) is not str or len(value) > _MAX_BULLET_TEXT_BYTES:
        raise BulletOutputError("Bullet labels must be a bounded comma-separated list")
    if not value.strip():
        return []
    tokens = value.split(",")
    if len(tokens) > _MAX_BULLET_TOKENS:
        raise BulletOutputError("Bullet labels exceed the item limit")
    return [_truncate_utf8(token.strip(), _MAX_BULLET_TEXT_BYTES) for token in tokens]


def _unique_bullet_derived_field(
    rows: list[dict[str, Any]], base: str, reserved: tuple[str, ...] = ()
) -> str:
    """Return one internal key absent from result rows and prior derived keys."""
    occupied = {key for row in rows for key in dict.keys(row)}
    occupied.update(reserved)
    candidate = base
    suffix = 0
    while candidate in occupied:
        suffix += 1
        candidate = f"{base}_{suffix}"
    return candidate


def _unique_bullet_category_field(rows: list[dict[str, Any]]) -> str:
    """Return an internal category key absent from every query-result row."""
    return _unique_bullet_derived_field(rows, "__mcp_bullet_category")


def _validate_bullet_format(format_: Any, values: list[float]) -> str:
    """Reject a presentation format the backend cannot reproduce."""
    format_ = _safe_enum_backing(format_)
    if format_ is None or format_ == "":
        format_ = "SMART_NUMBER"
    if type(format_) is not str or len(format_) > 50:
        raise BulletOutputError(
            "Bullet number format is unsupported by previews",
            error_type="UnsupportedFormat",
        )
    try:
        for value in values:
            _format_bullet_number(format_, value)
    except (TypeError, ValueError, OverflowError) as ex:
        raise BulletOutputError(
            f"Bullet number format {format_!r} is unsupported by previews",
            error_type="UnsupportedFormat",
        ) from ex
    return format_


def _format_bullet_number(format_: str, value: float) -> str:
    """Format finite Bullet values, including the full binary-float range."""
    from superset.utils.number_format import format_numeric

    try:
        return format_numeric(format_, value)
    except OverflowError:
        # SMART_NUMBER's significant-digit rounding can overflow a finite float
        # near DBL_MAX. Scientific repr remains deterministic and informative.
        if format_ in {"SMART_NUMBER", "SMART_NUMBER_SIGNED"} and math.isfinite(value):
            prefix = "+" if format_ == "SMART_NUMBER_SIGNED" and value > 0 else ""
            return prefix + repr(value)
        raise


def _containing_bullet_range_label(
    measure: float, ranges: list[float], labels: list[str]
) -> str | None:
    """Match the frontend's labelled containing-range tooltip selection."""
    ascending = sorted(
        (
            (value, labels[index] if index < len(labels) else "")
            for index, value in enumerate(ranges)
        ),
        key=lambda entry: entry[0],
    )
    for threshold, label in ascending:
        if measure <= threshold:
            return label or None
    if ascending and ascending[-1][1]:
        return f"> {ascending[-1][1]}"
    return None


def resolve_bullet_render_model(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> BulletRenderModel:
    """Resolve and validate every Bullet row and presentation control."""
    if type(data) is not list:
        raise BulletOutputError("Bullet query output must be an array of objects")
    for row_index in range(list.__len__(data)):
        row = list.__getitem__(data, row_index)
        if type(row) is not dict:
            raise BulletOutputError("Bullet query output must be an array of objects")
        if dict.__len__(row) > _MAX_BULLET_FIELDS:
            raise BulletOutputError("Bullet query row exceeds the field limit")
        for key in dict.keys(row):
            if type(key) is not str:
                raise BulletOutputError("Bullet query row keys must be strings")
            if len(key) > _MAX_BULLET_FIELD_BYTES:
                raise BulletOutputError("Bullet query row key exceeds the size limit")

    if type(form_data) is not dict:
        raise BulletOutputError("Bullet form data must be an object")

    metric_label = _form_metric_label(dict.get(form_data, "metric"))
    if not metric_label:
        raise BulletOutputError("Bullet metric has no declared result alias")
    raw_groupby = dict.get(form_data, "groupby")
    if raw_groupby is None:
        raw_groupby = []
    if type(raw_groupby) is not list:
        raise BulletOutputError("Bullet dimensions must be an array")
    dimension_labels = [
        _form_column_label(list.__getitem__(raw_groupby, index))
        for index in range(list.__len__(raw_groupby))
    ]
    if any(not label for label in dimension_labels):
        raise BulletOutputError("Bullet dimension has no declared result alias")

    if data:
        first_row = list.__getitem__(data, 0)
        metric_field = _require_result_field(metric_label, first_row, "metric")
        dimensions = [
            _require_result_field(label, first_row, "dimension")
            for label in dimension_labels
        ]
    else:
        # The frontend accepts empty results. Ungrouped charts retain one
        # zero-valued measure; grouped charts retain the declared roles but no
        # categories or rows are fabricated.
        metric_field = metric_label
        dimensions = [label for label in dimension_labels if label is not None]

    measures: list[float] = []
    copied_rows: list[dict[str, Any]] = []
    for index in range(list.__len__(data)):
        row = list.__getitem__(data, index)
        row_metric_field = _require_result_field(
            metric_label, row, f"metric row {index}"
        )
        measure = _bullet_number(
            dict.__getitem__(row, row_metric_field), index, metric_field
        )
        # Reserve every exact output key so the internal Vega category alias
        # cannot collide with an unselected result field. Unselected values are
        # deliberately replaced with None rather than converted or serialized.
        copied: dict[str, Any] = dict.fromkeys(dict.keys(row))
        copied[metric_field] = measure
        for label, dimension in zip(dimension_labels, dimensions, strict=True):
            row_dimension = _require_result_field(label, row, f"dimension row {index}")
            dimension_value, _ = _bullet_category_value(
                dict.__getitem__(row, row_dimension), dimension, index
            )
            copied[dimension] = dimension_value
        copied_rows.append(copied)
        measures.append(measure)

    # The frontend validates/coerces the whole result array but renders only
    # the first row for an ungrouped aggregate.
    if not dimensions:
        copied_rows = copied_rows[:1]
        measures = measures[:1]
        if not copied_rows:
            copied_rows = [{metric_field: 0.0}]
            measures = [0.0]

    ranges = _strict_bullet_numeric_tokens(dict.get(form_data, "ranges"), "ranges")
    if not ranges:
        # Match Bullet/transformProps.ts: the largest measure drives one
        # qualitative band whose upper threshold is 110% of that measure.
        ranges = [0.0, max(measures, default=0.0) * 1.1]
    markers = _strict_bullet_numeric_tokens(dict.get(form_data, "markers"), "markers")
    marker_lines = _strict_bullet_numeric_tokens(
        dict.get(form_data, "marker_lines"), "marker lines"
    )
    all_numbers = [*measures, *ranges, *markers, *marker_lines]
    if any(not math.isfinite(value) for value in all_numbers):
        raise BulletOutputError("Bullet presentation values must be finite")

    show_labels = dict.get(form_data, "show_labels", False)
    show_legend = dict.get(form_data, "show_legend", False)
    if type(show_labels) is not bool or type(show_legend) is not bool:
        raise BulletOutputError("Bullet label and legend controls must be booleans")

    range_labels = _bullet_string_tokens(dict.get(form_data, "range_labels"))
    marker_labels = _bullet_string_tokens(dict.get(form_data, "marker_labels"))
    marker_line_labels = _bullet_string_tokens(
        dict.get(form_data, "marker_line_labels")
    )
    return BulletRenderModel(
        rows=copied_rows,
        metric_field=metric_field,
        dimensions=dimensions,
        measures=measures,
        ranges=ranges,
        range_labels=range_labels,
        markers=markers,
        marker_labels=marker_labels,
        marker_lines=marker_lines,
        marker_line_labels=marker_line_labels,
        y_axis_format=_validate_bullet_format(
            dict.get(form_data, "y_axis_format", "SMART_NUMBER"), all_numbers
        ),
        show_labels=show_labels,
        show_legend=show_legend,
    )


def _generate_ascii_bullet_chart(
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> str:
    """Generate a horizontal Bullet preview from the shared strict model."""
    model = resolve_bullet_render_model(data, form_data)
    if model.dimensions and not model.rows:
        return "No data available for grouped Bullet chart"
    extent = (
        max(
            [abs(value) for value in [*model.measures, *model.ranges, *model.markers]],
            default=1,
        )
        or 1
    )
    lines = [f"ASCII Bullet Chart — {model.metric_field}", "=" * 60]
    for row_index, (row, value) in enumerate(
        zip(model.rows[:10], model.measures[:10], strict=True)
    ):
        category = ", ".join(
            _bullet_category_value(dict.get(row, field), field, row_index)[1]
            for field in model.dimensions
        )
        category = category or "Measure"
        width = round(abs(value) / extent * 32)
        bar = "█" * width
        formatted = _format_bullet_number(model.y_axis_format, value)
        lines.append(f"{category[:20]:>20} |{bar:<32} {formatted}")

    def labeled(values: list[float], labels: list[str], prefix: str) -> list[str]:
        return [
            f"{labels[index] if index < len(labels) and labels[index] else prefix}: "
            f"{_format_bullet_number(model.y_axis_format, value)}"
            for index, value in enumerate(values)
        ]

    if model.show_labels or model.show_legend or model.marker_lines:
        lines.append("Key:")
        if model.show_labels or model.show_legend:
            lines.extend(
                f"  range {item}"
                for item in labeled(model.ranges, model.range_labels, "Range")
            )
            lines.extend(
                f"  marker {item}"
                for item in labeled(model.markers, model.marker_labels, "Marker")
            )
        # ECharts markLine labels are visible independently of show_labels.
        lines.extend(
            f"  line {item}"
            for item in labeled(
                model.marker_lines, model.marker_line_labels, "Marker line"
            )
        )
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


def _bullet_numeric_tokens(value: Any) -> list[float]:
    """Parse native comma-separated Bullet threshold controls."""
    if isinstance(value, str):
        tokens: list[Any] = [token.strip() for token in value.split(",")]
    elif isinstance(value, list):
        tokens = value
    else:
        return []
    result: list[float] = []
    for token in tokens:
        try:
            number = float(token)
        except (TypeError, ValueError):
            continue
        if not _is_nan(number) and math.isfinite(number):
            result.append(number)
    return result


def _strict_bullet_numeric_tokens(value: Any, role: str) -> list[float]:  # noqa: C901
    """Parse all native presentation values or reject the malformed control."""
    value = _safe_enum_backing(value)
    if value is None or (type(value) is str and value == ""):
        return []
    if type(value) is str:
        if len(value) > _MAX_BULLET_TEXT_BYTES:
            raise BulletOutputError(f"Bullet {role} exceeds the size limit")
        tokens: list[Any] = [token.strip() for token in value.split(",")]
    elif type(value) is list:
        tokens = [
            list.__getitem__(value, index) for index in range(list.__len__(value))
        ]
    else:
        raise BulletOutputError(f"Bullet {role} must be a comma-separated list")
    if len(tokens) > _MAX_BULLET_TOKENS:
        raise BulletOutputError(f"Bullet {role} exceeds the item limit")

    numbers: list[float] = []
    for index, token in enumerate(tokens):
        token = _safe_enum_backing(token)
        if type(token) is str and token == "":
            continue
        if type(token) is bool or not (
            type(token) is str
            or type(token) is int
            or type(token) is float
            or type(token) is Decimal
        ):
            raise BulletOutputError(f"Bullet {role}[{index}] is not numeric")
        if type(token) is str and len(token) > _MAX_BULLET_TEXT_BYTES:
            raise BulletOutputError(f"Bullet {role}[{index}] is not numeric")
        try:
            number = float(token)
        except (TypeError, ValueError, OverflowError) as ex:
            raise BulletOutputError(f"Bullet {role}[{index}] is not numeric") from ex
        if not math.isfinite(number):
            raise BulletOutputError(f"Bullet {role}[{index}] is NaN or infinite")
        numbers.append(number)
    return numbers


def _generate_bullet_vega_lite_preview(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview:
    """Build a horizontal layered preview from the shared strict model."""
    model = resolve_bullet_render_model(data, form_data)

    category_field = _unique_bullet_category_field(model.rows)
    containing_range_labels = (
        [
            _containing_bullet_range_label(measure, model.ranges, model.range_labels)
            for measure in model.measures
        ]
        if model.range_labels
        else [None] * len(model.rows)
    )
    range_tooltip_field = (
        _unique_bullet_derived_field(
            model.rows, "__mcp_bullet_range", (category_field,)
        )
        if any(label is not None for label in containing_range_labels)
        else None
    )
    values = []
    for row_index, row in enumerate(model.rows):
        copied = dict.copy(row)
        copied[category_field] = (
            ", ".join(
                _bullet_category_value(dict.get(row, field), field, row_index)[1]
                for field in model.dimensions
            )
            if model.dimensions
            else ""
        )
        if (
            range_tooltip_field is not None
            and containing_range_labels[row_index] is not None
        ):
            copied[range_tooltip_field] = containing_range_labels[row_index]
        values.append(copied)

    y_encoding = {
        "field": category_field,
        "type": "nominal",
        "title": ", ".join(model.dimensions) if model.dimensions else None,
        "sort": None,
    }
    tooltip = [
        {
            "field": category_field,
            "type": "nominal",
            "title": ", ".join(model.dimensions) if model.dimensions else None,
        },
        {
            "field": model.metric_field,
            "type": "quantitative",
            "format": (
                "~s" if model.y_axis_format == "SMART_NUMBER" else model.y_axis_format
            ),
        },
    ]
    if range_tooltip_field is not None:
        tooltip.append(
            {"field": range_tooltip_field, "type": "nominal", "title": "Range"}
        )
    axis_min = min(
        0.0,
        *model.measures,
        *model.ranges,
        *model.markers,
        *model.marker_lines,
    )
    axis_max = max(
        *model.measures,
        *model.ranges,
        *model.markers,
        *model.marker_lines,
    )
    if axis_min == axis_max:
        axis_max = axis_min + (abs(axis_min) or 1)
    vega_format = "~s" if model.y_axis_format == "SMART_NUMBER" else model.y_axis_format

    def label_at(labels: list[str], index: int, value: float, prefix: str) -> str:
        if index < len(labels) and labels[index]:
            return labels[index]
        return (
            ""
            if prefix == "Range"
            else _format_bullet_number(model.y_axis_format, value)
        )

    def legend_color(name: str) -> dict[str, Any]:
        return {
            "datum": name,
            "type": "nominal",
            "legend": {"title": None} if model.show_legend else None,
        }

    layers: list[dict[str, Any]] = []
    range_entries = sorted(
        [
            (
                threshold,
                label_at(model.range_labels, index, threshold, "Range"),
            )
            for index, threshold in enumerate(model.ranges)
        ],
        key=lambda entry: entry[0],
        reverse=True,
    )
    for index, (threshold, label) in enumerate(range_entries):
        layers.append(
            {
                "mark": {
                    "type": "rect",
                    "opacity": max(0.08, 0.28 - index * 0.04),
                },
                "encoding": {
                    "x": {"datum": axis_min, "type": "quantitative"},
                    "x2": {"datum": threshold},
                    "y": y_encoding,
                    "color": legend_color(
                        (f"{label}: " if label else "")
                        + f"≤ {_format_bullet_number(model.y_axis_format, threshold)}"
                    ),
                    "tooltip": [
                        {"value": label, "title": "Range"},
                        {
                            "value": _format_bullet_number(
                                model.y_axis_format, threshold
                            ),
                            "title": "Threshold",
                        },
                    ],
                },
            }
        )
        if model.show_labels and label:
            layers.append(
                {
                    "mark": {"type": "text", "align": "right", "dx": -3},
                    "encoding": {
                        "x": {"datum": threshold, "type": "quantitative"},
                        "y": y_encoding,
                        "text": {"value": label},
                    },
                }
            )
    layers.append(
        {
            "mark": {"type": "bar", "tooltip": True, "size": 16},
            "encoding": {
                "x": {
                    "field": model.metric_field,
                    "type": "quantitative",
                    "title": model.metric_field,
                    "scale": {"domain": [axis_min, axis_max]},
                    "axis": {"format": vega_format},
                },
                "y": y_encoding,
                "tooltip": tooltip,
                "color": legend_color(model.metric_field),
            },
        }
    )
    for index, marker in enumerate(model.markers):
        label = label_at(model.marker_labels, index, marker, "Marker")
        layers.append(
            {
                "mark": {
                    "type": "point",
                    "shape": "triangle-up",
                    "filled": True,
                    "size": 80,
                },
                "encoding": {
                    "x": {"datum": marker, "type": "quantitative"},
                    "y": y_encoding,
                    "color": legend_color(
                        f"{label}: {_format_bullet_number(model.y_axis_format, marker)}"
                    ),
                    "tooltip": [
                        {"value": label, "title": "Marker"},
                        {
                            "value": _format_bullet_number(model.y_axis_format, marker),
                            "title": "Value",
                        },
                    ],
                },
            }
        )
        if model.show_labels:
            layers.append(
                {
                    "mark": {"type": "text", "dy": 14},
                    "encoding": {
                        "x": {"datum": marker, "type": "quantitative"},
                        "y": y_encoding,
                        "text": {"value": label},
                    },
                }
            )
    for index, marker_line in enumerate(model.marker_lines):
        label = label_at(model.marker_line_labels, index, marker_line, "Marker line")
        layers.append(
            {
                "mark": {"type": "rule", "strokeWidth": 2},
                "encoding": {
                    "x": {"datum": marker_line, "type": "quantitative"},
                    "color": legend_color(
                        f"{label}: "
                        f"{_format_bullet_number(model.y_axis_format, marker_line)}"
                    ),
                    "tooltip": [
                        {"value": label, "title": "Marker line"},
                        {
                            "value": _format_bullet_number(
                                model.y_axis_format, marker_line
                            ),
                            "title": "Value",
                        },
                    ],
                },
            }
        )
        # ECharts markLine renders its label regardless of show_labels. Keep
        # Vega faithful by always materializing one label per reference line.
        layers.append(
            {
                "transform": [{"aggregate": []}],
                "mark": {"type": "text", "align": "right", "dx": -3, "dy": -8},
                "encoding": {
                    "x": {"datum": marker_line, "type": "quantitative"},
                    "y": {"value": 8},
                    "text": {"value": label},
                },
            }
        )

    return VegaLitePreview(
        type="vega_lite",
        specification={
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            **(
                {"description": "No data available for grouped Bullet chart"}
                if model.dimensions and not model.rows
                else {}
            ),
            "data": {"values": values},
            "layer": layers,
            "resolve": {"scale": {"color": "independent"}},
            "usermeta": {
                "bullet": {
                    "metric": model.metric_field,
                    "dimensions": model.dimensions,
                    "ranges": model.ranges,
                    "range_labels": model.range_labels,
                    "markers": model.markers,
                    "marker_labels": model.marker_labels,
                    "marker_lines": model.marker_lines,
                    "marker_line_labels": model.marker_line_labels,
                    "y_axis_format": model.y_axis_format,
                    "show_labels": model.show_labels,
                    "show_legend": model.show_legend,
                }
            },
        },
        supports_streaming=False,
    )


def _generate_vega_lite_preview_from_data(  # noqa: C901
    data: List[Dict[str, Any]], form_data: Dict[str, Any]
) -> VegaLitePreview:
    """Generate Vega-Lite preview from raw data and form_data."""
    viz_type = form_data.get("viz_type", "table")
    if viz_type == "bullet":
        return _generate_bullet_vega_lite_preview(data, form_data)

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
        "bullet": "bar",
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
    if not metrics and form_data.get("metric"):
        metrics = [form_data["metric"]]
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
