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

"""Tests for shared extension storage helpers (superset.extensions.storage.utils)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.extensions.context import use_context
from superset.extensions.storage.utils import (
    build_cache_key,
    build_storage_key,
    get_current_extension_id,
    get_current_user_id,
    get_extension_or_404,
    KEY_PREFIX,
    parse_ttl,
    SEPARATOR,
)
from tests.unit_tests.extensions.storage.conftest import create_context, set_user

# ── build_cache_key ────────────────────────────────────────────────────────────


def test_build_cache_key_joins_with_separator():
    """build_cache_key joins parts with SEPARATOR."""
    assert build_cache_key("a", "b", "c") == f"a{SEPARATOR}b{SEPARATOR}c"


def test_build_cache_key_converts_non_strings():
    """build_cache_key converts integers and other types to strings."""
    assert build_cache_key("prefix", 42, "key") == "prefix:42:key"


def test_build_cache_key_single_part():
    """build_cache_key with a single part returns that part as a string."""
    assert build_cache_key("only") == "only"


# ── build_storage_key ────────────────────────────────────────────────────────


def test_build_storage_key_user_scoped() -> None:
    """build_storage_key builds user-scoped key with user ID."""
    key = build_storage_key("acme.ext", "my-key", user_id=42, shared=False)
    assert key == f"{KEY_PREFIX}:acme.ext:user:42:my-key"


def test_build_storage_key_shared() -> None:
    """build_storage_key builds shared key without user ID."""
    key = build_storage_key("acme.ext", "my-key", user_id=42, shared=True)
    assert key == f"{KEY_PREFIX}:acme.ext:shared:my-key"


def test_build_storage_key_different_extensions_are_isolated() -> None:
    """Different extensions produce different keys for the same user/key."""
    key1 = build_storage_key("org.ext1", "k", user_id=1, shared=False)
    key2 = build_storage_key("org.ext2", "k", user_id=1, shared=False)
    assert key1 != key2


def test_build_storage_key_different_users_are_isolated() -> None:
    """Different users produce different keys for the same extension/key."""
    key1 = build_storage_key("org.ext", "k", user_id=1, shared=False)
    key2 = build_storage_key("org.ext", "k", user_id=2, shared=False)
    assert key1 != key2


# ── get_extension_or_404 ─────────────────────────────────────────────────────


@patch("superset.extensions.storage.utils.get_extensions")
def test_get_extension_or_404_returns_extension(mock_get_ext: MagicMock) -> None:
    """get_extension_or_404 returns the extension when found."""
    mock_ext = MagicMock()
    mock_get_ext.return_value = {"acme.dashboard": mock_ext}
    result = get_extension_or_404("acme.dashboard")
    assert result is mock_ext


@patch("superset.extensions.storage.utils.get_extensions")
def test_get_extension_or_404_returns_none_when_missing(
    mock_get_ext: MagicMock,
) -> None:
    """get_extension_or_404 returns None when extension is not registered."""
    mock_get_ext.return_value = {}
    result = get_extension_or_404("nonexistent.ext")
    assert result is None


# ── parse_ttl ─────────────────────────────────────────────────────────────────
#
# parse_ttl only type-coerces the raw request body value; the MAX_TTL
# business rule is enforced once in ExtensionEphemeralDAO (see
# test_ephemeral_dao.py), shared by the REST API and the ambient accessor.


def test_parse_ttl_returns_error_when_absent(app: Flask) -> None:
    """parse_ttl returns an error when 'ttl' is not in body."""
    with app.app_context():
        ttl, error = parse_ttl({"value": "something"})
    assert ttl is None
    assert error is not None


def test_parse_ttl_returns_valid_integer(app: Flask) -> None:
    """parse_ttl returns the parsed integer TTL."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": 300})
    assert ttl == 300
    assert error is None


def test_parse_ttl_parses_string_integer(app: Flask) -> None:
    """parse_ttl converts string TTL to int."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": "600"})
    assert ttl == 600
    assert error is None


def test_parse_ttl_rejects_non_numeric(app: Flask) -> None:
    """parse_ttl returns error for non-numeric TTL."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": "not-a-number"})
    assert ttl is None
    assert error is not None
    assert "positive integer" in error


def test_parse_ttl_rejects_zero(app: Flask) -> None:
    """parse_ttl returns error for zero TTL."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": 0})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_negative(app: Flask) -> None:
    """parse_ttl returns error for negative TTL."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": -10})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_none_value(app: Flask) -> None:
    """parse_ttl returns error when ttl is None."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": None})
    assert ttl is None
    assert error is not None


def test_parse_ttl_accepts_large_values(app: Flask) -> None:
    """parse_ttl itself does not cap TTL — that's the DAO's job."""
    with app.app_context():
        ttl, error = parse_ttl({"ttl": 999999})
    assert ttl == 999999
    assert error is None


# ── get_current_extension_id ─────────────────────────────────────────────────


def test_get_current_extension_id_raises_outside_context(app: Flask) -> None:
    """get_current_extension_id raises RuntimeError outside an extension context."""
    with app.app_context():
        with pytest.raises(RuntimeError, match="within an extension context"):
            get_current_extension_id("ephemeral_state")


def test_get_current_extension_id_returns_id_within_context(app: Flask) -> None:
    """get_current_extension_id returns the manifest ID within an extension context."""
    ctx = create_context("my-org", "my-ext")
    with app.app_context(), use_context(ctx):
        assert get_current_extension_id("persistent_state") == "my-org.my-ext"


def test_get_current_extension_id_error_names_the_caller(app: Flask) -> None:
    """The RuntimeError message includes the caller name passed in."""
    with app.app_context():
        with pytest.raises(RuntimeError, match="persistent_state can only be used"):
            get_current_extension_id("persistent_state")


# ── get_current_user_id ──────────────────────────────────────────────────────


def test_get_current_user_id_raises_without_user(app: Flask) -> None:
    """get_current_user_id raises RuntimeError without an authenticated user."""
    with app.app_context():
        with pytest.raises(RuntimeError, match="requires an authenticated user"):
            get_current_user_id("ephemeral_state")


def test_get_current_user_id_returns_id_when_authenticated(app: Flask) -> None:
    """get_current_user_id returns the user's ID when authenticated."""
    with app.app_context():
        set_user(7)
        assert get_current_user_id("ephemeral_state") == 7
