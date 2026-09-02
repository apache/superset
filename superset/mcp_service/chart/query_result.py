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
import time as system_time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from enum import Enum
from types import MappingProxyType
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
import pandas as pd
import pytz
from dateutil import tz as dateutil_tz
from dateutil.zoneinfo import tzfile as dateutil_zoneinfo_tzfile
from pydantic import BaseModel
from pydantic_core import to_json

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
_MAX_COLUMN_NAME_BYTES = 4096
_MAX_ROW_CONTAINER_DEPTH = 32
_MAX_ROW_CONTAINER_ITEMS = 4096
_MAX_CACHE_STRING_BYTES = 4096
_MAX_RESULT_ROW_COUNT = (1 << 63) - 1

# Chart results are routinely much larger than an MCP response should return, but
# legitimate exports and high-cardinality chart queries still need useful room.
# Each query may return Superset's configured 50k ROW_LIMIT. The aggregate row
# budget admits both legs of Big Number raw/trend and Mixed Timeseries results
# at that limit, while the value budget admits twenty scalar columns on both
# legs (plus their row containers). The complete compact JSON projection is
# capped at 16 MiB, including scalar tokens, escaping, keys, and syntax. Metadata
# profiling has a separate row-by-column work budget in ``response_utils`` so
# wide sparse results cannot turn bounded validation into an unbounded scan.
# Individual source-result cell strings are capped at 64 KiB and object keys at
# 4 KiB. Derived strings in a final Pydantic response have no per-cell cap; the
# complete compact response remains subject to the 16 MiB aggregate budget.
# Query metadata has its own 1 MiB aggregate budget so SQL and cache metadata
# cannot consume the row-data allowance. Integer/Decimal bounds also prevent
# later hashing, uniqueness, and JSON conversion from allocating by magnitude.
MAX_QUERY_RESULT_ROWS = 50_000
MAX_QUERY_RESULT_TOTAL_ROWS = 2 * MAX_QUERY_RESULT_ROWS
MAX_QUERY_RESULT_VALUES = 2_500_000
MAX_QUERY_RESULT_VALUE_BYTES = 16 * 1024 * 1024
MAX_QUERY_RESULT_METADATA_BYTES = 1024 * 1024
MAX_QUERY_RESULT_METADATA_ITEMS = 32_768
MAX_QUERY_RESULT_WORK = MAX_QUERY_RESULT_VALUES + MAX_QUERY_RESULT_METADATA_ITEMS
MAX_QUERY_RESULT_STRING_BYTES = 64 * 1024
MAX_QUERY_RESULT_KEY_BYTES = 4096
MAX_QUERY_RESULT_INTEGER_BITS = 4096
MAX_QUERY_RESULT_INTEGER_DIGITS = 1234
MAX_QUERY_RESULT_DECIMAL_DIGITS = 1024
MAX_QUERY_RESULT_DECIMAL_EXPONENT = 4096
MAX_QUERY_RESULT_DECIMAL_STORAGE = 2048
_BUILTIN_SCALAR_TYPES = (str, bytes, bytearray, memoryview, int, float, bool)
_SCALAR_BASE_TYPES = (*_BUILTIN_SCALAR_TYPES, Enum)
_SUPPORTED_COLTYPES = frozenset(GenericDataType)
_TRUSTED_TZINFO_TYPES = (timezone, ZoneInfo)
_DATEUTIL_TZFILE_TYPE = dateutil_tz.tzfile
_DATEUTIL_TZOFFSET_TYPE = type(dateutil_tz.tzoffset(None, 0))
_DATEUTIL_TZUTC_TYPE = type(dateutil_tz.UTC)
_DATEUTIL_TZLOCAL_TYPE = type(dateutil_tz.tzlocal())
_PYTZ_FIXED_OFFSET_TYPE = type(pytz.FixedOffset(1))
_PYTZ_UTC_TYPE = type(pytz.UTC)
_PYTZ_NAMED_BASE_TYPES = (pytz.tzinfo.DstTzInfo, pytz.tzinfo.StaticTzInfo)
_NUMPY_INTEGER_TYPES = frozenset(
    type(value)
    for value in (
        np.int8(0),
        np.int16(0),
        np.int32(0),
        np.int64(0),
        np.uint8(0),
        np.uint16(0),
        np.uint32(0),
        np.uint64(0),
    )
)
_NUMPY_FLOAT_TYPES = frozenset(
    type(value)
    for value in (np.float16(0), np.float32(0), np.float64(0), np.longdouble(0))
)
_PANDAS_NAT_TYPE = type(pd.NaT)
_PANDAS_NA_TYPE = type(pd.NA)
_PANDAS_PERIOD_TYPE = type(pd.Period("2000-01", freq="M"))
_PANDAS_INTERVAL_TYPE = type(pd.Interval(0, 1))


@dataclass(frozen=True)
class _ErrorText:
    """Bounded error extraction outcome."""

    text: str | None = None
    malformed: str | None = None


@dataclass
class _ResultBudget:
    """Aggregate work counters shared across all queries in one result."""

    rows: int = 0
    values: int = 0
    json_bytes: int = 0
    metadata_items: int = 0
    metadata_bytes: int = 0


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


def _bounded_utf8_length(value: str, max_bytes: int) -> int | None:
    """Return an exact UTF-8 size without encoding attacker-sized text."""
    if str.__len__(value) > max_bytes:
        return None
    try:
        encoded = str.encode(value, "utf-8", errors="strict")
    except UnicodeEncodeError:
        return None
    size = bytes.__len__(encoded)
    return size if size <= max_bytes else None


