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

"""Tests for the ephemeral state ambient accessor (ephemeral.py).

Cache-key construction, TTL/MAX_VALUE_SIZE validation live in
`ExtensionEphemeralDAO` (`ephemeral_dao.py`) and are tested once in
`test_ephemeral_dao.py`; these tests cover the accessor's context/user
resolution and delegation to that DAO.
"""

from __future__ import annotations

import base64
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from flask_babel import Babel

from superset.extensions.context import use_context
from superset.extensions.storage.codecs import get_codec
from superset.extensions.storage.ephemeral import EphemeralSetOptions, EphemeralState
from superset.extensions.storage.ephemeral_dao import (
    ExtensionEphemeralTTLInvalid,
    ExtensionEphemeralValueTooLarge,
)
from tests.unit_tests.extensions.storage.conftest import (
    create_context,
    set_user,
)


def _envelope(value: Any, codec: str = "json") -> dict[str, str]:
    """Build the cache envelope ExtensionEphemeralDAO stores values as."""
    encoded = get_codec(codec).encode(value)
    return {"codec": codec, "value": base64.b64encode(encoded).decode("ascii")}


def test_ephemeral_state_raises_without_context(app: Flask) -> None:
    """EphemeralState operations raise RuntimeError without extension context."""
    with app.app_context():
        set_user(1)

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralState.get("key")

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralState.set("key", "value", EphemeralSetOptions(ttl=300))

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralState.remove("key")


def test_ephemeral_state_raises_without_user(app: Flask) -> None:
    """EphemeralState operations raise RuntimeError without authenticated user."""
    ctx = create_context()

    with app.app_context(), use_context(ctx):
        # No user set on g
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            EphemeralState.get("key")


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_get_builds_correct_key(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralState.get() builds user-scoped key and calls cache.get()."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope({"data": "test"})

    ctx = create_context("my-org", "my-ext")

    with app.app_context(), use_context(ctx):
        set_user(42)
        result = EphemeralState.get("my-key")

    expected_key = "superset-ext:my-org.my-ext:user:42:my-key"
    mock_cache.get.assert_called_once_with(expected_key)
    assert result == {"data": "test"}


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_set_builds_correct_key_and_uses_ttl(
    mock_cm: MagicMock, app: Flask
) -> None:
    """EphemeralState.set() builds user-scoped key and passes TTL to cache."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context("my-org", "my-ext")

    with app.app_context(), use_context(ctx):
        set_user(42)
        EphemeralState.set("my-key", {"value": 123}, EphemeralSetOptions(ttl=600))

    expected_key = "superset-ext:my-org.my-ext:user:42:my-key"
    mock_cache.set.assert_called_once_with(
        expected_key, _envelope({"value": 123}), timeout=600
    )


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_set_uses_given_codec(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralState.set() encodes the value with options.codec."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context("my-org", "my-ext")

    with app.app_context(), use_context(ctx):
        set_user(42)
        EphemeralState.set(
            "my-key", {"value": 123}, EphemeralSetOptions(ttl=600, codec="pickle")
        )

    expected_key = "superset-ext:my-org.my-ext:user:42:my-key"
    mock_cache.set.assert_called_once_with(
        expected_key, _envelope({"value": 123}, codec="pickle"), timeout=600
    )


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_set_rejects_ttl_exceeding_max(
    mock_cm: MagicMock, app: Flask
) -> None:
    """EphemeralState.set() raises when ttl exceeds MAX_TTL, same as the REST API."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_TTL": 3600}
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context()

    with app.app_context(), use_context(ctx):
        set_user(1)
        with pytest.raises(ExtensionEphemeralTTLInvalid):
            EphemeralState.set("key", "value", EphemeralSetOptions(ttl=7200))

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_set_rejects_value_exceeding_max_size(
    mock_cm: MagicMock, app: Flask
) -> None:
    """EphemeralState.set() raises when value exceeds MAX_VALUE_SIZE."""
    app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {"MAX_VALUE_SIZE": 10}
    Babel(app)
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context()

    with app.app_context(), use_context(ctx):
        set_user(1)
        with pytest.raises(ExtensionEphemeralValueTooLarge):
            EphemeralState.set("key", "x" * 100, EphemeralSetOptions(ttl=300))

    mock_cache.set.assert_not_called()


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_ephemeral_state_remove_deletes_key(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralState.remove() calls cache.delete() with correct key."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        set_user(99)
        EphemeralState.remove("to-delete")

    expected_key = "superset-ext:org.ext:user:99:to-delete"
    mock_cache.delete.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_shared_accessor_builds_shared_key(mock_cm: MagicMock, app: Flask) -> None:
    """SharedEphemeralStateAccessor builds key without user scope."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = _envelope("shared-value")

    ctx = create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        set_user(1)  # User is set but should not appear in shared key
        result = EphemeralState.shared.get("shared-key")

    expected_key = "superset-ext:org.ext:shared:shared-key"
    mock_cache.get.assert_called_once_with(expected_key)
    assert result == "shared-value"


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_shared_accessor_set_and_remove(mock_cm: MagicMock, app: Flask) -> None:
    """SharedEphemeralStateAccessor set() and remove() use shared key."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        set_user(1)
        EphemeralState.shared.set("key", {"shared": True}, EphemeralSetOptions(ttl=300))
        EphemeralState.shared.remove("key")

    expected_key = "superset-ext:org.ext:shared:key"
    mock_cache.set.assert_called_once_with(
        expected_key, _envelope({"shared": True}), timeout=300
    )
    mock_cache.delete.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_different_extensions_have_isolated_keys(
    mock_cm: MagicMock, app: Flask
) -> None:
    """Different extensions use different key prefixes for isolation."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.side_effect = lambda k: _envelope(f"value-for-{k}")

    ctx1 = create_context("org1", "ext1")
    ctx2 = create_context("org2", "ext2")

    with app.app_context():
        set_user(1)

        with use_context(ctx1):
            EphemeralState.get("same-key")

        with use_context(ctx2):
            EphemeralState.get("same-key")

    calls = [call.args[0] for call in mock_cache.get.call_args_list]
    assert "superset-ext:org1.ext1:user:1:same-key" in calls
    assert "superset-ext:org2.ext2:user:1:same-key" in calls


@patch("superset.extensions.storage.ephemeral_dao.cache_manager")
def test_different_users_have_isolated_keys(mock_cm: MagicMock, app: Flask) -> None:
    """Different users use different key prefixes for isolation."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = None

    ctx = create_context()

    with app.app_context(), use_context(ctx):
        set_user(1)
        EphemeralState.get("key")

        set_user(2)
        EphemeralState.get("key")

    calls = [call.args[0] for call in mock_cache.get.call_args_list]
    assert any(":user:1:" in k for k in calls)
    assert any(":user:2:" in k for k in calls)
