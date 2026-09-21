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
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd
import pytest
from fastmcp.tools.base import default_serializer

from superset.mcp_service.utils.serialization import (
    BINARY_PREFIX,
    coerce_int,
    coerce_optional_int,
    MAX_DEPTH,
    sanitize_json_value,
    sanitize_mapping,
    sanitize_sequence,
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
    assert sanitize_json_value(Decimal("1.5")) == Decimal("1.5")


def test_numpy_scalars_are_normalised() -> None:
    assert sanitize_json_value(np.int64(3)) == 3
    assert sanitize_json_value(np.bool_(True)) is True
    assert sanitize_json_value(np.array([1, 2])) == [1, 2]


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


def test_sanitize_sequence_leaves_non_lists_to_pydantic() -> None:
    assert sanitize_sequence("not a list") == "not a list"


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
