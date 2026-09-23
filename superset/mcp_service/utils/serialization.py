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

"""JSON-safety helpers for MCP response schemas.

FastMCP serialises every tool return value with
``pydantic_core.to_json(value, fallback=str)``. The ``fallback`` only fires for
types pydantic does not recognise, so values that *are* recognised but cannot
be rendered as JSON raise ``PydanticSerializationError`` and abort the whole
tool call — after the warehouse query already succeeded. Warehouse result sets
routinely carry such values:

* ``bytes`` from ``BLOB``/``BYTEA``/``VARBINARY`` columns that are not valid
  UTF-8 (``invalid utf-8 sequence of 1 bytes from index N``);
* ``pandas.NaT`` for a null timestamp — a ``datetime`` subclass backed by a
  float, which pydantic tries to render as a datetime
  (``TypeError: 'float' object cannot be interpreted as an integer``);
* ``float`` NaN/Infinity, which serialise to the non-standard JSON literals
  ``NaN``/``Infinity`` that strict JSON clients reject;
* ``str`` holding lone surrogates, produced by drivers decoding with
  ``surrogatepass`` (``surrogates not allowed``).

Row counts are a second failure source: a DBAPI cursor may report ``rowcount``
as a ``float``, which fails validation of an ``int`` field before serialisation
is even reached.

Finite Decimals are preserved exactly and therefore render as JSON strings in
Pydantic, uniformly even when a value is representable as a float. Converting
``Decimal("0.10000000000000000001")`` to a float silently collapses its precision
to ``0.1``. Non-finite Decimals (including signaling NaN) render as JSON ``null``.

The annotated types exported here (:data:`JsonSafeRows`,
:data:`JsonSafeValues`, :data:`JsonSafeMapping`, :data:`RowCount`,
:data:`OptionalRowCount`) attach the coercion as a ``BeforeValidator``, so any
response schema that uses them is protected at construction time. Prefer them
over per-field validators so new data-bearing tools inherit the protection.
"""

from __future__ import annotations

import base64
import math
from collections.abc import Mapping
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import numpy as np
import pandas as pd
from pydantic import BeforeValidator

from superset.utils.json import base_json_conv

# Undecodable binary is returned base64-encoded behind this marker. Base64 is
# lossless and always valid UTF-8; decoding with a lenient codec instead (e.g.
# UTF-16) can emit lone surrogates, which is a second way to break the
# serializer.
BINARY_PREFIX = "base64:"

# Values nested deeper than this (a cyclic or pathologically nested JSON
# column) are rendered as text rather than walked.
MAX_DEPTH = 20

# Types pydantic renders natively and that never need rewriting.
_PASSTHROUGH_TYPES = (datetime, date, time, timedelta, UUID)

# Marks a value the scalar pass did not handle; ``None`` is a real result.
_UNHANDLED = object()


def _decode_binary(value: bytes | bytearray | memoryview) -> str:
    """Render binary column data as a JSON-safe string."""
    raw = bytes(value)
    try:
        return _sanitize_str(raw.decode("utf-8"))
    except UnicodeDecodeError:
        return BINARY_PREFIX + base64.b64encode(raw).decode("ascii")


def _sanitize_str(value: str) -> str:
    """Replace lone surrogates, which cannot be encoded as UTF-8."""
    if value.isascii():
        return value
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        return value.encode("utf-8", "replace").decode("utf-8")
    return value


def is_missing_value(value: Any) -> bool:
    """True when a result value is null-like: ``None``, NaN, ``pandas.NaT``,
    ``pandas.NA`` or ``numpy`` NaT.

    Use this instead of ``value is None`` when summarising result data, so a
    column full of NaN is not reported as having no nulls. This is exactly the
    set of values :func:`sanitize_json_value` renders as JSON ``null``, so a
    null count derived from it agrees with the payload.

    ``pandas.isna`` returns an array for array-likes, so only a scalar boolean
    result counts as missing.
    """
    if value is None:
        return True
    if isinstance(value, Decimal):
        return not Decimal.is_finite(value)
    if isinstance(value, (float, np.floating)):
        # NaN and the infinities, at every numpy width.
        return not math.isfinite(value)
    if isinstance(value, str):
        return False
    try:
        missing = pd.isna(value)
    except (TypeError, ValueError):
        return False
    return missing is True or (isinstance(missing, np.bool_) and bool(missing))


