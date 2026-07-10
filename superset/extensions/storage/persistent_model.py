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

import uuid as uuid_module

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy_utils import UUIDType
from superset_core.extensions.storage.models import (
    ExtensionStorageEntry as CoreExtensionStorageEntry,
)

from superset.models.helpers import AuditMixinNullable


class ExtensionStorage(CoreExtensionStorageEntry, AuditMixinNullable, Model):
    """Generic persistent key-value storage for extensions (Tier 3).

    Each row is identified by (extension_id, user_fk, resource_type,
    resource_uuid, key):

    * Global scope      — user_fk IS NULL, resource_type IS NULL
    * User scope        — user_fk set, resource_type IS NULL
    * Resource scope    — resource_type + resource_uuid set (user_fk optional)

    The payload is stored as raw bytes (value) alongside the identifier of
    the codec used to encode it (codec), so the same bytes can be decoded
    back into a value on read. When is_encrypted is True the value has been
    encrypted at the DAO layer using Fernet and must be decrypted before
    decoding.
    """

    __tablename__ = "extension_storage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(
        UUIDType(binary=True),
        default=uuid_module.uuid4,
        unique=True,
        nullable=False,
    )

    # Extension identity
    extension_id = Column(String(255), nullable=False)

    # Scope discriminators — all nullable; NULLs define the scope (see docstring).
    # No relationship() is declared for user_fk: extension storage rows are
    # not deleted when their owning user is (ondelete="SET NULL" demotes them
    # to global scope instead), and nothing reads through such a relationship,
    # so there's no ORM object here for a future change to attach a cascade to.
    user_fk = Column(
        Integer,
        ForeignKey(
            "ab_user.id",
            ondelete="SET NULL",
            name="fk_extension_storage_user_fk_ab_user",
        ),
        nullable=True,
    )
    # No FK here: resource_type is a free-form string naming the referenced
    # table (a built-in Superset model or a resource type defined by another
    # extension entirely), so the table a given row's resource_uuid points
    # into varies per row and can't be fixed at the schema level.
    resource_type = Column(String(64), nullable=True)
    resource_uuid = Column(String(36), nullable=True)

    # Storage key within the scope
    key = Column(String(255), nullable=False)

    # Payload. Size is bounded at the application level by
    # EXTENSIONS_PERSISTENT_STORAGE["MAX_VALUE_SIZE"], enforced in
    # ExtensionStorageDAO.set(), rather than by a fixed column length here.
    value = Column(LargeBinary, nullable=False)
    # Byte length of `value`, kept in sync at write time so the quota SUM in
    # _check_quota() can be computed from this fixed-width column instead of
    # reading (and, once TOASTed, detoasting) every extension's stored blobs.
    value_size = Column(Integer, nullable=False)
    codec = Column(String(255), nullable=False, default="json")
    is_encrypted = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        # Unique constraint prevents duplicate rows from concurrent writes
        UniqueConstraint(
            "extension_id",
            "user_fk",
            "resource_type",
            "resource_uuid",
            "key",
            name="uq_extension_storage_scoped_key",
        ),
        # Composite index covering all lookup dimensions
        Index(
            "ix_ext_storage_lookup",
            "extension_id",
            "user_fk",
            "resource_type",
            "resource_uuid",
            "key",
        ),
        # Covers both extension_id-only lookups (leftmost prefix) and the
        # quota SUM(value_size) query, letting the latter run as an
        # index-only scan instead of touching the LargeBinary value column.
        Index("ix_ext_storage_extension_id", "extension_id", "value_size"),
    )

    def __repr__(self) -> str:
        return (
            f"<ExtensionStorage {self.extension_id}/"
            f"user={self.user_fk}/res={self.resource_type}/{self.key}>"
        )
