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
"""Create task_dependencies table for Global Task Framework (GTF) task DAG

Revision ID: 7e2c9a4f1b83
Revises: 1072de5ed955
Create Date: 2026-08-21 12:00:00.000000

"""

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
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
revision = "7e2c9a4f1b83"
down_revision = "1072de5ed955"

TASKS_TABLE = "tasks"
TASK_DEPENDENCIES_TABLE = "task_dependencies"


def upgrade():
    """
    Create the task_dependencies junction table for the task dependency graph.

    Each row is a directed edge: ``task_id`` (the dependent) depends on
    ``depends_on_task_id`` (the prerequisite). Both foreign keys reference
    ``tasks.id`` with ``ON DELETE CASCADE`` so edges are removed when either
    endpoint task is pruned (task pruning uses a bulk core DELETE that bypasses
    the ORM cascade, so the database-level cascade is required for cleanup).
    """
    create_table(
        TASK_DEPENDENCIES_TABLE,
        Column("id", Integer, primary_key=True),
        Column("task_id", Integer, nullable=False),
        Column("depends_on_task_id", Integer, nullable=False),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
        # Unique constraint defined as part of table creation (SQLite compatible).
        # The leading task_id column also serves forward (prerequisite) lookups.
        UniqueConstraint(
            "task_id",
            "depends_on_task_id",
            name="uq_task_dependencies_task_depends_on",
        ),
    )

    # Index for reverse (dependents) lookups by prerequisite.
    create_index(
        TASK_DEPENDENCIES_TABLE,
        "idx_task_dependencies_depends_on",
        ["depends_on_task_id"],
    )

    # Both edge endpoints cascade-delete with their task.
    create_fks_for_table(
        foreign_key_name="fk_task_dependencies_task_id_tasks",
        table_name=TASK_DEPENDENCIES_TABLE,
        referenced_table=TASKS_TABLE,
        local_cols=["task_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_dependencies_depends_on_task_id_tasks",
        table_name=TASK_DEPENDENCIES_TABLE,
        referenced_table=TASKS_TABLE,
        local_cols=["depends_on_task_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_dependencies_created_by_fk_ab_user",
        table_name=TASK_DEPENDENCIES_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_task_dependencies_changed_by_fk_ab_user",
        table_name=TASK_DEPENDENCIES_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade():
    """Drop the task_dependencies table and its indexes and foreign keys."""
    drop_fks_for_table(
        TASK_DEPENDENCIES_TABLE,
        [
            "fk_task_dependencies_task_id_tasks",
            "fk_task_dependencies_depends_on_task_id_tasks",
            "fk_task_dependencies_created_by_fk_ab_user",
            "fk_task_dependencies_changed_by_fk_ab_user",
        ],
    )

    drop_index(TASK_DEPENDENCIES_TABLE, "idx_task_dependencies_depends_on")
    drop_table(TASK_DEPENDENCIES_TABLE)
