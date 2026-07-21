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

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from flask_babel import Babel
from sqlalchemy.orm.session import Session

from superset.extensions.storage.codecs import get_codec
from superset.extensions.storage.filters import ExtensionStorageFilter
from superset.extensions.storage.persistent_dao import (
    _derive_key,
    _enc_type,
    ExtensionStorageDAO,
    ExtensionStorageKeyTooLong,
    ExtensionStorageListPayloadTooLarge,
    ExtensionStorageQuotaExceeded,
    ExtensionStorageValueTooLarge,
    MAX_KEY_LENGTH,
    SET_LOCK_TTL_SECONDS,
)
from superset.extensions.storage.persistent_model import ExtensionStorage


@pytest.fixture
def app() -> Flask:
    """Create a minimal Flask app for testing."""
    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = True
    flask_app.config["SECRET_KEY"] = "test-secret-key"  # noqa: S105
    # Mirrors the default set in superset/config.py, which is always present
    # in a real Superset app.
    flask_app.config["EXTENSIONS_PERSISTENT_STORAGE"] = {}
    return flask_app


@pytest.fixture
def app_with_quota(app: Flask) -> Flask:
    """App fixture with a configured persistent storage quota (100 bytes).

    Initializes Babel since exceeding the quota raises an exception whose
    message is built with flask_babel's gettext.
    """
    app.config["EXTENSIONS_PERSISTENT_STORAGE"] = {"QUOTA_PER_EXTENSION": 100}
    Babel(app)
    return app


@pytest.fixture
def app_with_max_value_size(app: Flask) -> Flask:
    """App fixture with a configured MAX_VALUE_SIZE (10 bytes).

    Initializes Babel since exceeding the limit raises an exception whose
    message is built with flask_babel's gettext.
    """
    app.config["EXTENSIONS_PERSISTENT_STORAGE"] = {"MAX_VALUE_SIZE": 10}
    Babel(app)
    return app


@pytest.fixture
def app_with_max_list_payload_size(app: Flask) -> Flask:
    """App fixture with a configured MAX_LIST_PAYLOAD_SIZE (20 bytes).

    Initializes Babel since exceeding the limit raises an exception whose
    message is built with flask_babel's gettext.
    """
    app.config["EXTENSIONS_PERSISTENT_STORAGE"] = {"MAX_LIST_PAYLOAD_SIZE": 20}
    Babel(app)
    return app


@pytest.fixture(autouse=True)
def mock_distributed_lock() -> Generator[MagicMock, None, None]:
    """`ExtensionStorageDAO.set` wraps its select-then-write section in a
    `DistributedLock`, which needs a configured lock backend (Redis or an
    initialized DB session) to acquire. These tests exercise DAO logic
    against a mocked `db`, not lock acquisition, so replace it with a no-op.
    """
    with patch("superset.extensions.storage.persistent_dao.DistributedLock") as mock:
        yield mock


@pytest.fixture
def list_session(session: Session) -> Session:
    """In-memory SQLite session with the extension_storage table created,
    used only by `list()` tests below (which exercise real queries rather
    than mocking `db.session`, since `list()`'s query chain — count,
    order_by, offset, limit, a value_size subquery sum — is too complex to
    mock link-by-link without the test just re-asserting the
    implementation)."""
    ExtensionStorage.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    return session


def _create_entry(
    session: Session,
    extension_id: str,
    key: str,
    value: bytes = b"{}",
    codec: str = "json",
    user_fk: int | None = None,
    resource_type: str | None = None,
    resource_uuid: str | None = None,
    is_encrypted: bool = False,
) -> ExtensionStorage:
    """Insert an ExtensionStorage row directly, bypassing DAO.set() (whose
    own validation isn't what these `list()` tests are exercising)."""
    entry = ExtensionStorage(
        extension_id=extension_id,
        key=key,
        value=value,
        value_size=len(value),
        codec=codec,
        user_fk=user_fk,
        resource_type=resource_type,
        resource_uuid=resource_uuid,
        is_encrypted=is_encrypted,
    )
    session.add(entry)
    session.flush()
    return entry


