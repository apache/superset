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

"""Tests for ExtensionEphemeralDAO — the shared Tier 2 cache access and
MAX_TTL/MAX_VALUE_SIZE validation used by both the REST API and the ambient
`ephemeral_state` accessor."""

from __future__ import annotations

import base64
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from flask_babel import Babel

from superset.extensions.storage.codecs import get_codec
from superset.extensions.storage.ephemeral_dao import (
    ExtensionEphemeralDAO,
    ExtensionEphemeralTTLInvalid,
    ExtensionEphemeralValueTooLarge,
)
from tests.unit_tests.extensions.storage.conftest import set_user


def _envelope(value: Any, codec: str = "json") -> dict[str, str]:
    """Build the cache envelope ExtensionEphemeralDAO stores values as."""
    encoded = get_codec(codec).encode(value)
    return {"codec": codec, "value": base64.b64encode(encoded).decode("ascii")}


# ── get / set / delete key building ──────────────────────────────────────────


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_user_scoped_key(mock_cm: MagicMock, app: Flask) -> None:
    """get() builds a user-scoped key when shared=False."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope("value")

    with app.app_context():
        set_user(42)
        result = ExtensionEphemeralDAO.get("acme.ext", "key", shared=False)

    assert result == "value"
    mock_cache.get.assert_called_once_with("superset-ext:acme.ext:user:42:key")


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_user_scoped_raises_without_user(mock_cm: MagicMock, app: Flask) -> None:
    """get() raises RuntimeError when shared=False and no user is authenticated."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            ExtensionEphemeralDAO.get("acme.ext", "key", shared=False)

    mock_cache.get.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_shared_key(mock_cm: MagicMock, app: Flask) -> None:
    """get() builds a shared key when shared=True, no user needed."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope("value")

    with app.app_context():
        result = ExtensionEphemeralDAO.get("acme.ext", "key", shared=True)

    assert result == "value"
    mock_cache.get.assert_called_once_with("superset-ext:acme.ext:shared:key")


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_returns_none_when_not_found(mock_cm: MagicMock, app: Flask) -> None:
    """get() returns None without attempting to decode when the cache misses."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = None

    with app.app_context():
        result = ExtensionEphemeralDAO.get("acme.ext", "key", shared=True)

    assert result is None


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_decodes_with_stored_codec(mock_cm: MagicMock, app: Flask) -> None:
    """get() decodes the cached envelope using the codec it was written with."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope({"pct": 42})

    with app.app_context():
        result = ExtensionEphemeralDAO.get("acme.ext", "key", shared=True)

    assert result == {"pct": 42}


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_raw_returns_bytes_and_codec(mock_cm: MagicMock, app: Flask) -> None:
    """get_raw() returns the decoded envelope's raw bytes and codec name."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope({"pct": 42}, codec="json")

    with app.app_context():
        result = ExtensionEphemeralDAO.get_raw("acme.ext", "key", shared=True)

    assert result is not None
    raw, codec = result
    assert codec == "json"
    assert get_codec(codec).decode(raw) == {"pct": 42}


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_get_raw_returns_none_when_not_found(mock_cm: MagicMock, app: Flask) -> None:
    """get_raw() returns None when the cache misses."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = None

    with app.app_context():
        result = ExtensionEphemeralDAO.get_raw("acme.ext", "key", shared=True)

    assert result is None


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_delete_calls_cache_delete(mock_cm: MagicMock, app: Flask) -> None:
    """delete() calls cache.delete() with the scoped key."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.delete("acme.ext", "key", shared=True)

    mock_cache.delete.assert_called_once_with("superset-ext:acme.ext:shared:key")


# ── set() TTL validation ──────────────────────────────────────────────────────


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_passes_ttl_to_cache(mock_cm: MagicMock, app: Flask) -> None:
    """set() passes the given TTL through to cache.set()."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", "value", 300, shared=True)

    mock_cache.set.assert_called_once_with(
        "superset-ext:acme.ext:shared:key", _envelope("value"), timeout=300
    )


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_defaults_codec_to_json(mock_cm: MagicMock, app: Flask) -> None:
    """set() encodes the value with the json codec when none is specified."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", {"pct": 42}, 300, shared=True)

    envelope = mock_cache.set.call_args[0][1]
    assert envelope["codec"] == "json"
    assert get_codec("json").decode(base64.b64decode(envelope["value"])) == {"pct": 42}


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_stores_given_codec(mock_cm: MagicMock, app: Flask) -> None:
    """set() encodes the value with the caller-supplied codec."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set(
            "acme.ext", "key", {"pct": 42}, 300, codec="pickle", shared=True
        )

    envelope = mock_cache.set.call_args[0][1]
    assert envelope["codec"] == "pickle"
    assert get_codec("pickle").decode(base64.b64decode(envelope["value"])) == {
        "pct": 42
    }


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_raises_when_ttl_missing(mock_cm: MagicMock, app: Flask) -> None:
    """set() raises ExtensionEphemeralTTLInvalid when ttl is None."""
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        with pytest.raises(ExtensionEphemeralTTLInvalid):
            ExtensionEphemeralDAO.set("acme.ext", "key", "value", None, shared=True)

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_raises_when_ttl_not_positive(mock_cm: MagicMock, app: Flask) -> None:
    """set() raises ExtensionEphemeralTTLInvalid when ttl <= 0."""
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        with pytest.raises(ExtensionEphemeralTTLInvalid):
            ExtensionEphemeralDAO.set("acme.ext", "key", "value", 0, shared=True)

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_rejects_ttl_exceeding_max(mock_cm: MagicMock, app: Flask) -> None:
    """set() raises ExtensionEphemeralTTLInvalid when ttl exceeds MAX_TTL."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        with pytest.raises(ExtensionEphemeralTTLInvalid):
            ExtensionEphemeralDAO.set("acme.ext", "key", "value", 7200, shared=True)

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_accepts_ttl_equal_to_max(mock_cm: MagicMock, app: Flask) -> None:
    """set() accepts a TTL exactly equal to MAX_TTL."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", "value", 3600, shared=True)

    mock_cache.set.assert_called_once()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_accepts_any_ttl_when_max_not_configured(
    mock_cm: MagicMock, app: Flask
) -> None:
    """set() accepts any positive TTL when MAX_TTL is not configured."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", "value", 999999, shared=True)

    mock_cache.set.assert_called_once()


# ── set() value size validation ──────────────────────────────────────────────


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_rejects_value_exceeding_max_size(mock_cm: MagicMock, app: Flask) -> None:
    """set() raises ExtensionEphemeralValueTooLarge when the JSON-encoded
    value exceeds MAX_VALUE_SIZE."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_VALUE_SIZE": 10}
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        with pytest.raises(ExtensionEphemeralValueTooLarge):
            ExtensionEphemeralDAO.set("acme.ext", "key", "x" * 100, 300, shared=True)

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_accepts_value_within_max_size(mock_cm: MagicMock, app: Flask) -> None:
    """set() accepts a value at or under MAX_VALUE_SIZE."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_VALUE_SIZE": 1000}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", "small", 300, shared=True)

    mock_cache.set.assert_called_once()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_set_accepts_any_size_when_max_not_configured(
    mock_cm: MagicMock, app: Flask
) -> None:
    """set() accepts any value size when MAX_VALUE_SIZE is not configured."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        ExtensionEphemeralDAO.set("acme.ext", "key", "x" * 10000, 300, shared=True)

    mock_cache.set.assert_called_once()
