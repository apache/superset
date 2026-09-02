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

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from superset.common.db_query_status import QueryStatus
from superset.mcp_service.chart.schemas import ChartError
from superset.utils.core import (
    ExtraFiltersReasonType,
    ExtraFiltersTimeColumnType,
    GenericDataType,
)

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
MAX_QUERY_RESULT_ROWCOUNT = 2**63 - 1

_SAFE_RESULT_ENUM_TYPES = frozenset(
    {
        QueryStatus,
        ExtraFiltersReasonType,
        ExtraFiltersTimeColumnType,
        GenericDataType,
    }
)


def _safe_enum_value(value: Any) -> Any | None:
    """Read only explicitly trusted enum storage without dispatching hooks."""
    if type(value) not in _SAFE_RESULT_ENUM_TYPES:
        return None
    return object.__getattribute__(value, "_value_")


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
    if type(value) in _SAFE_RESULT_ENUM_TYPES:
        return _is_bounded_result_value(_safe_enum_value(value), depth=depth + 1)
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
    if type(value) is dict:
        for key in ("error", "error_message", "message", "detail"):
            if text := _query_error_text(value.get(key)):
                return text
        return None
    if type(value) is list:
        parts = [text for item in value if (text := _query_error_text(item))]
        return "; ".join(parts[:3]) or None
    if type(value) is str:
        return value[:2000] or None
    if type(value) is bytes:
        return repr(value[:2000]) or None
    if type(value) in {bool, int, float, date, datetime, time, Decimal, UUID}:
        text = str(value)
        return text[:2000] if text else None
    if type(value) in _SAFE_RESULT_ENUM_TYPES:
        return _query_error_text(_safe_enum_value(value))
    return None


def _status_text(value: Any) -> str | None:
    """Return a status wire value without invoking user-defined conversion."""
    if value is None:
        return ""
    if type(value) is str:
        return value
    if type(value) is QueryStatus:
        enum_value = _safe_enum_value(value)
        return enum_value if type(enum_value) is str else None
    return None


def _invalid_metadata(label: str) -> ChartError:
    return ChartError(
        error=f"{label} returned hostile or malformed metadata.",
        error_type="InvalidQueryResult",
    )


def _payload_metadata_is_bounded(payload: dict[str, Any], *, skip: str) -> bool:
    """Validate an exact result mapping before any field-specific access."""
    if len(payload) > MAX_RESULT_VALUE_ITEMS:
        return False
    return all(
        type(key) is str
        and len(key) <= MAX_RESULT_STRING_LENGTH
        and (key == skip or _is_bounded_result_value(value))
        for key, value in payload.items()
    )


def _payload_metadata_error(
    payload: dict[str, Any], *, label: str, skip: str
) -> ChartError | None:
    """Return a structured error for metadata that cannot be read safely."""
    if not _payload_metadata_is_bounded(payload, skip=skip):
        return _invalid_metadata(label)
    if "status" in payload and _status_text(payload["status"]) is None:
        return _invalid_metadata(label)
    if "success" in payload and type(payload["success"]) is not bool:
        return _invalid_metadata(label)
    return None


def _failure_for_query_payload(
    payload: dict[str, Any], label: str
) -> ChartError | None:
    """Extract one failure from a top-level or per-query payload."""
    for key in ("error", "errors", "error_message"):
        if message := _query_error_text(payload.get(key)):
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = payload.get("status")
    status = _status_text(raw_status)
    if status is None:
        return _invalid_metadata(label)
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

    if error := _payload_metadata_error(result, label="Chart query", skip="queries"):
        return error

    if failure := _failure_for_query_payload(result, "Chart query"):
        return failure
    queries = result.get("queries")
    if "queries" in result and (
        type(queries) is not list or len(queries) > MAX_QUERY_RESULTS
    ):
        return _invalid_metadata("Chart query")
    if type(queries) is list:
        for index, query in enumerate(queries, start=1):
            if type(query) is not dict:
                return ChartError(
                    error=f"Chart query {index} returned a malformed result envelope.",
                    error_type="InvalidQueryResult",
                )
            if error := _payload_metadata_error(
                query, label=f"Chart query {index}", skip="data"
            ):
                return error
            if failure := _failure_for_query_payload(query, f"Chart query {index}"):
                return failure
    return None


