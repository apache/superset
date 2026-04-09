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
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable

# 16 MB — matches the KeyValue store limit.
EXTENSION_STORAGE_MAX_SIZE = 2**24 - 1


class ExtensionStorage(AuditMixinNullable, Model):
    """Generic persistent key-value storage for extensions (Tier 3).

    Each row is identified by (extension_id, user_fk, resource_type,
    resource_uuid, key):

    * Global scope      — user_fk IS NULL, resource_type IS NULL
    * User scope        — user_fk set, resource_type IS NULL
    * Resource scope    — resource_type + resource_uuid set (user_fk optional)

    The payload is stored as raw bytes (value) with a MIME-type hint
    (value_type).  When is_encrypted is True the value has been encrypted
    at the DAO layer using Fernet and must be decrypted before use.
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

    # Scope discriminators — all nullable; NULLs define the scope (see docstring)
    user_fk = Column(
        Integer,
        ForeignKey(
            "ab_user.id",
            ondelete="SET NULL",
            name="fk_extension_storage_user_fk_ab_user",
        ),
        nullable=True,
    )
    resource_type = Column(String(64), nullable=True)
    resource_uuid = Column(String(36), nullable=True)

    # Storage key within the scope
    key = Column(String(255), nullable=False)

    # Optional metadata
    category = Column(String(64), nullable=True)
    description = Column(Text, nullable=True)

    # Payload
    value = Column(LargeBinary(EXTENSION_STORAGE_MAX_SIZE), nullable=False)
    value_type = Column(String(255), nullable=False, default="application/json")
    is_encrypted = Column(Boolean, nullable=False, default=False)

    user = relationship(
        "User",
        backref=backref("extension_storage_entries", cascade="all, delete-orphan"),
        foreign_keys=[user_fk],
    )

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
        Index("ix_ext_storage_extension_id", "extension_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<ExtensionStorage {self.extension_id}/"
            f"user={self.user_fk}/res={self.resource_type}/{self.key}>"
        )