def _json_string_size(value: str, max_bytes: int) -> int | None:
    """Return the exact UTF-8 size of a JSON string without serializing it."""
    raw_size = _bounded_utf8_length(value, max_bytes)
    if raw_size is None:
        return None
    escaped_size = raw_size + 2  # surrounding quotes
    for character in value:
        codepoint = ord(character)
        if character in {'"', "\\"} or character in {"\b", "\t", "\n", "\f", "\r"}:
            escaped_size += 1
        elif codepoint < 0x20:
            # Other JSON control characters use a six-byte ``\\u00xx`` escape.
            escaped_size += 5
    return escaped_size


def _integer_json_size(value: int) -> int:
    """Return an exact integer JSON size without creating its decimal string."""
    magnitude = -value if value < 0 else value
    if magnitude == 0:
        digits = 1
    else:
        bits = int.bit_length(magnitude)
        # This fixed-point log10(2) estimate is at most one digit low. Refine it
        # with one bounded integer comparison rather than rendering the value.
        digits = ((bits - 1) * 30103) // 100000 + 1
        if magnitude >= 10**digits:
            digits += 1
    return digits + (value < 0)


def _container_json_syntax_size(item_count: int, *, mapping: bool) -> int:
    """Return braces/brackets, separators, and mapping-colon byte cost."""
    if item_count == 0:
        return 2
    return 2 + item_count - 1 + (item_count if mapping else 0)


def _trusted_timedelta_text(value: timedelta) -> str:
    """Render an exact timedelta with Pydantic's stable ISO-8601 spelling."""
    total_microseconds = (
        value.days * 86_400 + value.seconds
    ) * 1_000_000 + value.microseconds
    sign = "-" if total_microseconds < 0 else ""
    remaining = abs(total_microseconds)
    days, remaining = divmod(remaining, 86_400 * 1_000_000)
    years, days = divmod(days, 365)
    hours, remaining = divmod(remaining, 3_600 * 1_000_000)
    minutes, remaining = divmod(remaining, 60 * 1_000_000)
    seconds, microseconds = divmod(remaining, 1_000_000)

    date_parts = [f"{years}Y" if years else "", f"{days}D" if days else ""]
    time_parts = [f"{hours}H" if hours else "", f"{minutes}M" if minutes else ""]
    if microseconds:
        fraction = f"{microseconds:06d}".rstrip("0")
        time_parts.append(f"{seconds}.{fraction}S")
    elif seconds:
        time_parts.append(f"{seconds}S")

    date_text = "".join(date_parts)
    time_text = "".join(time_parts)
    if not date_text and not time_text:
        time_text = "0S"
    return f"{sign}P{date_text}{'T' if time_text else ''}{time_text}"


def _normalized_scalar_json_size(  # noqa: C901
    value: Any, *, max_string_bytes: int = MAX_QUERY_RESULT_STRING_BYTES
) -> int:
    """Return a conservative encoded size for one normalized exact scalar."""
    value_type = type(value)
    if value is None:
        return 4
    if value_type is bool:
        return 4 if value else 5
    if value_type is str:
        size = _json_string_size(value, max_string_bytes)
        assert size is not None  # scalar normalization already bounded the string
        return size
    if value_type is int:
        return _integer_json_size(value)
    if value_type is float:
        # Exact builtin repr is hook-free, bounded to a shortest-round-trip
        # spelling, and avoids pessimistically charging 24 bytes for values
        # such as 0.0 across ordinary large numeric datasets.
        return len(float.__repr__(value))
    if value_type is Decimal:
        # Decimal storage, coefficient digits, and exponent are bounded before
        # this point. Its canonical spelling is therefore itself bounded, and
        # Pydantic serializes Decimal values as JSON strings.
        text = Decimal.__str__(value)
        size = _json_string_size(text, MAX_QUERY_RESULT_STRING_BYTES)
        assert size is not None
        return size
    if value_type is datetime:
        return 40
    if value_type is date:
        text = date.isoformat(value)
    elif value_type is time:
        return 32
    elif value_type is timedelta:
        text = _trusted_timedelta_text(value)
    elif value_type is UUID:
        text = UUID.__str__(value)
    else:
        raise AssertionError(f"unaccounted normalized scalar: {value_type!r}")
    size = _json_string_size(text, MAX_QUERY_RESULT_STRING_BYTES)
    assert size is not None
    return size


def _pydantic_scalar_json_size(value: Any) -> int:
    """Return the exact Pydantic wire size for a normalized scalar.

    Source-result accounting deliberately retains its existing conservative
    scalar rules.  Final response projections, however, must match
    pydantic-core's JSON number spelling: for example, it emits ``0.00001`` for
    ``1e-5`` and ``1e-6`` for ``1e-6`` rather than Python's repr spellings.
    """
    if type(value) is float:
        return len(to_json(value))
    return _normalized_scalar_json_size(value)


def _charge_json_bytes(
    budget: _ResultBudget, size: int, *, metadata: bool = False
) -> str | None:
    """Charge aggregate response bytes and the independent metadata allowance."""
    budget.json_bytes += size
    if budget.json_bytes > MAX_QUERY_RESULT_VALUE_BYTES:
        return "exceeds the total JSON-encoded byte limit"
    if metadata:
        budget.metadata_bytes += size
        if budget.metadata_bytes > MAX_QUERY_RESULT_METADATA_BYTES:
            return "metadata exceeds the total JSON-encoded byte limit"
    return None


