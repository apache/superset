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

"""Unit tests for the MCP JSON-safety helpers."""

from __future__ import annotations

import base64
from collections import deque, UserDict
from collections.abc import Callable
from decimal import Decimal
from types import MappingProxyType
from typing import Any
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
from fastmcp.tools.base import default_serializer
from pydantic import BaseModel, TypeAdapter, ValidationError
from pydantic_core import to_json, to_jsonable_python

from superset.mcp_service.utils.serialization import (
    BINARY_PREFIX,
    coerce_int,
    coerce_optional_int,
    is_missing_value,
    JsonSafeMapping,
    JsonSafeRows,
    JsonSafeValues,
    MAX_DEPTH,
    OptionalRowCount,
    RowCount,
    sanitize_json_value,
    sanitize_mapping,
)
from superset.utils.json import loads as json_loads


def test_utf8_bytes_decode_to_text() -> None:
    assert sanitize_json_value(b"hello") == "hello"


def test_non_utf8_bytes_become_base64() -> None:
    raw = b"\xff\xfe\x00\x01"
    assert sanitize_json_value(raw) == BINARY_PREFIX + base64.b64encode(raw).decode()


@pytest.mark.parametrize("value", [bytearray(b"\x80\x81"), memoryview(b"\x80\x81")])
def test_bytearray_and_memoryview_are_handled(value: Any) -> None:
    """``bytes`` is not the only binary type a DBAPI driver returns."""
    assert (
        sanitize_json_value(value)
        == BINARY_PREFIX + base64.b64encode(b"\x80\x81").decode()
    )


@pytest.mark.parametrize(
    "value", [pd.NaT, np.datetime64("NaT"), float("nan"), np.nan, pd.NA]
)
def test_missing_values_become_null(value: Any) -> None:
    """``pandas.NaT`` is a ``datetime`` subclass backed by a float; pydantic
    tries to render it as a datetime and raises ``TypeError: 'float' object
    cannot be interpreted as an integer``."""
    assert sanitize_json_value(value) is None


@pytest.mark.parametrize("value", [float("inf"), float("-inf")])
def test_infinities_become_null(value: float) -> None:
    """``Infinity`` is not valid JSON, so strict clients reject it."""
    assert sanitize_json_value(value) is None


def test_lone_surrogates_are_replaced() -> None:
    """Drivers decoding with ``surrogatepass`` produce strings that cannot be
    encoded back to UTF-8."""
    value = b"\xed\xa0\xbd".decode("utf-8", "surrogatepass")
    sanitized = sanitize_json_value(value)
    assert sanitized.encode("utf-8")  # no UnicodeEncodeError
    assert "\ud83d" not in sanitized


def test_ordinary_scalars_pass_through() -> None:
    assert sanitize_json_value("abc") == "abc"
    assert sanitize_json_value(7) == 7
    assert sanitize_json_value(True) is True
    assert sanitize_json_value(1.5) == 1.5
    assert sanitize_json_value(None) is None


@pytest.mark.parametrize(
    "value,expected",
    [
        (np.int64(3), 3),
        (np.int32(3), 3),
        (np.int8(3), 3),
        (np.uint16(3), 3),
        (np.float64(1.5), 1.5),
        (np.float32(1.5), 1.5),
        (np.bool_(True), True),
    ],
)
def test_numpy_scalars_of_every_width_are_normalised(value: Any, expected: Any) -> None:
    """Rendering a numpy scalar as text would silently turn numbers into
    strings for the caller."""
    sanitized = sanitize_json_value(value)
    assert sanitized == expected
    assert isinstance(sanitized, type(expected))


@pytest.mark.parametrize("value", [np.float32("inf"), np.float64("-inf")])
def test_non_finite_numpy_floats_become_null(value: Any) -> None:
    assert sanitize_json_value(value) is None


def test_numpy_arrays_become_lists() -> None:
    assert sanitize_json_value(np.array([1, 2])) == [1, 2]


