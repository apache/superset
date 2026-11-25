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
"""Tests for migration ``a7f3c2e91d84_add_partition_filter_mapping``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an
in-memory SQLite engine with a real Alembic ``Operations`` context.
The four partition filter mapping columns land on ``tables`` and
``table_columns`` and on their Continuum shadow tables, so dataset
version history and restore keep working.
"""

from __future__ import annotations

from collections.abc import Callable
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
    "2026-09-23_00-01_a7f3c2e91d84_add_partition_filter_mapping"
)

# The columns the migration adds, per table it touches.
ADDED_COLUMNS = {
    "tables": {"partition_column", "partition_mapped_column"},
    "table_columns": {
        "partition_value_transform",
        "partition_transform_is_monotonic",
    },
    "tables_version": {"partition_column", "partition_mapped_column"},
    "table_columns_version": {
        "partition_value_transform",
        "partition_transform_is_monotonic",
    },
}


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with minimal pre-migration tables.

    The real tables have many columns; the migration only adds columns, so
    each table is seeded with an ``id`` and one column to hold a row.
    """
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    for table_name in ADDED_COLUMNS:
        Table(
            table_name,
            md,
            Column("id", Integer, primary_key=True),
            Column("name", String(250)),
        )
    md.create_all(engine)
    return engine


def _columns(engine: Engine, table_name: str) -> set[str]:
    return {col["name"] for col in inspect(engine).get_columns(table_name)}


def _run(engine: Engine, *steps: Callable[[], None]) -> None:
    """Run migration steps, in order, in one Alembic ``Operations`` context."""
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            for step in steps:
                step()


@pytest.mark.parametrize("table_name", list(ADDED_COLUMNS))
def test_upgrade_adds_the_partition_mapping_columns(
    engine: Engine, table_name: str
) -> None:
    _run(engine, migration.upgrade)

    assert ADDED_COLUMNS[table_name] <= _columns(engine, table_name), (
        f"upgrade() must add the partition mapping columns to {table_name}"
    )


@pytest.mark.parametrize("table_name", list(ADDED_COLUMNS))
def test_downgrade_drops_the_partition_mapping_columns(
    engine: Engine, table_name: str
) -> None:
    _run(engine, migration.upgrade, migration.downgrade)

    assert _columns(engine, table_name) == {"id", "name"}, (
        f"downgrade() must drop exactly the partition mapping columns from {table_name}"
    )


def test_upgrade_leaves_existing_columns_undeclared_monotonic(
    engine: Engine,
) -> None:
    """A column saved before the upgrade must not start mirroring ranges.

    ``partition_transform_is_monotonic`` gates range operators, so an existing
    row reads ``false`` through the server default rather than a value the
    owner never declared.
    """
    with engine.begin() as conn:
        conn.execute(
            insert(Table("table_columns", MetaData(), autoload_with=conn)).values(
                id=1, name="event_time"
            )
        )

    _run(engine, migration.upgrade)

    with engine.connect() as conn:
        table_columns = Table("table_columns", MetaData(), autoload_with=conn)
        monotonic = conn.execute(
            select(table_columns.c.partition_transform_is_monotonic)
        ).scalar_one()
    assert not monotonic


def test_upgrade_is_idempotent(engine: Engine) -> None:
    """``add_columns`` skips columns that exist; a second upgrade must not raise."""
    _run(engine, migration.upgrade, migration.upgrade)

    assert ADDED_COLUMNS["tables"] <= _columns(engine, "tables")


def test_downgrade_is_idempotent(engine: Engine) -> None:
    """``drop_columns`` skips missing columns; a second downgrade must not raise."""
    _run(engine, migration.upgrade, migration.downgrade, migration.downgrade)

    assert _columns(engine, "tables") == {"id", "name"}
