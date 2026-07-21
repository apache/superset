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

from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass
from typing import Any

import backoff
from flask import current_app
from flask_babel import gettext as _
from sqlalchemy import and_, desc, func, LargeBinary

from superset import db
from superset.daos.base import BaseDAO
from superset.distributed_lock import DistributedLock
from superset.exceptions import (
    AcquireDistributedLockFailedException,
    SupersetGenericErrorException,
)
from superset.extensions.storage.codecs import DEFAULT_CODEC, get_codec
from superset.extensions.storage.filters import ExtensionStorageFilter
from superset.extensions.storage.persistent_model import ExtensionStorage
from superset.utils.encrypt import (
    DEFAULT_ENCRYPTION_ENGINE_NAME,
    EncryptedType,
    resolve_encryption_engine,
)

logger = logging.getLogger(__name__)


class ExtensionStorageQuotaExceeded(SupersetGenericErrorException):
    """Raised when a write would exceed an extension's persistent storage quota."""

    status = 413

    def __init__(self, extension_id: str, quota: int) -> None:
        super().__init__(
            message=_(
                "Extension '%(extension_id)s' has exceeded its persistent "
                "storage quota of %(quota)d bytes.",
                extension_id=extension_id,
                quota=quota,
            ),
        )


class ExtensionStorageValueTooLarge(SupersetGenericErrorException):
    """Raised when a `set` call's value exceeds MAX_VALUE_SIZE."""

    status = 400

    def __init__(self, max_size: int) -> None:
        super().__init__(
            message=_(
                "Value exceeds the maximum allowed size of %(max_size)d bytes.",
                max_size=max_size,
            ),
        )


class ExtensionStorageListPayloadTooLarge(SupersetGenericErrorException):
    """Raised when a `list` page's combined value size exceeds
    MAX_LIST_PAYLOAD_SIZE."""

    status = 400

    def __init__(self, requested_size: int, max_size: int) -> None:
        super().__init__(
            message=_(
                "Requested page would return %(requested_size)d bytes, "
                "exceeding the maximum allowed list payload size of "
                "%(max_size)d bytes. Reduce page_size and try again.",
                requested_size=requested_size,
                max_size=max_size,
            ),
        )


class ExtensionStorageKeyTooLong(SupersetGenericErrorException):
    """Raised when a `set` call's key exceeds MAX_KEY_LENGTH."""

    status = 400

    def __init__(self, max_length: int) -> None:
        super().__init__(
            message=_(
                "Storage key exceeds the maximum allowed length of "
                "%(max_length)d characters.",
                max_length=max_length,
            ),
        )


#: Matches the `key` column's `String(255)` definition in `ExtensionStorage`
#: (`persistent_model.py`). Enforced here, at the DAO boundary, so every
#: caller (REST API, ambient accessors, direct DAO use) gets a consistent
#: error instead of a database integrity/truncation failure — the frontend
#: SDK enforces the same limit client-side purely so it can fail fast
#: without a round trip, not as the source of truth.
MAX_KEY_LENGTH = 255

#: TTL for the lock guarding `ExtensionStorageDAO.set`'s select-then-write.
#: Short because the guarded section is a handful of local DB operations, no
#: network calls — long enough to cover normal execution, short enough that
#: a crashed holder doesn't block the same key for long.
SET_LOCK_TTL_SECONDS = 5


def _validate_key_length(key: str) -> None:
    """Validate key length against MAX_KEY_LENGTH. Raises if over."""
    if len(key) > MAX_KEY_LENGTH:
        raise ExtensionStorageKeyTooLong(MAX_KEY_LENGTH)


def _derive_key(secret: str, user_fk: int) -> str:
    """Derive a per-user encryption key from the master secret and user ID.

    Uses HMAC-SHA256 so the derived key is cryptographically bound to both.
    Ciphertext encrypted for one user cannot be decrypted as another.
    """
    return hmac.new(
        secret.encode(),
        str(user_fk).encode(),
        hashlib.sha256,
    ).hexdigest()


def _enc_type(user_fk: int | None) -> EncryptedType:
    """Return an EncryptedType for the given scope.

    User-scoped rows use a key derived from SECRET_KEY and the user ID, so
    ciphertext written for one user cannot be decrypted as another.
    Shared rows (user_fk=None) use SECRET_KEY directly.
    """
    secret = current_app.config["SECRET_KEY"]
    key = _derive_key(secret, user_fk) if user_fk is not None else secret
    engine_name = current_app.config.get(
        "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE", DEFAULT_ENCRYPTION_ENGINE_NAME
    )
    return EncryptedType(
        LargeBinary,
        key=key,
        engine=resolve_encryption_engine(engine_name),
    )


