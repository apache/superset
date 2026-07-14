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
"""Tests for migration ``9e1f3b8c4d2a_add_deleted_at_to_dashboards``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an
in-memory SQLite engine with a real Alembic ``Operations`` context.

The migration has two responsibilities:

1. Add ``deleted_at`` column + ``ix_dashboards_deleted_at`` index — the
   shared soft-delete schema.
2. Swap the legacy full unique constraint on ``slug`` for a partial
   index (Postgres) or functional index (MySQL 8.0.13+). On SQLite
   and older MySQL the slug-constraint swap is a documented no-op
   (the original full constraint stays in place).

The tests pin both responsibilities. The slug-swap path is exercised
only on the no-op branch (the SQLite engine the unit tests run
against); the Postgres / MySQL functional-index paths are covered by
the integration tests against those backends.
"""

from __future__ import annotations

from datetime import datetime, timezone
from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    create_engine,
    Index,
    insert,
    inspect,
    Integer,
    MetaData,
    select,
    String,
    Table,
)
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions."
    "2026-05-08_12-05_9e1f3b8c4d2a_add_deleted_at_to_dashboards"
)

TABLE_NAME = migration.TABLE_NAME  # "dashboards"
DELETED_AT_INDEX_NAME = migration.DELETED_AT_INDEX_NAME
LEGACY_SLUG_INDEX_NAME = migration.LEGACY_SLUG_INDEX_NAME


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with a minimal pre-migration ``dashboards`` table.

    The real ``dashboards`` table has many columns; the migration only
    touches ``deleted_at``, its index, and the legacy slug constraint,
    so only those columns need to exist. The legacy unique constraint
    on ``slug`` is included so SQLite's no-op branch can be asserted
    against the post-migration state.
    """
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    table = Table(
        TABLE_NAME,
        md,
        Column("id", Integer, primary_key=True),
        Column("dashboard_title", String(500)),
        Column("slug", String(255)),
    )
    # Production seeds the legacy slug uniqueness as a named UNIQUE INDEX,
    # not a column-level UNIQUE constraint. Mirror that here so ``inspect()
    # .get_indexes()`` reports it — column-level UNIQUE on SQLite is not
    # surfaced by the indexes inspector.
    Index(LEGACY_SLUG_INDEX_NAME, table.c.slug, unique=True)
    md.create_all(engine)
    return engine


def _columns(engine: Engine) -> set[str]:
    return {col["name"] for col in inspect(engine).get_columns(TABLE_NAME)}


def _indexes(engine: Engine) -> set[str]:
    return {ix["name"] for ix in inspect(engine).get_indexes(TABLE_NAME)}


def test_upgrade_adds_deleted_at_column_and_index(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert "deleted_at" in _columns(engine), "upgrade() must add the deleted_at column"
    assert DELETED_AT_INDEX_NAME in _indexes(engine), (
        "upgrade() must create the supporting index on deleted_at"
    )


def test_downgrade_drops_deleted_at_column_and_index(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()

    assert "deleted_at" not in _columns(engine), (
        "downgrade() must drop the deleted_at column"
    )
    assert DELETED_AT_INDEX_NAME not in _indexes(engine), (
        "downgrade() must drop the supporting index"
    )


def test_downgrade_preserves_soft_deleted_row_data(engine: Engine) -> None:
    """Pin the operator-facing contract from ``UPDATING.md``: rows that
    were soft-deleted before the migration is reversed survive the
    downgrade. The ``deleted_at`` column is gone, so those rows are
    indistinguishable from live rows to any code path that no longer
    applies the visibility filter — operators must decide on
    hard-delete, restore, or rename BEFORE downgrading. See the
    "Rollback note" in ``UPDATING.md``.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

            dashboards = Table(TABLE_NAME, MetaData(), autoload_with=conn)
            conn.execute(
                insert(dashboards).values(
                    [
                        {
                            "id": 1,
                            "dashboard_title": "Live Dashboard",
                            "slug": "live",
                            "deleted_at": None,
                        },
                        {
                            "id": 2,
                            "dashboard_title": "Archived Dashboard",
                            "slug": "archived",
                            "deleted_at": datetime(
                                2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc
                            ),
                        },
                    ]
                )
            )

            migration.downgrade()

            dashboards_after = Table(TABLE_NAME, MetaData(), autoload_with=conn)
            rows = conn.execute(
                select(dashboards_after).order_by(dashboards_after.c.id)
            ).fetchall()

    assert [(r.id, r.dashboard_title, r.slug) for r in rows] == [
        (1, "Live Dashboard", "live"),
        (2, "Archived Dashboard", "archived"),
    ], (
        "downgrade() must not delete or mutate row data — soft-deleted "
        "rows become indistinguishable from live rows but they remain"
    )
    assert "deleted_at" not in {
        c["name"] for c in inspect(engine).get_columns(TABLE_NAME)
    }


def test_sqlite_slug_constraint_swap_is_a_no_op(engine: Engine) -> None:
    """Pin the documented SQLite behaviour: the partial-unique-index swap
    runs only on PostgreSQL and MySQL 8.0.13+; on SQLite the original
    full unique constraint stays in place because column-level UNIQUE
    cannot be dropped without recreating the table.

    The test seeds the pre-migration legacy constraint and verifies it
    survives both ``upgrade()`` and ``downgrade()``.
    """
    pre_indexes = _indexes(engine)
    assert LEGACY_SLUG_INDEX_NAME in pre_indexes, (
        "pre-condition: legacy slug constraint must exist before the migration runs"
    )

    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert LEGACY_SLUG_INDEX_NAME in _indexes(engine), (
        "upgrade() must keep the legacy slug constraint on SQLite (no-op branch)"
    )

    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.downgrade()

    assert LEGACY_SLUG_INDEX_NAME in _indexes(engine), (
        "downgrade() must keep the legacy slug constraint on SQLite (no-op branch)"
    )


def test_upgrade_is_idempotent(engine: Engine) -> None:
    """The migration helpers (``add_columns``, ``create_index``) are
    idempotent skip-if-exists; running ``upgrade()`` twice must not
    raise.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.upgrade()


def test_downgrade_is_idempotent(engine: Engine) -> None:
    """``drop_columns`` / ``drop_index`` are skip-if-not-exists; running
    ``downgrade()`` twice must not raise.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()
            migration.downgrade()
