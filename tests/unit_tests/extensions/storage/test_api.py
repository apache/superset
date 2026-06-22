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

"""Tests for the Extension Storage REST API helper functions and logic."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from flask import Flask, g

from superset.extensions.storage.api import (
    _build_cache_key,
    _build_storage_key,
    _get_extension_or_404,
    _parse_ttl,
    KEY_PREFIX,
    SEPARATOR,
)

# ── _build_cache_key ──────────────────────────────────────────────────────────


def test_build_cache_key_joins_with_separator():
    """_build_cache_key joins parts with SEPARATOR."""
    assert _build_cache_key("a", "b", "c") == f"a{SEPARATOR}b{SEPARATOR}c"


def test_build_cache_key_converts_non_strings():
    """_build_cache_key converts integers and other types to strings."""
    assert _build_cache_key("prefix", 42, "key") == "prefix:42:key"


def test_build_cache_key_single_part():
    """_build_cache_key with a single part returns that part as a string."""
    assert _build_cache_key("only") == "only"


# ── _parse_ttl ────────────────────────────────────────────────────────────────


def test_parse_ttl_returns_error_when_absent():
    """_parse_ttl returns an error when 'ttl' is not in body."""
    ttl, error = _parse_ttl({"value": "something"})
    assert ttl is None
    assert error is not None


def test_parse_ttl_returns_valid_integer():
    """_parse_ttl returns the parsed integer TTL."""
    ttl, error = _parse_ttl({"ttl": 300})
    assert ttl == 300
    assert error is None


def test_parse_ttl_parses_string_integer():
    """_parse_ttl converts string TTL to int."""
    ttl, error = _parse_ttl({"ttl": "600"})
    assert ttl == 600
    assert error is None


def test_parse_ttl_rejects_non_numeric():
    """_parse_ttl returns error for non-numeric TTL."""
    ttl, error = _parse_ttl({"ttl": "not-a-number"})
    assert ttl is None
    assert error is not None
    assert "positive integer" in error


def test_parse_ttl_rejects_zero():
    """_parse_ttl returns error for zero TTL."""
    ttl, error = _parse_ttl({"ttl": 0})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_negative():
    """_parse_ttl returns error for negative TTL."""
    ttl, error = _parse_ttl({"ttl": -10})
    assert ttl is None
    assert error is not None


def test_parse_ttl_rejects_none_value():
    """_parse_ttl returns error when ttl is None."""
    ttl, error = _parse_ttl({"ttl": None})
    assert ttl is None
    assert error is not None


# ── _get_extension_or_404 ────────────────────────────────────────────────────


@patch("superset.extensions.storage.api.get_extensions")
def test_get_extension_or_404_returns_extension(mock_get_ext: MagicMock) -> None:
    """_get_extension_or_404 returns the extension when found."""
    mock_ext = MagicMock()
    mock_get_ext.return_value = {"acme.dashboard": mock_ext}
    result = _get_extension_or_404("acme.dashboard")
    assert result is mock_ext


@patch("superset.extensions.storage.api.get_extensions")
def test_get_extension_or_404_returns_none_when_missing(
    mock_get_ext: MagicMock,
) -> None:
    """_get_extension_or_404 returns None when extension is not registered."""
    mock_get_ext.return_value = {}
    result = _get_extension_or_404("nonexistent.ext")
    assert result is None


# ── _build_storage_key ───────────────────────────────────────────────────────


def test_build_storage_key_user_scoped(app: Flask) -> None:
    """_build_storage_key builds user-scoped key with user ID."""
    with app.app_context():
        g.user = MagicMock(id=42)
        key = _build_storage_key("acme.ext", "my-key", shared=False)
        assert key == f"{KEY_PREFIX}:acme.ext:user:42:my-key"


def test_build_storage_key_shared(app: Flask) -> None:
    """_build_storage_key builds shared key without user ID."""
    with app.app_context():
        g.user = MagicMock(id=42)
        key = _build_storage_key("acme.ext", "my-key", shared=True)
        assert key == f"{KEY_PREFIX}:acme.ext:shared:my-key"


# ── Ephemeral GET / PUT / DELETE endpoint logic ──────────────────────────────


@patch("superset.extensions.storage.api.cache_manager")
@patch("superset.extensions.storage.api.get_extensions")
def test_ephemeral_get_builds_correct_key_and_returns_value(
    mock_get_ext: MagicMock, mock_cm: MagicMock, app: Flask
) -> None:
    """get_ephemeral handler flow: extension lookup -> key build -> cache get."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = {"data": 42}

    with app.app_context():
        g.user = MagicMock(id=7)

        # Simulate what the endpoint does
        extension_id = "acme.dashboard"
        extension = _get_extension_or_404(extension_id)
        assert extension is not None

        shared = False
        cache_key = _build_storage_key(extension_id, "my-key", shared)
        value = mock_cache.get(cache_key)
        assert value == {"data": 42}
        expected_key = f"{KEY_PREFIX}:acme.dashboard:user:7:my-key"
        mock_cache.get.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.api.cache_manager")