def _get_quota() -> int | None:
    """Return the configured per-extension persistent storage quota in bytes.

    Returns None when no quota is configured (unlimited).
    """
    config = current_app.config["EXTENSIONS_PERSISTENT_STORAGE"]
    return config.get("QUOTA_PER_EXTENSION")


def _get_max_list_payload_size() -> int | None:
    """Return the configured max combined value size for a `list()` page.

    Returns None when no limit is configured (unlimited).
    """
    config = current_app.config["EXTENSIONS_PERSISTENT_STORAGE"]
    return config.get("MAX_LIST_PAYLOAD_SIZE")


def _validate_value_size(encoded: bytes) -> None:
    """Validate encoded value bytes against MAX_VALUE_SIZE. Raises if over.

    Enforced independently of `QUOTA_PER_EXTENSION`: the quota bounds an
    extension's total storage, while this bounds a single value. A
    `list_entries()` page's combined size is bounded separately by
    MAX_LIST_PAYLOAD_SIZE (see `ExtensionStorageDAO.list_entries`).
    """
    config = current_app.config["EXTENSIONS_PERSISTENT_STORAGE"]
    max_size = config.get("MAX_VALUE_SIZE")
    if max_size is None:
        return
    if len(encoded) > max_size:
        raise ExtensionStorageValueTooLarge(max_size)


def _check_quota(extension_id: str, new_size: int, existing_size: int = 0) -> None:
    """Raise if writing `new_size` bytes would push the extension over quota.

    `existing_size` is the size of the row being replaced (0 for inserts),
    subtracted from current usage so overwriting a key doesn't double-count
    it against the quota it already occupies.

    The usage query sums the `value_size` column via the covering
    `ix_ext_storage_extension_id` index (on `extension_id, value_size`)
    instead of `LENGTH(value)`, so it can run as an index-only scan rather
    than reading every one of the extension's stored (and potentially
    TOASTed) blobs. It is still O(rows) for the extension, so write latency
    grows with row count — acceptable at the row counts a single extension
    is expected to accumulate, but not a fully constant-time check.
    """
    quota = _get_quota()
    if quota is None:
        return
    current_usage = (
        db.session.query(func.coalesce(func.sum(ExtensionStorage.value_size), 0))
        .filter(ExtensionStorage.extension_id == extension_id)
        .scalar()
    )
    if current_usage - existing_size + new_size > quota:
        raise ExtensionStorageQuotaExceeded(extension_id, quota)


def _decrypt_if_needed(
    entry: ExtensionStorage, extension_id: str, key: str
) -> bytes | None:
    """Return `entry.value`, decrypted if `entry.is_encrypted`.

    Returns None (and logs) if decryption fails, e.g. after key rotation.
    """
    if not entry.is_encrypted:
        return entry.value
    try:
        return _enc_type(entry.user_fk).process_result_value(
            entry.value, db.engine.dialect
        )
    except Exception:  # noqa: BLE001
        logger.error(
            "Failed to decrypt extension storage value for "
            "extension_id=%s key=%s — possible key rotation issue",
            extension_id,
            key,
        )
        return None


def _scope_filter(
    extension_id: str,
    key: str,
    user_fk: int | None = None,
    resource_type: str | None = None,
    resource_uuid: str | None = None,
) -> list[object]:
    """Build the SQLAlchemy filter list for a scoped lookup."""
    filters: list[object] = [
        ExtensionStorage.extension_id == extension_id,
        ExtensionStorage.key == key,
    ]
    if user_fk is None:
        filters.append(ExtensionStorage.user_fk.is_(None))
    else:
        filters.append(ExtensionStorage.user_fk == user_fk)
    if resource_type is None:
        filters.append(ExtensionStorage.resource_type.is_(None))
    else:
        filters.append(ExtensionStorage.resource_type == resource_type)
    if resource_uuid is None:
        filters.append(ExtensionStorage.resource_uuid.is_(None))
    else:
        filters.append(ExtensionStorage.resource_uuid == resource_uuid)
    return filters


