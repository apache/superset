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
"""add user_ui_prefs table

Revision ID: d5f6b7c8a9e0
Revises: c4e8a1f2b3d5
Create Date: 2026-10-28 12:01:00.000000

"""

revision = "d5f6b7c8a9e0"
down_revision = "c4e8a1f2b3d5"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade() -> None:
    op.create_table(
        "user_ui_prefs",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            name="fk_user_ui_prefs_user_id_ab_user",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_user_ui_prefs_created_by_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_user_ui_prefs_changed_by_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key", name="uq_user_ui_prefs_user_key"),
    )


def downgrade() -> None:
    op.drop_table("user_ui_prefs")
