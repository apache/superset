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
"""add_extension_storage_table

Revision ID: e5f6a7b8c9d0
Revises: 8f3a1b2c4d5e
Create Date: 2026-06-23 12:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "8f3a1b2c4d5e"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402


def upgrade() -> None:
    op.create_table(
        "extension_storage",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("extension_id", sa.String(255), nullable=False),
        sa.Column("user_fk", sa.Integer(), nullable=True),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_uuid", sa.String(36), nullable=True),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("value", sa.LargeBinary(), nullable=False),
        sa.Column("value_size", sa.Integer(), nullable=False),
        sa.Column(
            "codec",
            sa.String(255),
            nullable=False,
            server_default="json",
        ),
        sa.Column(
            "is_encrypted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_fk"],
            ["ab_user.id"],
            name="fk_extension_storage_user_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_extension_storage_created_by_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_extension_storage_changed_by_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint(
            "extension_id",
            "user_fk",
            "resource_type",
            "resource_uuid",
            "key",
            name="uq_extension_storage_scoped_key",
        ),
    )
    # Covers both the extension_id-only lookups (leftmost prefix) and the
    # quota SUM(value_size) query, letting the latter run as an index-only
    # scan instead of touching the LargeBinary value column.
    op.create_index(
        "ix_ext_storage_extension_id",
        "extension_storage",
        ["extension_id", "value_size"],
    )
    op.create_index(
        "ix_ext_storage_lookup",
        "extension_storage",
        ["extension_id", "user_fk", "resource_type", "resource_uuid", "key"],
    )


def downgrade() -> None:
    op.drop_index("ix_ext_storage_lookup", "extension_storage")
    op.drop_index("ix_ext_storage_extension_id", "extension_storage")
    op.drop_table("extension_storage")
