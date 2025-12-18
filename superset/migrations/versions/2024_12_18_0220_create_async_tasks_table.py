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
"""Create async_tasks table for Global Async Task Framework (GATF)

Revision ID: 4b2a8c9d3e1f
Revises: f5b5f88d8526
Create Date: 2024-12-18 02:20:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, String, Text

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
down_revision = "f5b5f88d8526"

TABLE_NAME = "async_tasks"


def upgrade():
    """
    Create async_tasks table for the Global Async Task Framework (GATF).

    This table provides unified tracking for all async operations in Superset,
    including SQL queries, thumbnail generation, reports, and other background tasks.
    """
    create_table(
        TABLE_NAME,
        Column("id", Integer, primary_key=True),
        Column("uuid", String(36), nullable=False, unique=True),
        Column("task_id", String(256), nullable=False),  # For deduplication
        Column("task_type", String(100), nullable=False),  # e.g., 'sql_execution'
        Column("task_name", String(256), nullable=True),  # Human readable name
        Column("status", String(50), nullable=False),  # PENDING, IN_PROGRESS, etc.
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),  # FK to ab_user.id
        Column("changed_by_fk", Integer, nullable=True),  # FK to ab_user.id
        # Task-specific columns
        Column("started_at", DateTime, nullable=True),
        Column("ended_at", DateTime, nullable=True),
        Column("user_id", Integer, nullable=True),  # User context for execution
        Column("database_id", Integer, nullable=True),  # Optional FK to dbs.id
        Column("error_message", Text, nullable=True),
        Column("payload", Text, nullable=True),  # JSON serialized task-specific data
    )

    # Create indexes for optimal query performance
    create_index(TABLE_NAME, "idx_async_tasks_status", ["status"])
    create_index(TABLE_NAME, "idx_async_tasks_task_id", ["task_id"])
    create_index(TABLE_NAME, "idx_async_tasks_created_by", ["created_by_fk"])
    create_index(TABLE_NAME, "idx_async_tasks_created_on", ["created_on"])
    create_index(TABLE_NAME, "idx_async_tasks_task_type", ["task_type"])
    create_index(TABLE_NAME, "idx_async_tasks_uuid", ["uuid"], unique=True)

    # Create foreign key constraints
    create_fks_for_table(
        foreign_key_name="fk_async_tasks_created_by_fk_ab_user",
        table_name=TABLE_NAME,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_async_tasks_changed_by_fk_ab_user",
        table_name=TABLE_NAME,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_async_tasks_database_id_dbs",
        table_name=TABLE_NAME,
        referenced_table="dbs",
        local_cols=["database_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade():
    """
    Drop async_tasks table and all related indexes and foreign keys.
    """
    # Drop foreign keys first
    drop_fks_for_table(
        TABLE_NAME,
        [
            "fk_async_tasks_created_by_fk_ab_user",
            "fk_async_tasks_changed_by_fk_ab_user",
            "fk_async_tasks_database_id_dbs",
        ],
    )

    # Drop indexes
    drop_index(TABLE_NAME, "idx_async_tasks_status")
    drop_index(TABLE_NAME, "idx_async_tasks_task_id")
    drop_index(TABLE_NAME, "idx_async_tasks_created_by")
    drop_index(TABLE_NAME, "idx_async_tasks_created_on")
    drop_index(TABLE_NAME, "idx_async_tasks_task_type")
    drop_index(TABLE_NAME, "idx_async_tasks_uuid")

    # Drop table
    drop_table(TABLE_NAME)
