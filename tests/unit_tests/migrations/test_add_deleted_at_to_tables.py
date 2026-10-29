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
"""Tests for migration ``3a8e6f2c1b95_add_deleted_at_to_tables``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an
in-memory SQLite engine with a real Alembic ``Operations`` context.
The behaviour being pinned is the operator-facing contract documented
in ``UPDATING.md``: ``downgrade()`` reverses the schema but does not
hard-delete or otherwise mutate rows that were soft-deleted before
the migration was reversed — those rows survive the downgrade and
become visible to any code path that no longer applies the
soft-delete visibility filter.
"""

from __future__ import annotations

from datetime import datetime
from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    create_engine,
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
    "2026-05-08_12-10_3a8e6f2c1b95_add_deleted_at_to_tables"
)

TABLE_NAME = migration.TABLE_NAME  # "tables"
INDEX_NAME = migration.INDEX_NAME  # "ix_tables_deleted_at"


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with a minimal pre-migration ``tables`` table.

    The real ``tables`` table has many columns; the migration only touches
    ``deleted_at`` and its index, so only the columns that participate in
    the test are seeded.
    """
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    Table(
        TABLE_NAME,
        md,
        Column("id", Integer, primary_key=True),
        Column("table_name", String(250), nullable=False),
    )
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
    assert INDEX_NAME in _indexes(engine), (
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
    assert INDEX_NAME not in _indexes(engine), (
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

            # Seed one live row and one soft-deleted row.
            tables = Table(TABLE_NAME, MetaData(), autoload_with=conn)
            conn.execute(
                insert(tables).values(
                    [
                        {
                            "id": 1,
                            "table_name": "live_table",
                            "deleted_at": None,
                        },
                        {
                            "id": 2,
                            "table_name": "archived_table",
                            "deleted_at": datetime(2026, 1, 1, 12, 0, 0),
                        },
                    ]
                )
            )

            migration.downgrade()

            # Re-reflect after schema change. Both rows must survive; no
            # column to distinguish them remains.
            tables_after = Table(TABLE_NAME, MetaData(), autoload_with=conn)
            rows = conn.execute(
                select(tables_after).order_by(tables_after.c.id)
            ).fetchall()

    assert [(r.id, r.table_name) for r in rows] == [
        (1, "live_table"),
        (2, "archived_table"),
    ], (
        "downgrade() must not delete or mutate row data — soft-deleted "
        "rows become indistinguishable from live rows but they remain"
    )
    assert "deleted_at" not in {
        c["name"] for c in inspect(engine).get_columns(TABLE_NAME)
    }


def test_upgrade_is_idempotent(engine: Engine) -> None:
    """The migration helpers (``add_columns``, ``create_index``) are
    idempotent skip-if-exists; running ``upgrade()`` twice must not
    raise.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.upgrade()  # second call must be a no-op


def test_downgrade_is_idempotent(engine: Engine) -> None:
    """``drop_columns`` / ``drop_index`` are skip-if-not-exists; running
    ``downgrade()`` twice must not raise.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()
            migration.downgrade()  # second call must be a no-op
