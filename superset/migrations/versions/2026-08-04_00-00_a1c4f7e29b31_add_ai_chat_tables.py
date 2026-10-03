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
"""add_ai_chat_tables

Revision ID: a1c4f7e29b31
Revises: e7d93a524ff6
Create Date: 2026-08-04 00:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "a1c4f7e29b31"
down_revision = "f3a8c1d2e9b7"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402

from superset.utils.core import MediumText  # noqa: E402


def upgrade() -> None:
    op.create_table(
        "ai_chat_threads",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("title", sa.String(512), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="active",
        ),
        sa.Column("agent_key", sa.String(64), nullable=True),
        sa.Column("extra_json", MediumText(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_threads_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_threads_changed_by_fk_ab_user",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid", name="uq_ai_chat_threads_uuid"),
    )
    # Serves "my threads, most recent first" without a sort.
    op.create_index(
        "ix_ai_chat_threads_owner_recent",
        "ai_chat_threads",
        ["created_by_fk", "changed_on"],
    )

    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", MediumText(), nullable=False),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="complete",
        ),
        sa.Column("request_id", sa.String(96), nullable=True),
        sa.Column("extra_json", MediumText(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["ai_chat_threads.id"],
            name="fk_ai_chat_messages_thread_id_ai_chat_threads",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_messages_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_messages_changed_by_fk_ab_user",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid", name="uq_ai_chat_messages_uuid"),
        # Makes client-supplied idempotency real rather than advisory.
        sa.UniqueConstraint(
            "thread_id",
            "request_id",
            "role",
            name="uq_ai_chat_messages_thread_request_role",
        ),
    )
    op.create_index(
        "ix_ai_chat_messages_thread_created",
        "ai_chat_messages",
        ["thread_id", "created_on"],
    )

    op.create_table(
        "ai_chat_feedback",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("liked", sa.Boolean(), nullable=False),
        sa.Column("comment", MediumText(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["ai_chat_messages.id"],
            name="fk_ai_chat_feedback_message_id_ai_chat_messages",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_feedback_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_ai_chat_feedback_changed_by_fk_ab_user",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid", name="uq_ai_chat_feedback_uuid"),
        sa.UniqueConstraint(
            "message_id",
            "created_by_fk",
            name="uq_ai_chat_feedback_message_user",
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_chat_feedback")
    op.drop_index("ix_ai_chat_messages_thread_created", "ai_chat_messages")
    op.drop_table("ai_chat_messages")
    op.drop_index("ix_ai_chat_threads_owner_recent", "ai_chat_threads")
    op.drop_table("ai_chat_threads")
