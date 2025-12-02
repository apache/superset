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
"""add_async_task_framework

Revision ID: af8b2c4d9e1f
Revises: a9c01ec10479
Create Date: 2025-11-29 20:01:00.000000

"""

import logging

import sqlalchemy as sa
from alembic import op

from superset.utils import core as utils

logger = logging.getLogger("alembic.env")

# revision identifiers, used by Alembic.
revision = "af8b2c4d9e1f"
down_revision = "a9c01ec10479"


def upgrade():
    """Create async_tasks table for the async task framework."""

    # Check if table already exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "async_tasks" in inspector.get_table_names():
        logger.info("Table async_tasks already exists. Skipping creation.")
        return

    # Create async_tasks table
    op.create_table(
        "async_tasks",
        # Primary key
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", utils.UUIDColumn(), nullable=True),
        # Task identification and status
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="pending"
        ),
        # Execution tracking
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        # Data fields (JSON serialized as text)
        sa.Column("parameters", utils.MediumText(), nullable=True),
        sa.Column("result", utils.MediumText(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("progress_info", utils.MediumText(), nullable=True),
        # Deduplication
        sa.Column("task_signature", sa.String(length=64), nullable=True),
        # User context
        sa.Column("user_id", sa.Integer(), nullable=True),
        # Audit fields (from AuditMixinNullable)
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        # Primary key constraint
        sa.PrimaryKeyConstraint("id"),
        # Foreign key constraints
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"], ondelete="SET NULL"),
        # Unique constraint for task signature (deduplication)
        sa.UniqueConstraint("task_signature", name="uq_async_tasks_task_signature"),
    )

    # Create indexes for performance
    with op.batch_alter_table("async_tasks") as batch_op:
        # Index for status filtering
        batch_op.create_index("idx_async_task_status", ["status"])

        # Index for task name filtering
        batch_op.create_index("idx_async_task_task_name", ["task_name"])

        # Index for signature lookups (deduplication)
        batch_op.create_index("idx_async_task_signature", ["task_signature"])

        # Composite index for user + status queries
        batch_op.create_index("idx_async_task_user_status", ["user_id", "status"])

        # Index for creation time ordering
        batch_op.create_index("idx_async_task_created_on", ["created_on"])

    logger.info("Successfully created async_tasks table and indexes")


def downgrade():
    """Drop async_tasks table."""

    # Check if table exists before attempting to drop
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "async_tasks" not in inspector.get_table_names():
        logger.info("Table async_tasks does not exist. Skipping drop.")
        return

    # Drop the table (indexes will be dropped automatically)
    op.drop_table("async_tasks")

    logger.info("Successfully dropped async_tasks table")
