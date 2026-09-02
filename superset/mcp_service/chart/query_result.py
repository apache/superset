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

"""Canonicalize and validate ``ChartDataCommand`` result envelopes."""

import math
import time as system_time
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
import pandas as pd
import pytz
from dateutil import tz as dateutil_tz, zoneinfo as dateutil_zoneinfo
from pydantic import BaseModel
from pydantic_core import to_json

from superset.common.chart_data import ChartDataResultFormat
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

# These are aggregate envelope limits, not per-query allowances. In particular,
# splitting a result across the maximum number of queries must not multiply the
# permitted rows, nodes, or encoded bytes.
MAX_QUERY_RESULTS = 32
MAX_QUERY_RESULT_ROWS_PER_QUERY = 50_000
MAX_QUERY_RESULT_ROWS = 100_000
MAX_QUERY_RESULT_COLUMNS = 4_096
MAX_QUERY_RESULT_VALUES = 2_500_000
MAX_QUERY_RESULT_VALUE_BYTES = 16 * 1024 * 1024
MAX_QUERY_RESULT_METADATA_BYTES = 1024 * 1024
MAX_QUERY_RESULT_METADATA_ITEMS = 32_768
MAX_RESULT_VALUE_ITEMS = 4_096
MAX_RESULT_VALUE_DEPTH = 32
MAX_RESULT_STRING_LENGTH = 65_536
MAX_RESULT_KEY_LENGTH = 4_096
MAX_RESULT_INTEGER_BITS = 4_096
MAX_RESULT_INTEGER_DIGITS = 1_234
MAX_RESULT_DECIMAL_DIGITS = 1_024
MAX_RESULT_DECIMAL_MAGNITUDE = 4_096
MAX_RESULT_DECIMAL_STORAGE = 2_048
MAX_QUERY_RESULT_ROWCOUNT = 2**63 - 1
MAX_QUERY_RESULT_CACHE_TIMEOUT = 2**31 - 1
MAX_QUERY_RESULT_TIMESTAMP_LENGTH = 64

_ERROR_KEYS = ("error", "errors", "error_message", "message", "detail")
_MAX_ERROR_TEXT_BYTES = 2_000
_TRUSTED_TIMEZONE_TYPES = (timezone, ZoneInfo)
_SAFE_RESULT_ENUM_TYPES = frozenset(
    {
        ChartDataResultFormat,
        QueryStatus,
        ExtraFiltersReasonType,
        ExtraFiltersTimeColumnType,
        GenericDataType,
    }
)
_RESULT_FORMAT_VALUES = frozenset(
    object.__getattribute__(member, "_value_") for member in ChartDataResultFormat
)
_COLTYPE_VALUES = frozenset(
    object.__getattribute__(member, "_value_") for member in GenericDataType
)
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
_DATEUTIL_FIXED_TIMEZONE_TYPES = frozenset(
    {type(dateutil_tz.tzoffset(None, 0)), type(dateutil_tz.tzutc())}
)
_DATEUTIL_NAMED_TIMEZONE_TYPES = frozenset(
    {dateutil_tz.tzfile, dateutil_zoneinfo.tzfile}
)
_DATEUTIL_LOCAL_TIMEZONE_TYPE = type(dateutil_tz.tzlocal())
_PYTZ_FIXED_TIMEZONE_TYPES = frozenset({type(pytz.FixedOffset(1))})


@dataclass
class _ResultBudget:
    """Aggregate counters shared by every query and metadata value."""

    rows: int = 0
    values: int = 0
    json_bytes: int = 0
    metadata_items: int = 0
    metadata_bytes: int = 0


def _invalid_result(message: str) -> ChartError:
    return ChartError(
        error=f"Chart query returned {message}.",
        error_type="InvalidQueryResult",
    )


def _invalid_metadata(label: str) -> ChartError:
    return ChartError(
        error=f"{label} returned hostile or malformed metadata.",
        error_type="InvalidQueryResult",
    )


def _safe_enum_value(value: Any, expected: frozenset[type[Any]]) -> Any | None:
    """Read trusted enum storage without invoking public conversion hooks."""
    if type(value) not in expected or type(value) not in _SAFE_RESULT_ENUM_TYPES:
        return None
    return object.__getattribute__(value, "_value_")


def _bounded_utf8_length(value: str, maximum: int) -> int | None:
    """Return the exact UTF-8 size while bounding pre-encoding work."""
    if str.__len__(value) > maximum:
        return None
    try:
        encoded = str.encode(value, "utf-8", errors="strict")
    except UnicodeEncodeError:
        return None
    size = bytes.__len__(encoded)
    return size if size <= maximum else None


def _json_string_size(value: str, maximum: int) -> int | None:
    """Return compact UTF-8 JSON string size without serializing the value."""
    raw_size = _bounded_utf8_length(value, maximum)
    if raw_size is None:
        return None
    escaped_size = raw_size + 2
    for character in value:
        codepoint = ord(character)
        if character in {'"', "\\", "\b", "\t", "\n", "\f", "\r"}:
            escaped_size += 1
        elif codepoint < 0x20:
            escaped_size += 5
    return escaped_size