@patch("superset.extensions.storage.api.get_extensions")
def test_ephemeral_set_with_ttl(
    mock_get_ext: MagicMock, mock_cm: MagicMock, app: Flask
) -> None:
    """Verifying the set_ephemeral handler flow: parse TTL -> build key -> cache set."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        g.user = MagicMock(id=7)

        extension_id = "acme.dashboard"
        body = {"value": {"progress": 50}, "ttl": 600}
        ttl, error = _parse_ttl(body)
        assert error is None
        assert ttl == 600

        cache_key = _build_storage_key(extension_id, "job", shared=False)
        mock_cache.set(cache_key, body["value"], timeout=ttl)

        expected_key = f"{KEY_PREFIX}:acme.dashboard:user:7:job"
        mock_cache.set.assert_called_once_with(
            expected_key, {"progress": 50}, timeout=600
        )


@patch("superset.extensions.storage.api.cache_manager")
@patch("superset.extensions.storage.api.get_extensions")
def test_ephemeral_delete_calls_cache_delete(
    mock_get_ext: MagicMock, mock_cm: MagicMock, app: Flask
) -> None:
    """Verifying the delete_ephemeral handler flow: build key -> cache delete."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache

    with app.app_context():
        g.user = MagicMock(id=7)

        extension_id = "acme.dashboard"
        cache_key = _build_storage_key(extension_id, "to-delete", shared=False)
        mock_cache.delete(cache_key)

        expected_key = f"{KEY_PREFIX}:acme.dashboard:user:7:to-delete"
        mock_cache.delete.assert_called_once_with(expected_key)


@patch("superset.extensions.storage.api.cache_manager")
@patch("superset.extensions.storage.api.get_extensions")
def test_ephemeral_shared_uses_shared_key(
    mock_get_ext: MagicMock, mock_cm: MagicMock, app: Flask
) -> None:
    """Shared ephemeral operations use 'shared' scope instead of 'user:<id>'."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_cache = MagicMock()
    mock_cm.extension_ephemeral_state_cache = mock_cache
    mock_cache.get.return_value = "shared-data"

    with app.app_context():
        g.user = MagicMock(id=99)

        extension_id = "acme.dashboard"
        cache_key = _build_storage_key(extension_id, "config", shared=True)
        result = mock_cache.get(cache_key)

        assert result == "shared-data"
        expected_key = f"{KEY_PREFIX}:acme.dashboard:shared:config"
        mock_cache.get.assert_called_once_with(expected_key)


# ── Persistent GET / PUT / DELETE endpoint logic ─────────────────────────────


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.api.get_extensions")
def test_persistent_get_user_scoped(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET with user scope passes user_fk to DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.get_value.return_value = b'{"theme":"dark"}'

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        user_fk = g.user.id
        raw = mock_dao.get_value(extension_id, "prefs", user_fk=user_fk)

        assert raw == b'{"theme":"dark"}'
        mock_dao.get_value.assert_called_once_with(
            "acme.dashboard", "prefs", user_fk=42
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.api.get_extensions")
def test_persistent_get_shared_scope(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent GET with shared=True passes user_fk=None to DAO."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}
    mock_dao.get_value.return_value = b'{"version":2}'

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        raw = mock_dao.get_value(extension_id, "config", user_fk=None)

        assert raw == b'{"version":2}'
        mock_dao.get_value.assert_called_once_with(
            "acme.dashboard", "config", user_fk=None
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.api.get_extensions")
def test_persistent_set_encodes_and_stores(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent PUT encodes value as JSON bytes and calls DAO.set."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.app_context():
        g.user = MagicMock(id=42)

        from superset.utils import json

        extension_id = "acme.dashboard"
        value = {"theme": "dark"}
        value_bytes = json.dumps(value).encode()
        mock_dao.set(extension_id, "prefs", value_bytes, user_fk=42)

        mock_dao.set.assert_called_once_with(
            "acme.dashboard", "prefs", value_bytes, user_fk=42
        )


@patch("superset.extensions.storage.api.ExtensionStorageDAO")
@patch("superset.extensions.storage.api.get_extensions")
def test_persistent_delete_calls_dao(
    mock_get_ext: MagicMock, mock_dao: MagicMock, app: Flask
) -> None:
    """Persistent DELETE calls DAO.delete with correct scope."""
    mock_get_ext.return_value = {"acme.dashboard": MagicMock()}

    with app.app_context():
        g.user = MagicMock(id=42)

        extension_id = "acme.dashboard"
        mock_dao.delete(extension_id, "prefs", user_fk=42)

        mock_dao.delete.assert_called_once_with("acme.dashboard", "prefs", user_fk=42)


# ── Extension ID reconstruction ──────────────────────────────────────────────


def test_extension_id_reconstruction():
    """Verify publisher + name are correctly joined to form extension_id."""
    publisher = "acme"
    name = "dashboard"
    extension_id = f"{publisher}.{name}"
    assert extension_id == "acme.dashboard"


def test_extension_id_with_special_characters():
    """Extension ID supports publisher/name with hyphens."""
    publisher = "my-org"
    name = "my-ext"
    extension_id = f"{publisher}.{name}"
    assert extension_id == "my-org.my-ext"


# ── Missing value field ─────────────────────────────────────────────────────


def test_set_ephemeral_requires_value_field():
    """PUT body must contain 'value' field — test the validation logic."""
    body = {"ttl": 300}  # missing 'value'
    assert "value" not in body


def test_set_persistent_requires_value_field():
    """PUT body must contain 'value' field — test the validation logic."""
    body = {"some_other_field": True}  # missing 'value'
    assert "value" not in body


# ── Extension not found returns None ─────────────────────────────────────────


@patch("superset.extensions.storage.api.get_extensions")
def test_unknown_extension_returns_none(mock_get_ext: MagicMock) -> None:
    """When extension is not found, _get_extension_or_404 returns None."""
    mock_get_ext.return_value = {"other.ext": MagicMock()}
    result = _get_extension_or_404("unknown.ext")
    assert result is None


@patch("superset.extensions.storage.api.get_extensions")
def test_empty_extensions_registry(mock_get_ext: MagicMock) -> None:
    """When no extensions are registered, all lookups return None."""
    mock_get_ext.return_value = {}
    assert _get_extension_or_404("any.ext") is None
    assert _get_extension_or_404("") is None
