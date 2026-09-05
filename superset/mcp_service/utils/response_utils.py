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
Utilities for building MCP tool responses with explicit omission metadata.

When MCP tool responses strip large fields to reduce context window usage,
the LLM agent should be told *what* was omitted and *why* — otherwise it
cannot distinguish "field is empty" from "field was stripped for size".

This module provides a reusable builder for omission metadata that any
MCP tool serializer can use.

Industry context (as of 2026):
- The MCP spec has no standard for field omission signaling.
- Silent omission is considered an anti-pattern (Grafana MCP #557).
- Production servers (mcp-git-polite, Blockscout, Axiom) converge on
  explicit omission indicators with size hints and retrieval guidance.
- Anthropic's "Writing Tools for Agents" blog recommends surfacing
  what was stripped so agents can decide whether to fetch full data.

Usage example::

    from superset.mcp_service.utils.response_utils import OmittedFieldsBuilder

    omitted = (
        OmittedFieldsBuilder()
        .add_raw_field(
            "position_json",
            raw_value=dashboard.position_json,
            reason="Internal layout tree — not useful for analysis.",
        )
        .add_extracted_field(
            "json_metadata",
            raw_value=dashboard.json_metadata,
            reason="native_filters and cross_filters_enabled extracted above.",
        )
        .build()
    )
    # Returns: {"position_json": "Omitted (~42 KB) — ...", ...}
"""

from __future__ import annotations

import math
import struct
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, TYPE_CHECKING
from uuid import UUID
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from superset.mcp_service.chart.schemas import DataColumn

import humanize

from superset.utils.core import GenericDataType


def humanize_timestamp(dt: datetime | None) -> str | None:
    """Convert a datetime to a humanized string like '2 hours ago'."""
    if dt is None:
        return None
    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    return humanize.naturaltime(now - dt)


def _byte_size_label(value: str | None) -> str:
    """Return a human-readable size label for a string value."""
    if not value or not isinstance(value, str):
        return "empty"
    size_bytes = len(value.encode("utf-8", errors="replace"))
    if size_bytes < 1024:
        return f"{size_bytes} B"
    return f"{size_bytes / 1024:.0f} KB"


class OmittedFieldsBuilder:
    """Builder for constructing omission metadata dicts.

    Produces a ``Dict[str, str]`` mapping field names to human-readable
    descriptions of what was omitted, including approximate sizes.

    Two field types are supported:

    - **Raw fields** (``add_raw_field``): The field was stripped entirely
      with no replacement. The agent has no way to access this data
      unless a companion tool exists.

    - **Extracted fields** (``add_extracted_field``): The raw blob was
      stripped, but useful subsets were extracted into structured fields
      on the same response object (e.g. ``native_filters`` extracted
      from ``json_metadata``).

    All methods return ``self`` for fluent chaining.
    """

    def __init__(self) -> None:
        self._fields: Dict[str, str] = {}

    def add_raw_field(
        self,
        field_name: str,
        raw_value: str | None,
        reason: str,
    ) -> "OmittedFieldsBuilder":
        """Record a field that was stripped with no replacement.

        Parameters
        ----------
        field_name:
            The original field name (e.g. ``"position_json"``).
        raw_value:
            The raw value that was omitted (used only to compute size).
            Pass ``None`` if the field was empty/unset.
        reason:
            Why the field was omitted, written for an LLM audience.
        """
        size = _byte_size_label(raw_value)
        has_data = isinstance(raw_value, str) and len(raw_value) > 0
        if has_data:
            self._fields[field_name] = f"Omitted (~{size}) — {reason}"
        else:
            self._fields[field_name] = f"Omitted ({size}) — {reason}"
        return self

    def add_extracted_field(
        self,
        field_name: str,
        raw_value: str | None,
        reason: str,
    ) -> "OmittedFieldsBuilder":
        """Record a field whose useful parts were extracted into other fields.

        Parameters
        ----------
        field_name:
            The original raw field name (e.g. ``"json_metadata"``).
        raw_value:
            The raw value that was omitted (used only to compute size).
        reason:
            Explanation of what was extracted and where, for LLM context.
        """
        size = _byte_size_label(raw_value)
        has_data = isinstance(raw_value, str) and len(raw_value) > 0
        if has_data:
            self._fields[field_name] = (
                f"Omitted (~{size}), useful parts extracted — {reason}"
            )
        else:
            self._fields[field_name] = (
                f"Omitted ({size}), useful parts extracted — {reason}"
            )
        return self

    def build(self) -> Dict[str, str]:
        """Return the omission metadata dict."""
        return dict(self._fields)


# Column metadata may otherwise perform rows*columns work after result
# validation. Keep both a per-column sample ceiling and a shared inspection
# budget; the latter reduces the sample for wide result sets. Representative
# values are gathered during that same pass rather than requiring another scan.
STATS_ROW_CAP: int = 5000
STATS_SAMPLE_VALUE_ROWS: int = 3
STATS_TOTAL_WORK_CAP: int = 1_000_000


def data_column_stats_row_limit(row_count: int, column_count: int) -> int:
    """Return a row sample whose aggregate column-inspection work is bounded."""
    if row_count <= 0 or column_count <= 0:
        return 0
    per_column_budget = STATS_TOTAL_WORK_CAP // column_count
    return min(row_count, STATS_ROW_CAP, per_column_budget)


GENERIC_DATA_TYPE_NAMES: dict[int, str] = {
    GenericDataType.NUMERIC: "numeric",
    GenericDataType.STRING: "string",
    GenericDataType.TEMPORAL: "temporal",
    GenericDataType.BOOLEAN: "boolean",
}

_MAX_NUMERIC_IDENTITY_BITS = 4096
_MAX_DECIMAL_IDENTITY_DIGITS = 1024
_MAX_DECIMAL_IDENTITY_STORAGE = 1024
_TRUSTED_TZINFO_TYPES = (timezone, ZoneInfo)


def _bounded_integer_identity(value: int) -> tuple[Any, ...]:
    """Return a value identity without hashing attacker-sized magnitudes."""
    if (bit_count := int.bit_length(value)) > _MAX_NUMERIC_IDENTITY_BITS:
        return ("oversized_numeric", "integer", value < 0, bit_count)
    return ("finite_numeric", value, 1)


def _decimal_identity(value: Decimal) -> tuple[Any, ...]:  # noqa: C901
    """Return bounded value-semantic identity for an exact ``Decimal``.

    Finite values share rational identities with exact ints and floats, so
    scale variants and signed zero collapse just as Python numeric equality
    does. Decimal tuple materialization and rational conversion are guarded by
    storage, digit, exponent, and bit limits. Values outside those limits are
    safely classified rather than fully converted.
    """
    is_signed = Decimal.is_signed(value)
    if Decimal.is_infinite(value):
        return ("numeric_infinity", is_signed)

    is_snan = Decimal.is_snan(value)
    if is_snan or Decimal.is_qnan(value):
        nan_kind = "signaling" if is_snan else "quiet"
        storage = Decimal.__sizeof__(value)
        if storage > _MAX_DECIMAL_IDENTITY_STORAGE:
            return ("decimal_nan", nan_kind, is_signed, "oversized", storage)
        parts = Decimal.as_tuple(value)
        if len(parts.digits) > _MAX_DECIMAL_IDENTITY_DIGITS:
            return (
                "decimal_nan",
                nan_kind,
                is_signed,
                "oversized",
                len(parts.digits),
            )
        return ("decimal_nan", nan_kind, is_signed, parts.digits)

    if Decimal.is_zero(value):
        return ("finite_numeric", 0, 1)

    storage = Decimal.__sizeof__(value)
    if storage > _MAX_DECIMAL_IDENTITY_STORAGE:
        # ``adjusted`` returns the already-stored magnitude exponent without
        # allocating a digit tuple or coefficient.
        return (
            "oversized_numeric",
            "decimal",
            is_signed,
            Decimal.adjusted(value),
            storage,
        )

    parts = Decimal.as_tuple(value)
    digit_count = len(parts.digits)
    exponent = parts.exponent
    if type(exponent) is not int:  # specials were handled above
        return ("decimal_special", exponent, is_signed)
    if digit_count > _MAX_DECIMAL_IDENTITY_DIGITS:
        return (
            "oversized_numeric",
            "decimal",
            is_signed,
            exponent + digit_count - 1,
            digit_count,
        )

    projected_bits = (digit_count + abs(exponent)) * 4
    if projected_bits > _MAX_NUMERIC_IDENTITY_BITS:
        # Preserve a bounded, scale-normalized Decimal classification without
        # constructing 10**abs(exponent). This intentionally declines exact
        # cross-type comparison for values too large for bounded rational work.
        digits = parts.digits
        trailing_zeros = 0
        while trailing_zeros < digit_count and digits[-trailing_zeros - 1] == 0:
            trailing_zeros += 1
        significant = digits[: digit_count - trailing_zeros]
        coefficient = 0
        for digit in significant:
            coefficient = coefficient * 10 + digit
        if is_signed:
            coefficient = -coefficient
        return (
            "oversized_numeric",
            "decimal",
            coefficient,
            exponent + trailing_zeros,
        )

    numerator, denominator = Decimal.as_integer_ratio(value)
    if (
        int.bit_length(numerator) > _MAX_NUMERIC_IDENTITY_BITS
        or int.bit_length(denominator) > _MAX_NUMERIC_IDENTITY_BITS
    ):
        return (
            "oversized_numeric",
            "decimal_ratio",
            is_signed,
            int.bit_length(numerator),
            int.bit_length(denominator),
        )
    return ("finite_numeric", numerator, denominator)


def _has_trusted_timezone(value: datetime | datetime_time) -> bool:
    """Check timezone trust by exact type without invoking timezone hooks."""
    tzinfo = value.tzinfo
    return tzinfo is not None and any(
        type(tzinfo) is type_ for type_ in _TRUSTED_TZINFO_TYPES
    )


def _safe_value_identity(value: Any) -> tuple[Any, ...]:  # noqa: C901
    """Build a bounded hashable identity from a validated exact result value."""
    if type(value) is list:
        return (
            list,
            tuple(
                _safe_value_identity(list.__getitem__(value, index))
                for index in range(list.__len__(value))
            ),
        )
    if type(value) is dict:
        return (
            dict,
            tuple(
                (key, _safe_value_identity(child))
                for key, child in sorted(dict.items(value))
            ),
        )
    value_type = type(value)
    if value is None or value_type is str:
        return (value_type, value)
    if value_type is bool:
        # Python deliberately compares bools equal to the integers 0 and 1,
        # but result metadata describes source values rather than dictionary
        # key semantics. Preserve the distinct JSON scalar identities.
        return (bool, value)
    if value_type is int:
        return _bounded_integer_identity(value)
    if value_type is float:
        if math.isnan(value):
            # IEEE bytes retain NaN sign/payload while avoiding its
            # non-reflexive equality and identity-based hashing behavior.
            return ("float_nan", struct.pack(">d", value))
        if math.isinf(value):
            return ("numeric_infinity", value < 0)
        numerator, denominator = float.as_integer_ratio(value)
        return ("finite_numeric", numerator, denominator)
    if value_type is Decimal:
        return _decimal_identity(value)
    if value_type is datetime:
        if value.tzinfo is None or _has_trusted_timezone(value):
            # Exact datetime plus exact builtin/ZoneInfo timezone objects can
            # safely delegate to CPython's equality/hash implementation. This
            # retains its subtle same-zone fold and inter-zone ambiguity rules
            # instead of reducing every aware value to a UTC instant.
            return ("trusted_datetime", value)
        # A custom tzinfo may execute arbitrary code. Keep its values distinct
        # without calling it; repeated values using the same timezone object
        # still receive a stable identity within the metadata computation.
        return (
            "opaque_datetime",
            date.toordinal(value),
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
            value.fold,
            id(value.tzinfo),
        )
    if value_type is date:
        return (date, date.toordinal(value))
    if value_type is datetime_time:
        if value.tzinfo is None or _has_trusted_timezone(value):
            return ("trusted_time", value)
        return (
            "opaque_time",
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
            value.fold,
            id(value.tzinfo),
        )
    if value_type is timedelta:
        return (timedelta, value.days, value.seconds, value.microseconds)
    if value_type is UUID:
        return (UUID, value.int)
    # query_result_data rejects this branch before callers inspect rows.
    return (object,)


def format_data_columns(
    data: list[dict[str, Any]],
    raw_columns: list[str],
    coltypes: list[int | GenericDataType] | None = None,
) -> list[DataColumn]:
    """Build bounded, coltype-aware metadata with value-semantic statistics."""
    # Local import breaks the chart.schemas ↔ response_utils circular dependency.
    from superset.mcp_service.chart.schemas import DataColumn  # noqa: PLC0415

    stats_row_limit = data_column_stats_row_limit(len(data), len(raw_columns))
    stats_rows = data[:stats_row_limit]
    is_sampled = len(data) > stats_row_limit
    authoritative_coltypes = coltypes or []
    columns: list[DataColumn] = []
    for index, col_name in enumerate(raw_columns):
        sample_values: list[Any] = []
        null_count = 0
        unique_values: set[tuple[Any, ...]] = set()
        for row in stats_rows:
            value = dict.get(row, col_name)
            if value is None:
                null_count += 1
                continue
            if len(sample_values) < STATS_SAMPLE_VALUE_ROWS:
                sample_values.append(value)
            unique_values.add(_safe_value_identity(value))

        data_type = "string"
        if authoritative_coltypes:
            data_type = GENERIC_DATA_TYPE_NAMES.get(
                authoritative_coltypes[index], "string"
            )
        elif sample_values:
            if all(type(value) is bool for value in sample_values):
                data_type = "boolean"
            elif all(type(value) in (int, float, Decimal) for value in sample_values):
                data_type = "numeric"

        columns.append(
            DataColumn(
                name=col_name,
                display_name=col_name.replace("_", " ").title(),
                data_type=data_type,
                sample_values=sample_values,
                null_count=null_count,
                unique_count=len(unique_values),
                statistics={"sampled_rows": len(stats_rows)} if is_sampled else None,
                semantic_type=None,
            )
        )
    return columns


def format_data_quality(columns: list[DataColumn], row_count: int) -> dict[str, Any]:
    """Build completeness from the same exact or sampled rows as null counts."""
    sampled_rows = row_count
    for column in columns:
        statistics = column.statistics
        if statistics is not None:
            candidate = statistics.get("sampled_rows")
            if type(candidate) is int:
                sampled_rows = min(sampled_rows, candidate)

    denominator = sampled_rows * len(columns)
    completeness = (
        1.0
        if denominator == 0
        else 1.0 - sum(column.null_count for column in columns) / denominator
    )
    quality: dict[str, Any] = {"completeness": completeness}
    if sampled_rows < row_count:
        quality.update(
            {
                "completeness_is_approximate": True,
                "sampled_rows": sampled_rows,
            }
        )
    return quality