# ── get / get_value ───────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_get_returns_none_when_not_found(mock_db: MagicMock, app: Flask) -> None:
    """get() returns None when no entry exists for the given scope."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.get("my-ext", "key", user_fk=1)

    assert result is None


@patch("superset.extensions.storage.persistent_dao.db")
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


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_get_value_returns_none_when_not_found(
    mock_db: MagicMock, app: Flask
) -> None:
    """get_value() returns None when the key does not exist."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.get_value("my-ext", "missing", user_fk=1)

    assert result is None


# ── get_decoded_value ─────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_get_decoded_value_decodes_with_stored_codec(
    mock_db: MagicMock, app: Flask
) -> None:
    """get_decoded_value() decodes the raw bytes using the entry's codec."""
    entry = MagicMock()
    entry.is_encrypted = False
    entry.value = b'{"theme": "dark"}'
    entry.codec = "json"
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry

    with app.app_context():
        result = ExtensionStorageDAO.get_decoded_value("my-ext", "key", user_fk=1)

    assert result == {"theme": "dark"}


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_get_decoded_value_returns_none_when_not_found(
    mock_db: MagicMock, app: Flask
) -> None:
    """get_decoded_value() returns None when no entry exists."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.get_decoded_value("my-ext", "missing", user_fk=1)

    assert result is None


@patch("superset.extensions.storage.persistent_dao._enc_type")
@patch("superset.extensions.storage.persistent_dao.db")
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


@patch("superset.extensions.storage.persistent_dao._enc_type")
@patch("superset.extensions.storage.persistent_dao.db")
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


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_creates_new_entry_when_absent(mock_db: MagicMock, app: Flask) -> None:
    """set() adds a new entry when no existing entry is found."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"value": 1}', user_fk=1)

    mock_db.session.add.assert_called_once()
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_locks_the_whole_extension_not_just_the_key(
    mock_db: MagicMock, mock_distributed_lock: MagicMock, app: Flask
) -> None:
    """set()'s lock is scoped to extension_id alone, not to the specific key:
    _check_quota sums usage across every key in the extension, so a lock
    scoped to just this key would let concurrent writes to different keys
    each pass the quota check before either commits, letting the extension
    exceed its quota."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"value": 1}', user_fk=1)

    mock_distributed_lock.assert_called_once_with(
        namespace="extension_storage_set",
        ttl_seconds=SET_LOCK_TTL_SECONDS,
        extension_id="my-ext",
    )


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_updates_existing_entry(mock_db: MagicMock, app: Flask) -> None:
    """set() updates in-place when an entry already exists (no duplicate row)."""
    existing = MagicMock()
    existing.value_size = 0
    mock_db.session.query.return_value.filter.return_value.first.return_value = existing

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"new": true}', user_fk=1)

    assert existing.value == b'{"new": true}'
    assert existing.value_size == len(b'{"new": true}')
    mock_db.session.add.assert_not_called()
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_defaults_codec_to_json(mock_db: MagicMock, app: Flask) -> None:
    """set() stores codec="json" on the entry when not specified."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"value": 1}', user_fk=1)

    added_entry = mock_db.session.add.call_args[0][0]
    assert added_entry.codec == "json"


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_stores_given_codec(mock_db: MagicMock, app: Flask) -> None:
    """set() stores the caller-supplied codec identifier on the entry."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set(
            "my-ext", "key", b"\x80pickled", codec="pickle", user_fk=1
        )

    added_entry = mock_db.session.add.call_args[0][0]
    assert added_entry.codec == "pickle"


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_updates_codec_on_existing_entry(
    mock_db: MagicMock, app: Flask
) -> None:
    """set() overwrites the stored codec when re-writing an existing key."""
    existing = MagicMock()
    existing.value_size = 0
    existing.codec = "json"
    mock_db.session.query.return_value.filter.return_value.first.return_value = existing

    with app.app_context():
        ExtensionStorageDAO.set(
            "my-ext", "key", b"\x80pickled", codec="pickle", user_fk=1
        )

    assert existing.codec == "pickle"


@patch("superset.extensions.storage.persistent_dao._enc_type")
@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_encrypts_value_when_requested(
    mock_db: MagicMock, mock_enc_type: MagicMock, app: Flask
) -> None:
    """set() encrypts value bytes with user-derived key and sets is_encrypted=True."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None
    mock_enc_type.return_value.process_bind_param.return_value = b"ciphertext"

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b"plaintext", user_fk=1, encrypt=True)

    mock_enc_type.assert_called_once_with(1)
    mock_enc_type.return_value.process_bind_param.assert_called_once_with(
        b"plaintext", mock_db.engine.dialect
    )
    added_entry = mock_db.session.add.call_args[0][0]
    assert added_entry.value == b"ciphertext"
    assert added_entry.value_size == len(b"ciphertext")
    assert added_entry.is_encrypted is True


