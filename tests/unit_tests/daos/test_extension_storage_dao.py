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

"""Unit tests for ExtensionStorageDAO.

Covers the three storage scopes (global, user, resource) and verifies that
scope isolation, upsert semantics, and delete behaviour all work correctly.
Encryption is tested via a mock Fernet key derived from the test SECRET_KEY.
"""

from typing import Iterator

import pytest
from sqlalchemy.orm.session import Session

from superset.extension_storage.daos import ExtensionStorageDAO
from superset.extension_storage.models import ExtensionStorage


@pytest.fixture
def session(session: Session) -> Iterator[Session]:
    """Extend the base session fixture with the extension_storage table."""
    engine = session.get_bind()
    ExtensionStorage.metadata.create_all(engine)
    yield session
    session.rollback()


EXT_A = "community.jupyter-notebook"
EXT_B = "community.other-extension"
USER_1 = 1
USER_2 = 2
RES_TYPE = "dashboard"
RES_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_entry(
    session: Session,
    *,
    extension_id: str = EXT_A,
    key: str = "mykey",
    value: bytes = b"hello",
    value_type: str = "application/json",
    user_fk: int | None = None,
    resource_type: str | None = None,
    resource_uuid: str | None = None,
    category: str | None = None,
) -> ExtensionStorage:
    entry = ExtensionStorage(
        extension_id=extension_id,
        key=key,
        value=value,
        value_type=value_type,
        user_fk=user_fk,
        resource_type=resource_type,
        resource_uuid=resource_uuid,
        category=category,
        is_encrypted=False,
    )
    session.add(entry)
    session.flush()
    return entry


# ── Global scope ──────────────────────────────────────────────────────────────


def test_set_and_get_global(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "cfg", b'{"theme":"dark"}')
    val = ExtensionStorageDAO.get_value(EXT_A, "cfg")
    assert val == b'{"theme":"dark"}'


def test_global_upsert_updates_value(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "cfg", b"v1")
    ExtensionStorageDAO.set(EXT_A, "cfg", b"v2")
    entries = ExtensionStorageDAO.list_global(EXT_A)
    assert len(entries) == 1
    assert entries[0].value == b"v2"


def test_global_delete(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "cfg", b"data")
    deleted = ExtensionStorageDAO.delete(EXT_A, "cfg")
    assert deleted is True
    assert ExtensionStorageDAO.get_value(EXT_A, "cfg") is None


def test_global_delete_missing_returns_false(session: Session) -> None:
    assert ExtensionStorageDAO.delete(EXT_A, "nonexistent") is False


def test_global_scope_isolated_from_user_scope(session: Session) -> None:
    """A global key and a same-named user key do not collide."""
    ExtensionStorageDAO.set(EXT_A, "key", b"global-val")
    ExtensionStorageDAO.set(EXT_A, "key", b"user-val", user_fk=USER_1)
    assert ExtensionStorageDAO.get_value(EXT_A, "key") == b"global-val"
    assert ExtensionStorageDAO.get_value(EXT_A, "key", user_fk=USER_1) == b"user-val"


def test_list_global_filtered_by_extension(session: Session) -> None:
    _make_entry(session, extension_id=EXT_A, key="k1")
    _make_entry(session, extension_id=EXT_A, key="k2")
    _make_entry(session, extension_id=EXT_B, key="k3")
    results = ExtensionStorageDAO.list_global(EXT_A)
    keys = {r.key for r in results}
    assert keys == {"k1", "k2"}


def test_list_global_filtered_by_category(session: Session) -> None:
    _make_entry(session, key="k1", category="notebook")
    _make_entry(session, key="k2", category="chart")
    results = ExtensionStorageDAO.list_global(EXT_A, category="notebook")
    assert all(r.category == "notebook" for r in results)
    assert {r.key for r in results} == {"k1"}


# ── User scope ────────────────────────────────────────────────────────────────


def test_set_and_get_user(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "prefs", b"data", user_fk=USER_1)
    val = ExtensionStorageDAO.get_value(EXT_A, "prefs", user_fk=USER_1)
    assert val == b"data"


def test_user_scope_isolated_between_users(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "prefs", b"u1", user_fk=USER_1)
    ExtensionStorageDAO.set(EXT_A, "prefs", b"u2", user_fk=USER_2)
    assert ExtensionStorageDAO.get_value(EXT_A, "prefs", user_fk=USER_1) == b"u1"
    assert ExtensionStorageDAO.get_value(EXT_A, "prefs", user_fk=USER_2) == b"u2"


def test_user_upsert(session: Session) -> None:
    ExtensionStorageDAO.set(EXT_A, "prefs", b"old", user_fk=USER_1)
    ExtensionStorageDAO.set(EXT_A, "prefs", b"new", user_fk=USER_1)
    entries = ExtensionStorageDAO.list_user(EXT_A, USER_1)
    assert len(entries) == 1
    assert entries[0].value == b"new"