def _is_supported_coltype(value: Any) -> bool:
    """Accept only exact wire integers or the canonical generic-type enum."""
    if type(value) is GenericDataType:
        return True
    return type(value) is int and value in {
        _safe_enum_value(member) for member in GenericDataType
    }


def _is_bounded_wire_string(value: Any, *enum_types: type[Any]) -> bool:
    """Validate a string or one exact trusted string enum."""
    if type(value) is str:
        return bool(value) and len(value) <= MAX_RESULT_STRING_LENGTH
    if type(value) in enum_types:
        enum_value = _safe_enum_value(value)
        return (
            type(enum_value) is str
            and bool(enum_value)
            and len(enum_value) <= MAX_RESULT_STRING_LENGTH
        )
    return False


def _is_valid_filter_metadata(value: Any, *, rejected: bool) -> bool:
    """Validate the filter metadata shapes read by get-chart-data consumers."""
    if type(value) is not list or len(value) > MAX_RESULT_VALUE_ITEMS:
        return False
    expected_keys = {"column", "reason"} if rejected else {"column"}
    for entry in value:
        if type(entry) is not dict or set(entry) != expected_keys:
            return False
        if not _is_bounded_wire_string(entry["column"], ExtraFiltersTimeColumnType):
            return False
        if rejected and not _is_bounded_wire_string(
            entry["reason"], ExtraFiltersReasonType
        ):
            return False
    return True


def _is_valid_string_list(value: Any) -> bool:
    return (
        type(value) is list
        and len(value) <= MAX_RESULT_VALUE_ITEMS
        and all(_is_bounded_wire_string(item) for item in value)
    )


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

    if not _payload_metadata_is_bounded(result, skip="queries"):
        return _invalid_metadata("Chart query")
    if "status" in result and _status_text(result["status"]) is None:
        return _invalid_metadata("Chart query")
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
        if not _payload_metadata_is_bounded(query, skip="data"):
            return _invalid_metadata(f"Chart query {index}")
        if "status" in query and _status_text(query["status"]) is None:
            return _invalid_metadata(f"Chart query {index}")
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
        if (colnames_present or coltypes_present) and (
            not colnames_present
            or not coltypes_present
            or len(colnames) != len(coltypes)
        ):
            return ChartError(
                error=(f"Chart query {index} returned misaligned column metadata."),
                error_type="InvalidQueryResult",
            )
        if colnames_present:
            column_contract = set(colnames)
            if any(set(row) != column_contract for row in data):
                return ChartError(
                    error=(
                        f"Chart query {index} returned rows that do not match "
                        "declared columns."
                    ),
                    error_type="InvalidQueryResult",
                )

        if "rowcount" in query and not (
            query["rowcount"] is None
            or (
                type(query["rowcount"]) is int
                and 0 <= query["rowcount"] <= MAX_QUERY_RESULT_ROWCOUNT
            )
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "sql_rowcount" in query and not (
            query["sql_rowcount"] is None
            or (
                type(query["sql_rowcount"]) is int
                and 0 <= query["sql_rowcount"] <= MAX_QUERY_RESULT_ROWCOUNT
            )
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "is_cached" in query and type(query["is_cached"]) is not bool:
            return _invalid_metadata(f"Chart query {index}")
        if "cache_key" in query and not (
            query["cache_key"] is None or _is_bounded_wire_string(query["cache_key"])
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "cache_dttm" in query and not (
            query["cache_dttm"] is None
            or type(query["cache_dttm"]) is datetime
            or _is_bounded_wire_string(query["cache_dttm"])
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "applied_filters" in query and not _is_valid_filter_metadata(
            query["applied_filters"], rejected=False
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "rejected_filters" in query and not _is_valid_filter_metadata(
            query["rejected_filters"], rejected=True
        ):
            return _invalid_metadata(f"Chart query {index}")
        if "rejected_filter_columns" in query and not _is_valid_string_list(
            query["rejected_filter_columns"]
        ):
            return _invalid_metadata(f"Chart query {index}")
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
