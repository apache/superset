"""Add guest_key to task_subscribers for embedded-guest task visibility

Revision ID: c4e7a1f9b6d2
Revises: 7e2c9a4f1b83
Create Date: 2026-08-22 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "c4e7a1f9b6d2"
down_revision = "7e2c9a4f1b83"

TABLE = "task_subscribers"


def upgrade():
    """
    Let embedded guests subscribe to tasks by a token-derived ``guest_key``.

    Guests have no ``ab_user`` row, so a subscription is now identified by
    exactly one of ``user_id`` (authenticated) or ``guest_key`` (guest). This
    adds the nullable ``guest_key`` column, relaxes ``user_id`` to nullable, and
    adds a unique ``(task_id, guest_key)`` index mirroring the existing
    ``(task_id, user_id)`` uniqueness so a guest subscribes to a task at most
    once. (NULLs are distinct in unique constraints, so user rows and guest rows
    do not collide.)
    """
    add_columns(TABLE, sa.Column("guest_key", sa.String(length=64), nullable=True))
    with op.batch_alter_table(TABLE) as batch_op:
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_task_subscribers_guest_key", ["guest_key"])
        batch_op.create_unique_constraint(
            "uq_task_subscribers_task_guest", ["task_id", "guest_key"]
        )


def downgrade():
    # Guest subscriptions cannot be represented without the column; drop those
    # rows first so restoring user_id NOT NULL does not fail on NULL user_id.
    op.execute(sa.text("DELETE FROM task_subscribers WHERE user_id IS NULL"))
    with op.batch_alter_table(TABLE) as batch_op:
        batch_op.drop_constraint("uq_task_subscribers_task_guest", type_="unique")
        batch_op.drop_index("ix_task_subscribers_guest_key")
        batch_op.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
    drop_columns(TABLE, "guest_key")
