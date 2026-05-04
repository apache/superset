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

from typing import Dict


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