# ── value size ────────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_allows_key_at_max_length(mock_db: MagicMock, app: Flask) -> None:
    """set() accepts a key exactly at MAX_KEY_LENGTH."""
    Babel(app)
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "k" * MAX_KEY_LENGTH, b"value", user_fk=1)

    mock_db.session.add.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_rejects_key_exceeding_max_length(
    mock_db: MagicMock, app: Flask
) -> None:
    """set() raises ExtensionStorageKeyTooLong and does not write when the
    key exceeds MAX_KEY_LENGTH."""
    Babel(app)
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        with pytest.raises(ExtensionStorageKeyTooLong):
            ExtensionStorageDAO.set(
                "my-ext", "k" * (MAX_KEY_LENGTH + 1), b"value", user_fk=1
            )

    mock_db.session.add.assert_not_called()
    mock_db.session.flush.assert_not_called()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_checks_key_length_before_value_size(
    mock_db: MagicMock, app: Flask
) -> None:
    """set() rejects an over-length key before running the value-size query,
    since the key check happens first."""
    Babel(app)
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        with pytest.raises(ExtensionStorageKeyTooLong):
            ExtensionStorageDAO.set(
                "my-ext", "k" * (MAX_KEY_LENGTH + 1), b"value", user_fk=1
            )

    mock_db.session.query.return_value.filter.return_value.first.assert_not_called()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_allows_write_when_no_max_value_size_configured(
    mock_db: MagicMock, app: Flask
) -> None:
    """set() skips the value-size check entirely when MAX_VALUE_SIZE is unset."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 10000, user_fk=1)

    mock_db.session.add.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_allows_value_within_max_value_size(
    mock_db: MagicMock, app_with_max_value_size: Flask
) -> None:
    """set() accepts a value at or under MAX_VALUE_SIZE."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app_with_max_value_size.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 10, user_fk=1)

    mock_db.session.add.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_rejects_value_exceeding_max_value_size(
    mock_db: MagicMock, app_with_max_value_size: Flask
) -> None:
    """set() raises ExtensionStorageValueTooLarge and does not write when the
    value exceeds MAX_VALUE_SIZE."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app_with_max_value_size.app_context():
        with pytest.raises(ExtensionStorageValueTooLarge):
            ExtensionStorageDAO.set("my-ext", "key", b"x" * 11, user_fk=1)

    mock_db.session.add.assert_not_called()
    mock_db.session.flush.assert_not_called()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_checks_value_size_before_quota(
    mock_db: MagicMock, app_with_max_value_size: Flask
) -> None:
    """set() rejects an oversized value before running the quota usage query."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app_with_max_value_size.app_context():
        with pytest.raises(ExtensionStorageValueTooLarge):
            ExtensionStorageDAO.set("my-ext", "key", b"x" * 11, user_fk=1)

    # scalar() is only called by the quota-usage query; it must not run.
    mock_db.session.query.return_value.filter.return_value.scalar.assert_not_called()


