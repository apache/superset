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

from collections.abc import Mapping
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from superset.mcp_service.chart.schemas import ChartError
from superset.utils.core import GenericDataType

FAILED_QUERY_STATUSES = frozenset(
    {"error", "failed", "stopped", "timed_out", "cancelled", "canceled"}
)

# ChartDataCommand results cross a trust boundary before MCP response shaping.
# Keep every container and traversal bounded so a malformed command result
# cannot trigger user-defined sequence/mapping hooks or unbounded work.
MAX_QUERY_RESULTS = 32
MAX_QUERY_RESULT_ROWS = 500_000
MAX_QUERY_RESULT_COLUMNS = 10_000
MAX_RESULT_VALUE_ITEMS = 10_000
MAX_RESULT_VALUE_DEPTH = 6
MAX_RESULT_STRING_LENGTH = 1_000_000


def _is_bounded_result_value(value: Any, *, depth: int = 0) -> bool:
    """Accept safe result scalars and exact, bounded builtin containers."""
    if depth > MAX_RESULT_VALUE_DEPTH:
        return False
    if type(value) in {type(None), bool, int, float, str, bytes}:  # noqa: E721
        return not isinstance(value, (str, bytes)) or len(value) <= (
            MAX_RESULT_STRING_LENGTH
        )
    if type(value) in {date, datetime, time, Decimal, UUID}:  # noqa: E721
        return True
    if isinstance(value, Enum):
        return _is_bounded_result_value(value.value, depth=depth + 1)
    if type(value) is list:
        return len(value) <= MAX_RESULT_VALUE_ITEMS and all(
            _is_bounded_result_value(item, depth=depth + 1) for item in value
        )
    if type(value) is dict:
        return len(value) <= MAX_RESULT_VALUE_ITEMS and all(
            type(key) is str
            and len(key) <= MAX_RESULT_STRING_LENGTH
            and _is_bounded_result_value(item, depth=depth + 1)
            for key, item in value.items()
        )
    return False


def _query_error_text(value: Any) -> str | None:
    """Convert a bounded query error payload into a useful message."""
    if value is None or value is False:
        return None
    if isinstance(value, Mapping):
        for key in ("error", "error_message", "message", "detail"):
            if text := _query_error_text(value.get(key)):
                return text
        return None
    if isinstance(value, (list, tuple)):
        parts = [text for item in value if (text := _query_error_text(item))]
        return "; ".join(parts[:3]) or None
    text = str(value)
    return text[:2000] if text else None


def _failure_for_query_payload(
    payload: Mapping[str, Any], label: str
) -> ChartError | None:
    """Extract one failure from a top-level or per-query payload."""
    for key in ("error", "errors", "error_message"):
        if message := _query_error_text(payload.get(key)):
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = payload.get("status")
    status = str(getattr(raw_status, "value", raw_status) or "")
    normalized_status = status.strip().casefold().replace("-", "_").replace(" ", "_")
    if normalized_status in FAILED_QUERY_STATUSES:
        message = (
            _query_error_text(payload.get("message"))
            or _query_error_text(payload.get("error_message"))
            or normalized_status
        )
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if payload.get("success") is False:
        message = _query_error_text(payload.get("message")) or "request failed"
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if (
        raw_status is None
        and "data" not in payload
        and "queries" not in payload
        and (message := _query_error_text(payload.get("message")))
    ):
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    return None


def query_result_failure(result: Any) -> ChartError | None:
    """Return a structured failure embedded anywhere in a query result."""
    if type(result) is not dict:
        return ChartError(
            error="Chart query returned a malformed result envelope.",
            error_type="InvalidQueryResult",
        )

    for key in ("error", "errors", "error_message", "message", "status"):
        if key in result and not _is_bounded_result_value(result[key]):
            return ChartError(
                error="Chart query returned hostile or oversized metadata.",
                error_type="InvalidQueryResult",
            )
    if failure := _failure_for_query_payload(result, "Chart query"):
        return failure
    queries = result.get("queries")
    if type(queries) is list:
        for index, query in enumerate(queries, start=1):
            if type(query) is not dict:
                return ChartError(
                    error=f"Chart query {index} returned a malformed result envelope.",
                    error_type="InvalidQueryResult",
                )
            if any(
                key in query and not _is_bounded_result_value(query[key])
                for key in ("error", "errors", "error_message", "message", "status")
            ):
                return ChartError(
                    error=f"Chart query {index} returned hostile metadata.",
                    error_type="InvalidQueryResult",
                )
            if failure := _failure_for_query_payload(query, f"Chart query {index}"):
                return failure
    return None


def _is_supported_coltype(value: Any) -> bool:
    """Accept only exact wire integers or the canonical generic-type enum."""
    if type(value) is GenericDataType:
        return True
    return type(value) is int and value in {member.value for member in GenericDataType}