def _integer_json_size(value: int) -> int:
    """Return exact decimal JSON size without rendering the bounded integer."""
    magnitude = -value if value < 0 else value
    if magnitude == 0:
        digits = 1
    else:
        bits = int.bit_length(magnitude)
        digits = ((bits - 1) * 30103) // 100000 + 1
        if magnitude >= 10**digits:
            digits += 1
    return digits + (value < 0)


def _container_json_syntax_size(item_count: int, *, mapping: bool) -> int:
    """Return braces/brackets plus compact separators and mapping colons."""
    if item_count == 0:
        return 2
    return 2 + item_count - 1 + (item_count if mapping else 0)


def _normalized_scalar_json_size(value: Any) -> int:
    """Return exact compact JSON size for a normalized scalar."""
    value_type = type(value)
    if value is None:
        return 4
    if value_type is bool:
        return 4 if value else 5
    if value_type is str:
        size = _json_string_size(value, MAX_RESULT_STRING_LENGTH)
        assert size is not None
        return size
    if value_type is int:
        return _integer_json_size(value)
    if value_type is float:
        return len(float.__repr__(value))
    if value_type is Decimal:
        # Pydantic serializes Decimal values as JSON strings so their exact
        # finite value survives the wire projection without binary rounding.
        text = Decimal.__str__(value)
        size = _json_string_size(text, MAX_RESULT_STRING_LENGTH)
        assert size is not None
        return size
    raise AssertionError("result scalar was not normalized")


def _pydantic_scalar_json_size(value: Any) -> int:
    """Return the scalar size emitted by Pydantic's JSON serializer."""
    if type(value) is float:
        # pydantic-core uses the shortest exponent (``1e-7``), while Python's
        # repr retains a leading zero (``1e-07``).
        return len(to_json(value))
    return _normalized_scalar_json_size(value)


def _charge_json_bytes(
    budget: _ResultBudget, size: int, *, metadata: bool = False
) -> str | None:
    budget.json_bytes += size
    if budget.json_bytes > MAX_QUERY_RESULT_VALUE_BYTES:
        return "too many aggregate JSON bytes"
    if metadata:
        budget.metadata_bytes += size
        if budget.metadata_bytes > MAX_QUERY_RESULT_METADATA_BYTES:
            return "too many aggregate metadata JSON bytes"
    return None


def _charge_value(budget: _ResultBudget, *, metadata: bool = False) -> str | None:
    budget.values += 1
    if budget.values > MAX_QUERY_RESULT_VALUES:
        return "too many aggregate values"
    if metadata:
        budget.metadata_items += 1
        if budget.metadata_items > MAX_QUERY_RESULT_METADATA_ITEMS:
            return "too many aggregate metadata values"
    return None


def _charge_text(
    value: str,
    budget: _ResultBudget,
    *,
    key: bool = False,
    metadata: bool = False,
) -> str | None:
    maximum = (
        MAX_RESULT_KEY_LENGTH
        if key
        else MAX_QUERY_RESULT_METADATA_BYTES
        if metadata
        else MAX_RESULT_STRING_LENGTH
    )
    size = _json_string_size(value, maximum)
    if size is None:
        return "an invalid or oversized object key" if key else "invalid text data"
    return _charge_json_bytes(budget, size, metadata=metadata)


def _integer_failure(value: int) -> str | None:
    bits = int.bit_length(value)
    if bits > MAX_RESULT_INTEGER_BITS:
        return "an oversized integer"
    digits = 1 if bits == 0 else ((bits - 1) * 30103) // 100000 + 1
    if digits > MAX_RESULT_INTEGER_DIGITS:
        return "an oversized integer"
    return None


def _decimal_failure(value: Decimal) -> str | None:
    if Decimal.__sizeof__(value) > MAX_RESULT_DECIMAL_STORAGE:
        return "an oversized Decimal"
    if not Decimal.is_finite(value):
        return "a non-finite Decimal"
    parts = Decimal.as_tuple(value)
    if tuple.__len__(parts.digits) > MAX_RESULT_DECIMAL_DIGITS:
        return "an oversized Decimal"
    exponent = parts.exponent
    if type(exponent) is not int or abs(exponent) > MAX_RESULT_DECIMAL_MAGNITUDE:
        return "an oversized Decimal"
    return None


def _type_mro(value_type: type[Any]) -> tuple[type[Any], ...]:
    """Read a concrete type's MRO without consulting metaclass overrides."""
    try:
        mro = type.__getattribute__(value_type, "__mro__")
    except (AttributeError, TypeError):  # pragma: no cover - defensive metaclass
        return ()
    return mro if type(mro) is tuple else ()


