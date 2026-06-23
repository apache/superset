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

"""Tests for ExtensionStorageDAO — encryption, scoping, and CRUD behavior."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.extensions.storage.persistent_state_dao import (
    _derive_key,
    _enc_type,
    ExtensionStorageDAO,
)


@pytest.fixture
def app() -> Flask:
    """Create a minimal Flask app for testing."""
    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = True
    flask_app.config["SECRET_KEY"] = "test-secret-key"  # noqa: S105
    return flask_app


# ── get / get_value ───────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_get_returns_none_when_not_found(mock_db: MagicMock, app: Flask) -> None:
    """get() returns None when no entry exists for the given scope."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.get("my-ext", "key", user_fk=1)

    assert result is None


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_get_value_returns_raw_bytes_for_unencrypted(
    mock_db: MagicMock, app: Flask
) -> None:
    """get_value() returns raw bytes unchanged when the entry is not encrypted."""
    entry = MagicMock()
    entry.is_encrypted = False
    entry.value = b'{"foo": "bar"}'
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry

    with app.app_context():
        result = ExtensionStorageDAO.get_value("my-ext", "key", user_fk=1)

    assert result == b'{"foo": "bar"}'


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_get_value_returns_none_when_not_found(
    mock_db: MagicMock, app: Flask
) -> None:
    """get_value() returns None when the key does not exist."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.get_value("my-ext", "missing", user_fk=1)

    assert result is None


@patch("superset.extensions.storage.persistent_state_dao._enc_type")
@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_get_value_decrypts_encrypted_entry(
    mock_db: MagicMock, mock_enc_type: MagicMock, app: Flask
) -> None:
    """get_value() decrypts the stored value for encrypted entries."""
    entry = MagicMock()
    entry.is_encrypted = True
    entry.user_fk = 1
    entry.value = b"encrypted-bytes"
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry
    mock_enc_type.return_value.process_result_value.return_value = (
        b'{"decrypted": true}'
    )

    with app.app_context():
        result = ExtensionStorageDAO.get_value("my-ext", "key", user_fk=1)

    assert result == b'{"decrypted": true}'
    mock_enc_type.assert_called_once_with(1)
    mock_enc_type.return_value.process_result_value.assert_called_once_with(
        b"encrypted-bytes", mock_db.engine.dialect
    )


@patch("superset.extensions.storage.persistent_state_dao._enc_type")
@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_get_value_returns_none_on_decryption_failure(
    mock_db: MagicMock, mock_enc_type: MagicMock, app: Flask
) -> None:
    """get_value() returns None and logs an error when decryption fails."""
    entry = MagicMock()
    entry.is_encrypted = True
    entry.user_fk = 1
    entry.value = b"corrupted"
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry
    mock_enc_type.return_value.process_result_value.side_effect = Exception(
        "bad decrypt"
    )

    with app.app_context():
        result = ExtensionStorageDAO.get_value("my-ext", "key", user_fk=1)

    assert result is None


# ── set (upsert) ──────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_set_creates_new_entry_when_absent(mock_db: MagicMock, app: Flask) -> None:
    """set() adds a new entry when no existing entry is found."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"value": 1}', user_fk=1)

    mock_db.session.add.assert_called_once()
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_set_updates_existing_entry(mock_db: MagicMock, app: Flask) -> None:
    """set() updates in-place when an entry already exists (no duplicate row)."""
    existing = MagicMock()
    mock_db.session.query.return_value.filter.return_value.first.return_value = existing

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"new": true}', user_fk=1)

    assert existing.value == b'{"new": true}'
    mock_db.session.add.assert_not_called()
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_state_dao._enc_type")
@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_set_encrypts_value_when_requested(
    mock_db: MagicMock, mock_enc_type: MagicMock, app: Flask
) -> None:
    """set() encrypts value bytes with user-derived key and sets is_encrypted=True."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None
    mock_enc_type.return_value.process_bind_param.return_value = b"ciphertext"

    with app.app_context():
        ExtensionStorageDAO.set(
            "my-ext", "key", b"plaintext", user_fk=1, is_encrypted=True
        )

    mock_enc_type.assert_called_once_with(1)
    mock_enc_type.return_value.process_bind_param.assert_called_once_with(
        b"plaintext", mock_db.engine.dialect
    )
    added_entry = mock_db.session.add.call_args[0][0]
    assert added_entry.value == b"ciphertext"
    assert added_entry.is_encrypted is True


# ── delete ────────────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_delete_returns_true_when_entry_exists(
    mock_db: MagicMock, app: Flask
) -> None:
    """delete() returns True and removes the row when the entry is found."""
    entry = MagicMock()
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry

    with app.app_context():
        result = ExtensionStorageDAO.delete("my-ext", "key", user_fk=1)

    assert result is True
    mock_db.session.delete.assert_called_once_with(entry)
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_delete_returns_false_when_not_found(
    mock_db: MagicMock, app: Flask
) -> None:
    """delete() returns False without touching the session when entry is absent."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.delete("my-ext", "key", user_fk=1)

    assert result is False
    mock_db.session.delete.assert_not_called()


# ── scoping ───────────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_state_dao.db")
def test_dao_user_and_shared_scopes_issue_independent_queries(
    mock_db: MagicMock, app: Flask
) -> None:
    """User-scoped (user_fk=N) and shared-scoped (user_fk=None) lookups are separate."""
    first_call = MagicMock(return_value=None)
    mock_db.session.query.return_value.filter.return_value.first = first_call

    with app.app_context():
        ExtensionStorageDAO.get("my-ext", "key", user_fk=42)
        ExtensionStorageDAO.get("my-ext", "key", user_fk=None)

    # Each scope issues its own independent DB query
    assert first_call.call_count == 2


# ── key derivation ────────────────────────────────────────────────────────────


def test_enc_type_user_scoped_uses_derived_key(app: Flask) -> None:
    """User-scoped _enc_type derives the key from SECRET_KEY + user_fk."""
    with app.app_context():
        secret = app.config["SECRET_KEY"]
        enc = _enc_type(user_fk=42)
        expected_key = _derive_key(secret, 42)
        # The key lambda on the EncryptedType resolves to the derived key.
        assert enc.key == expected_key


def test_enc_type_shared_uses_secret_key_directly(app: Flask) -> None:
    """Shared _enc_type (user_fk=None) uses SECRET_KEY without derivation."""
    with app.app_context():
        secret = app.config["SECRET_KEY"]
        enc = _enc_type(user_fk=None)
        assert enc.key == secret


def test_enc_type_different_users_produce_different_keys(app: Flask) -> None:
    """Two different user IDs produce different derived keys."""
    with app.app_context():
        enc_a = _enc_type(user_fk=1)
        enc_b = _enc_type(user_fk=2)
        assert enc_a.key != enc_b.key


def test_enc_type_user_key_differs_from_shared_key(app: Flask) -> None:
    """User-scoped derived key differs from the plain SECRET_KEY used for shared."""
    with app.app_context():
        secret = app.config["SECRET_KEY"]
        enc_user = _enc_type(user_fk=1)
        assert enc_user.key != secret