# ── quota ─────────────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_allows_write_when_no_quota_configured(
    mock_db: MagicMock, app: Flask
) -> None:
    """set() skips the quota check entirely when no quota is configured."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b'{"value": 1}', user_fk=1)

    # scalar() is only called by the quota-usage query; it must not run.
    mock_db.session.query.return_value.filter.return_value.scalar.assert_not_called()
    mock_db.session.add.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_allows_write_under_quota(
    mock_db: MagicMock, app_with_quota: Flask
) -> None:
    """set() succeeds when current usage plus the new value stays within quota."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None
    mock_db.session.query.return_value.filter.return_value.scalar.return_value = 50

    with app_with_quota.app_context():
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 10, user_fk=1)

    mock_db.session.add.assert_called_once()
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_rejects_write_over_quota(
    mock_db: MagicMock, app_with_quota: Flask
) -> None:
    """set() raises ExtensionStorageQuotaExceeded and does not write when over quota."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None
    mock_db.session.query.return_value.filter.return_value.scalar.return_value = 95

    with app_with_quota.app_context(), pytest.raises(ExtensionStorageQuotaExceeded):
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 10, user_fk=1)

    mock_db.session.add.assert_not_called()
    mock_db.session.flush.assert_not_called()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_overwrite_does_not_double_count_existing_row(
    mock_db: MagicMock, app_with_quota: Flask
) -> None:
    """Overwriting a key nets out its own existing size against quota usage."""
    existing = MagicMock()
    existing.value = b"x" * 20
    existing.value_size = 20
    mock_db.session.query.return_value.filter.return_value.first.return_value = existing
    # Usage already includes the 20 bytes this row occupies.
    mock_db.session.query.return_value.filter.return_value.scalar.return_value = 95

    with app_with_quota.app_context():
        # Same-size replacement: 95 - 20 + 20 = 95 <= 100, must not raise even
        # though total usage (95) is already close to the 100-byte quota.
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 20, user_fk=1)

    assert existing.value == b"x" * 20
    assert existing.value_size == 20
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_set_overwrite_still_rejected_when_growth_exceeds_quota(
    mock_db: MagicMock, app_with_quota: Flask
) -> None:
    """Overwriting with a larger value is rejected if the *net* growth exceeds quota."""
    existing = MagicMock()
    existing.value = b"x" * 20
    existing.value_size = 20
    mock_db.session.query.return_value.filter.return_value.first.return_value = existing
    mock_db.session.query.return_value.filter.return_value.scalar.return_value = 95

    with app_with_quota.app_context(), pytest.raises(ExtensionStorageQuotaExceeded):
        # 95 - 20 + 30 = 105 > 100
        ExtensionStorageDAO.set("my-ext", "key", b"x" * 30, user_fk=1)

    assert existing.value == b"x" * 20
    assert existing.value_size == 20


# ── create (disallowed) ────────────────────────────────────────────────────────


def test_dao_create_raises_not_implemented(app: Flask) -> None:
    """create() is BaseDAO's raw insert, with no upsert dedup, quota check,
    or locking against the key set() writes to — it must raise rather than
    silently allow constructing a row outside set()'s guarantees."""
    with app.app_context(), pytest.raises(NotImplementedError):
        ExtensionStorageDAO.create()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_delete_by_key_returns_true_when_entry_exists(
    mock_db: MagicMock, app: Flask
) -> None:
    """delete_by_key() returns True and removes the row when the entry is found."""
    entry = MagicMock()
    mock_db.session.query.return_value.filter.return_value.first.return_value = entry

    with app.app_context():
        result = ExtensionStorageDAO.delete_by_key("my-ext", "key", user_fk=1)

    assert result is True
    mock_db.session.delete.assert_called_once_with(entry)
    mock_db.session.flush.assert_called_once()


@patch("superset.extensions.storage.persistent_dao.db")
def test_dao_delete_by_key_returns_false_when_not_found(
    mock_db: MagicMock, app: Flask
) -> None:
    """delete_by_key() returns False without touching the session when absent."""
    mock_db.session.query.return_value.filter.return_value.first.return_value = None

    with app.app_context():
        result = ExtensionStorageDAO.delete_by_key("my-ext", "key", user_fk=1)

    assert result is False
    mock_db.session.delete.assert_not_called()


# ── scoping ───────────────────────────────────────────────────────────────────


@patch("superset.extensions.storage.persistent_dao.db")
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


def test_dao_is_wired_to_the_extension_storage_model_and_filter() -> None:
    """ExtensionStorageDAO is a BaseDAO[ExtensionStorage] scoped by
    ExtensionStorageFilter, so filter_by/find_all/query/create/update/delete
    (inherited from BaseDAO) are automatically restricted to the calling
    extension's own rows when used via superset_core.extensions.storage.dao.
    """
    assert ExtensionStorageDAO.model_cls is ExtensionStorage
    assert ExtensionStorageDAO.base_filter is ExtensionStorageFilter


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