def _timezone_name_without_hooks(tzinfo: Any) -> str | None:  # noqa: C901
    """Read common pytz/dateutil zone state without dispatching timezone hooks."""
    value_mro = _type_mro(type(tzinfo))
    if any(base is pytz.tzinfo.BaseTzInfo for base in value_mro):
        for base in value_mro:
            try:
                namespace = type.__getattribute__(base, "__dict__")
            except (AttributeError, TypeError):  # pragma: no cover
                continue
            zone = namespace.get("zone")
            if type(zone) is str and _bounded_utf8_length(zone, 256) is not None:
                try:
                    canonical = pytz.timezone(zone)
                except (KeyError, ValueError):
                    return None
                # Generated pytz types are trusted; arbitrary subclasses that
                # inherit their internal fields are not.
                return zone if type(canonical) is type(tzinfo) else None

    if type(tzinfo) not in _DATEUTIL_NAMED_TIMEZONE_TYPES:
        return None

    try:
        namespace = object.__getattribute__(tzinfo, "__dict__")
    except (AttributeError, TypeError):
        return None
    if type(namespace) is not dict:
        return None
    filename = dict.get(namespace, "_filename")
    if type(filename) is not str or _bounded_utf8_length(filename, 4_096) is None:
        return None
    marker = "/zoneinfo/"
    if (offset := str.find(filename, marker)) >= 0:
        name = str.__getitem__(filename, slice(offset + len(marker), None))
    elif not str.startswith(filename, "/") and str.find(filename, "\\") < 0:
        name = filename
    else:
        return None
    parts = str.split(name, "/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        return None
    return name if _bounded_utf8_length(name, 256) is not None else None


def _object_namespace(value: Any) -> dict[str, Any] | None:
    """Read exact instance storage without descriptor dispatch."""
    try:
        namespace = object.__getattribute__(value, "__dict__")
    except (AttributeError, TypeError):
        return None
    return namespace if type(namespace) is dict else None


def _pytz_named_offset_without_hooks(tzinfo: Any) -> timezone | None:
    """Return a localized pytz zone's stored offset without calling hooks."""
    if _timezone_name_without_hooks(tzinfo) is None:
        return None
    namespace = _object_namespace(tzinfo)
    offset = dict.get(namespace, "_utcoffset") if namespace is not None else None
    if type(offset) is not timedelta:
        return None
    try:
        return timezone(offset)
    except ValueError:
        return None


def _dateutil_local_offset_without_hooks(
    value: datetime, tzinfo: Any
) -> timezone | None:
    """Select a dateutil local offset using builtin system-time data."""
    if type(tzinfo) is not _DATEUTIL_LOCAL_TIMEZONE_TYPE:
        return None
    namespace = _object_namespace(tzinfo)
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
        if not is_daylight and is_daylight != previous_is_daylight:
            is_daylight = not bool(value.fold)
        selected_offset = daylight_offset if is_daylight else standard_offset
    try:
        return timezone(selected_offset)
    except ValueError:
        return None


def _canonical_timezone(tzinfo: Any) -> timezone | ZoneInfo | None:  # noqa: C901
    if any(type(tzinfo) is trusted for trusted in _TRUSTED_TIMEZONE_TYPES):
        return tzinfo
    if zone_name := _timezone_name_without_hooks(tzinfo):
        try:
            return ZoneInfo(zone_name)
        except (KeyError, ValueError, ZoneInfoNotFoundError):
            return None
    if type(tzinfo) in _DATEUTIL_FIXED_TIMEZONE_TYPES:
        try:
            namespace = object.__getattribute__(tzinfo, "__dict__")
        except (AttributeError, TypeError):
            return timezone.utc if type(tzinfo) is type(dateutil_tz.tzutc()) else None
        if type(namespace) is not dict:
            return None
        offset = dict.get(namespace, "_offset")
        if type(offset) is not timedelta:
            return timezone.utc if type(tzinfo) is type(dateutil_tz.tzutc()) else None
        if abs(offset) >= timedelta(days=1):
            return None
        return timezone(offset)
    if type(tzinfo) in _PYTZ_FIXED_TIMEZONE_TYPES:
        try:
            namespace = object.__getattribute__(tzinfo, "__dict__")
        except (AttributeError, TypeError):
            return None
        if type(namespace) is not dict:
            return None
        minutes = dict.get(namespace, "_minutes")
        if type(minutes) is not int or not -1_440 < minutes < 1_440:
            return None
        return timezone(timedelta(minutes=minutes))
    return None


def _timestamp_offset_without_hooks(value: pd.Timestamp) -> timezone | None:
    """Recover a timestamp's stored wall-clock offset without timezone hooks."""
    multipliers = {"s": 1_000_000_000, "ms": 1_000_000, "us": 1_000, "ns": 1}
    multiplier = multipliers.get(value.unit)
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


def _canonical_datetime(value: datetime) -> tuple[str | None, str | None]:
    """Serialize an exact datetime through trusted timezone state only."""
    tzinfo = value.tzinfo
    canonical_value = value
    if tzinfo is not None and not any(
        type(tzinfo) is trusted for trusted in _TRUSTED_TIMEZONE_TYPES
    ):
        canonical_tz = (
            _pytz_named_offset_without_hooks(tzinfo)
            or _dateutil_local_offset_without_hooks(value, tzinfo)
            or _canonical_timezone(tzinfo)
        )
        if canonical_tz is None:
            return None, "a datetime with an unsupported timezone"
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
        return None, "an invalid datetime"


def _canonical_time(value: time) -> tuple[str | None, str | None]:
    """Serialize an exact time through trusted timezone state only."""
    tzinfo = value.tzinfo
    canonical_value = value
    if tzinfo is not None and not any(
        type(tzinfo) is trusted for trusted in _TRUSTED_TIMEZONE_TYPES
    ):
        canonical_tz = _canonical_timezone(tzinfo)
        if canonical_tz is None and type(tzinfo) is _DATEUTIL_LOCAL_TIMEZONE_TYPE:
            namespace = _object_namespace(tzinfo)
            if namespace is not None and dict.get(namespace, "_hasdst") is False:
                offset = dict.get(namespace, "_std_offset")
                if type(offset) is timedelta:
                    try:
                        canonical_tz = timezone(offset)
                    except ValueError:
                        canonical_tz = None
        if canonical_tz is None:
            return None, "a time with an unsupported timezone"
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
        return None, "an invalid time"


def _canonical_timestamp(value: pd.Timestamp) -> tuple[str | None, str | None]:
    """Preserve a trusted timestamp's instant, offset, nanoseconds, and fold."""
    try:
        tzinfo = value.tzinfo
        if tzinfo is not None and not any(
            type(tzinfo) is trusted for trusted in _TRUSTED_TIMEZONE_TYPES
        ):
            if (
                _canonical_timezone(tzinfo) is None
                and type(tzinfo) is not _DATEUTIL_LOCAL_TIMEZONE_TYPE
            ):
                return None, "a timestamp with an unsupported timezone"
            canonical_tz = _timestamp_offset_without_hooks(value)
            if canonical_tz is None:
                return None, "an invalid timestamp"
            raw_value = value.asm8.view("i8")
            value = pd.Timestamp(raw_value, unit=value.unit, tz="UTC").tz_convert(
                canonical_tz
            )
        return pd.Timestamp.isoformat(value), None
    except (KeyError, OverflowError, TypeError, ValueError):
        return None, "an invalid timestamp"


def _normalize_scalar(value: Any) -> tuple[Any, str | None]:  # noqa: C901
    """Convert one exact trusted producer scalar to a JSON-safe scalar."""
    value_type = type(value)
    if value is None or value_type is bool or value_type is str:
        return value, None
    if value_type is int:
        return value, _integer_failure(value)
    if value_type is float:
        if math.isnan(value):
            return None, None
        return (value, None) if math.isfinite(value) else (None, "a non-finite number")
    if value_type is Decimal:
        return value, _decimal_failure(value)
    if value_type is datetime:
        return _canonical_datetime(value)
    if value_type is time:
        return _canonical_time(value)
    if value_type is date:
        return date.isoformat(value), None
    if value_type is timedelta:
        try:
            return pd.Timedelta(value).isoformat(), None
        except (OverflowError, TypeError, ValueError):
            return None, "an invalid duration"
    if value_type is UUID:
        return UUID.__str__(value), None

    if value_type is _PANDAS_NAT_TYPE or value_type is _PANDAS_NA_TYPE:
        return None, None
    if value_type is pd.Timestamp:
        return _canonical_timestamp(value)
    if value_type is pd.Timedelta:
        if pd.isna(value):
            return None, None
        try:
            return pd.Timedelta.isoformat(value), None
        except (OverflowError, TypeError, ValueError):
            return None, "an invalid pandas duration"
    if value_type is _PANDAS_PERIOD_TYPE or value_type is _PANDAS_INTERVAL_TYPE:
        # These concrete immutable pandas extension scalars are trusted. Exact
        # type checks deliberately exclude subclasses with conversion hooks.
        try:
            normalized_text = str(value)
        except (OverflowError, TypeError, ValueError):
            return None, "an invalid pandas scalar"
        if _bounded_utf8_length(normalized_text, MAX_RESULT_STRING_LENGTH) is None:
            return None, "an oversized pandas scalar"
        return normalized_text, None
    if value_type in _NUMPY_INTEGER_TYPES:
        normalized = int(value)
        return normalized, _integer_failure(normalized)
    if value_type in _NUMPY_FLOAT_TYPES:
        normalized_float = float(value)
        if math.isnan(normalized_float):
            return None, None
        return (
            (normalized_float, None)
            if math.isfinite(normalized_float)
            else (None, "a non-finite NumPy number")
        )
    if value_type is np.bool_:
        return bool(value), None
    if value_type is np.str_:
        return str(value), None
    if value_type is np.datetime64:
        if np.isnat(value):
            return None, None
        try:
            return _canonical_timestamp(pd.Timestamp(value))
        except (OverflowError, TypeError, ValueError):
            return None, "an invalid NumPy timestamp"
    if value_type is np.timedelta64:
        if np.isnat(value):
            return None, None
        try:
            return pd.Timedelta(value).isoformat(), None
        except (OverflowError, TypeError, ValueError):
            return None, "an invalid NumPy duration"
    return None, "an unsupported or subclassed value"


def _normalize_value(  # noqa: C901
    value: Any,
    budget: _ResultBudget,
    *,
    enum_types: frozenset[type[Any]] = frozenset(),
    metadata: bool = False,
) -> tuple[Any, str | None]:
    """Iteratively normalize one bounded exact-container value tree."""
    stack: list[
        tuple[Any, list[Any] | dict[str, Any] | None, int | str | None, int, bool]
    ] = [(value, None, None, 0, False)]
    active_containers: set[int] = set()
    root = value

    while stack:
        item, parent, slot, depth, leaving = stack.pop()
        if leaving:
            active_containers.remove(id(item))
            continue
        if depth > MAX_RESULT_VALUE_DEPTH:
            return None, "excessively nested data"
        if reason := _charge_value(budget, metadata=metadata):
            return None, reason

        if type(item) is list:
            identity = id(item)
            if identity in active_containers:
                return None, "cyclic containers"
            active_containers.add(identity)
            width = list.__len__(item)
            if width > MAX_RESULT_VALUE_ITEMS:
                return None, "an oversized array"
            if reason := _charge_json_bytes(
                budget,
                _container_json_syntax_size(width, mapping=False),
                metadata=metadata,
            ):
                return None, reason
            stack.append((item, None, None, depth, True))
            stack.extend(
                (list.__getitem__(item, index), item, index, depth + 1, False)
                for index in range(width - 1, -1, -1)
            )
            continue

        if type(item) is dict:
            identity = id(item)
            if identity in active_containers:
                return None, "cyclic containers"
            active_containers.add(identity)
            width = dict.__len__(item)
            if width > MAX_RESULT_VALUE_ITEMS:
                return None, "an oversized object"
            if reason := _charge_json_bytes(
                budget,
                _container_json_syntax_size(width, mapping=True),
                metadata=metadata,
            ):
                return None, reason
            children: list[tuple[Any, dict[str, Any], str, int, bool]] = []
            for key, child in dict.items(item):
                if type(key) is not str:
                    return None, "a non-string object key"
                if reason := _charge_text(key, budget, key=True, metadata=metadata):
                    return None, reason
                children.append((child, item, key, depth + 1, False))
            stack.append((item, None, None, depth, True))
            stack.extend(reversed(children))
            continue

        source_item = item
        if type(item) in enum_types:
            normalized = _safe_enum_value(item, enum_types)
            if normalized is None:
                return None, "an unsupported enum"
            item = normalized
        elif any(base is Enum for base in _type_mro(type(item))):
            return None, "an enum outside its expected metadata slot"

        normalized, reason = _normalize_scalar(item)
        if reason is not None:
            return None, reason
        max_string_bytes = (
            MAX_QUERY_RESULT_METADATA_BYTES if metadata else MAX_RESULT_STRING_LENGTH
        )
        if type(normalized) is str:
            scalar_size = _json_string_size(normalized, max_string_bytes)
            if scalar_size is None:
                return None, "invalid text data"
        else:
            scalar_size = _normalized_scalar_json_size(normalized)
        if reason := _charge_json_bytes(
            budget,
            scalar_size,
            metadata=metadata,
        ):
            return None, reason
        if parent is None:
            root = normalized
        elif normalized is not source_item:
            if type(parent) is list:
                assert type(slot) is int
                list.__setitem__(parent, slot, normalized)
            else:
                assert type(parent) is dict
                assert type(slot) is str
                dict.__setitem__(parent, slot, normalized)
    return root, None


def _normalize_metadata_value(
    payload: dict[str, Any], key: str, budget: _ResultBudget
) -> str | None:
    enum_slots: dict[str, frozenset[type[Any]]] = {
        "status": frozenset({QueryStatus}),
        "result_format": frozenset({ChartDataResultFormat}),
        "coltypes": frozenset({GenericDataType}),
        "applied_filters": frozenset({ExtraFiltersTimeColumnType}),
        "rejected_filters": frozenset(
            {ExtraFiltersReasonType, ExtraFiltersTimeColumnType}
        ),
    }
    value = dict.__getitem__(payload, key)
    normalized, reason = _normalize_value(
        value,
        budget,
        enum_types=enum_slots.get(key, frozenset()),
        metadata=True,
    )
    if reason is None and normalized is not value:
        dict.__setitem__(payload, key, normalized)
    return reason


def _error_text(value: Any) -> str | None:
    """Extract a bounded error from an already validated primitive tree."""
    stack: list[Any] = [value]
    parts: list[str] = []
    used = 0
    while stack and len(parts) < 3 and used < _MAX_ERROR_TEXT_BYTES:
        item = stack.pop()
        if type(item) is dict:
            stack.extend(
                reversed(
                    [dict.__getitem__(item, key) for key in _ERROR_KEYS if key in item]
                )
            )
            continue
        if type(item) is list:
            stack.extend(
                list.__getitem__(item, index)
                for index in range(list.__len__(item) - 1, -1, -1)
            )
            continue
        if item is None or item is False:
            continue
        if type(item) is str:
            remaining = _MAX_ERROR_TEXT_BYTES - used - (2 if parts else 0)
            encoded = str.encode(item, "utf-8")[:remaining]
            text = bytes.decode(encoded, "utf-8", errors="ignore")
            if text:
                parts.append(text)
                used += bytes.__len__(encoded) + (2 if len(parts) > 1 else 0)
    return "; ".join(parts) or None


def _failure_for_payload(payload: dict[str, Any], label: str) -> ChartError | None:
    for key in ("error", "errors", "error_message"):
        if key in payload and (message := _error_text(dict.__getitem__(payload, key))):
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = dict.get(payload, "status")
    status = raw_status if type(raw_status) is str else ""
    normalized_status = status.strip().casefold().replace("-", "_").replace(" ", "_")
    if normalized_status in FAILED_QUERY_STATUSES:
        message = (
            _error_text(dict.get(payload, "message"))
            or _error_text(dict.get(payload, "error_message"))
            or normalized_status
        )
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if dict.get(payload, "success") is False:
        message = _error_text(dict.get(payload, "message")) or "request failed"
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if raw_status is None and "data" not in payload and "queries" not in payload:
        if message := _error_text(dict.get(payload, "message")):
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )
    return None


