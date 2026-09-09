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

from datetime import datetime
from typing import Any, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.mcp_service.chart.schemas import DataColumn

import humanize


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


def format_data_columns(
    data: list[dict[str, Any]], raw_columns: list[str]
) -> list[DataColumn]:
    """Build column metadata from query result data.

    Caps null_count/unique_count computation at STATS_ROW_CAP rows to avoid
    O(rows*cols) overhead on large result sets. When the result exceeds the
    cap, those counts are marked as sampled/approximate via ``statistics``
    instead of being reported as exact full-dataset totals.
    """
    # Local import breaks the chart.schemas ↔ response_utils circular dependency.
    from superset.mcp_service.chart.schemas import DataColumn  # noqa: PLC0415

    stats_rows: list[dict[str, Any]] = data[:STATS_ROW_CAP]
    is_sampled: bool = len(data) > STATS_ROW_CAP
    columns_meta: list[DataColumn] = []
    for col_name in raw_columns:
        sample_values = [
            row.get(col_name) for row in data[:3] if row.get(col_name) is not None
        ]
        data_type: str = "string"
        if sample_values:
            if all(isinstance(v, bool) for v in sample_values):
                data_type = "boolean"
            elif all(isinstance(v, (int, float)) for v in sample_values):
                data_type = "numeric"

        null_count = 0
        unique_vals: set[str] = set()
        for row in stats_rows:
            val = row.get(col_name)
            if val is None:
                null_count += 1
            else:
                unique_vals.add(str(val))

        columns_meta.append(
            DataColumn(
                name=col_name,
                display_name=col_name.replace("_", " ").title(),
                data_type=data_type,
                sample_values=sample_values[:3],
                null_count=null_count,
                unique_count=len(unique_vals),
                statistics={"sampled_rows": len(stats_rows)} if is_sampled else None,
            )
        )
    return columns_meta