# ── list ──────────────────────────────────────────────────────────────────────


def test_list_returns_entries_and_total_count(
    app: Flask, list_session: Session
) -> None:
    """list() returns decoded entries plus the total count across all pages."""
    _create_entry(list_session, "my-ext", "a", value=b'{"n": 1}', user_fk=1)
    _create_entry(list_session, "my-ext", "b", value=b'{"n": 2}', user_fk=1)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 2
    assert {e.key for e in entries} == {"a", "b"}
    decoded = {}
    for e in entries:
        assert e.value is not None
        decoded[e.key] = get_codec(e.codec).decode(e.value)
    assert decoded == {"a": {"n": 1}, "b": {"n": 2}}


def test_list_scopes_by_extension_id(app: Flask, list_session: Session) -> None:
    """list() only returns entries for the given extension_id."""
    _create_entry(list_session, "ext-a", "key", user_fk=1)
    _create_entry(list_session, "ext-b", "key", user_fk=1)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("ext-a", user_fk=1)

    assert total_count == 1
    assert entries[0].key == "key"


def test_list_scopes_by_user_fk(app: Flask, list_session: Session) -> None:
    """list() only returns entries matching the given user_fk (or global
    scope when user_fk=None)."""
    _create_entry(list_session, "my-ext", "mine", user_fk=1)
    _create_entry(list_session, "my-ext", "theirs", user_fk=2)
    _create_entry(list_session, "my-ext", "shared", user_fk=None)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 1
    assert entries[0].key == "mine"


def test_list_scopes_by_resource(app: Flask, list_session: Session) -> None:
    """list() only returns entries matching the given resource_type/uuid."""
    _create_entry(
        list_session,
        "my-ext",
        "a",
        resource_type="dashboard",
        resource_uuid="uuid-1",
    )
    _create_entry(
        list_session,
        "my-ext",
        "b",
        resource_type="dashboard",
        resource_uuid="uuid-2",
    )

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries(
            "my-ext", resource_type="dashboard", resource_uuid="uuid-1"
        )

    assert total_count == 1
    assert entries[0].key == "a"


def test_list_paginates_with_page_and_page_size(
    app: Flask, list_session: Session
) -> None:
    """list() applies offset/limit based on page and page_size, while
    total_count still reflects every matching row, not just the page."""
    for i in range(5):
        _create_entry(list_session, "my-ext", f"key-{i}", user_fk=1)

    with app.app_context():
        page_0, total_0 = ExtensionStorageDAO.list_entries(
            "my-ext", user_fk=1, page=0, page_size=2
        )
        page_1, total_1 = ExtensionStorageDAO.list_entries(
            "my-ext", user_fk=1, page=1, page_size=2
        )

    assert total_0 == total_1 == 5
    assert len(page_0) == 2
    assert len(page_1) == 2
    assert {e.key for e in page_0}.isdisjoint({e.key for e in page_1})


def test_list_defaults_to_page_size_ten(app: Flask, list_session: Session) -> None:
    """list() returns at most 10 entries per page when page_size is not given."""
    for i in range(15):
        _create_entry(list_session, "my-ext", f"key-{i}", user_fk=1)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 15
    assert len(entries) == 10


def test_list_allows_page_size_larger_than_ten(
    app: Flask, list_session: Session
) -> None:
    """list() has no row-count ceiling — a caller-supplied page_size above
    the default of 10 is honored, subject only to MAX_LIST_PAYLOAD_SIZE."""
    for i in range(15):
        _create_entry(list_session, "my-ext", f"key-{i}", user_fk=1)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries(
            "my-ext", user_fk=1, page_size=15
        )

    assert total_count == 15
    assert len(entries) == 15