def _metadata_shape_error(  # noqa: C901
    payload: dict[str, Any], label: str, budget: _ResultBudget
) -> ChartError | None:
    if "success" in payload and type(dict.__getitem__(payload, "success")) is not bool:
        return _invalid_metadata(label)
    if "status" in payload and type(dict.__getitem__(payload, "status")) is not str:
        return _invalid_metadata(label)
    if (
        "result_format" in payload
        and dict.__getitem__(payload, "result_format") not in _RESULT_FORMAT_VALUES
    ):
        return _invalid_metadata(label)
    for count_key in ("rowcount", "sql_rowcount", "total_rows"):
        if count_key in payload:
            count = dict.__getitem__(payload, count_key)
            if count is not None and not (
                type(count) is int and 0 <= count <= MAX_QUERY_RESULT_ROWCOUNT
            ):
                return _invalid_metadata(label)
    if "is_cached" in payload:
        cached = dict.__getitem__(payload, "is_cached")
        if cached is None:
            if reason := _charge_json_bytes(
                budget, 1, metadata=True
            ):  # ``false`` vs ``null``
                return _invalid_result(reason)
            dict.__setitem__(payload, "is_cached", False)
        elif type(cached) is not bool:
            return _invalid_metadata(label)
    if "cache_timeout" in payload:
        timeout = dict.__getitem__(payload, "cache_timeout")
        if timeout is not None and not (
            type(timeout) is int and 0 <= timeout <= MAX_QUERY_RESULT_CACHE_TIMEOUT
        ):
            return _invalid_metadata(label)
    if "cache_key" in payload:
        cache_key = dict.__getitem__(payload, "cache_key")
        if cache_key is not None and (type(cache_key) is not str or not cache_key):
            return _invalid_metadata(label)
    for timestamp_key in ("cached_dttm", "cache_dttm", "queried_dttm"):
        if timestamp_key not in payload:
            continue
        timestamp = dict.__getitem__(payload, timestamp_key)
        if timestamp is None:
            continue
        if (
            type(timestamp) is not str
            or not timestamp
            or len(timestamp) > MAX_QUERY_RESULT_TIMESTAMP_LENGTH
        ):
            return _invalid_metadata(label)
        normalized = f"{timestamp[:-1]}+00:00" if timestamp.endswith("Z") else timestamp
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return _invalid_metadata(label)
        if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
            return _invalid_metadata(label)
        canonical_timestamp = parsed.astimezone(timezone.utc).isoformat()
        original_size = _json_string_size(timestamp, MAX_RESULT_STRING_LENGTH)
        canonical_size = _json_string_size(
            canonical_timestamp, MAX_RESULT_STRING_LENGTH
        )
        assert original_size is not None
        assert canonical_size is not None
        if canonical_size > original_size and (
            reason := _charge_json_bytes(
                budget, canonical_size - original_size, metadata=True
            )
        ):
            return _invalid_result(reason)
        dict.__setitem__(payload, timestamp_key, canonical_timestamp)
    return None