@pytest.mark.parametrize("text", ["0.10000000000000000001", "0.1", "0.5", "19.99", "1"])
def test_finite_decimal_is_preserved_as_an_exact_json_string(text: str) -> None:
    """Every finite Decimal retains its digits and a uniform string wire type."""

    class Response(BaseModel):
        """Exercise each shared data-bearing response annotation."""

        rows: JsonSafeRows
        values: JsonSafeValues
        statistics: JsonSafeMapping

    value = Decimal(text)
    response = Response(
        rows=[{"amount": value}], values=[value], statistics={"amount": value}
    )
    assert sanitize_json_value(value) is value
    assert response.rows[0]["amount"] is value
    expected = {
        "rows": [{"amount": text}],
        "values": [text],
        "statistics": {"amount": text},
    }
    assert json_loads(to_json(response)) == expected
    assert json_loads(default_serializer(response)) == expected
    assert to_jsonable_python(response) == expected


@pytest.mark.parametrize("text", ["NaN", "sNaN", "Infinity", "-Infinity"])
def test_non_finite_decimal_serializes_as_null(text: str) -> None:
    """Decimal missing values agree with the float null representation."""
    value = Decimal(text)
    assert sanitize_json_value(value) is None
    assert is_missing_value(value) is True
    rows = TypeAdapter(JsonSafeRows).validate_python([{"amount": value}])
    assert to_json(rows) == b'[{"amount":null}]'
    assert to_jsonable_python(rows) == [{"amount": None}]


@pytest.mark.parametrize("text", ["0.10000000000000000001", "NaN", "sNaN", "Infinity"])
def test_decimal_subclass_hooks_are_not_called(text: str) -> None:
    """Decimal detection must not dispatch to subclass comparison/conversion hooks."""

    class HostileDecimal(Decimal):
        """A Decimal whose overridable numeric operations must not be used."""

        def __float__(self) -> float:
            raise AssertionError("float hook executed")

        def __eq__(self, other: object) -> bool:
            raise AssertionError("equality hook executed")

        def is_finite(self) -> bool:
            raise AssertionError("is_finite hook executed")

    value = HostileDecimal(text)
    expected = value if text == "0.10000000000000000001" else None
    assert sanitize_json_value(value) is expected
    assert is_missing_value(value) is (expected is None)


def test_unknown_types_are_stringified() -> None:
    """The structured-content path (``to_jsonable_python``) has no
    ``fallback=str``, so unknown values cannot be left as-is."""

    class Custom:
        def __str__(self) -> str:
            return "custom_value"

    assert sanitize_json_value(Custom()) == "custom_value"


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, True),
        (pd.NaT, True),
        (pd.NA, True),
        (float("nan"), True),
        (np.float32("nan"), True),
        (0, False),
        ("", False),
        ("NaN", False),
        ("NaT", False),
        ("None", False),
        (b"\xff", False),
        ([], False),
        ([1, 2], False),
    ],
)
def test_is_missing_value(value: Any, expected: bool) -> None:
    assert is_missing_value(value) is expected


def test_nested_containers_are_walked() -> None:
    value = {"a": [{"b": b"\xff"}], "c": (pd.NaT, float("nan"))}
    assert sanitize_json_value(value) == {
        "a": [{"b": BINARY_PREFIX + base64.b64encode(b"\xff").decode()}],
        "c": [None, None],
    }


def test_non_string_mapping_keys_are_stringified() -> None:
    assert sanitize_json_value({1: "a"}) == {"1": "a"}


def test_deep_nesting_is_capped_instead_of_recursing() -> None:
    value: Any = b"\xff"
    for _ in range(MAX_DEPTH + 5):
        value = [value]
    # The cap renders the tail as text rather than recursing forever; the
    # point is that it returns something JSON-encodable at all.
    assert json_loads(default_serializer(sanitize_json_value(value)))


