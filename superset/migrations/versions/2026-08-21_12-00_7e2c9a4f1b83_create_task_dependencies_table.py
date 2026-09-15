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
"""Create task_dependencies table and add task_subscribers.guest_key (GTF)

Revision ID: 7e2c9a4f1b83
Revises: b3e9c1a75d24
Create Date: 2026-08-21 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    UniqueConstraint,
)

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_index,
    create_table,
    drop_columns,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "7e2c9a4f1b83"
down_revision = "b3e9c1a75d24"

TASKS_TABLE = "tasks"
TASK_DEPENDENCIES_TABLE = "task_dependencies"
TASK_SUBSCRIBERS_TABLE = "task_subscribers"


def upgrade():
    """
    Create the task_dependencies junction table and add task_subscribers.guest_key.

    ``task_dependencies``: each row is a directed edge — ``task_id`` (the
    dependent) depends on ``depends_on_task_id`` (the prerequisite). Both foreign
    keys reference ``tasks.id`` with ``ON DELETE CASCADE`` so edges are removed
    when either endpoint task is pruned (task pruning uses a bulk core DELETE that
    bypasses the ORM cascade, so the database-level cascade is required for
    cleanup).

    ``task_subscribers.guest_key``: lets embedded guests (which have no
    ``ab_user`` row) subscribe to tasks by a stable, token-derived key so the task
    filter can grant them visibility of their own async work.
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

    # Let embedded guests subscribe to tasks by a token-derived ``guest_key``.
    # Guests have no ``ab_user`` row, so a subscription is identified by exactly
    # one of ``user_id`` (authenticated) or ``guest_key`` (guest): add the
    # nullable ``guest_key`` column, relax ``user_id`` to nullable, and add a
    # unique ``(task_id, guest_key)`` index mirroring the existing
    # ``(task_id, user_id)`` uniqueness so a guest subscribes at most once.
    # (NULLs are distinct in unique constraints, so user rows and guest rows do
    # not collide.)
    add_columns(
        TASK_SUBSCRIBERS_TABLE,
        Column("guest_key", sa.String(length=128), nullable=True),
    )
    with op.batch_alter_table(TASK_SUBSCRIBERS_TABLE) as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_task_subscribers_guest_key", ["guest_key"])
        batch_op.create_unique_constraint(
            "uq_task_subscribers_task_guest", ["task_id", "guest_key"]
        )
        # A subscription is identified by exactly one of user_id (authenticated) or
        # guest_key (embedded guest); enforce that XOR at the DB so the principal
        # model can't be violated by a stray write.
        batch_op.create_check_constraint(
            "ck_task_subscribers_user_xor_guest",
            "(user_id IS NULL) <> (guest_key IS NULL)",
        )

    # Liveness marker for orphan detection: the executing worker bumps
    # ``tasks.last_heartbeat`` on a background thread, and the reap_orphaned_tasks
    # beat job reaps ACTIVE tasks whose heartbeat has gone stale (a dead/orphaned
    # worker). The index backs the reaper's ``last_heartbeat < now - timeout`` scan.
    add_columns(
        TASKS_TABLE,
        Column("last_heartbeat", DateTime, nullable=True),
    )
    create_index(TASKS_TABLE, "ix_tasks_last_heartbeat", ["last_heartbeat"])


def downgrade():
    """Drop task_dependencies and revert the task_subscribers.guest_key change."""
    drop_index(TASKS_TABLE, "ix_tasks_last_heartbeat")
    drop_columns(TASKS_TABLE, "last_heartbeat")

    # Guest subscriptions cannot be represented without the column; drop those
    # rows first so restoring user_id NOT NULL does not fail on NULL user_id.
    op.execute(sa.text("DELETE FROM task_subscribers WHERE user_id IS NULL"))
    with op.batch_alter_table(TASK_SUBSCRIBERS_TABLE) as batch_op:
        batch_op.drop_constraint("ck_task_subscribers_user_xor_guest", type_="check")
        batch_op.drop_constraint("uq_task_subscribers_task_guest", type_="unique")
        batch_op.drop_index("ix_task_subscribers_guest_key")
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
    drop_columns(TASK_SUBSCRIBERS_TABLE, "guest_key")

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