def _list_scope_filter(
    extension_id: str,
    user_fk: int | None = None,
    resource_type: str | None = None,
    resource_uuid: str | None = None,
) -> list[object]:
    """Build the SQLAlchemy filter list for a `list()` call.

    Same scope semantics as `_scope_filter` (an explicit None means "match
    the global/unset scope"), minus the `key` filter.
    """
    filters: list[object] = [ExtensionStorage.extension_id == extension_id]
    if user_fk is None:
        filters.append(ExtensionStorage.user_fk.is_(None))
    else:
        filters.append(ExtensionStorage.user_fk == user_fk)
    if resource_type is None:
        filters.append(ExtensionStorage.resource_type.is_(None))
    else:
        filters.append(ExtensionStorage.resource_type == resource_type)
    if resource_uuid is None:
        filters.append(ExtensionStorage.resource_uuid.is_(None))
    else:
        filters.append(ExtensionStorage.resource_uuid == resource_uuid)
    return filters


@dataclass
class ExtensionStorageListEntry:
    """A single row returned by `ExtensionStorageDAO.list_entries`.

    `value` is the raw (decrypted) payload, mirroring `get_value()` — it is
    not decoded with `codec` here, since REST callers must first check
    `codec` against `SAFE_CODECS` before deciding whether decoding it is
    safe to expose over the API, while ambient backend callers (no such
    restriction) decode unconditionally, same as `get_decoded_value()`.
    """

    key: str
    value: bytes | None
    codec: str
    is_encrypted: bool