def _filter_metadata_is_valid(value: Any, *, rejected: bool) -> bool:
    if type(value) is not list or list.__len__(value) > MAX_RESULT_VALUE_ITEMS:
        return False
    expected = {"column", "reason"} if rejected else {"column"}
    for entry in value:
        if type(entry) is not dict or set(dict.keys(entry)) != expected:
            return False
        if type(dict.__getitem__(entry, "column")) is not str:
            return False
        if rejected and type(dict.__getitem__(entry, "reason")) is not str:
            return False
    return True


def _validate_query_metadata(query: dict[str, Any], index: int) -> ChartError | None:
    label = f"Chart query {index}"
    colnames_present = "colnames" in query
    coltypes_present = "coltypes" in query
    colnames = dict.get(query, "colnames", [])
    coltypes = dict.get(query, "coltypes", [])
    if (
        type(colnames) is not list
        or list.__len__(colnames) > MAX_QUERY_RESULT_COLUMNS
        or any(type(column) is not str or not column for column in colnames)
        or len(set(colnames)) != len(colnames)
    ):
        return _invalid_result(f"malformed column metadata for query {index}")
    if (
        type(coltypes) is not list
        or list.__len__(coltypes) > MAX_QUERY_RESULT_COLUMNS
        or any(
            type(value) is not int or value not in _COLTYPE_VALUES for value in coltypes
        )
    ):
        return _invalid_result(f"malformed column type metadata for query {index}")
    if (colnames_present or coltypes_present) and (
        not colnames_present
        or not coltypes_present
        or list.__len__(colnames) != list.__len__(coltypes)
    ):
        return _invalid_result(f"misaligned column metadata for query {index}")
    if "applied_filters" in query and not _filter_metadata_is_valid(
        dict.__getitem__(query, "applied_filters"), rejected=False
    ):
        return _invalid_metadata(label)
    if "rejected_filters" in query and not _filter_metadata_is_valid(
        dict.__getitem__(query, "rejected_filters"), rejected=True
    ):
        return _invalid_metadata(label)
    if "rejected_filter_columns" in query:
        rejected_columns = dict.__getitem__(query, "rejected_filter_columns")
        if type(rejected_columns) is not list or any(
            type(column) is not str for column in rejected_columns
        ):
            return _invalid_metadata(label)
    return None