def _integer_failure(value: int) -> str | None:
    """Validate exact integer magnitude before decimal rendering or hashing."""
    bits = int.bit_length(value)
    if bits > MAX_QUERY_RESULT_INTEGER_BITS:
        return "contains an integer exceeding the bit-length limit"
    digits = 1 if bits == 0 else ((bits - 1) * 30103) // 100000 + 1
    if digits > MAX_QUERY_RESULT_INTEGER_DIGITS:
        return "contains an integer exceeding the digit limit"
    return None


def _decimal_failure(value: Decimal) -> str | None:
    """Validate exact Decimal storage, finiteness, digits, and exponent."""
    if Decimal.__sizeof__(value) > MAX_QUERY_RESULT_DECIMAL_STORAGE:
        return "contains a Decimal exceeding the storage limit"
    if not Decimal.is_finite(value):
        return "contains a non-finite Decimal"
    parts = Decimal.as_tuple(value)
    if tuple.__len__(parts.digits) > MAX_QUERY_RESULT_DECIMAL_DIGITS:
        return "contains a Decimal exceeding the digit limit"
    exponent = parts.exponent
    if type(exponent) is not int or abs(exponent) > MAX_QUERY_RESULT_DECIMAL_EXPONENT:
        return "contains a Decimal exceeding the exponent limit"
    return None


def _exact_object_namespace(value: Any) -> dict[str, Any] | None:
    """Read an object's concrete storage without descriptor dispatch."""
    try:
        namespace = object.__getattribute__(value, "__dict__")
    except (AttributeError, TypeError):
        return None
    return namespace if type(namespace) is dict else None