def validate_query_result_envelope(  # noqa: C901
    result: Any, *, none_as_empty: bool = False
) -> ChartError | None:
    """Strictly validate a ChartDataCommand result before consuming it.

    Exact builtin containers prevent overridden ``get``/iteration/slicing
    hooks, while the size and value checks bound every later row and metadata
    operation performed by the multi-query get-data response builder.
    """
    if type(result) is not dict:
        return ChartError(
            error="Chart query returned a malformed result envelope.",
            error_type="InvalidQueryResult",
        )

    for key in ("error", "errors", "error_message", "message", "status"):
        if key in result and not _is_bounded_result_value(result[key]):
            return ChartError(
                error="Chart query returned hostile or oversized metadata.",
                error_type="InvalidQueryResult",
            )
    if "success" in result and type(result["success"]) is not bool:
        return ChartError(
            error="Chart query returned malformed success metadata.",
            error_type="InvalidQueryResult",
        )

    queries = result.get("queries")
    if type(queries) is not list or not queries:
        if failure := query_result_failure(result):
            return failure
        return ChartError(
            error="Chart query returned no query result envelope.",
            error_type="InvalidQueryResult",
        )
    if len(queries) > MAX_QUERY_RESULTS:
        return ChartError(
            error="Chart query returned too many query result envelopes.",
            error_type="InvalidQueryResult",
        )

    for index, query in enumerate(queries, start=1):
        if type(query) is not dict:
            return ChartError(
                error=f"Chart query {index} returned a malformed result envelope.",
                error_type="InvalidQueryResult",
            )
        for key in ("error", "errors", "error_message", "message", "status"):
            if key in query and not _is_bounded_result_value(query[key]):
                return ChartError(
                    error=f"Chart query {index} returned hostile metadata.",
                    error_type="InvalidQueryResult",
                )
        if "success" in query and type(query["success"]) is not bool:
            return ChartError(
                error=f"Chart query {index} returned malformed success metadata.",
                error_type="InvalidQueryResult",
            )

    if failure := query_result_failure(result):
        return failure

    for index, query in enumerate(queries, start=1):
        data = query.get("data")
        if data is None and none_as_empty:
            data = []
        if type(data) is not list:
            return ChartError(
                error=f"Chart query {index} result data is not an array of rows.",
                error_type="InvalidQueryResult",
            )
        if len(data) > MAX_QUERY_RESULT_ROWS:
            return ChartError(
                error=f"Chart query {index} returned too many rows.",
                error_type="InvalidQueryResult",
            )
        for row in data:
            if type(row) is not dict or len(row) > MAX_QUERY_RESULT_COLUMNS:
                return ChartError(
                    error=f"Chart query {index} returned a malformed data row.",
                    error_type="InvalidQueryResult",
                )
            if not all(
                type(column) is str
                and len(column) <= MAX_RESULT_STRING_LENGTH
                and _is_bounded_result_value(value)
                for column, value in row.items()
            ):
                return ChartError(
                    error=(
                        f"Chart query {index} returned hostile or oversized row data."
                    ),
                    error_type="InvalidQueryResult",
                )

        colnames_present = "colnames" in query
        colnames = query.get("colnames", [])
        if (
            type(colnames) is not list
            or len(colnames) > MAX_QUERY_RESULT_COLUMNS
            or not all(
                type(column) is str
                and bool(column)
                and len(column) <= MAX_RESULT_STRING_LENGTH
                for column in colnames
            )
            or len(set(colnames)) != len(colnames)
        ):
            return ChartError(
                error=f"Chart query {index} returned malformed column metadata.",
                error_type="InvalidQueryResult",
            )
        coltypes_present = "coltypes" in query
        coltypes = query.get("coltypes", [])
        if (
            type(coltypes) is not list
            or len(coltypes) > MAX_QUERY_RESULT_COLUMNS
            or not all(_is_supported_coltype(value) for value in coltypes)
        ):
            return ChartError(
                error=f"Chart query {index} returned malformed column type metadata.",
                error_type="InvalidQueryResult",
            )
        if colnames_present and coltypes_present and len(colnames) != len(coltypes):
            return ChartError(
                error=(f"Chart query {index} returned misaligned column metadata."),
                error_type="InvalidQueryResult",
            )
        for key in (
            "cache_key",
            "cache_dttm",
            "is_cached",
            "rowcount",
            "rejected_filters",
            "rejected_filter_columns",
        ):
            if key in query and not _is_bounded_result_value(query[key]):
                return ChartError(
                    error=f"Chart query {index} returned hostile result metadata.",
                    error_type="InvalidQueryResult",
                )
    return None


def first_query_data(
    result: Any, *, none_as_empty: bool = False
) -> tuple[list[Any] | None, ChartError | None]:
    """Validate the result envelope and return the first query's data array.

    ``none_as_empty`` preserves legacy empty-result behavior for generic saved
    previews. Role-sensitive previews such as Sunburst keep strict validation.
    """
    if failure := validate_query_result_envelope(result, none_as_empty=none_as_empty):
        return None, failure
    queries = result.get("queries")
    first_query = queries[0]
    data = first_query.get("data")
    if data is None and none_as_empty:
        return [], None
    return data, None
