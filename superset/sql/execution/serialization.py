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
"""Lossless, transport-independent sidecars for supported nested SQL values."""

import base64
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import msgpack


def _encode_nested_scalar(value: Any) -> msgpack.ExtType:
    """Encode supported non-MessagePack scalars with explicit type tags."""
    if type(value) is int:
        return msgpack.ExtType(1, str(value).encode("ascii"))
    if type(value) is datetime and (
        value.tzinfo is None or type(value.tzinfo) is timezone
    ):
        return msgpack.ExtType(2, value.isoformat().encode("ascii"))
    if type(value) is UUID:
        return msgpack.ExtType(3, value.bytes)
    if type(value) is Decimal:
        return msgpack.ExtType(4, str(value).encode("ascii"))
    raise TypeError("Unsupported nested SQL value")


def _encode_nested_value(value: Any) -> Any:
    """Walk exact supported types, excluding user-supplied extension tags."""
    if type(value) is list:
        return [_encode_nested_value(item) for item in value]
    if type(value) is dict:
        return {
            _encode_nested_value(key): _encode_nested_value(item)
            for key, item in value.items()
        }
    if type(value) is int and -(2**63) <= value < 2**64:
        return value
    if type(value) in (type(None), bool, float, str, bytes):
        return value
    return _encode_nested_scalar(value)


def _decode_nested_scalar(code: int, data: bytes) -> Any:
    """Restore only the scalar types explicitly supported by the sidecar."""
    if code == 1:
        return int(data)
    if code == 2:
        return datetime.fromisoformat(data.decode("ascii"))
    if code == 3:
        return UUID(bytes=data)
    if code == 4:
        return Decimal(data.decode("ascii"))
    raise ValueError("Unsupported nested SQL type tag")


def serialize_nested_columns(columns: dict[str, list[Any]]) -> dict[str, str]:
    """Encode nested columns as Base64 MessagePack, or keep Arrow's fallback.

    Explicit extensions preserve arbitrary-sized integers, datetime, UUID and
    Decimal; MessagePack retains bytes without text decoding. Strict types
    prevent silent conversions (for example, tuples into lists). A column
    containing unsupported values is omitted so its Arrow string column is
    used instead. Sidecars never rely on executable object deserialization.
    """
    encoded: dict[str, str] = {}
    for name, values in columns.items():
        try:
            data = msgpack.dumps(
                _encode_nested_value(values),
                use_bin_type=True,
                strict_types=True,
            )
        except (TypeError, ValueError, OverflowError):
            continue
        encoded[name] = base64.b64encode(data).decode("ascii")
    return encoded


def deserialize_nested_columns(columns: dict[str, str]) -> dict[str, list[Any]]:
    """Decode nested sidecars independently of the outer results codec."""
    return {
        name: msgpack.loads(
            base64.b64decode(data),
            raw=False,
            strict_map_key=False,
            ext_hook=_decode_nested_scalar,
        )
        for name, data in columns.items()
    }
