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
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, TYPE_CHECKING

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


STATS_ROW_CAP: int = 5000
STATS_SAMPLE_VALUE_COUNT: int = 3
STATS_TOTAL_WORK_CAP: int = 100_000

_GENERIC_DATA_TYPE_NAMES: dict[int, str] = {
    GenericDataType.NUMERIC: "numeric",
    GenericDataType.STRING: "string",
    GenericDataType.TEMPORAL: "temporal",
    GenericDataType.BOOLEAN: "boolean",
}
_MAX_PROFILE_INTEGER_BITS = 4_096
_MAX_PROFILE_DECIMAL_DIGITS = 1_024
_MAX_PROFILE_DECIMAL_EXPONENT = 4_096
_MAX_PROFILE_STRING_LENGTH = 65_536


@dataclass
class _ColumnStatsBudget:
    """One nested-node budget shared by all result columns."""

    nodes: int = 0


def data_column_stats_row_limit(row_count: int, column_count: int) -> int:
    """Return a row sample whose aggregate top-level cell work is bounded."""
    if row_count <= 0 or column_count <= 0:
        return 0
    return min(row_count, STATS_ROW_CAP, STATS_TOTAL_WORK_CAP // column_count)


def _decimal_profile_identity(
    value: Decimal, budget: _ColumnStatsBudget
) -> tuple[Any, ...] | None:
    """Return the exact reduced rational identity for a finite Decimal.

    The same ``("number", numerator, denominator)`` token is used for trusted
    integers and floats, making numeric equality explicit across those exact
    builtin types. Decimal digit work and powers of ten are bounded; values
    outside the producer limits stop metadata sampling instead of invoking
    user hooks or allocating an unbounded integer.
    """
    if not Decimal.is_finite(value):
        return ("nonfinite_decimal", Decimal.__str__(value))

    parts = Decimal.as_tuple(value)
    digits = parts.digits
    exponent = parts.exponent
    digit_count = tuple.__len__(digits)
    if (
        type(exponent) is not int
        or digit_count > _MAX_PROFILE_DECIMAL_DIGITS
        or abs(exponent) > _MAX_PROFILE_DECIMAL_EXPONENT
    ):
        return None

    budget.nodes += digit_count
    if budget.nodes > STATS_TOTAL_WORK_CAP:
        return None

    coefficient = 0
    for digit in digits:
        coefficient = coefficient * 10 + digit
    if parts.sign:
        coefficient = -coefficient
    if coefficient == 0:
        return ("number", 0, 1)

    if exponent >= 0:
        numerator = coefficient * 10**exponent
        bit_count = int.bit_length(numerator)
        if bit_count > _MAX_PROFILE_INTEGER_BITS:
            return ("oversized_integer", numerator < 0, bit_count)
        return ("number", numerator, 1)

    denominator = 10 ** (-exponent)
    divisor = math.gcd(coefficient, denominator)
    numerator = coefficient // divisor
    denominator //= divisor
    if (
        int.bit_length(numerator) > _MAX_PROFILE_INTEGER_BITS
        or int.bit_length(denominator) > _MAX_PROFILE_INTEGER_BITS
    ):
        # Digit/exponent caps above already bound these exact integers. Keep
        # fractional extremes in the sample just like oversized integers.
        return ("oversized_fraction", numerator, denominator)
    return ("number", numerator, denominator)


def _profile_value_identity(  # noqa: C901
    value: Any, budget: _ColumnStatsBudget
) -> tuple[Any, ...] | None:
    """Build a hook-free identity under the shared iterative node budget."""
    tokens: list[Any] = []
    stack: list[tuple[str, Any]] = [("value", value)]
    active_containers: set[int] = set()
    while stack:
        action, item = stack.pop()
        budget.nodes += 1
        if budget.nodes > STATS_TOTAL_WORK_CAP:
            return None
        if action == "token":
            tokens.append(item)
            continue
        if action == "leave":
            active_containers.remove(id(item))
            continue
        if type(item) is list:
            identity = id(item)
            if identity in active_containers:
                tokens.append(("cyclic_list",))
                continue
            active_containers.add(identity)
            width = list.__len__(item)
            tokens.append(("list", width))
            stack.append(("leave", item))
            stack.append(("token", "list_end"))
            stack.extend(
                ("value", list.__getitem__(item, index))
                for index in range(width - 1, -1, -1)
            )
            continue
        if type(item) is dict:
            identity = id(item)
            if identity in active_containers:
                tokens.append(("cyclic_dict",))
                continue
            active_containers.add(identity)
            entries = list(dict.items(item))
            if all(type(key) is str for key, _child in entries):
                entries.sort(key=lambda entry: entry[0])
            tokens.append(("dict", list.__len__(entries)))
            stack.append(("leave", item))
            stack.append(("token", "dict_end"))
            for key, child in reversed(entries):
                key_token = (
                    ("key", key)
                    if type(key) is str
                    and str.__len__(key) <= _MAX_PROFILE_STRING_LENGTH
                    else ("opaque_key", id(type(key)), id(key))
                )
                stack.append(("value", child))
                stack.append(("token", key_token))
            continue

        value_type = type(item)
        if item is None:
            tokens.append(("null",))
        elif value_type is bool:
            tokens.append(("boolean", item))
        elif value_type is int:
            bit_count = int.bit_length(item)
            tokens.append(
                ("number", item, 1)
                if bit_count <= _MAX_PROFILE_INTEGER_BITS
                else ("oversized_integer", item < 0, bit_count)
            )
        elif value_type is float:
            if math.isfinite(item):
                numerator, denominator = float.as_integer_ratio(item)
                tokens.append(("number", numerator, denominator))
            else:
                tokens.append(("nonfinite_float", float.__repr__(item)))
        elif value_type is Decimal:
            decimal_identity = _decimal_profile_identity(item, budget)
            if decimal_identity is None:
                return None
            tokens.append(decimal_identity)
        elif value_type is str:
            tokens.append(
                ("string", item)
                if str.__len__(item) <= _MAX_PROFILE_STRING_LENGTH
                else ("oversized_string", str.__len__(item))
            )
        else:
            tokens.append(("opaque", id(value_type), id(item)))
    return tuple(tokens)


def format_data_columns(  # noqa: C901
    data: list[dict[str, Any]],
    raw_columns: list[str],
    coltypes: list[int | GenericDataType] | None = None,
) -> list[DataColumn]:
    """Build coltype-aware metadata under one shared iterative work budget."""
    # Local import breaks the chart.schemas ↔ response_utils circular dependency.
    from superset.mcp_service.chart.schemas import DataColumn  # noqa: PLC0415

    row_limit = data_column_stats_row_limit(len(data), len(raw_columns))
    budget = _ColumnStatsBudget()
    samples: dict[str, list[Any]] = {column: [] for column in raw_columns}
    null_counts = dict.fromkeys(raw_columns, 0)
    unique_values: dict[str, set[tuple[Any, ...]]] = {
        column: set() for column in raw_columns
    }
    sampled_rows = 0
    for row_offset in range(row_limit):
        row = list.__getitem__(data, row_offset)
        row_values: list[tuple[str, Any, tuple[Any, ...]]] = []
        for column in raw_columns:
            value = dict.get(row, column)
            identity = _profile_value_identity(value, budget)
            if identity is None:
                break
            row_values.append((column, value, identity))
        if list.__len__(row_values) != list.__len__(raw_columns):
            break
        for column, value, identity in row_values:
            if value is None:
                null_counts[column] += 1
                continue
            if list.__len__(samples[column]) < STATS_SAMPLE_VALUE_COUNT:
                samples[column].append(value)
            unique_values[column].add(identity)
        sampled_rows += 1

    columns_meta: list[DataColumn] = []
    authoritative_coltypes = coltypes or []
    for index, col_name in enumerate(raw_columns):
        sample_values = samples[col_name]
        if index < list.__len__(authoritative_coltypes):
            data_type = _GENERIC_DATA_TYPE_NAMES.get(
                list.__getitem__(authoritative_coltypes, index), "string"
            )
        else:
            data_type = "string"
            if sample_values and all(type(value) is bool for value in sample_values):
                data_type = "boolean"
            elif sample_values and all(
                type(value) in {int, float, Decimal} for value in sample_values
            ):
                data_type = "numeric"

        columns_meta.append(
            DataColumn(
                name=col_name,
                display_name=col_name.replace("_", " ").title(),
                data_type=data_type,
                sample_values=sample_values,
                null_count=null_counts[col_name],
                unique_count=len(unique_values[col_name]),
                statistics=(
                    {"sampled_rows": sampled_rows} if sampled_rows < len(data) else None
                ),
            )
        )
    return columns_meta


def format_data_quality(columns: list[DataColumn], row_count: int) -> dict[str, Any]:
    """Calculate completeness from the same exact or sampled rows as metadata."""
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
    result: dict[str, Any] = {"completeness": completeness}
    if sampled_rows < row_count:
        result.update(
            {
                "completeness_is_approximate": True,
                "sampled_rows": sampled_rows,
            }
        )
    return result
