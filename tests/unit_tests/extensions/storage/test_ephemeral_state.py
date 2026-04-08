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

"""Tests for ephemeral state storage implementation."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g
from superset_core.extensions.types import Manifest

from superset.extensions.context import ConcreteExtensionContext, use_context
from superset.extensions.storage.ephemeral_state import (
    _build_cache_key,
    DEFAULT_TTL,
    EphemeralStateImpl,
)


@pytest.fixture
def app() -> Flask:
    """Create a minimal Flask app for testing."""
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


@pytest.fixture
def mock_cache() -> MagicMock:
    """Create a mock cache manager."""
    return MagicMock()


def _create_context(
    publisher: str = "test-org", name: str = "test-ext"
) -> ConcreteExtensionContext:
    """Create test context with given extension identifiers."""
    manifest = Manifest.model_validate(
        {
            "id": f"{publisher}.{name}",
            "publisher": publisher,
            "name": name,
            "displayName": f"Test {name}",
        }
    )
    return ConcreteExtensionContext(manifest)


def _set_user(user_id: int) -> None:
    """Set a mock user on Flask's g object."""
    g.user = MagicMock(id=user_id)


def test_build_cache_key_joins_parts_with_separator():
    """_build_cache_key joins all parts with colon separator."""
    assert _build_cache_key("a", "b", "c") == "a:b:c"
    assert _build_cache_key("prefix", 123, "key") == "prefix:123:key"


def test_default_ttl_is_one_hour():
    """DEFAULT_TTL should be 3600 seconds (1 hour)."""
    assert DEFAULT_TTL == 3600


def test_ephemeral_state_raises_without_context(app: Flask) -> None:
    """EphemeralStateImpl operations raise RuntimeError without extension context."""
    with app.app_context():
        _set_user(1)

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralStateImpl.get("key")

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralStateImpl.set("key", "value")

        with pytest.raises(RuntimeError, match="within an extension context"):
            EphemeralStateImpl.remove("key")


def test_ephemeral_state_raises_without_user(app: Flask) -> None:
    """EphemeralStateImpl operations raise RuntimeError without authenticated user."""
    ctx = _create_context()

    with app.app_context(), use_context(ctx):
        # No user set on g
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            EphemeralStateImpl.get("key")


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_ephemeral_state_get_builds_correct_key(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralStateImpl.get() builds user-scoped key and calls cache.get()."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = {"data": "test"}

    ctx = _create_context("my-org", "my-ext")

    with app.app_context(), use_context(ctx):
        _set_user(42)
        result = EphemeralStateImpl.get("my-key")

    expected_key = "superset-ext:my-org.my-ext:user:42:my-key"
    mock_cache.get.assert_called_once_with(expected_key)
    assert result == {"data": "test"}


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_ephemeral_state_set_builds_correct_key_and_uses_ttl(
    mock_cm: MagicMock, app: Flask
) -> None:
    """EphemeralStateImpl.set() builds user-scoped key and passes TTL to cache."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = _create_context("my-org", "my-ext")

    with app.app_context(), use_context(ctx):
        _set_user(42)
        EphemeralStateImpl.set("my-key", {"value": 123}, ttl=600)

    expected_key = "superset-ext:my-org.my-ext:user:42:my-key"
    mock_cache.set.assert_called_once_with(expected_key, {"value": 123}, timeout=600)


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_ephemeral_state_set_uses_default_ttl(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralStateImpl.set() uses DEFAULT_TTL when ttl not specified."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = _create_context()

    with app.app_context(), use_context(ctx):
        _set_user(1)
        EphemeralStateImpl.set("key", "value")

    mock_cache.set.assert_called_once()
    call_args = mock_cache.set.call_args
    assert call_args.kwargs["timeout"] == DEFAULT_TTL


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_ephemeral_state_remove_deletes_key(mock_cm: MagicMock, app: Flask) -> None:
    """EphemeralStateImpl.remove() calls cache.delete() with correct key."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = _create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        _set_user(99)
        EphemeralStateImpl.remove("to-delete")

    expected_key = "superset-ext:org.ext:user:99:to-delete"
    mock_cache.delete.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_shared_accessor_builds_shared_key(mock_cm: MagicMock, app: Flask) -> None:
    """SharedEphemeralStateAccessor builds key without user scope."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = "shared-value"

    ctx = _create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        _set_user(1)  # User is set but should not appear in shared key
        result = EphemeralStateImpl.shared.get("shared-key")

    expected_key = "superset-ext:org.ext:shared:shared-key"
    mock_cache.get.assert_called_once_with(expected_key)
    assert result == "shared-value"


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_shared_accessor_set_and_remove(mock_cm: MagicMock, app: Flask) -> None:
    """SharedEphemeralStateAccessor set() and remove() use shared key."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = _create_context("org", "ext")

    with app.app_context(), use_context(ctx):
        _set_user(1)
        EphemeralStateImpl.shared.set("key", {"shared": True}, ttl=300)
        EphemeralStateImpl.shared.remove("key")

    expected_key = "superset-ext:org.ext:shared:key"
    mock_cache.set.assert_called_once_with(expected_key, {"shared": True}, timeout=300)
    mock_cache.delete.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_different_extensions_have_isolated_keys(
    mock_cm: MagicMock, app: Flask
) -> None:
    """Different extensions use different key prefixes for isolation."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.side_effect = lambda k: f"value-for-{k}"

    ctx1 = _create_context("org1", "ext1")
    ctx2 = _create_context("org2", "ext2")

    with app.app_context():
        _set_user(1)

        with use_context(ctx1):
            EphemeralStateImpl.get("same-key")

        with use_context(ctx2):
            EphemeralStateImpl.get("same-key")

    calls = [call.args[0] for call in mock_cache.get.call_args_list]
    assert "superset-ext:org1.ext1:user:1:same-key" in calls
    assert "superset-ext:org2.ext2:user:1:same-key" in calls


@patch("superset.extensions.storage.ephemeral_state.cache_manager")
def test_different_users_have_isolated_keys(mock_cm: MagicMock, app: Flask) -> None:
    """Different users use different key prefixes for isolation."""
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    ctx = _create_context()

    with app.app_context(), use_context(ctx):
        _set_user(1)
        EphemeralStateImpl.get("key")

        _set_user(2)
        EphemeralStateImpl.get("key")

    calls = [call.args[0] for call in mock_cache.get.call_args_list]
    assert any(":user:1:" in k for k in calls)
    assert any(":user:2:" in k for k in calls)
