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
"""Add browser access classification to extension storage.

Revision ID: 4c8f2a1d9b73
Revises: 95d8a99c822e
Create Date: 2026-09-28 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "4c8f2a1d9b73"
down_revision = "95d8a99c822e"

_LOOKUP_COLUMNS = [
    "extension_id",
    "user_fk",
    "resource_type",
    "resource_uuid",
    "access",
    "key",
]
_LEGACY_LOOKUP_COLUMNS = [
    "extension_id",
    "user_fk",
    "resource_type",
    "resource_uuid",
    "key",
]


def upgrade() -> None:
    with op.batch_alter_table("extension_storage") as batch_op:
        batch_op.add_column(
            sa.Column(
                "access",
                sa.String(length=32),
                server_default="frontend",
                nullable=False,
            )
        )
        batch_op.drop_constraint(
            "uq_extension_storage_scoped_key",
            type_="unique",
        )
        batch_op.create_unique_constraint(
            "uq_extension_storage_scoped_key",
            _LOOKUP_COLUMNS,
        )
        batch_op.drop_index("ix_ext_storage_lookup")
        batch_op.create_index(
            "ix_ext_storage_lookup",
            _LOOKUP_COLUMNS,
            unique=False,
        )


def downgrade() -> None:
    # Backend entries must never become browser-readable after a downgrade.
    op.execute(
        sa.delete(sa.table("extension_storage", sa.column("access"))).where(
            sa.column("access") == "backend"
        )
    )
    with op.batch_alter_table("extension_storage") as batch_op:
        batch_op.drop_constraint(
            "uq_extension_storage_scoped_key",
            type_="unique",
        )
        batch_op.create_unique_constraint(
            "uq_extension_storage_scoped_key",
            _LEGACY_LOOKUP_COLUMNS,
        )
        batch_op.drop_index("ix_ext_storage_lookup")
        batch_op.create_index(
            "ix_ext_storage_lookup",
            _LEGACY_LOOKUP_COLUMNS,
            unique=False,
        )
        batch_op.drop_column("access")