def validate_query_result_envelope(  # noqa: C901
    result: Any, *, none_as_empty: bool = False
) -> ChartError | None:
    """Canonicalize and strictly validate one real command result in place.

    ``ChartDataCommand.run`` adds a live ``query_context`` sidecar. It is
    intentionally exempted without access or traversal: MCP consumers only use
    the wire query payload, and inspecting the sidecar would cross arbitrary
    datasource/query hooks. Every wire value is charged against one aggregate
    row/node/UTF-8 budget shared by all queries.
    """
    if type(result) is not dict:
        return _invalid_result("a malformed result envelope")

    budget = _ResultBudget()
    if reason := _charge_value(budget, metadata=True):
        return _invalid_result(reason)
    top_level_keys = list(dict.keys(result))
    if any(type(key) is not str for key in top_level_keys):
        return _invalid_metadata("Chart query")
    has_query_context = any(key == "query_context" for key in top_level_keys)
    wire_item_count = dict.__len__(result) - has_query_context
    if reason := _charge_json_bytes(
        budget,
        _container_json_syntax_size(wire_item_count, mapping=True),
        metadata=True,
    ):
        return _invalid_result(reason)
    for key in top_level_keys:
        if key == "query_context":
            continue
        if reason := _charge_text(key, budget, key=True, metadata=True):
            return _invalid_result(reason)
        if key == "queries":
            continue
        if reason := _normalize_metadata_value(result, key, budget):
            return _invalid_metadata("Chart query")

    if error := _metadata_shape_error(result, "Chart query", budget):
        return error
    if failure := _failure_for_payload(result, "Chart query"):
        return failure
    if not dict.__contains__(result, "queries"):
        return _invalid_result("no query result envelope")
    queries = dict.__getitem__(result, "queries")
    if type(queries) is not list or not queries:
        return _invalid_result("no query result envelope")
    if list.__len__(queries) > MAX_QUERY_RESULTS:
        return _invalid_result("too many query result envelopes")
    if reason := _charge_value(budget):
        return _invalid_result(reason)
    if reason := _charge_json_bytes(
        budget,
        _container_json_syntax_size(list.__len__(queries), mapping=False),
    ):
        return _invalid_result(reason)

    for offset in range(list.__len__(queries)):
        index = offset + 1
        query = list.__getitem__(queries, offset)
        if type(query) is not dict:
            return _invalid_result(f"a malformed query {index} result envelope")
        if reason := _charge_value(budget):
            return _invalid_result(reason)
        if reason := _charge_json_bytes(
            budget,
            _container_json_syntax_size(dict.__len__(query), mapping=True),
            metadata=True,
        ):
            return _invalid_result(reason)
        for key in list(dict.keys(query)):
            if type(key) is not str:
                return _invalid_metadata(f"Chart query {index}")
            if reason := _charge_text(key, budget, key=True, metadata=True):
                return _invalid_result(reason)
            if key == "data":
                continue
            if reason := _normalize_metadata_value(query, key, budget):
                return _invalid_metadata(f"Chart query {index}")

        if error := _metadata_shape_error(query, f"Chart query {index}", budget):
            return error
        if failure := _failure_for_payload(query, f"Chart query {index}"):
            return failure
        if not dict.__contains__(query, "data"):
            return _invalid_result(f"query {index} result data is not an array of rows")
        data = dict.__getitem__(query, "data")
        if data is None and none_as_empty:
            data = []
            dict.__setitem__(query, "data", data)
        if type(data) is not list:
            return _invalid_result(f"query {index} result data is not an array of rows")
        data_length = list.__len__(data)
        if data_length > MAX_QUERY_RESULT_ROWS_PER_QUERY:
            return _invalid_result(f"too many rows for query {index}")
        budget.rows += data_length
        if budget.rows > MAX_QUERY_RESULT_ROWS:
            return _invalid_result("too many aggregate rows")
        if reason := _charge_value(budget):
            return _invalid_result(reason)
        if reason := _charge_json_bytes(
            budget, _container_json_syntax_size(data_length, mapping=False)
        ):
            return _invalid_result(reason)

        if error := _validate_query_metadata(query, index):
            return error
        declared_columns = (
            dict.__getitem__(query, "colnames") if "colnames" in query else None
        )

        # Check declared order in the same capped pass that normalizes cells.
        # A width mismatch fails before comparing names, so empty rows cannot
        # multiply work by the maximum declared column count.
        for row_offset in range(data_length):
            row = list.__getitem__(data, row_offset)
            if type(row) is not dict or dict.__len__(row) > MAX_QUERY_RESULT_COLUMNS:
                return _invalid_result(f"a malformed data row for query {index}")
            if reason := _charge_value(budget):
                return _invalid_result(reason)
            row_items = list(dict.items(row))
            if reason := _charge_json_bytes(
                budget,
                _container_json_syntax_size(list.__len__(row_items), mapping=True),
            ):
                return _invalid_result(reason)
            if declared_columns is not None and list.__len__(row_items) != list.__len__(
                declared_columns
            ):
                return ChartError(
                    error=(
                        f"Chart query {index} returned rows that do not match the "
                        "declared column order."
                    ),
                    error_type="InvalidQueryResult",
                )
            for column_offset, (column, value) in enumerate(row_items):
                if type(column) is not str:
                    return _invalid_result(
                        f"hostile or oversized row data for query {index}"
                    )
                if declared_columns is not None and column != list.__getitem__(
                    declared_columns, column_offset
                ):
                    return ChartError(
                        error=(
                            f"Chart query {index} returned rows that do not match "
                            "the declared column order."
                        ),
                        error_type="InvalidQueryResult",
                    )
                if reason := _charge_text(column, budget, key=True):
                    return _invalid_result(reason)
                normalized, reason = _normalize_value(value, budget)
                if reason is not None:
                    return _invalid_result(
                        f"hostile or oversized row data for query {index}: {reason}"
                    )
                if normalized is not value:
                    dict.__setitem__(row, column, normalized)

    return None