class ExtensionStorageDAO(BaseDAO[ExtensionStorage]):
    """Persistent key-value store for extensions (Tier 3).

    Every query and mutation is scoped to the extension currently executing
    (resolved from ambient extension context by `ExtensionStorageFilter`),
    so an extension can never read or modify another extension's storage
    through this DAO.

    Two access shapes are supported:

    * `get`/`set`/`delete_by_key`/`list_entries` — single-key or
      paginated-listing operations with explicit scope discriminators
      (`user_fk`, `resource_type`, `resource_uuid`), used by the ambient
      `persistent_state`/`ephemeral_state` accessors and the REST API (both
      of which establish the ambient extension context themselves before
      calling in).
    * `find_all`/`find_one_or_none`/`filter_by`/`query`/`create`/`update`/
      `delete` (inherited from `BaseDAO`) — general-purpose DAO access for
      backend extension code that needs to enumerate or bulk-manage its own
      rows, exposed to extensions via `superset_core.extensions.storage.dao`.

    Scope is one of:

    * Global scope      — user_fk=None, resource_type=None
    * User scope        — user_fk=<id>, resource_type=None
    * Resource scope    — resource_type + resource_uuid set
    """

    base_filter = ExtensionStorageFilter

    # ── Read ─────────────────────────────────────────────────────────────────

    @staticmethod
    def get(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> ExtensionStorage | None:
        """Return the raw storage entry. The value field may be encrypted."""
        entry = (
            db.session.query(ExtensionStorage)
            .filter(
                and_(
                    *_scope_filter(
                        extension_id, key, user_fk, resource_type, resource_uuid
                    )
                )
            )
            .first()
        )
        return entry

    @staticmethod
    def get_value(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> bytes | None:
        """Return the raw (decrypted) value bytes, or None if not found."""
        entry = ExtensionStorageDAO.get(
            extension_id, key, user_fk, resource_type, resource_uuid
        )
        if entry is None:
            return None
        return _decrypt_if_needed(entry, extension_id, key)

    @staticmethod
    def get_decoded_value(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> Any:
        """Return the value decoded with the codec it was written with.

        :returns: The decoded value, or None if not found.
        """
        entry = ExtensionStorageDAO.get(
            extension_id, key, user_fk, resource_type, resource_uuid
        )
        if entry is None:
            return None
        raw = _decrypt_if_needed(entry, extension_id, key)
        if raw is None:
            return None
        return get_codec(entry.codec).decode(raw)

    @staticmethod
    def list_entries(
        extension_id: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
        page: int = 0,
        page_size: int = 10,
    ) -> tuple[list[ExtensionStorageListEntry], int]:
        """List entries in the given scope, most recently changed first.

        Named `list_entries` rather than `list` (unlike the single-key
        `get`/`set`/`delete_by_key` shape) because `BaseDAO` already
        defines a generic `list()` with a different, incompatible
        signature (search/sort/column-selection over arbitrary models);
        overriding it here would break that contract for callers relying
        on polymorphic DAO access.

        Callers may request any `page_size` — there is no row-count
        ceiling — but the combined `value_size` of the requested page is
        checked against MAX_LIST_PAYLOAD_SIZE *before* the (potentially
        large) `value` column is fetched for any row, so an oversized
        request fails fast rather than reading data it will then reject.

        :returns: (entries, total_count). `entries[i].value` is the raw
            (decrypted) payload — see `ExtensionStorageListEntry`.
        :raises ExtensionStorageListPayloadTooLarge: if the requested page's
            combined value size exceeds MAX_LIST_PAYLOAD_SIZE.
        """
        filters = _list_scope_filter(
            extension_id, user_fk, resource_type, resource_uuid
        )
        base_query = db.session.query(ExtensionStorage).filter(and_(*filters))
        total_count = base_query.count()

        page = max(page, 0)
        page_size = max(page_size, 1)
        page_query = (
            base_query.order_by(desc(ExtensionStorage.changed_on))
            .offset(page * page_size)
            .limit(page_size)
        )

        if (max_payload_size := _get_max_list_payload_size()) is not None:
            # Sum value_size for exactly this page's rows, without touching
            # the `value` column, by reusing the same ordered/offset/limited
            # query as a subquery.
            subquery = page_query.with_entities(ExtensionStorage.value_size).subquery()
            requested_size = db.session.query(
                func.coalesce(func.sum(subquery.c.value_size), 0)
            ).scalar()
            if requested_size > max_payload_size:
                raise ExtensionStorageListPayloadTooLarge(
                    requested_size, max_payload_size
                )

        entries = [
            ExtensionStorageListEntry(
                key=row.key,
                value=_decrypt_if_needed(row, extension_id, row.key),
                codec=row.codec,
                is_encrypted=row.is_encrypted,
            )
            for row in page_query.all()
        ]
        return entries, total_count

    # ── Write (upsert) ────────────────────────────────────────────────────────

    @staticmethod
    @backoff.on_exception(
        backoff.expo,
        AcquireDistributedLockFailedException,
        factor=0.1,
        base=2,
        max_tries=8,
    )
    def set(
        extension_id: str,
        key: str,
        value: bytes,
        codec: str = DEFAULT_CODEC,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
        encrypt: bool = False,
    ) -> ExtensionStorage:
        """Upsert a storage entry.  Encrypts value when encrypt=True.

        The select-then-insert/update below is guarded by a distributed lock
        scoped to this exact key: the row's unique constraint can't be relied
        on to catch concurrent writes here, since `user_fk`, `resource_type`,
        and `resource_uuid` are nullable and standard SQL never treats
        NULL = NULL, so two concurrent inserts for the same *global* or
        *resource*-scoped key (where one or more of those columns is NULL)
        would not violate it and would land as duplicate rows.

        :raises ExtensionStorageKeyTooLong: if `key` exceeds MAX_KEY_LENGTH.
        :raises ExtensionStorageValueTooLarge: if `value` exceeds
            MAX_VALUE_SIZE.
        :raises ExtensionStorageQuotaExceeded: if writing `value` would push
            the extension over its total storage quota.
        """
        _validate_key_length(key)
        _validate_value_size(value)
        stored_value = (
            _enc_type(user_fk).process_bind_param(value, db.engine.dialect)
            if encrypt
            else value
        )

        with DistributedLock(
            namespace="extension_storage_set",
            ttl_seconds=SET_LOCK_TTL_SECONDS,
            extension_id=extension_id,
            key=key,
            user_fk=user_fk,
            resource_type=resource_type,
            resource_uuid=resource_uuid,
        ):
            entry = (
                db.session.query(ExtensionStorage)
                .filter(
                    and_(
                        *_scope_filter(
                            extension_id, key, user_fk, resource_type, resource_uuid
                        )
                    )
                )
                .first()
            )
            new_size = len(stored_value)
            existing_size = entry.value_size if entry is not None else 0
            _check_quota(extension_id, new_size, existing_size)
            if entry is not None:
                entry.value = stored_value
                entry.value_size = new_size
                entry.codec = codec
                entry.is_encrypted = encrypt
            else:
                entry = ExtensionStorage(
                    extension_id=extension_id,
                    key=key,
                    value=stored_value,
                    value_size=new_size,
                    codec=codec,
                    user_fk=user_fk,
                    resource_type=resource_type,
                    resource_uuid=resource_uuid,
                    is_encrypted=encrypt,
                )
                db.session.add(entry)
            db.session.flush()
            return entry

    # ── Delete ────────────────────────────────────────────────────────────────

    @staticmethod
    def delete_by_key(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> bool:
        """Delete a single entry by key. Returns True if a row was removed."""
        entry = (
            db.session.query(ExtensionStorage)
            .filter(
                and_(
                    *_scope_filter(
                        extension_id, key, user_fk, resource_type, resource_uuid
                    )
                )
            )
            .first()
        )
        if entry is None:
            return False
        db.session.delete(entry)
        db.session.flush()
        return True