def test_list_user_does_not_include_other_users(session: Session) -> None:
    _make_entry(session, key="u1k", user_fk=USER_1)
    _make_entry(session, key="u2k", user_fk=USER_2)
    results = ExtensionStorageDAO.list_user(EXT_A, USER_1)
    assert all(r.user_fk == USER_1 for r in results)


# ── Resource scope ────────────────────────────────────────────────────────────


def test_set_and_get_resource(session: Session) -> None:
    ExtensionStorageDAO.set(
        EXT_A,
        "state",
        b"res-val",
        resource_type=RES_TYPE,
        resource_uuid=RES_UUID,
    )
    val = ExtensionStorageDAO.get_value(
        EXT_A, "state", resource_type=RES_TYPE, resource_uuid=RES_UUID
    )
    assert val == b"res-val"


def test_resource_scope_isolated_by_uuid(session: Session) -> None:
    uuid2 = "11111111-2222-3333-4444-555555555555"
    ExtensionStorageDAO.set(
        EXT_A, "k", b"r1", resource_type=RES_TYPE, resource_uuid=RES_UUID
    )
    ExtensionStorageDAO.set(
        EXT_A, "k", b"r2", resource_type=RES_TYPE, resource_uuid=uuid2
    )
    assert (
        ExtensionStorageDAO.get_value(
            EXT_A, "k", resource_type=RES_TYPE, resource_uuid=RES_UUID
        )
        == b"r1"
    )
    assert (
        ExtensionStorageDAO.get_value(
            EXT_A, "k", resource_type=RES_TYPE, resource_uuid=uuid2
        )
        == b"r2"
    )


def test_list_resource(session: Session) -> None:
    _make_entry(session, key="ra", resource_type=RES_TYPE, resource_uuid=RES_UUID)
    _make_entry(session, key="rb", resource_type=RES_TYPE, resource_uuid=RES_UUID)
    _make_entry(session, key="rc", resource_type="chart", resource_uuid=RES_UUID)
    results = ExtensionStorageDAO.list_resource(EXT_A, RES_TYPE, RES_UUID)
    keys = {r.key for r in results}
    assert keys == {"ra", "rb"}


# ── Pagination ────────────────────────────────────────────────────────────────


def test_list_user_pagination(session: Session) -> None:
    """list_user returns all rows; callers slice for pagination."""
    for i in range(10):
        _make_entry(session, key=f"page-{i}", user_fk=USER_1)
    all_entries = ExtensionStorageDAO.list_user(EXT_A, USER_1)
    assert len(all_entries) == 10
    # Simulate first page (page_size=3)
    page0 = all_entries[0:3]
    page1 = all_entries[3:6]
    assert len(page0) == 3
    assert len(page1) == 3
    # No overlap between pages
    assert {e.key for e in page0}.isdisjoint({e.key for e in page1})


def test_list_global_pagination(session: Session) -> None:
    for i in range(5):
        _make_entry(session, key=f"g-{i}")
    all_entries = ExtensionStorageDAO.list_global(EXT_A)
    assert len(all_entries) == 5
    page = all_entries[0:2]
    assert len(page) == 2


def test_list_resource_pagination(session: Session) -> None:
    for i in range(4):
        _make_entry(
            session, key=f"r-{i}", resource_type=RES_TYPE, resource_uuid=RES_UUID
        )
    all_entries = ExtensionStorageDAO.list_resource(EXT_A, RES_TYPE, RES_UUID)
    assert len(all_entries) == 4


# ── Encryption ────────────────────────────────────────────────────────────────


def test_encrypted_roundtrip(session: Session) -> None:
    """Values stored with is_encrypted=True survive a set → get_value roundtrip."""
    secret = b"supersecret"
    ExtensionStorageDAO.set(EXT_A, "secret_key", secret, is_encrypted=True)
    entry = ExtensionStorageDAO.get(EXT_A, "secret_key")
    assert entry is not None
    assert entry.is_encrypted is True
    # Raw stored bytes must differ from the plaintext
    assert entry.value != secret
    # get_value must decrypt transparently
    assert ExtensionStorageDAO.get_value(EXT_A, "secret_key") == secret


def test_encrypted_upsert_preserves_encryption(session: Session) -> None:
    """Upserting an encrypted value keeps is_encrypted and re-encrypts the new value."""
    ExtensionStorageDAO.set(EXT_A, "enc", b"v1", is_encrypted=True)
    ExtensionStorageDAO.set(EXT_A, "enc", b"v2", is_encrypted=True)
    assert ExtensionStorageDAO.get_value(EXT_A, "enc") == b"v2"


