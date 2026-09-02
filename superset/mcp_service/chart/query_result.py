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
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from superset.mcp_service.chart.schemas import ChartError
from superset.utils.core import GenericDataType

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
_MAX_QUERY_COUNT = 64
_MAX_QUERY_COLUMNS = 4096
_MAX_COLUMN_NAME_LENGTH = 4096
_MAX_ROW_CONTAINER_DEPTH = 32
_MAX_ROW_CONTAINER_ITEMS = 4096
_MAX_CACHE_STRING_LENGTH = 4096
_MAX_RESULT_ROW_COUNT = (1 << 63) - 1
_BUILTIN_SCALAR_TYPES = (str, bytes, bytearray, memoryview, int, float, bool)
_SCALAR_BASE_TYPES = (*_BUILTIN_SCALAR_TYPES, Enum)
_SAFE_ROW_SCALAR_TYPES = (
    str,
    int,
    float,
    bool,
    Decimal,
    date,
    datetime,
    time,
    timedelta,
    UUID,
)
_SUPPORTED_COLTYPES = frozenset(GenericDataType)
_TRUSTED_TZINFO_TYPES = (timezone, ZoneInfo)


@dataclass(frozen=True)
class _ErrorText:
    """Bounded error extraction outcome."""

    text: str | None = None
    malformed: str | None = None


def _truncate_utf8(value: str, max_bytes: int) -> str:
    """Return bounded, replacement-decoded UTF-8 text.

    Encoding even the non-truncated path is intentional: Python strings may
    contain unpaired surrogates, while MCP/JSON responses must always be valid
    UTF-8.  Slicing by characters before encoding also prevents an
    attacker-sized string from being encoded in full.
    """
    if max_bytes <= 0:
        return ""
    candidate = value[:max_bytes]
    encoded = candidate.encode("utf-8", errors="replace")
    if len(encoded) <= max_bytes and len(candidate) == len(value):
        return encoded.decode("utf-8", errors="replace")
    suffix = "... [truncated]"
    suffix_bytes = suffix.encode()
    if max_bytes <= len(suffix_bytes):
        return suffix_bytes[:max_bytes].decode("ascii")
    content_limit = max(0, max_bytes - len(suffix_bytes))
    content = encoded[:content_limit].decode("utf-8", errors="ignore")
    return content + suffix


def _type_descriptor(value: Any, max_bytes: int) -> str | None:
    """Describe an unsupported value without consulting its implementation."""
    if max_bytes <= 0:
        return None
    value_type = type(value)
    try:
        type_name = type.__getattribute__(value_type, "__name__")
    except (AttributeError, TypeError):  # pragma: no cover - defensive metaclass
        type_name = "unknown"
    if type(type_name) is not str:
        type_name = "unknown"
    bounded_name = _truncate_utf8(type_name, max_bytes)
    return _truncate_utf8(f"<{bounded_name} object>", max_bytes)


def _type_mro(value_type: type[Any]) -> tuple[type[Any], ...]:
    """Read a concrete type's MRO without consulting its metaclass overrides."""
    try:
        mro = type.__getattribute__(value_type, "__mro__")
    except (AttributeError, TypeError):  # pragma: no cover - all normal types have MRO
        return ()
    return mro if type(mro) is tuple else ()


def _mro_contains(
    value_mro: tuple[type[Any], ...], base_types: tuple[type[Any], ...]
) -> bool:
    """Return whether an MRO contains a base, using identity-only comparisons."""
    return any(
        base is expected_base for base in value_mro for expected_base in base_types
    )