def test_list_orders_by_changed_on_descending(
    app: Flask, list_session: Session
) -> None:
    """list() orders entries most-recently-changed first."""
    from datetime import datetime, timedelta, timezone

    first = _create_entry(list_session, "my-ext", "first", user_fk=1)
    second = _create_entry(list_session, "my-ext", "second", user_fk=1)
    now = datetime.now(timezone.utc)
    first.changed_on = now - timedelta(hours=1)
    second.changed_on = now
    list_session.flush()

    with app.app_context():
        entries, _ = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert [e.key for e in entries] == ["second", "first"]


def test_list_allows_page_within_max_list_payload_size(
    app_with_max_list_payload_size: Flask, list_session: Session
) -> None:
    """list() succeeds when the page's combined value_size is within
    MAX_LIST_PAYLOAD_SIZE (20 bytes in this fixture)."""
    _create_entry(list_session, "my-ext", "a", value=b"x" * 10, user_fk=1)
    _create_entry(list_session, "my-ext", "b", value=b"x" * 10, user_fk=1)

    with app_with_max_list_payload_size.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 2
    assert len(entries) == 2


def test_list_rejects_page_exceeding_max_list_payload_size(
    app_with_max_list_payload_size: Flask, list_session: Session
) -> None:
    """list() raises ExtensionStorageListPayloadTooLarge when the requested
    page's combined value_size exceeds MAX_LIST_PAYLOAD_SIZE, without
    fetching the oversized rows' `value` column."""
    _create_entry(list_session, "my-ext", "a", value=b"x" * 15, user_fk=1)
    _create_entry(list_session, "my-ext", "b", value=b"x" * 15, user_fk=1)

    with app_with_max_list_payload_size.app_context():
        with pytest.raises(ExtensionStorageListPayloadTooLarge):
            ExtensionStorageDAO.list_entries("my-ext", user_fk=1)


def test_list_payload_size_check_considers_only_the_requested_page(
    app_with_max_list_payload_size: Flask, list_session: Session
) -> None:
    """A row excluded from the requested page by pagination does not count
    against MAX_LIST_PAYLOAD_SIZE for that page."""
    # Page 0 (page_size=1) contains only one 15-byte row — within the
    # 20-byte budget — even though a second 15-byte row exists overall.
    _create_entry(list_session, "my-ext", "a", value=b"x" * 15, user_fk=1)
    _create_entry(list_session, "my-ext", "b", value=b"x" * 15, user_fk=1)

    with app_with_max_list_payload_size.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries(
            "my-ext", user_fk=1, page_size=1
        )

    assert total_count == 2
    assert len(entries) == 1


def test_list_allows_unlimited_payload_when_not_configured(
    app: Flask, list_session: Session
) -> None:
    """list() skips the payload-size check entirely when
    MAX_LIST_PAYLOAD_SIZE is not configured."""
    for i in range(3):
        _create_entry(list_session, "my-ext", f"key-{i}", value=b"x" * 1000, user_fk=1)

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 3
    assert len(entries) == 3


@patch("superset.extensions.storage.persistent_dao._enc_type")
@patch("superset.extensions.storage.persistent_dao.db")
def test_list_decrypts_encrypted_entries(
    mock_db: MagicMock, mock_enc_type: MagicMock, app: Flask
) -> None:
    """list() decrypts entries written with is_encrypted=True before
    returning them, same as get_value()."""
    entry = MagicMock()
    entry.key = "secret"
    entry.value = b"encrypted-bytes"
    entry.is_encrypted = True
    entry.user_fk = 1
    entry.codec = "json"
    mock_db.session.query.return_value.filter.return_value.count.return_value = 1
    page_query = (
        mock_db.session.query.return_value.filter.return_value.order_by.return_value
    )
    page_query.offset.return_value.limit.return_value.all.return_value = [entry]
    mock_enc_type.return_value.process_result_value.return_value = b"plaintext"

    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert total_count == 1
    assert len(entries) == 1
    assert entries[0].is_encrypted is True
    assert entries[0].value == b"plaintext"


def test_list_returns_empty_when_no_entries_match(
    app: Flask, list_session: Session
) -> None:
    """list() returns an empty list and total_count=0 when nothing matches."""
    with app.app_context():
        entries, total_count = ExtensionStorageDAO.list_entries("my-ext", user_fk=1)

    assert entries == []
    assert total_count == 0