def query_result_failure(result: Any) -> ChartError | None:
    """Return an embedded failure or malformed-envelope error."""
    return validate_query_result_envelope(result)


def first_query_data(
    result: Any, *, none_as_empty: bool = False
) -> tuple[list[Any] | None, ChartError | None]:
    """Validate the full result and return its first canonical data array.

    ``none_as_empty`` preserves generic saved-preview behavior. Sunburst calls
    this with the strict default so hierarchy input can never silently become an
    empty visualization.
    """
    if failure := validate_query_result_envelope(result, none_as_empty=none_as_empty):
        return None, failure
    queries = dict.__getitem__(result, "queries")
    first_query = list.__getitem__(queries, 0)
    return dict.__getitem__(first_query, "data"), None


def response_json_failure(response: BaseModel) -> ChartError | None:  # noqa: C901
    """Bound the complete compact Pydantic response before serialization.

    Response models duplicate some source values in column samples and query
    compatibility fields, and exports add derived SQL/CSV/Excel strings. Those
    strings are limited only by the aggregate response budget, not the source
    cell string cap.
    """
    try:
        # ``mode="json"`` is the same value projection used by
        # ``model_dump_json``. In particular, UTC datetimes become ``Z`` rather
        # than the ``+00:00`` text produced by the Python-mode normalizer.
        payload = BaseModel.model_dump(response, mode="json", by_alias=True)
    except Exception:
        return _invalid_result("an uninspectable response projection")

    stack: list[tuple[str, Any]] = [("value", payload)]
    active_containers: set[int] = set()
    encoded_bytes = 0
    inspected_values = 0
    while stack:
        action, item = stack.pop()
        if action == "leave":
            active_containers.remove(id(item))
            continue
        inspected_values += 1
        if inspected_values > 3 * MAX_QUERY_RESULT_VALUES:
            return _invalid_result("a response projection exceeding the work limit")

        if type(item) is dict:
            identity = id(item)
            if identity in active_containers:
                return _invalid_result("a cyclic response projection")
            active_containers.add(identity)
            width = dict.__len__(item)
            encoded_bytes += _container_json_syntax_size(width, mapping=True)
            stack.append(("leave", item))
            children: list[tuple[str, Any]] = []
            for key, child in dict.items(item):
                if type(key) is not str:
                    return _invalid_result("a response with a non-string object key")
                key_size = _json_string_size(key, MAX_RESULT_KEY_LENGTH)
                if key_size is None:
                    return _invalid_result("an invalid or oversized response key")
                encoded_bytes += key_size
                children.append(("value", child))
            stack.extend(reversed(children))
        elif type(item) is list:
            identity = id(item)
            if identity in active_containers:
                return _invalid_result("a cyclic response projection")
            active_containers.add(identity)
            width = list.__len__(item)
            encoded_bytes += _container_json_syntax_size(width, mapping=False)
            stack.append(("leave", item))
            stack.extend(
                ("value", list.__getitem__(item, index))
                for index in range(width - 1, -1, -1)
            )
        elif type(item) is str:
            remaining = MAX_QUERY_RESULT_VALUE_BYTES - encoded_bytes
            scalar_size = _json_string_size(item, remaining)
            if scalar_size is None:
                return _invalid_result(
                    "a response exceeding the aggregate JSON byte limit"
                )
            encoded_bytes += scalar_size
        else:
            normalized, reason = _normalize_scalar(item)
            if reason is not None:
                return _invalid_result(f"a response projection containing {reason}")
            if type(normalized) is str:
                remaining = MAX_QUERY_RESULT_VALUE_BYTES - encoded_bytes
                scalar_size = _json_string_size(normalized, remaining)
                if scalar_size is None:
                    return _invalid_result(
                        "a response exceeding the aggregate JSON byte limit"
                    )
            else:
                scalar_size = _pydantic_scalar_json_size(normalized)
            encoded_bytes += scalar_size

        if encoded_bytes > MAX_QUERY_RESULT_VALUE_BYTES:
            return _invalid_result("a response exceeding the aggregate JSON byte limit")
    return None
