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

import base64
import hashlib
import logging

from cryptography.fernet import Fernet
from flask import current_app
from sqlalchemy import and_

from superset import db
from superset.extension_storage.models import ExtensionStorage

logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    """Return a Fernet instance derived from the app SECRET_KEY."""
    raw_key = current_app.config["SECRET_KEY"]
    if isinstance(raw_key, str):
        raw_key = raw_key.encode()
    derived = hashlib.sha256(raw_key).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


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


class ExtensionStorageDAO:
    """Persistent key-value store for extensions.

    Provides scoped get/set/delete and list operations covering the three
    storage scopes defined by the Tier 3 proposal:

    * Global scope      — user_fk=None, resource_type=None
    * User scope        — user_fk=<id>, resource_type=None
    * Resource scope    — resource_type + resource_uuid set
    """

    # ── Read ─────────────────────────────────────────────────────────────────

    @staticmethod
    def get(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> ExtensionStorage | None:
        """Return a storage entry, decrypting the value if needed."""
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
        if entry.is_encrypted:
            return _fernet().decrypt(entry.value)
        return entry.value

    # ── Write (upsert) ────────────────────────────────────────────────────────

    @staticmethod
    def set(
        extension_id: str,
        key: str,
        value: bytes,
        value_type: str = "application/json",
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
        category: str | None = None,
        description: str | None = None,
        is_encrypted: bool = False,
    ) -> ExtensionStorage:
        """Upsert a storage entry.  Encrypts value when is_encrypted=True."""
        stored_value = _fernet().encrypt(value) if is_encrypted else value

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
        if entry is not None:
            entry.value = stored_value
            entry.value_type = value_type
            entry.category = category
            entry.description = description
            entry.is_encrypted = is_encrypted
        else:
            entry = ExtensionStorage(
                extension_id=extension_id,
                key=key,
                value=stored_value,
                value_type=value_type,
                user_fk=user_fk,
                resource_type=resource_type,
                resource_uuid=resource_uuid,
                category=category,
                description=description,
                is_encrypted=is_encrypted,
            )
            db.session.add(entry)
        db.session.flush()
        return entry

    # ── Delete ────────────────────────────────────────────────────────────────

    @staticmethod
    def delete(
        extension_id: str,
        key: str,
        user_fk: int | None = None,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> bool:
        """Delete an entry. Returns True if a row was removed."""
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

    # ── List ──────────────────────────────────────────────────────────────────

    @staticmethod
    def list_global(
        extension_id: str,
        category: str | None = None,
    ) -> list[ExtensionStorage]:
        """List all global (user_fk=NULL, resource_type=NULL) entries."""
        q = db.session.query(ExtensionStorage).filter(
            ExtensionStorage.extension_id == extension_id,
            ExtensionStorage.user_fk.is_(None),
            ExtensionStorage.resource_type.is_(None),
        )
        if category is not None:
            q = q.filter(ExtensionStorage.category == category)
        return q.order_by(ExtensionStorage.key).all()

    @staticmethod
    def list_user(
        extension_id: str,
        user_fk: int,
        category: str | None = None,
    ) -> list[ExtensionStorage]:
        """List all user-scoped entries (resource_type=NULL)."""
        q = db.session.query(ExtensionStorage).filter(
            ExtensionStorage.extension_id == extension_id,
            ExtensionStorage.user_fk == user_fk,
            ExtensionStorage.resource_type.is_(None),
        )
        if category is not None:
            q = q.filter(ExtensionStorage.category == category)
        return q.order_by(ExtensionStorage.key).all()

    @staticmethod
    def list_resource(
        extension_id: str,
        resource_type: str,
        resource_uuid: str,
        category: str | None = None,
    ) -> list[ExtensionStorage]:
        """List all entries linked to a specific resource."""
        q = db.session.query(ExtensionStorage).filter(
            ExtensionStorage.extension_id == extension_id,
            ExtensionStorage.resource_type == resource_type,
            ExtensionStorage.resource_uuid == resource_uuid,
        )
        if category is not None:
            q = q.filter(ExtensionStorage.category == category)
        return q.order_by(ExtensionStorage.key).all()
