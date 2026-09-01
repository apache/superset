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

"""Helpers for interpreting ChartDataCommand result envelopes."""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Any

from superset.mcp_service.chart.schemas import ChartError

FAILED_QUERY_STATUSES = frozenset(
    {"error", "failed", "stopped", "timed_out", "cancelled", "canceled"}
)

_ERROR_KEYS = ("error", "error_message", "message", "detail")
_MAX_ERROR_DEPTH = 32
_MAX_ERROR_ITEMS = 256
_MAX_SEQUENCE_ITEMS = 64
_MAX_ERROR_PARTS = 3
_MAX_ERROR_BYTES = 2000
_MAX_INTEGER_DIGITS = 1000


@dataclass(frozen=True)
class _ErrorText:
    """Bounded error extraction outcome."""

    text: str | None = None
    malformed: str | None = None


def _truncate_utf8(value: str, max_bytes: int) -> str:
    """Truncate text without encoding an attacker-sized string in full."""
    if max_bytes <= 0:
        return ""
    candidate = value[:max_bytes]
    encoded = candidate.encode("utf-8", errors="replace")
    if len(encoded) <= max_bytes and len(candidate) == len(value):
        return candidate
    suffix = "... [truncated]"
    suffix_bytes = suffix.encode()
    content_limit = max(0, max_bytes - len(suffix_bytes))
    content = encoded[:content_limit].decode("utf-8", errors="ignore")
    return content + suffix


def _safe_scalar_text(value: Any, max_bytes: int) -> str | None:
    """Stringify one scalar without triggering Python's integer digit limit."""
    if value is None or value is False:
        return None
    if isinstance(value, Enum):
        value = value.value
    if isinstance(value, int) and not isinstance(value, bool):
        digits = (
            1 if value == 0 else int((abs(value).bit_length() - 1) * math.log10(2)) + 1
        )
        if digits > _MAX_INTEGER_DIGITS:
            sign = "negative " if value < 0 else ""
            return f"<{sign}integer with approximately {digits} decimal digits>"
    try:
        text = str(value)
    except Exception:  # pragma: no cover - defensive custom scalar
        return f"<{type(value).__name__} could not be stringified>"
    return _truncate_utf8(text, max_bytes) if text else None


def _query_error_text(value: Any) -> _ErrorText:  # noqa: C901
    """Iteratively extract actionable text from an untrusted error payload.

    Chart backends and engine adapters can return arbitrary nested error shapes.
    Depth, visited-item, sequence-width, and output-byte limits keep validation
    deterministic even for cycles, repeated containers, and adversarial values.
    """
    stack: list[tuple[Any, int]] = [(value, 0)]
    seen: set[int] = set()
    parts: list[str] = []
    visited = 0
    used_bytes = 0

    while stack and len(parts) < _MAX_ERROR_PARTS:
        item, depth = stack.pop()
        visited += 1
        if visited > _MAX_ERROR_ITEMS:
            return _ErrorText(malformed="error payload exceeds the item limit")
        if depth > _MAX_ERROR_DEPTH:
            return _ErrorText(malformed="error payload exceeds the depth limit")

        is_mapping = isinstance(item, Mapping)
        is_sequence = isinstance(item, Sequence) and not isinstance(
            item, (str, bytes, bytearray)
        )
        if is_mapping or is_sequence:
            identity = id(item)
            if identity in seen:
                return _ErrorText(
                    malformed="error payload contains repeated or cyclic containers"
                )
            seen.add(identity)

        if is_mapping:
            children: list[Any] = []
            try:
                for key in _ERROR_KEYS:
                    if key in item:
                        children.append(item[key])
            except Exception:
                return _ErrorText(malformed="error payload mapping is unreadable")
            if not children:
                try:
                    has_items = bool(item)
                except Exception:
                    return _ErrorText(malformed="error payload mapping is unreadable")
                if has_items:
                    return _ErrorText(
                        malformed=(
                            "error payload object has no recognized message field"
                        )
                    )
            stack.extend((child, depth + 1) for child in reversed(children))
            continue

        if is_sequence:
            children = []
            try:
                iterator = iter(item)
                for _index in range(_MAX_SEQUENCE_ITEMS + 1):
                    try:
                        children.append(next(iterator))
                    except StopIteration:
                        break
            except Exception:
                return _ErrorText(malformed="error payload sequence is unreadable")
            if len(children) > _MAX_SEQUENCE_ITEMS:
                return _ErrorText(malformed="error payload exceeds the width limit")
            stack.extend((child, depth + 1) for child in reversed(children))
            continue

        remaining = _MAX_ERROR_BYTES - used_bytes - (2 if parts else 0)
        text = _safe_scalar_text(item, remaining)
        if text:
            parts.append(text)
            used_bytes += len(text.encode("utf-8")) + (2 if len(parts) > 1 else 0)

    return _ErrorText(text="; ".join(parts) or None)


