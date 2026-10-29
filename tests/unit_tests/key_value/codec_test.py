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
import math
from contextlib import nullcontext
from datetime import datetime
from typing import Any

import pytest
from marshmallow import Schema

from superset.dashboards.permalink.schemas import DashboardPermalinkSchema
from superset.key_value.exceptions import KeyValueCodecEncodeException
from superset.key_value.types import (
    BinaryKeyValueCodec,
    JsonKeyValueCodec,
    MarshmallowKeyValueCodec,
    PickleKeyValueCodec,
)


@pytest.mark.parametrize(
    "input_,expected_result",
    [
        (
            {"foo": "bar"},
            {"foo": "bar"},
        ),
        (
            {"foo": (1, 2, 3)},
            {"foo": [1, 2, 3]},
        ),
        (
            # `superset.utils.json`'s default serializer (`base_json_conv`)
            # converts bare sets to lists rather than raising, unlike stdlib
            # `json`; this no longer raises now that the codec uses it.
            {1, 2, 3},
            [1, 2, 3],
        ),
        (
            object(),
            KeyValueCodecEncodeException(),
        ),
        (
            # Regression test: stdlib `json` can't serialize `datetime` values
            # and raises `TypeError`, which this codec maps to
            # `KeyValueCodecEncodeException`. The codec uses
            # `superset.utils.json`, whose `dumps` serializes datetimes to
            # ISO 8601 strings, so this must round-trip without raising.
            {"foo": datetime(2024, 1, 1, 12, 0, 0)},
            {"foo": "2024-01-01T12:00:00"},
        ),
    ],
)
def test_json_codec(input_: Any, expected_result: Any):
    cm = (
        pytest.raises(type(expected_result))
        if isinstance(expected_result, Exception)
        else nullcontext()
    )
    with cm:
        codec = JsonKeyValueCodec()
        encoded_value = codec.encode(input_)
        assert expected_result == codec.decode(encoded_value)


@pytest.mark.parametrize(
    "schema,input_,expected_result",
    [
        (
            DashboardPermalinkSchema(),
            {
                "dashboardId": "1",
                "state": {
                    "urlParams": [["foo", "bar"], ["foo", "baz"]],
                },
            },
            {
                "dashboardId": "1",
                "state": {
                    "urlParams": [("foo", "bar"), ("foo", "baz")],
                },
            },
        ),
        (
            DashboardPermalinkSchema(),
            {"foo": "bar"},
            KeyValueCodecEncodeException(),
        ),
    ],
)
def test_marshmallow_codec(schema: Schema, input_: Any, expected_result: Any):
    cm = (
        pytest.raises(type(expected_result))
        if isinstance(expected_result, Exception)
        else nullcontext()
    )
    with cm:
        codec = MarshmallowKeyValueCodec(schema)
        encoded_value = codec.encode(input_)
        assert expected_result == codec.decode(encoded_value)


@pytest.mark.parametrize(
    "input_,expected_result",
    [
        (
            {1, 2, 3},
            {1, 2, 3},
        ),
        (
            {"foo": 1, "bar": {1: (1, 2, 3)}, "baz": {1, 2, 3}},
            {
                "foo": 1,
                "bar": {1: (1, 2, 3)},
                "baz": {1, 2, 3},
            },
        ),
    ],
)
def test_pickle_codec(input_: Any, expected_result: Any):
    codec = PickleKeyValueCodec()
    encoded_value = codec.encode(input_)
    assert expected_result == codec.decode(encoded_value)


def test_binary_codec_encode():
    codec = BinaryKeyValueCodec()
    raw = b"\x00\x01binary\xffdata"
    assert codec.encode(raw) == raw


def test_binary_codec_round_trips():
    codec = BinaryKeyValueCodec()
    raw = b"\x00\x01binary\xffdata"
    assert codec.decode(raw) == raw
    assert codec.encode(codec.decode(raw)) == raw


def test_json_codec_rejects_bytes():
    """Raw bytes must raise rather than be silently stringified."""
    with pytest.raises(KeyValueCodecEncodeException):
        JsonKeyValueCodec().encode(b"hello")


@pytest.mark.parametrize(
    "value",
    [
        {"payload": b"hello"},
        {"payload": [b"hello"]},
        {b"hello": 1},
        {"payload": (b"hello",)},
        {"payload": {b"hello"}},
        {"payload": frozenset({b"hello"})},
        {"payload": bytearray(b"hello")},
        {"payload": memoryview(b"hello")},
    ],
)
def test_json_codec_rejects_nested_bytes(value: Any):
    """Bytes nested inside containers must raise rather than be altered."""
    with pytest.raises(KeyValueCodecEncodeException):
        JsonKeyValueCodec().encode(value)


def test_json_codec_decodes_legacy_non_finite_floats():
    """Entries written by stdlib json with NaN/Infinity must stay readable."""
    decoded = JsonKeyValueCodec().decode(b'{"score": NaN, "limit": Infinity}')
    assert math.isnan(decoded["score"])
    assert decoded["limit"] == float("inf")


def test_json_codec_encodes_non_finite_floats():
    """NaN/Infinity must round-trip instead of being coerced to null."""
    encoded = JsonKeyValueCodec().encode({"score": float("nan"), "limit": float("inf")})
    assert encoded == b'{"score": NaN, "limit": Infinity}'
    decoded = JsonKeyValueCodec().decode(encoded)
    assert math.isnan(decoded["score"])
    assert decoded["limit"] == float("inf")
