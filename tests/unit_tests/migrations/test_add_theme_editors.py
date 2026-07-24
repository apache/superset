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
"""Tests for migration ``f7e8d9c0b1a2_add_theme_editors_table``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an in-memory
SQLite engine with a real Alembic ``Operations`` context. The referenced
``subjects`` and ``themes`` tables are seeded so the junction table's foreign
keys can be created (via the shared SQLite-compatible helpers).
"""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Column, create_engine, inspect, Integer, MetaData, String, Table
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions.2026-07-24_00-00_f7e8d9c0b1a2_add_theme_editors_table"
)

THEME_EDITORS = migration.THEME_EDITORS  # "theme_editors"


def test_revision_chain() -> None:
    """The migration must sit directly on top of the current single head."""
    assert migration.revision == "f7e8d9c0b1a2"
    assert migration.down_revision == "e5f6a7b8c9d0"


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with the tables the junction FKs reference."""
    engine = create_engine("sqlite:///:memory:", future=True)
    md = MetaData()
    Table(
        "subjects",
        md,
        Column("id", Integer, primary_key=True),
        Column("label", String(255), nullable=False),
    )
    Table(
        "themes",
        md,
        Column("id", Integer, primary_key=True),
        Column("theme_name", String(250)),
    )
    md.create_all(engine)
    return engine


def _tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def test_upgrade_creates_theme_editors_table(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert THEME_EDITORS in _tables(engine), (
        "upgrade() must create the theme_editors junction table"
    )
    columns = {col["name"] for col in inspect(engine).get_columns(THEME_EDITORS)}
    assert {"id", "subject_id", "theme_id"} <= columns

    unique_constraints = inspect(engine).get_unique_constraints(THEME_EDITORS)
    unique_col_sets = [set(uc["column_names"]) for uc in unique_constraints]
    assert {"subject_id", "theme_id"} in unique_col_sets, (
        "upgrade() must enforce uniqueness on (subject_id, theme_id)"
    )


def test_downgrade_drops_theme_editors_table(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()

    assert THEME_EDITORS not in _tables(engine), (
        "downgrade() must drop the theme_editors table"
    )
