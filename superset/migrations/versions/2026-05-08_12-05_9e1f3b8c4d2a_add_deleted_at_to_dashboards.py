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
"""Add deleted_at + partial unique slug index for soft-delete.

Adds to the ``dashboards`` table:
- a nullable ``deleted_at`` column for soft-delete state
- an index ``ix_dashboards_deleted_at`` for the visibility-filter listener
- a partial unique index ``ix_dashboards_active_slug`` enforcing slug
  uniqueness only among active (non-soft-deleted) rows

Drops:
- the existing full unique constraint on ``slug`` (named
  ``idx_unique_slug``, created in migration 1a48a5411020)

The constraint change makes the ``slug`` field reusable after soft-delete:
soft-deleted rows no longer reserve their slug for the lifetime of the
row. ``RestoreDashboardCommand`` handles the reverse case (restoring a
dashboard whose slug has since been claimed by another active row) with
an explicit conflict error. See UPDATING.md for the user-facing change.

Dialect support for the partial index:
- PostgreSQL: native ``WHERE deleted_at IS NULL`` partial index
- MySQL 8.0+: functional index over
  ``(CASE WHEN deleted_at IS NULL THEN slug END)``
- MySQL <8.0: keeps the original full unique constraint (documented
  limitation; functional indexes are not supported on these versions)
- SQLite: keeps the original full unique constraint (column-level
  ``UNIQUE`` cannot be dropped without recreating the table, which is
  not worth the migration complexity for a test-only dialect). Tests
  that need to verify the partial-index behaviour run only on
  PostgreSQL and MySQL 8+.

Revision ID: 9e1f3b8c4d2a
Revises: a1b2c3d4e5f6
Create Date: 2026-05-08 12:05:00.000000
"""

from alembic import op
from sqlalchemy import Column, DateTime
from sqlalchemy.engine import Connection

from superset.migrations.shared.utils import (
    add_columns,
    create_index,
    drop_columns,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "9e1f3b8c4d2a"
down_revision = "a1b2c3d4e5f6"

TABLE_NAME = "dashboards"
DELETED_AT_INDEX_NAME = f"ix_{TABLE_NAME}_deleted_at"
PARTIAL_SLUG_INDEX_NAME = f"ix_{TABLE_NAME}_active_slug"
# The original full unique constraint on ``slug`` was created with an
# explicit name in migration 1a48a5411020 (2015-12-04). Same name on
# PostgreSQL (constraint) and MySQL (index).
LEGACY_SLUG_INDEX_NAME = "idx_unique_slug"


def _mysql_supports_functional_index(bind: Connection) -> bool:
    """Return True iff the connected MySQL is 8.0+ (supports functional indexes).

    Excludes MariaDB even at server version ``>= (10, x)`` because MariaDB
    reports through the same ``server_version_info`` attribute but uses
    different functional-index semantics around ``CASE`` expressions.
    Uses SQLAlchemy's parsed ``server_version_info`` rather than ``SELECT
    VERSION()`` to avoid an extra round-trip and brittle string parsing.
    """
    if getattr(bind.dialect, "is_mariadb", False):
        return False
    return (bind.dialect.server_version_info or ()) >= (8, 0)


def upgrade() -> None:
    bind = op.get_bind()
    _add_deleted_at_column()
    _replace_slug_constraint_with_partial_index(bind)


def downgrade() -> None:
    bind = op.get_bind()
    _restore_slug_constraint(bind)
    _drop_deleted_at_column()


def _add_deleted_at_column() -> None:
    add_columns(TABLE_NAME, Column("deleted_at", DateTime(), nullable=True))
    create_index(TABLE_NAME, DELETED_AT_INDEX_NAME, ["deleted_at"])


def _drop_deleted_at_column() -> None:
    drop_index(TABLE_NAME, DELETED_AT_INDEX_NAME)
    drop_columns(TABLE_NAME, "deleted_at")


def _replace_slug_constraint_with_partial_index(bind: Connection) -> None:
    """Swap the full UNIQUE on ``slug`` for a partial index where supported.

    The original constraint is named ``idx_unique_slug`` from migration
    1a48a5411020 — same name on PostgreSQL (constraint) and MySQL (index).

    SQLite and MySQL <8.0 are no-ops here: they keep the original full
    unique constraint. See the module docstring for the rationale.
    """
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute(
            f"ALTER TABLE {TABLE_NAME} "
            f"DROP CONSTRAINT IF EXISTS {LEGACY_SLUG_INDEX_NAME}"
        )
        # Some installations may have the unique enforced as a plain
        # index rather than a constraint. Both DROPs are IF EXISTS, so
        # whichever path applies cleans up.
        op.execute(f"DROP INDEX IF EXISTS {LEGACY_SLUG_INDEX_NAME}")
        op.execute(
            f"CREATE UNIQUE INDEX {PARTIAL_SLUG_INDEX_NAME} "
            f"ON {TABLE_NAME} (slug) WHERE deleted_at IS NULL"
        )
    elif dialect == "mysql" and _mysql_supports_functional_index(bind):
        op.execute(f"ALTER TABLE {TABLE_NAME} DROP INDEX {LEGACY_SLUG_INDEX_NAME}")
        op.execute(
            f"CREATE UNIQUE INDEX {PARTIAL_SLUG_INDEX_NAME} "
            f"ON {TABLE_NAME} ((CASE WHEN deleted_at IS NULL THEN slug END))"
        )


def _restore_slug_constraint(bind: Connection) -> None:
    """Restore the full UNIQUE on ``slug`` from the partial index.

    Symmetric counterpart to ``_replace_slug_constraint_with_partial_index``.
    No-op on dialects that never received the partial index.

    Pre-condition: each value of ``slug`` (other than NULL) must appear at
    most once across the entire ``dashboards`` table. The partial-index
    window allowed an active row and a soft-deleted row to share a slug;
    rebuilding the full unique constraint will abort with a
    ``UniqueViolation`` if any such pair still exists. Before downgrading,
    hard-delete the soft-deleted duplicates (or rename one side of each
    pair) so the constraint can be added cleanly.
    """
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute(f"DROP INDEX IF EXISTS {PARTIAL_SLUG_INDEX_NAME}")
        op.execute(
            f"ALTER TABLE {TABLE_NAME} "
            f"ADD CONSTRAINT {LEGACY_SLUG_INDEX_NAME} UNIQUE (slug)"
        )
    elif dialect == "mysql" and _mysql_supports_functional_index(bind):
        op.execute(f"ALTER TABLE {TABLE_NAME} DROP INDEX {PARTIAL_SLUG_INDEX_NAME}")
        op.execute(
            f"ALTER TABLE {TABLE_NAME} ADD UNIQUE INDEX {LEGACY_SLUG_INDEX_NAME} (slug)"
        )