def _sanitize_scalar(value: Any) -> Any:
    """Sanitize a leaf value, or return :data:`_UNHANDLED` when ``value`` needs
    the slower container/conversion path."""
    if value is None or value is True or value is False:
        return value
    if isinstance(value, str):
        return _sanitize_str(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        # Covers numpy.float64 (a float subclass) and NaN/Infinity.
        return float(value) if math.isfinite(value) else None
    if isinstance(value, Decimal):
        # Call the base descriptor, not subclass hooks or float conversion.
        return value if Decimal.is_finite(value) else None
    if isinstance(value, (bytes, bytearray, memoryview)):
        return _decode_binary(value)
    return _UNHANDLED


def _sanitize_other(value: Any, depth: int) -> Any:
    """Sanitize containers and the long tail of warehouse value types."""
    if isinstance(value, Mapping):
        return {
            _sanitize_str(key if isinstance(key, str) else str(key)): (
                sanitize_json_value(item, depth + 1)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set, frozenset)):
        return [sanitize_json_value(item, depth + 1) for item in value]
    # ``pandas.NaT`` is a ``datetime`` subclass, so the missing-value check has
    # to run before the passthrough types.
    if is_missing_value(value):
        return None
    if isinstance(value, np.generic):
        # Every numpy scalar width, not just the few base_json_conv knows.
        return sanitize_json_value(value.item(), depth + 1)
    if isinstance(value, _PASSTHROUGH_TYPES):
        return value
    try:
        # Normalises ndarrays, sets and similar; the result may itself
        # be a container or string that needs another pass. Recursion is bounded
        # by MAX_DEPTH.
        converted = base_json_conv(value)
    except TypeError:
        # Unknown to Superset too. Render it as text rather than leaving it for
        # FastMCP's ``fallback=str``, which the structured-content path
        # (``to_jsonable_python``) does not apply.
        return _sanitize_str(str(value))
    return sanitize_json_value(converted, depth + 1)


def sanitize_json_value(value: Any, depth: int = 0) -> Any:
    """Return ``value`` with anything ``pydantic_core.to_json`` cannot encode
    replaced by a JSON-safe equivalent."""
    if (sanitized := _sanitize_scalar(value)) is not _UNHANDLED:
        return sanitized
    if depth >= MAX_DEPTH:
        return _sanitize_str(str(value))
    return _sanitize_other(value, depth)


def sanitize_mapping(value: Any) -> Any:
    """Sanitize a mapping, leaving non-mapping input to pydantic."""
    if not isinstance(value, Mapping):
        return value
    return sanitize_json_value(value)


def coerce_optional_int(value: Any) -> Any:
    """Coerce an engine-reported count to ``int``, or ``None`` when it is not
    a usable count (e.g. a boolean or ``NaN``)."""
    if isinstance(value, (bool, np.bool_)):
        return None
    if value is None or isinstance(value, int):
        return value
    try:
        coerced = int(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return coerced


def coerce_int(value: Any) -> Any:
    """Like :func:`coerce_optional_int` but yields ``0`` instead of ``None``,
    for count fields that are not nullable. A count the engine did not report
    therefore reads as ``0``; callers needing the true size of a result should
    measure the rows themselves."""
    coerced = coerce_optional_int(value)
    return 0 if coerced is None else coerced


#: A mapping of arbitrary values drawn from result data (e.g. column stats).
JsonSafeMapping = Annotated[dict[str, Any], BeforeValidator(sanitize_mapping)]
#: Result rows, sanitized element by element after pydantic coerces the iterable.
JsonSafeRows = list[JsonSafeMapping]
#: Column samples, sanitized after pydantic coerces the iterable to a list.
JsonSafeValues = list[Annotated[Any, BeforeValidator(sanitize_json_value)]]
#: A non-nullable row count reported by the query engine.
RowCount = Annotated[int, BeforeValidator(coerce_int)]
#: A nullable row count reported by the query engine.
OptionalRowCount = Annotated[int | None, BeforeValidator(coerce_optional_int)]
