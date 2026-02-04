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
"""Create tasks and task_subscriber tables for Global Task Framework (GTF)

Revision ID: 4b2a8c9d3e1f
Revises: 9787190b3d89
Create Date: 2025-12-18 02:20:00.000000

"""

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "4b2a8c9d3e1f"
down_revision = "9787190b3d89"

TASKS_TABLE = "tasks"
TASK_SUBSCRIBERS_TABLE = "task_subscribers"


def upgrade():
    """
    Create tasks and task_subscribers tables for the Global Task Framework (GTF).

    This migration creates:
    1. tasks table - unified tracking for all long running tasks
    2. task_subscribers table - multi-user task subscriptions for shared tasks

    The scope feature allows tasks to be:
    - private: user-specific (default)
    - shared: multi-user collaborative tasks
    - system: admin-only background tasks
    """
    # Create tasks table
    create_table(
        TASKS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", String(36), nullable=False, unique=True),
        Column("task_key", String(256), nullable=False),
        Column("task_type", String(100), nullable=False),
        Column("task_name", String(256), nullable=True),
        Column("scope", String(20), nullable=False, server_default="private"),
        Column("status", String(50), nullable=False),
        Column("dedup_key", String(64), nullable=False),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
        # Task-specific columns
        Column("started_at", DateTime, nullable=True),
        Column("ended_at", DateTime, nullable=True),
        Column("user_id", Integer, nullable=True),
        Column("payload", Text, nullable=True),
        Column("properties", Text, nullable=True),
    )

    # Create indexes for optimal query performance
    create_index(TASKS_TABLE, "idx_tasks_dedup_key", ["dedup_key"], unique=True)
    create_index(TASKS_TABLE, "idx_tasks_status", ["status"])
    create_index(TASKS_TABLE, "idx_tasks_scope", ["scope"])
    create_index(TASKS_TABLE, "idx_tasks_ended_at", ["ended_at"])
    create_index(TASKS_TABLE, "idx_tasks_created_by", ["created_by_fk"])
    create_index(TASKS_TABLE, "idx_tasks_created_on", ["created_on"])
    create_index(TASKS_TABLE, "idx_tasks_task_type", ["task_type"])
    create_index(TASKS_TABLE, "idx_tasks_uuid", ["uuid"], unique=True)

    # Create foreign key constraints for tasks
    create_fks_for_table(
        foreign_key_name="fk_tasks_created_by_fk_ab_user",
        table_name=TASKS_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_tasks_changed_by_fk_ab_user",
        table_name=TASKS_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_tasks_user_id_ab_user",
        table_name=TASKS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # Create task_subscribers table for multi-user task subscriptions
    create_table(
        TASK_SUBSCRIBERS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("task_id", Integer, nullable=False),
        Column("user_id", Integer, nullable=False),
        Column("subscribed_at", DateTime, nullable=False),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
        # Unique constraint defined as part of table creation (SQLite compatible)
        UniqueConstraint("task_id", "user_id", name="uq_task_subscribers_task_user"),
    )

    # Create indexes for task_subscribers table
    create_index(TASK_SUBSCRIBERS_TABLE, "idx_task_subscribers_user_id", ["user_id"])

    # Create foreign key constraints for task_subscribers
    create_fks_for_table(
        foreign_key_name="fk_task_subscribers_task_id_tasks",
        table_name=TASK_SUBSCRIBERS_TABLE,
        referenced_table=TASKS_TABLE,
        local_cols=["task_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_subscribers_user_id_ab_user",
        table_name=TASK_SUBSCRIBERS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_subscribers_created_by_fk_ab_user",
        table_name=TASK_SUBSCRIBERS_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_subscribers_changed_by_fk_ab_user",
        table_name=TASK_SUBSCRIBERS_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade():
    """
    Drop tasks and task_subscribers tables and all related indexes and foreign keys.
    """
    drop_fks_for_table(
        TASK_SUBSCRIBERS_TABLE,
        [
            "fk_task_subscribers_task_id_tasks",
            "fk_task_subscribers_user_id_ab_user",
            "fk_task_subscribers_created_by_fk_ab_user",
            "fk_task_subscribers_changed_by_fk_ab_user",
        ],
    )

    drop_index(TASK_SUBSCRIBERS_TABLE, "idx_task_subscribers_user_id")
    drop_table(TASK_SUBSCRIBERS_TABLE)

    drop_fks_for_table(
        TASKS_TABLE,
        [
            "fk_tasks_created_by_fk_ab_user",
            "fk_tasks_changed_by_fk_ab_user",
            "fk_tasks_user_id_ab_user",
        ],
    )

    drop_index(TASKS_TABLE, "idx_tasks_dedup_key")
    drop_index(TASKS_TABLE, "idx_tasks_status")
    drop_index(TASKS_TABLE, "idx_tasks_scope")
    drop_index(TASKS_TABLE, "idx_tasks_ended_at")
    drop_index(TASKS_TABLE, "idx_tasks_created_by")
    drop_index(TASKS_TABLE, "idx_tasks_created_on")
    drop_index(TASKS_TABLE, "idx_tasks_task_type")
    drop_index(TASKS_TABLE, "idx_tasks_uuid")

    drop_table(TASKS_TABLE)