def _failure_for_query_payload(  # noqa: C901
    payload: Mapping[str, Any], label: str
) -> ChartError | None:
    """Extract one failure from a top-level or per-query payload."""
    for key in ("error", "errors", "error_message"):
        extracted = _query_error_text(payload.get(key))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        if message := extracted.text:
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = payload.get("status")
    status = _safe_scalar_text(getattr(raw_status, "value", raw_status), 200) or ""
    normalized_status = status.strip().casefold().replace("-", "_").replace(" ", "_")
    if normalized_status in FAILED_QUERY_STATUSES:
        extracted = _query_error_text(payload.get("message"))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        fallback = _query_error_text(payload.get("error_message"))
        if fallback.malformed:
            return _malformed_result(fallback.malformed)
        message = extracted.text or fallback.text or normalized_status
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if payload.get("success") is False:
        extracted = _query_error_text(payload.get("message"))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        message = extracted.text or "request failed"
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if raw_status is None and "data" not in payload and "queries" not in payload:
        extracted = _query_error_text(payload.get("message"))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        if extracted.text:
            return ChartError(
                error=f"{label} failed: {extracted.text}", error_type="QueryError"
            )
    return None


def _malformed_result(message: str) -> ChartError:
    """Build a stable error for an invalid ChartDataCommand envelope."""
    return ChartError(
        error=f"Malformed chart query result: {message}",
        error_type="MalformedQueryResult",
    )


def query_result_data(  # noqa: C901
    result: Any,
) -> tuple[list[list[Any]] | None, ChartError | None]:
    """Validate a chart-data envelope and return each query's data array.

    Every query is checked before callers use the first one so malformed nested
    entries cannot be hidden behind an otherwise valid leading query.
    """
    if not isinstance(result, Mapping):
        return None, _malformed_result("top-level result must be an object")

    if failure := _failure_for_query_payload(result, "Chart query"):
        return None, failure

    if "queries" not in result:
        return None, _malformed_result("missing queries array")
    queries = result["queries"]
    if not isinstance(queries, list):
        return None, _malformed_result("queries must be an array")
    if not queries:
        return None, _malformed_result("queries must contain at least one query")

    data_arrays: list[list[Any]] = []
    for index, query in enumerate(queries, start=1):
        if not isinstance(query, Mapping):
            return None, _malformed_result(f"query {index} must be an object")
        if failure := _failure_for_query_payload(query, f"Chart query {index}"):
            return None, failure
        if "data" not in query:
            return None, _malformed_result(f"query {index} is missing data")
        data = query["data"]
        if not isinstance(data, list):
            return None, _malformed_result(f"query {index} data must be an array")
        data_arrays.append(data)
    return data_arrays, None


def query_result_failure(result: Any) -> ChartError | None:
    """Return an embedded failure or malformed-envelope error."""
    _data, failure = query_result_data(result)
    return failure