def test_unencrypted_and_encrypted_keys_coexist(session: Session) -> None:
    """Encrypted and plaintext entries in the same scope do not interfere."""
    ExtensionStorageDAO.set(EXT_A, "plain", b"hello")
    ExtensionStorageDAO.set(EXT_A, "secret", b"world", is_encrypted=True)
    assert ExtensionStorageDAO.get_value(EXT_A, "plain") == b"hello"
    assert ExtensionStorageDAO.get_value(EXT_A, "secret") == b"world"
    plain_entry = ExtensionStorageDAO.get(EXT_A, "plain")
    assert plain_entry is not None
    assert plain_entry.is_encrypted is False
    assert plain_entry.value == b"hello"


def test_encrypted_user_scoped(session: Session) -> None:
    """Encryption works for user-scoped entries."""
    payload = b'{"token":"abc123"}'
    ExtensionStorageDAO.set(EXT_A, "auth", payload, user_fk=USER_1, is_encrypted=True)
    assert ExtensionStorageDAO.get_value(EXT_A, "auth", user_fk=USER_1) == payload
    raw = ExtensionStorageDAO.get(EXT_A, "auth", user_fk=USER_1)
    assert raw is not None
    assert raw.value != payload  # stored ciphertext differs from plaintext


def test_encrypted_value_is_fernet_token(session: Session) -> None:
    """The stored bytes are a valid Fernet token (starts with 'gAAA' in base64)."""
    import base64

    ExtensionStorageDAO.set(EXT_A, "fernet_check", b"data", is_encrypted=True)
    entry = ExtensionStorageDAO.get(EXT_A, "fernet_check")
    assert entry is not None
    # Fernet tokens are URL-safe base64 and always start with version byte 0x80
    decoded = base64.urlsafe_b64decode(entry.value + b"==")
    assert decoded[0] == 0x80, "stored value should be a Fernet token"


# ── Key rotation ──────────────────────────────────────────────────────────────


def test_key_rotation_roundtrip(session: Session, app: object) -> None:
    """MultiFernet.rotate() re-encrypts so only the new key is needed afterwards."""
    import base64
    import hashlib

    from cryptography.fernet import Fernet, MultiFernet
    from flask import current_app

    # Store a value encrypted with the current key (derived from SECRET_KEY).
    payload = b"sensitive-data"
    ExtensionStorageDAO.set(EXT_A, "rot_key", payload, is_encrypted=True)

    entry = ExtensionStorageDAO.get(EXT_A, "rot_key")
    assert entry is not None
    old_ciphertext = entry.value

    # Simulate adding a NEW key at the front of EXTENSION_STORAGE_ENCRYPTION_KEYS.
    new_raw = b"brand-new-secret-key-32-bytes!!!"
    new_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(new_raw).digest()))
    old_raw = current_app.config["SECRET_KEY"]
    if isinstance(old_raw, str):
        old_raw = old_raw.encode()
    old_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(old_raw).digest()))

    multi = MultiFernet([new_fernet, old_fernet])

    # Rotate: re-encrypt the old ciphertext with the new key.
    entry.value = multi.rotate(old_ciphertext)
    session.flush()

    # Now the rotated ciphertext must differ from the old one…
    assert entry.value != old_ciphertext
    # …but decrypting with only the NEW key must return the original plaintext.
    assert new_fernet.decrypt(entry.value) == payload


def test_multi_fernet_decrypts_old_key(session: Session, app: object) -> None:
    """MultiFernet tries all keys: a token encrypted with key-A is still readable
    when key-B is current (before rotation completes)."""
    import base64
    import hashlib

    from cryptography.fernet import Fernet, MultiFernet
    from flask import current_app

    payload = b"still-readable"
    ExtensionStorageDAO.set(EXT_A, "multi_key", payload, is_encrypted=True)

    entry = ExtensionStorageDAO.get(EXT_A, "multi_key")
    assert entry is not None

    # Build a MultiFernet with a new key first, then the current one.
    new_raw = b"another-brand-new-secret-key!!!!"
    new_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(new_raw).digest()))
    old_raw = current_app.config["SECRET_KEY"]
    if isinstance(old_raw, str):
        old_raw = old_raw.encode()
    old_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(old_raw).digest()))

    multi = MultiFernet([new_fernet, old_fernet])

    # Token was encrypted by old_fernet; multi should still decrypt it.
    assert multi.decrypt(entry.value) == payload


# ── Value blob ────────────────────────────────────────────────────────────────


def test_binary_value_roundtrip(session: Session) -> None:
    payload = bytes(range(256))
    ExtensionStorageDAO.set(
        EXT_A, "binkey", payload, value_type="application/octet-stream"
    )
    assert ExtensionStorageDAO.get_value(EXT_A, "binkey") == payload
    entry = ExtensionStorageDAO.get(EXT_A, "binkey")
    assert entry is not None
    assert entry.value_type == "application/octet-stream"
