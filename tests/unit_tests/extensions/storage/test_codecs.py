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

"""Tests for the extension storage codec registry."""

from __future__ import annotations

import pytest

from superset.extensions.storage.codecs import (
    DEFAULT_CODEC,
    get_codec,
    SAFE_CODECS,
    UnknownCodecError,
)
from superset.key_value.types import (
    Base64KeyValueCodec,
    JsonKeyValueCodec,
    PickleKeyValueCodec,
)


def test_get_codec_returns_json_codec() -> None:
    """'json' resolves to a JsonKeyValueCodec instance."""
    assert isinstance(get_codec("json"), JsonKeyValueCodec)


def test_get_codec_returns_pickle_codec() -> None:
    """'pickle' resolves to a PickleKeyValueCodec instance."""
    assert isinstance(get_codec("pickle"), PickleKeyValueCodec)


def test_get_codec_raises_for_unknown_name() -> None:
    """An unregistered codec identifier raises UnknownCodecError."""
    with pytest.raises(UnknownCodecError):
        get_codec("yaml")


def test_json_round_trips_through_registry() -> None:
    """A value encoded via the registry's json codec decodes back unchanged."""
    codec = get_codec("json")
    encoded = codec.encode({"a": 1})
    assert codec.decode(encoded) == {"a": 1}


def test_default_codec_is_json() -> None:
    """DEFAULT_CODEC resolves to the json codec."""
    assert DEFAULT_CODEC == "json"
    assert isinstance(get_codec(DEFAULT_CODEC), JsonKeyValueCodec)


def test_pickle_is_not_a_safe_codec() -> None:
    """'pickle' is excluded from SAFE_CODECS since it can deserialize
    arbitrary code and must not be reachable from the REST API."""
    assert "pickle" not in SAFE_CODECS


def test_json_is_a_safe_codec() -> None:
    """'json' is included in SAFE_CODECS."""
    assert "json" in SAFE_CODECS


def test_base64_is_a_safe_codec() -> None:
    """'base64' is included in SAFE_CODECS — it carries binary data as a
    base64 string, with no code-execution risk on decode."""
    assert "base64" in SAFE_CODECS


def test_get_codec_returns_base64_codec() -> None:
    """'base64' resolves to a Base64KeyValueCodec instance."""
    assert isinstance(get_codec("base64"), Base64KeyValueCodec)


def test_base64_round_trips_through_registry() -> None:
    """A base64 string encoded via the registry's codec decodes back to the
    same base64 string, with the raw bytes preserved in between."""
    codec = get_codec("base64")
    raw = b"binary\x00data"
    encoded_str = codec.decode(raw)
    assert codec.encode(encoded_str) == raw