def _safe_scalar_text(value: Any, max_bytes: int) -> str | None:  # noqa: C901
    """Render a bounded scalar without invoking attacker-controlled string code."""
    value_type = type(value)
    if _mro_contains(_type_mro(value_type), (Enum,)):
        try:
            enum_value = object.__getattribute__(value, "_value_")
        except Exception:
            return _type_descriptor(value, max_bytes)
        if not any(
            type(enum_value) is scalar_type for scalar_type in _BUILTIN_SCALAR_TYPES
        ):
            return _type_descriptor(value, max_bytes)
        return _safe_scalar_text(enum_value, max_bytes)
    if value is None or value is False:
        return None
    if value_type is str:
        return _truncate_utf8(value, max_bytes) if value else None
    if value_type is bytes or value_type is bytearray or value_type is memoryview:
        try:
            view = memoryview(value).cast("B")
            sample = view[: max(0, max_bytes)].tobytes()
            text = sample.decode("utf-8", errors="replace")
            if len(view) > len(sample):
                text += "... [truncated]"
            return _truncate_utf8(text, max_bytes) if text else None
        except (TypeError, ValueError):
            return _type_descriptor(value, max_bytes)
    if value_type is int:
        digits = (
            1 if value == 0 else int((abs(value).bit_length() - 1) * math.log10(2)) + 1
        )
        if digits > _MAX_INTEGER_DIGITS:
            sign = "negative " if value < 0 else ""
            return _truncate_utf8(
                f"<{sign}integer with approximately {digits} decimal digits>",
                max_bytes,
            )
        return _truncate_utf8(str(value), max_bytes)
    if value_type is bool or value_type is float:
        return _truncate_utf8(str(value), max_bytes)
    return _type_descriptor(value, max_bytes)


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

        # ChartDataCommand envelopes cross a JSON boundary. Only exact JSON
        # containers are trusted here: ABC/isinstance checks can consult a
        # spoofed ``__class__``, and subclass get/contains/iter/len hooks are
        # attacker-controlled. Exact dict/list operations below are builtin and
        # non-overridable.
        is_mapping = type(item) is dict
        is_sequence = type(item) is list
        item_mro = _type_mro(type(item))
        if not (is_mapping or is_sequence) and (
            _mro_contains(item_mro, (dict, list, Mapping, Sequence))
            and not _mro_contains(item_mro, _SCALAR_BASE_TYPES)
        ):
            return _ErrorText(
                malformed="error payload contains an unsupported container type"
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
            for key in _ERROR_KEYS:
                if dict.__contains__(item, key):
                    children.append(dict.__getitem__(item, key))
            if not children:
                if dict.__len__(item):
                    return _ErrorText(
                        malformed=(
                            "error payload object has no recognized message field"
                        )
                    )
            stack.extend((child, depth + 1) for child in reversed(children))
            continue

        if is_sequence:
            width = list.__len__(item)
            if width > _MAX_SEQUENCE_ITEMS:
                return _ErrorText(malformed="error payload exceeds the width limit")
            children = [list.__getitem__(item, index) for index in range(width)]
            stack.extend((child, depth + 1) for child in reversed(children))
            continue

        remaining = _MAX_ERROR_BYTES - used_bytes - (2 if parts else 0)
        text = _safe_scalar_text(item, remaining)
        if text:
            parts.append(text)
            used_bytes += len(text.encode("utf-8", errors="replace")) + (
                2 if len(parts) > 1 else 0
            )

    return _ErrorText(text="; ".join(parts) or None)


def _failure_for_query_payload(  # noqa: C901
    payload: dict[str, Any], label: str
) -> ChartError | None:
    """Extract one failure from a top-level or per-query payload."""
    for key in ("error", "errors", "error_message"):
        extracted = _query_error_text(dict.get(payload, key))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        if message := extracted.text:
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = dict.get(payload, "status")
    status = _safe_scalar_text(raw_status, 200) or ""
    normalized_status = status.strip().casefold().replace("-", "_").replace(" ", "_")
    if normalized_status in FAILED_QUERY_STATUSES:
        extracted = _query_error_text(dict.get(payload, "message"))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        fallback = _query_error_text(dict.get(payload, "error_message"))
        if fallback.malformed:
            return _malformed_result(fallback.malformed)
        message = extracted.text or fallback.text or normalized_status
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if dict.get(payload, "success") is False:
        extracted = _query_error_text(dict.get(payload, "message"))
        if extracted.malformed:
            return _malformed_result(extracted.malformed)
        message = extracted.text or "request failed"
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if (
        raw_status is None
        and "data" not in dict.keys(payload)
        and "queries" not in dict.keys(payload)
    ):
        extracted = _query_error_text(dict.get(payload, "message"))
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


def bounded_result_row_count(value: Any) -> int | None:
    """Return one exact bounded row count, rejecting coercive lookalikes."""
    if value is None:
        return None
    if type(value) is int:
        count = value
    elif type(value) is float and math.isfinite(value) and value.is_integer():
        count = int(value)
    else:
        raise ValueError("must be a finite non-negative integral number")
    if count < 0:
        raise ValueError("must be non-negative")
    if count > _MAX_RESULT_ROW_COUNT:
        raise ValueError("exceeds the supported bound")
    return count


def _metadata_failure(  # noqa: C901
    payload: dict[str, Any], label: str
) -> ChartError | None:
    """Validate bounded cache and row-count metadata before any consumer."""
    for key in ("rowcount", "total_rows"):
        if key in payload and dict.__getitem__(payload, key) is not None:
            try:
                bounded_result_row_count(dict.__getitem__(payload, key))
            except ValueError as ex:
                return _malformed_result(f"{label} {key} {ex}")

    if "is_cached" in payload:
        is_cached = dict.__getitem__(payload, "is_cached")
        if is_cached is not None and type(is_cached) is not bool:
            return _malformed_result(f"{label} is_cached must be an exact boolean")

    if "cache_key" in payload:
        cache_key = dict.__getitem__(payload, "cache_key")
        if cache_key is not None and (
            type(cache_key) is not str or len(cache_key) > _MAX_CACHE_STRING_LENGTH
        ):
            return _malformed_result(
                f"{label} cache_key must be a bounded exact string"
            )

    # ChartData's production schema emits ``cached_dttm``. ``cache_dttm`` was
    # used by earlier MCP payloads and remains a bounded compatibility alias.
    # Validate both before cache utilities parse or compare either value.
    for key in ("cached_dttm", "cache_dttm"):
        if key not in payload:
            continue
        cache_dttm = dict.__getitem__(payload, key)
        if cache_dttm is None:
            continue
        if type(cache_dttm) is str:
            if len(cache_dttm) <= _MAX_CACHE_STRING_LENGTH:
                continue
            return _malformed_result(f"{label} {key} must be a bounded exact string")
        if type(cache_dttm) is datetime:
            tzinfo = cache_dttm.tzinfo
            if tzinfo is None or any(
                type(tzinfo) is trusted for trusted in _TRUSTED_TZINFO_TYPES
            ):
                continue
            return _malformed_result(f"{label} {key} has an unsupported timezone")
        return _malformed_result(
            f"{label} {key} must be a bounded exact string or datetime"
        )
    return None


def _unsafe_row_value(value: Any) -> str | None:  # noqa: C901
    """Return a bounded reason when a result value is unsafe to serialize.

    ChartDataCommand output is expected to have crossed its JSON-materialization
    boundary. Exact builtin containers and the small scalar set emitted by SQL
    result adapters are safe to inspect. Subclasses and arbitrary objects are
    rejected without calling their conversion, comparison, iteration, or
    descriptor hooks.
    """
    stack: list[tuple[Any, int]] = [(value, 0)]
    visited = 0
    seen: set[int] = set()

    while stack:
        item, depth = stack.pop()
        visited += 1
        if visited > _MAX_ROW_CONTAINER_ITEMS:
            return "contains too many nested values"
        if depth > _MAX_ROW_CONTAINER_DEPTH:
            return "exceeds the nesting depth limit"

        if type(item) is datetime or type(item) is time:
            tzinfo = item.tzinfo
            if tzinfo is not None and not any(
                type(tzinfo) is type_ for type_ in _TRUSTED_TZINFO_TYPES
            ):
                return "contains a temporal value with an unsupported timezone"
            continue

        if item is None or any(type(item) is type_ for type_ in _SAFE_ROW_SCALAR_TYPES):
            continue

        if type(item) is list:
            identity = id(item)
            if identity in seen:
                return "contains repeated or cyclic containers"
            seen.add(identity)
            width = list.__len__(item)
            if width > _MAX_ROW_CONTAINER_ITEMS:
                return "contains an oversized array"
            stack.extend(
                (list.__getitem__(item, index), depth + 1) for index in range(width)
            )
            continue

        if type(item) is dict:
            identity = id(item)
            if identity in seen:
                return "contains repeated or cyclic containers"
            seen.add(identity)
            if dict.__len__(item) > _MAX_ROW_CONTAINER_ITEMS:
                return "contains an oversized object"
            for key, child in dict.items(item):
                if type(key) is not str:
                    return "contains a non-string object key"
                stack.append((child, depth + 1))
            continue

        return "contains an unsupported or subclassed value"

    return None


def query_result_data(  # noqa: C901
    result: Any,
) -> tuple[list[list[dict[str, Any]]] | None, ChartError | None]:
    """Validate a chart-data envelope and return each query's data array.

    Every query is checked before callers use the first one so malformed nested
    entries cannot be hidden behind an otherwise valid leading query.
    """
    if type(result) is not dict:
        return None, _malformed_result("top-level result must be an object")

    if metadata_failure := _metadata_failure(result, "top-level result"):
        return None, metadata_failure

    if failure := _failure_for_query_payload(result, "Chart query"):
        return None, failure

    if not dict.__contains__(result, "queries"):
        return None, _malformed_result("missing queries array")
    queries = dict.__getitem__(result, "queries")
    if type(queries) is not list:
        return None, _malformed_result("queries must be an array")
    query_count = list.__len__(queries)
    if query_count == 0:
        return None, _malformed_result("queries must contain at least one query")
    if query_count > _MAX_QUERY_COUNT:
        return None, _malformed_result("queries exceeds the item limit")

    data_arrays: list[list[dict[str, Any]]] = []
    for offset in range(query_count):
        index = offset + 1
        query = list.__getitem__(queries, offset)
        if type(query) is not dict:
            return None, _malformed_result(f"query {index} must be an object")
        if metadata_failure := _metadata_failure(query, f"query {index}"):
            return None, metadata_failure
        if failure := _failure_for_query_payload(query, f"Chart query {index}"):
            return None, failure
        if not dict.__contains__(query, "data"):
            return None, _malformed_result(f"query {index} is missing data")
        data = dict.__getitem__(query, "data")
        if type(data) is not list:
            return None, _malformed_result(f"query {index} data must be an array")
        for row_offset in range(list.__len__(data)):
            row = list.__getitem__(data, row_offset)
            if type(row) is not dict:
                return None, _malformed_result(
                    f"query {index} data row {row_offset + 1} must be an exact object"
                )
            if reason := _unsafe_row_value(row):
                return None, _malformed_result(
                    f"query {index} data row {row_offset + 1} {reason}"
                )
        for metadata_key in (
            "colnames",
            "coltypes",
            "rejected_filters",
            "rejected_filter_columns",
        ):
            metadata = dict.get(query, metadata_key)
            if metadata is not None and type(metadata) is not list:
                return None, _malformed_result(
                    f"query {index} {metadata_key} must be an array"
                )
        colnames = dict.get(query, "colnames")
        coltypes = dict.get(query, "coltypes")
        if type(colnames) is list:
            column_count = list.__len__(colnames)
            if column_count > _MAX_QUERY_COLUMNS:
                return None, _malformed_result(
                    f"query {index} colnames exceeds the item limit"
                )
            seen_colnames: set[str] = set()
            for column_offset in range(column_count):
                colname = list.__getitem__(colnames, column_offset)
                if (
                    type(colname) is not str
                    or not colname
                    or len(colname) > _MAX_COLUMN_NAME_LENGTH
                ):
                    return None, _malformed_result(
                        f"query {index} colnames must contain bounded, nonempty "
                        "exact strings"
                    )
                if colname in seen_colnames:
                    return None, _malformed_result(
                        f"query {index} colnames must not contain duplicates"
                    )
                seen_colnames.add(colname)

        if type(coltypes) is list:
            coltype_count = list.__len__(coltypes)
            if coltype_count > _MAX_QUERY_COLUMNS:
                return None, _malformed_result(
                    f"query {index} coltypes exceeds the item limit"
                )
            if type(colnames) is not list and coltype_count:
                return None, _malformed_result(
                    f"query {index} coltypes requires colnames"
                )
            if type(colnames) is list and coltype_count != list.__len__(colnames):
                return None, _malformed_result(
                    f"query {index} coltypes must align with colnames"
                )
            for coltype_offset in range(coltype_count):
                coltype = list.__getitem__(coltypes, coltype_offset)
                if not (
                    (type(coltype) is int or type(coltype) is GenericDataType)
                    and coltype in _SUPPORTED_COLTYPES
                ):
                    return None, _malformed_result(
                        f"query {index} coltypes contains an unsupported value"
                    )
        data_arrays.append(data)
    return data_arrays, None


def safe_exception_message(exception: BaseException, max_bytes: int = 2000) -> str:
    """Describe an exception without invoking attacker-controlled conversion.

    Query adapters may raise custom exception instances whose ``__str__`` or
    argument conversions are hostile or unbounded. BaseException stores
    ``args`` as an exact tuple; reading it through ``object`` and rendering only
    the bounded scalar subset keeps response and log amplification controlled.
    """
    try:
        args = object.__getattribute__(exception, "args")
    except Exception:  # pragma: no cover - BaseException always exposes args
        args = ()
    if type(args) is tuple:
        parts: list[str] = []
        used_bytes = 0
        for index in range(min(tuple.__len__(args), _MAX_ERROR_PARTS)):
            remaining = max_bytes - used_bytes - (2 if parts else 0)
            if remaining <= 0:
                break
            text = _safe_scalar_text(tuple.__getitem__(args, index), remaining)
            if text:
                parts.append(text)
                used_bytes += len(text.encode("utf-8", errors="replace")) + (
                    2 if len(parts) > 1 else 0
                )
        if parts:
            return _truncate_utf8("; ".join(parts), max_bytes)
    return _type_descriptor(exception, max_bytes) or "<exception>"


def query_result_failure(result: Any) -> ChartError | None:
    """Return an embedded failure or malformed-envelope error."""
    _data, failure = query_result_data(result)
    return failure