def test_sanitize_mapping_leaves_non_mappings_to_pydantic() -> None:
    assert sanitize_mapping(5) == 5
    assert sanitize_mapping({"a": b"\xff"}) == {
        "a": BINARY_PREFIX + base64.b64encode(b"\xff").decode()
    }


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, None),
        (5, 5),
        (5.0, 5),
        (5.9, 5),
        (Decimal("5.9"), 5),
        ("nonsense", None),
        (float("nan"), None),
        (object(), None),
    ],
)
def test_coerce_optional_int(value: Any, expected: int | None) -> None:
    assert coerce_optional_int(value) == expected


def test_coerce_int_falls_back_to_zero() -> None:
    assert coerce_int(None) == 0
    assert coerce_int("nonsense") == 0
    assert coerce_int(5.9) == 5


@pytest.mark.parametrize("container", [list, tuple, set, frozenset, iter, deque])
@pytest.mark.parametrize("value", [b"\xff", pd.NaT, float("inf"), "\ud800"])
def test_json_safe_values_sanitize_coerced_iterables(
    container: Callable[[list[Any]], Any], value: Any
) -> None:
    """Every accepted iterable must sanitize its elements before serialization."""
    values = TypeAdapter(JsonSafeValues).validate_python(container([value]))
    expected = [sanitize_json_value(value)]
    assert json_loads(default_serializer(values)) == expected
    assert to_jsonable_python(values) == expected


def test_json_safe_values_sanitize_generator() -> None:
    """One-shot generators must be consumed once and sanitized element by element."""
    values = TypeAdapter(JsonSafeValues).validate_python(
        value for value in [b"\xff", pd.NaT]
    )
    assert json_loads(default_serializer(values)) == ["base64:/w==", None]
    assert to_jsonable_python(values) == ["base64:/w==", None]


@pytest.mark.parametrize("container", [dict, MappingProxyType, UserDict])
def test_json_safe_mapping_sanitizes_general_mappings(
    container: Callable[[dict[str, Any]], Any],
) -> None:
    """Mapping implementations and nested mappings retain their JSON object shape."""
    mapping = TypeAdapter(JsonSafeMapping).validate_python(
        container({"blob": b"\xff", "nested": container({"ts": pd.NaT})})
    )
    expected = {"blob": "base64:/w==", "nested": {"ts": None}}
    assert json_loads(default_serializer(mapping)) == expected
    assert to_jsonable_python(mapping) == expected


@pytest.mark.parametrize("container", [list, tuple, iter, deque])
def test_json_safe_rows_sanitize_coerced_iterables(
    container: Callable[[list[Any]], Any],
) -> None:
    """Row mappings must be sanitized after the outer iterable is coerced."""
    rows = TypeAdapter(JsonSafeRows).validate_python(
        container([MappingProxyType({"blob": b"\xff", "ts": pd.NaT})])
    )
    expected = [{"blob": "base64:/w==", "ts": None}]
    assert json_loads(default_serializer(rows)) == expected
    assert to_jsonable_python(rows) == expected


@pytest.mark.parametrize("value", ["text", b"bytes", bytearray(b"bytes"), {}, 5, None])
@pytest.mark.parametrize("alias", [JsonSafeRows, JsonSafeValues])
def test_json_safe_sequences_reject_invalid_containers(value: Any, alias: Any) -> None:
    """Sanitization must not broaden the list schema's accepted input types."""
    with pytest.raises(ValidationError):
        TypeAdapter(alias).validate_python(value)


@pytest.mark.parametrize("value", [True, False, np.bool_(True), np.bool_(False)])
def test_boolean_counts_are_unavailable(value: Any) -> None:
    """Booleans are not warehouse row counts, including numpy booleans."""
    assert coerce_optional_int(value) is None
    assert coerce_int(value) == 0
    assert TypeAdapter(OptionalRowCount).validate_python(value) is None
    assert TypeAdapter(RowCount).validate_python(value) == 0


def test_string_missing_check_does_not_call_pandas() -> None:
    """Literal strings cannot represent missing scalars and need no pandas call."""
    with patch("superset.mcp_service.utils.serialization.pd.isna") as isna:
        for value in ("", "NaN", "NaT", "None", "ordinary"):
            assert is_missing_value(value) is False
    isna.assert_not_called()