def _dateutil_timezone_name_without_hooks(tzinfo: Any) -> str | None:
    """Read a dateutil tzfile's IANA name from exact internal storage."""
    tzinfo_type = type(tzinfo)
    if tzinfo_type not in {_DATEUTIL_TZFILE_TYPE, dateutil_zoneinfo_tzfile}:
        return None
    namespace = _exact_object_namespace(tzinfo)
    if namespace is None:
        return None
    filename = dict.get(namespace, "_filename")
    if type(filename) is not str or _bounded_utf8_length(filename, 4096) is None:
        return None
    if tzinfo_type is dateutil_zoneinfo_tzfile:
        name = filename
    else:
        marker = "/zoneinfo/"
        marker_offset = str.find(filename, marker)
        if marker_offset >= 0:
            name = str.__getitem__(filename, slice(marker_offset + len(marker), None))
        elif not str.startswith(filename, "/") and str.find(filename, "\\") < 0:
            name = filename
        else:
            return None
    parts = str.split(name, "/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        return None
    return name if _bounded_utf8_length(name, 256) is not None else None


def _pytz_timezone_name_without_hooks(tzinfo: Any) -> str | None:
    """Read and verify one generated pytz named-zone implementation."""
    value_type = type(tzinfo)
    if not _mro_contains(_type_mro(value_type), _PYTZ_NAMED_BASE_TYPES):
        return None
    try:
        namespace = type.__getattribute__(value_type, "__dict__")
    except (AttributeError, TypeError):
        return None
    if type(namespace) is not MappingProxyType:
        return None
    zone = namespace.get("zone")
    if type(zone) is not str or _bounded_utf8_length(zone, 256) is None:
        return None
    try:
        canonical = pytz.timezone(zone)
    except (KeyError, ValueError):
        return None
    # A user subclass can inherit pytz's base and spoof ``zone``. Only the
    # concrete class generated and cached by pytz for that name is trusted.
    return zone if type(canonical) is value_type else None


def _fixed_offset_without_hooks(tzinfo: Any) -> timezone | None:
    """Reconstruct trusted dateutil/pytz fixed offsets from exact storage."""
    if type(tzinfo) not in {_DATEUTIL_TZOFFSET_TYPE, _PYTZ_FIXED_OFFSET_TYPE}:
        return None
    namespace = _exact_object_namespace(tzinfo)
    if namespace is None:
        return None
    offset = dict.get(namespace, "_offset")
    if type(offset) is not timedelta:
        return None
    try:
        return timezone(offset)
    except ValueError:
        return None


def _pytz_named_offset_without_hooks(tzinfo: Any) -> timezone | None:
    """Return a localized pytz instance's stored offset without its hooks."""
    if _pytz_timezone_name_without_hooks(tzinfo) is None:
        return None
    namespace = _exact_object_namespace(tzinfo)
    if namespace is None:
        return None
    offset = dict.get(namespace, "_utcoffset")
    if type(offset) is not timedelta:
        return None
    try:
        return timezone(offset)
    except ValueError:
        return None


def _dateutil_local_offset_without_hooks(
    value: datetime, tzinfo: Any
) -> timezone | None:
    """Select an exact dateutil-local offset using builtin system time data."""
    if type(tzinfo) is not _DATEUTIL_TZLOCAL_TYPE:
        return None
    namespace = _exact_object_namespace(tzinfo)
    if namespace is None:
        return None
    standard_offset = dict.get(namespace, "_std_offset")
    daylight_offset = dict.get(namespace, "_dst_offset")
    has_daylight = dict.get(namespace, "_hasdst")
    if (
        type(standard_offset) is not timedelta
        or type(daylight_offset) is not timedelta
        or type(has_daylight) is not bool
    ):
        return None
    selected_offset = standard_offset
    if has_daylight:
        epoch = datetime(1970, 1, 1)
        naive = datetime(
            value.year,
            value.month,
            value.day,
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
        )
        timestamp = (naive - epoch).total_seconds()
        try:
            is_daylight = bool(
                system_time.localtime(timestamp + system_time.timezone).tm_isdst
            )
            daylight_saved = daylight_offset - standard_offset
            previous_is_daylight = bool(
                system_time.localtime(
                    timestamp
                    - timedelta.total_seconds(daylight_saved)
                    + system_time.timezone
                ).tm_isdst
            )
        except (OverflowError, OSError, ValueError):
            return None
        is_ambiguous = not is_daylight and is_daylight != previous_is_daylight
        if is_ambiguous:
            is_daylight = not bool(value.fold)
        selected_offset = daylight_offset if is_daylight else standard_offset
    try:
        return timezone(selected_offset)
    except ValueError:
        return None


def _canonical_timezone(tzinfo: Any) -> timezone | ZoneInfo | None:
    """Return an exact trusted timezone without invoking the source's methods."""
    if any(type(tzinfo) is type_ for type_ in _TRUSTED_TZINFO_TYPES):
        return tzinfo
    if type(tzinfo) in {_DATEUTIL_TZUTC_TYPE, _PYTZ_UTC_TYPE}:
        return timezone.utc
    if fixed_offset := _fixed_offset_without_hooks(tzinfo):
        return fixed_offset
    zone_name = _dateutil_timezone_name_without_hooks(
        tzinfo
    ) or _pytz_timezone_name_without_hooks(tzinfo)
    if zone_name:
        try:
            return ZoneInfo(zone_name)
        except (KeyError, ValueError, ZoneInfoNotFoundError):
            return None
    return None


def _timestamp_offset_without_hooks(value: pd.Timestamp) -> timezone | None:
    """Recover a timestamp's stored wall-clock offset without timezone hooks."""
    unit_multipliers = {"s": 1_000_000_000, "ms": 1_000_000, "us": 1_000, "ns": 1}
    multiplier = unit_multipliers.get(value.unit)
    if multiplier is None:
        return None
    try:
        instant_ns = int(value.asm8.view("i8")) * multiplier
        epoch_ordinal = date.toordinal(date(1970, 1, 1))
        wall_ns = (
            (
                (datetime.toordinal(value) - epoch_ordinal) * 86_400
                + value.hour * 3600
                + value.minute * 60
                + value.second
            )
            * 1_000_000_000
            + value.microsecond * 1000
            + value.nanosecond
        )
        offset_ns = wall_ns - instant_ns
        if offset_ns % 1000:
            return None
        return timezone(timedelta(microseconds=offset_ns // 1000))
    except (OverflowError, TypeError, ValueError):
        return None


def _trusted_datetime_text(value: datetime) -> tuple[str | None, str | None]:
    """Serialize an exact Python datetime through only trusted timezone types."""
    tzinfo = value.tzinfo
    canonical_value = value
    if tzinfo is not None and not any(
        type(tzinfo) is trusted for trusted in _TRUSTED_TZINFO_TYPES
    ):
        canonical_tz = (
            _pytz_named_offset_without_hooks(tzinfo)
            or _dateutil_local_offset_without_hooks(value, tzinfo)
            or _canonical_timezone(tzinfo)
        )
        if canonical_tz is None:
            return None, "contains a datetime with an unsupported timezone"
        canonical_value = datetime(
            value.year,
            value.month,
            value.day,
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
            tzinfo=canonical_tz,
            fold=value.fold,
        )
    try:
        return datetime.isoformat(canonical_value), None
    except (OverflowError, TypeError, ValueError):
        return None, "contains an invalid datetime"


def _trusted_time_text(value: time) -> tuple[str | None, str | None]:
    """Serialize an exact Python time through only trusted timezone types."""
    tzinfo = value.tzinfo
    canonical_value = value
    if tzinfo is not None and not any(
        type(tzinfo) is trusted for trusted in _TRUSTED_TZINFO_TYPES
    ):
        canonical_tz = _canonical_timezone(tzinfo)
        if canonical_tz is None and type(tzinfo) is _DATEUTIL_TZLOCAL_TYPE:
            namespace = _exact_object_namespace(tzinfo)
            if namespace is None or type(dict.get(namespace, "_hasdst")) is not bool:
                return None, "contains a time with an unsupported timezone"
            if dict.get(namespace, "_hasdst"):
                canonical_tz = None
            else:
                standard_offset = dict.get(namespace, "_std_offset")
                if type(standard_offset) is not timedelta:
                    return None, "contains a time with an unsupported timezone"
                try:
                    canonical_tz = timezone(standard_offset)
                except ValueError:
                    return None, "contains a time with an unsupported timezone"
        elif canonical_tz is None:
            return None, "contains a time with an unsupported timezone"
        canonical_value = time(
            value.hour,
            value.minute,
            value.second,
            value.microsecond,
            tzinfo=canonical_tz,
            fold=value.fold,
        )
    try:
        return time.isoformat(canonical_value), None
    except (OverflowError, TypeError, ValueError):
        return None, "contains an invalid time"


def _trusted_timestamp_text(value: pd.Timestamp) -> tuple[str | None, str | None]:
    """Convert an exact pandas timestamp to its canonical JSON representation."""
    tzinfo = value.tzinfo
    try:
        if tzinfo is not None and not any(
            type(tzinfo) is trusted for trusted in _TRUSTED_TZINFO_TYPES
        ):
            if (
                _canonical_timezone(tzinfo) is None
                and type(tzinfo) is not _DATEUTIL_TZLOCAL_TYPE
            ):
                return (
                    None,
                    "contains a pandas timestamp with an unsupported timezone",
                )
            if (canonical_tz := _timestamp_offset_without_hooks(value)) is None:
                return None, "contains an invalid pandas timestamp"
            # Rebuild from the stored instant and resolution. No method on the
            # original pytz/dateutil object is called, and the recovered fixed
            # offset preserves the timestamp's selected fold.
            raw_value = value.asm8.view("i8")
            value = pd.Timestamp(raw_value, unit=value.unit, tz="UTC").tz_convert(
                canonical_tz
            )
        # ISO output preserves nanoseconds and the UTC offset selected by fold.
        text = pd.Timestamp.isoformat(value)
    except (KeyError, OverflowError, TypeError, ValueError):
        return None, "contains an invalid pandas timestamp"
    if _bounded_utf8_length(text, MAX_QUERY_RESULT_STRING_BYTES) is None:
        return None, "contains an oversized pandas timestamp"
    return text, None


def _normalize_trusted_scalar(  # noqa: C901
    value: Any, *, max_string_bytes: int = MAX_QUERY_RESULT_STRING_BYTES
) -> tuple[Any, str | None]:
    """Normalize one exact trusted pandas/NumPy scalar or validate a builtin.

    Type identity is checked before every conversion. This deliberately does not
    accept subclasses or generic ``np.generic``/pandas extension objects, whose
    conversion hooks are outside the trusted ChartData materialization contract.
    """
    value_type = type(value)
    enum_seen: set[int] = set()
    while _mro_contains(_type_mro(value_type), (Enum,)):
        identity = id(value)
        if identity in enum_seen or len(enum_seen) >= _MAX_ROW_CONTAINER_DEPTH:
            return None, "contains a recursive enum"
        enum_seen.add(identity)
        try:
            value = object.__getattribute__(value, "_value_")
        except Exception:
            return None, "contains an unsupported enum"
        value_type = type(value)

    if value is None or value_type is bool:
        return value, None
    if value_type is str:
        size = _bounded_utf8_length(value, max_string_bytes)
        return (
            (value, None)
            if size is not None
            else (
                None,
                "contains an invalid or oversized string",
            )
        )
    if value_type is int:
        return value, _integer_failure(value)
    if value_type is float:
        if math.isnan(value):
            return None, None
        if math.isinf(value):
            return None, "contains a non-finite number"
        return value, None
    if value_type is Decimal:
        return value, _decimal_failure(value)

    if value_type is datetime:
        return _trusted_datetime_text(value)
    if value_type is time:
        return _trusted_time_text(value)
    if value_type is date:
        return date.isoformat(value), None
    if value_type is timedelta:
        return _trusted_timedelta_text(value), None
    if value_type is UUID:
        return UUID.__str__(value), None

    if value_type is _PANDAS_NAT_TYPE or value_type is _PANDAS_NA_TYPE:
        return None, None
    if value_type is pd.Timestamp:
        return _trusted_timestamp_text(value)
    if value_type is pd.Timedelta:
        if pd.isna(value):
            return None, None
        text = pd.Timedelta.isoformat(value)
        if _bounded_utf8_length(text, MAX_QUERY_RESULT_STRING_BYTES) is None:
            return None, "contains an oversized pandas timedelta"
        return text, None
    if value_type is _PANDAS_PERIOD_TYPE or value_type is _PANDAS_INTERVAL_TYPE:
        # The concrete extension scalar implementations are trusted, unlike an
        # arbitrary subclass's ``__str__`` implementation.
        text = str(value)
        if _bounded_utf8_length(text, MAX_QUERY_RESULT_STRING_BYTES) is None:
            return None, "contains an oversized pandas scalar"
        return text, None

    if any(value_type is type_ for type_ in _NUMPY_INTEGER_TYPES):
        normalized_integer = int(value)
        return normalized_integer, _integer_failure(normalized_integer)
    if any(value_type is type_ for type_ in _NUMPY_FLOAT_TYPES):
        normalized_float = float(value)
        if math.isnan(normalized_float):
            return None, None
        if math.isinf(normalized_float):
            return None, "contains a non-finite NumPy number"
        return normalized_float, None
    if value_type is np.bool_:
        return bool(value), None
    if value_type is np.str_:
        text = str(value)
        if _bounded_utf8_length(text, MAX_QUERY_RESULT_STRING_BYTES) is None:
            return None, "contains an invalid or oversized NumPy string"
        return text, None
    if value_type is np.datetime64:
        if np.isnat(value):
            return None, None
        try:
            timestamp = pd.Timestamp(value)
        except (OverflowError, TypeError, ValueError):
            return None, "contains an invalid NumPy datetime"
        return _trusted_timestamp_text(timestamp)
    if value_type is np.timedelta64:
        if np.isnat(value):
            return None, None
        try:
            delta = pd.Timedelta(value)
            text = pd.Timedelta.isoformat(delta)
        except (OverflowError, TypeError, ValueError):
            return None, "contains an invalid NumPy timedelta"
        if _bounded_utf8_length(text, MAX_QUERY_RESULT_STRING_BYTES) is None:
            return None, "contains an oversized NumPy timedelta"
        return text, None

    return None, "contains an unsupported or subclassed value"


def _chart_data_temporal_number(value: Any) -> tuple[float | None, str | None]:
    """Project an exact date/datetime through Chart Data's epoch-ms wire form.

    The public Chart Data API uses ``json_int_dttm_ser`` before the browser
    parses the payload.  The trusted text normalizer first validates timezone
    implementations without dispatching through arbitrary hooks; parsing that
    bounded text then gives the same instant using only builtin datetime types.
    """
    value_type = type(value)
    if value_type is datetime:
        text, reason = _trusted_datetime_text(value)
        if reason is not None or text is None:
            return None, reason or "contains an invalid datetime"
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo is None:
                epoch = datetime(1970, 1, 1)
            else:
                epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
                parsed = parsed.astimezone(timezone.utc)
            return (parsed - epoch).total_seconds() * 1000, None
        except (OverflowError, TypeError, ValueError):
            return None, "contains an invalid datetime"
    if value_type is date:
        # ``json_int_dttm_ser`` subtracts the epoch date and emits milliseconds.
        return float(
            (date.toordinal(value) - date.toordinal(date(1970, 1, 1))) * 86_400_000
        ), None
    return None, "contains an unsupported temporal value"


def _add_result_value_to_budget(value: Any, budget: _ResultBudget) -> str | None:
    """Account for one normalized row value and its JSON scalar size."""
    budget.values += 1
    if budget.values > MAX_QUERY_RESULT_VALUES:
        return "contains too many total values"
    if budget.values + budget.metadata_items > MAX_QUERY_RESULT_WORK:
        return "exceeds the total work limit"
    if type(value) is not list and type(value) is not dict:
        if reason := _charge_json_bytes(budget, _normalized_scalar_json_size(value)):
            return reason
    return None


def _metadata_failure_for_value(  # noqa: C901
    value: Any, budget: _ResultBudget
) -> str | None:
    """Bound exact-container query metadata independently of row data."""
    stack: list[tuple[Any, int, bool]] = [(value, 0, False)]
    active_containers: set[int] = set()
    while stack:
        item, depth, leaving = stack.pop()
        if leaving:
            active_containers.remove(id(item))
            continue
        budget.metadata_items += 1
        if budget.metadata_items > MAX_QUERY_RESULT_METADATA_ITEMS:
            return "metadata exceeds the item limit"
        if budget.values + budget.metadata_items > MAX_QUERY_RESULT_WORK:
            return "metadata exceeds the total work limit"
        if depth > _MAX_ROW_CONTAINER_DEPTH:
            return "metadata exceeds the nesting depth limit"

        if type(item) is dict:
            identity = id(item)
            if identity in active_containers:
                return "metadata contains cyclic containers"
            active_containers.add(identity)
            stack.append((item, depth, True))
            item_count = dict.__len__(item)
            if item_count > _MAX_ROW_CONTAINER_ITEMS:
                return "metadata contains an oversized object"
            if reason := _charge_json_bytes(
                budget,
                _container_json_syntax_size(item_count, mapping=True),
                metadata=True,
            ):
                return reason
            for key, child in dict.items(item):
                if type(key) is not str:
                    return "metadata contains a non-string object key"
                key_size = _json_string_size(key, MAX_QUERY_RESULT_KEY_BYTES)
                if key_size is None:
                    return "metadata contains an invalid or oversized object key"
                if reason := _charge_json_bytes(budget, key_size, metadata=True):
                    return reason
                stack.append((child, depth + 1, False))
            continue

        if type(item) is list:
            identity = id(item)
            if identity in active_containers:
                return "metadata contains cyclic containers"
            active_containers.add(identity)
            stack.append((item, depth, True))
            width = list.__len__(item)
            if width > _MAX_ROW_CONTAINER_ITEMS:
                return "metadata contains an oversized array"
            if reason := _charge_json_bytes(
                budget,
                _container_json_syntax_size(width, mapping=False),
                metadata=True,
            ):
                return reason
            stack.extend(
                (list.__getitem__(item, index), depth + 1, False)
                for index in range(width)
            )
            continue

        normalized, reason = _normalize_trusted_scalar(
            item, max_string_bytes=MAX_QUERY_RESULT_METADATA_BYTES
        )
        if reason is not None:
            return f"metadata {reason}"
        if reason := _charge_json_bytes(
            budget,
            _normalized_scalar_json_size(
                normalized, max_string_bytes=MAX_QUERY_RESULT_METADATA_BYTES
            ),
            metadata=True,
        ):
            return reason
    return None


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
            type(cache_key) is not str
            or _bounded_utf8_length(cache_key, _MAX_CACHE_STRING_BYTES) is None
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
            if _bounded_utf8_length(cache_dttm, _MAX_CACHE_STRING_BYTES) is not None:
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


def _normalize_row_value(  # noqa: C901
    value: Any, budget: _ResultBudget, *, temporal_json_numbers: bool = False
) -> str | None:
    """Normalize trusted scalars and return a bounded serialization failure.

    ChartDataCommand materializes a real DataFrame with ``to_dict(records)``, so
    exact pandas and NumPy scalars can remain in an otherwise valid result. They
    are converted in place to their canonical JSON-facing builtin values here.
    Exact containers are inspected through builtin operations only; arbitrary
    subclasses and scalar hooks remain rejected.
    """
    stack: list[
        tuple[
            Any,
            list[Any] | dict[str, Any] | None,
            int | str | None,
            int,
            bool,
        ]
    ] = [(value, None, None, 0, False)]
    active_containers: set[int] = set()

    while stack:
        item, parent, slot, depth, leaving = stack.pop()
        if leaving:
            active_containers.remove(id(item))
            continue
        if depth > _MAX_ROW_CONTAINER_DEPTH:
            return "exceeds the nesting depth limit"

        if type(item) is list:
            if reason := _add_result_value_to_budget(item, budget):
                return reason
            identity = id(item)
            if identity in active_containers:
                return "contains cyclic containers"
            active_containers.add(identity)
            stack.append((item, None, None, depth, True))
            width = list.__len__(item)
            if width > _MAX_ROW_CONTAINER_ITEMS:
                return "contains an oversized array"
            if reason := _charge_json_bytes(
                budget, _container_json_syntax_size(width, mapping=False)
            ):
                return reason
            stack.extend(
                (list.__getitem__(item, index), item, index, depth + 1, False)
                for index in range(width)
            )
            continue

        if type(item) is dict:
            if reason := _add_result_value_to_budget(item, budget):
                return reason
            identity = id(item)
            if identity in active_containers:
                return "contains cyclic containers"
            active_containers.add(identity)
            stack.append((item, None, None, depth, True))
            item_count = dict.__len__(item)
            if item_count > _MAX_ROW_CONTAINER_ITEMS:
                return "contains an oversized object"
            if reason := _charge_json_bytes(
                budget, _container_json_syntax_size(item_count, mapping=True)
            ):
                return reason
            for key, child in dict.items(item):
                if type(key) is not str:
                    return "contains a non-string object key"
                key_size = _json_string_size(key, MAX_QUERY_RESULT_KEY_BYTES)
                if key_size is None:
                    return "contains an invalid or oversized object key"
                if reason := _charge_json_bytes(budget, key_size):
                    return reason
                stack.append((child, item, key, depth + 1, False))
            continue

        if temporal_json_numbers and type(item) in {date, datetime}:
            normalized, reason = _chart_data_temporal_number(item)
        else:
            normalized, reason = _normalize_trusted_scalar(item)
        if reason is not None:
            return reason
        if reason := _add_result_value_to_budget(normalized, budget):
            return reason
        if parent is not None and normalized is not item:
            if type(parent) is list:
                assert type(slot) is int
                list.__setitem__(parent, slot, normalized)
            else:
                assert type(parent) is dict
                assert type(slot) is str
                dict.__setitem__(parent, slot, normalized)

    return None


def query_result_data(  # noqa: C901
    result: Any,
    *,
    temporal_json_numbers: bool = False,
) -> tuple[list[list[dict[str, Any]]] | None, ChartError | None]:
    """Validate a chart-data envelope and return each query's data array.

    Every query is checked before callers use the first one so malformed nested
    entries cannot be hidden behind an otherwise valid leading query.
    """
    if type(result) is not dict:
        return None, _malformed_result("top-level result must be an object")

    budget = _ResultBudget()
    result_item_count = dict.__len__(result)
    if reason := _charge_json_bytes(
        budget,
        _container_json_syntax_size(result_item_count, mapping=True),
        metadata=True,
    ):
        return None, _malformed_result(f"top-level result {reason}")
    for result_key in dict.keys(result):
        if type(result_key) is not str:
            return None, _malformed_result(
                "top-level result contains a non-string object key"
            )
        key_size = _json_string_size(result_key, MAX_QUERY_RESULT_KEY_BYTES)
        if key_size is None:
            return None, _malformed_result(
                "top-level result contains an invalid or oversized object key"
            )
        budget.metadata_items += 1
        if reason := _charge_json_bytes(budget, key_size, metadata=True):
            return None, _malformed_result(f"top-level result {reason}")
    if budget.metadata_items > MAX_QUERY_RESULT_METADATA_ITEMS:
        return None, _malformed_result("top-level metadata exceeds the item limit")
    if budget.metadata_bytes > MAX_QUERY_RESULT_METADATA_BYTES:
        return None, _malformed_result("top-level metadata exceeds the byte limit")

    for metadata_key, metadata_value in dict.items(result):
        # ChartDataCommand.run attaches the trusted QueryContext object as a
        # producer sidecar. MCP consumers never inspect or serialize it. Error
        # fields have their own width/depth-bounded extraction below.
        if metadata_key in {"queries", "query_context", *_ERROR_KEYS, "errors"}:
            continue
        if reason := _metadata_failure_for_value(metadata_value, budget):
            return None, _malformed_result(f"top-level result {reason}")

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
    if reason := _charge_json_bytes(
        budget, _container_json_syntax_size(query_count, mapping=False)
    ):
        return None, _malformed_result(f"queries {reason}")

    data_arrays: list[list[dict[str, Any]]] = []
    for offset in range(query_count):
        index = offset + 1
        query = list.__getitem__(queries, offset)
        if type(query) is not dict:
            return None, _malformed_result(f"query {index} must be an object")
        query_item_count = dict.__len__(query)
        if reason := _charge_json_bytes(
            budget,
            _container_json_syntax_size(query_item_count, mapping=True),
            metadata=True,
        ):
            return None, _malformed_result(f"query {index} {reason}")
        for query_key in dict.keys(query):
            if type(query_key) is not str:
                return None, _malformed_result(
                    f"query {index} contains a non-string object key"
                )
            key_size = _json_string_size(query_key, MAX_QUERY_RESULT_KEY_BYTES)
            if key_size is None:
                return None, _malformed_result(
                    f"query {index} contains an invalid or oversized object key"
                )
            budget.metadata_items += 1
            if reason := _charge_json_bytes(budget, key_size, metadata=True):
                return None, _malformed_result(f"query {index} {reason}")
        if budget.metadata_items > MAX_QUERY_RESULT_METADATA_ITEMS:
            return None, _malformed_result("query metadata exceeds the item limit")
        if budget.metadata_bytes > MAX_QUERY_RESULT_METADATA_BYTES:
            return None, _malformed_result("query metadata exceeds the byte limit")

        for metadata_key, metadata_value in dict.items(query):
            if metadata_key in {"data", *_ERROR_KEYS, "errors"}:
                continue
            if reason := _metadata_failure_for_value(metadata_value, budget):
                return None, _malformed_result(f"query {index} {reason}")
        if metadata_failure := _metadata_failure(query, f"query {index}"):
            return None, metadata_failure
        if failure := _failure_for_query_payload(query, f"Chart query {index}"):
            return None, failure
        if not dict.__contains__(query, "data"):
            return None, _malformed_result(f"query {index} is missing data")
        data = dict.__getitem__(query, "data")
        if type(data) is not list:
            return None, _malformed_result(f"query {index} data must be an array")
        data_length = list.__len__(data)
        if data_length > MAX_QUERY_RESULT_ROWS:
            return None, _malformed_result(f"query {index} data exceeds the row limit")
        budget.rows += data_length
        if budget.rows > MAX_QUERY_RESULT_TOTAL_ROWS:
            return None, _malformed_result("queries exceed the total row limit")
        if reason := _charge_json_bytes(
            budget, _container_json_syntax_size(data_length, mapping=False)
        ):
            return None, _malformed_result(f"query {index} data {reason}")
        for count_key in ("rowcount", "total_rows"):
            if dict.__contains__(query, count_key):
                count = dict.__getitem__(query, count_key)
                if count is not None:
                    try:
                        normalized_count = bounded_result_row_count(count)
                    except ValueError:  # handled above with the more specific label
                        normalized_count = None
                    if normalized_count is not None and normalized_count < data_length:
                        return None, _malformed_result(
                            f"query {index} {count_key} is smaller than len(data)"
                        )
        for row_offset in range(data_length):
            row = list.__getitem__(data, row_offset)
            if type(row) is not dict:
                return None, _malformed_result(
                    f"query {index} data row {row_offset + 1} must be an exact object"
                )
            if reason := _normalize_row_value(
                row, budget, temporal_json_numbers=temporal_json_numbers
            ):
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
                    or _bounded_utf8_length(colname, _MAX_COLUMN_NAME_BYTES) is None
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


def response_json_failure(response: BaseModel) -> ChartError | None:  # noqa: C901
    """Preflight the complete Pydantic response projection before serialization.

    Source results and returned models are not isomorphic: multi-query ChartData
    repeats the first query through its compatibility alias, and column samples
    repeat selected values. Walking the JSON-mode projection counts every
    actual occurrence, derived metadata, key, escape, and delimiter without
    materializing a potentially oversized JSON document.
    """
    try:
        # JSON mode is the projection Pydantic's wire serializer consumes.  In
        # particular, UTC datetimes become ``...Z`` here rather than the longer
        # Python-mode ``...+00:00`` spelling.  Walking that projection keeps the
        # byte accounting exact without materializing the JSON document (or
        # serializing the response twice).
        payload = BaseModel.model_dump(response, mode="json", by_alias=True)
    except Exception:
        return _malformed_result("response projection could not be inspected")

    stack: list[Any] = [payload]
    encoded_bytes = 0
    inspected_items = 0
    max_items = 3 * MAX_QUERY_RESULT_WORK
    while stack:
        item = stack.pop()
        inspected_items += 1
        if inspected_items > max_items:
            return _malformed_result("response projection exceeds the work limit")

        if type(item) is dict:
            item_count = dict.__len__(item)
            encoded_bytes += _container_json_syntax_size(item_count, mapping=True)
            for key, child in dict.items(item):
                if type(key) is not str:
                    return _malformed_result(
                        "response projection contains a non-string object key"
                    )
                key_size = _json_string_size(key, MAX_QUERY_RESULT_KEY_BYTES)
                if key_size is None:
                    return _malformed_result(
                        "response projection contains an invalid or oversized key"
                    )
                encoded_bytes += key_size
                stack.append(child)
        elif type(item) is list:
            item_count = list.__len__(item)
            encoded_bytes += _container_json_syntax_size(item_count, mapping=False)
            stack.extend(list.__getitem__(item, index) for index in range(item_count))
        else:
            if type(item) is str:
                remaining = MAX_QUERY_RESULT_VALUE_BYTES - encoded_bytes
                scalar_size = _json_string_size(item, remaining)
                if scalar_size is None:
                    return _malformed_result(
                        "response exceeds the total JSON-encoded byte limit"
                    )
            else:
                normalized, reason = _normalize_trusted_scalar(item)
                if reason is not None:
                    return _malformed_result(f"response projection {reason}")
                scalar_size = _pydantic_scalar_json_size(normalized)
            encoded_bytes += scalar_size

        if encoded_bytes > MAX_QUERY_RESULT_VALUE_BYTES:
            return _malformed_result(
                "response exceeds the total JSON-encoded byte limit"
            )
    return None


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
