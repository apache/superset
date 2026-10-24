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
"""Tests for migration ``06373bc38605_create_widgets_table``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an in-memory
SQLite engine with a real Alembic ``Operations`` context. The referenced
``ab_user`` and ``subjects`` tables are seeded so the foreign keys can be
created (via the shared SQLite-compatible helpers).
"""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Column, create_engine, inspect, Integer, MetaData, String, Table
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions.2026-10-03_12-00_06373bc38605_create_widgets_table"
)

NEW_TABLES = {"widgets", "widget_editors", "widget_viewers"}


def test_revision_chain() -> None:
    """The migration must sit directly on top of the current single head."""
    assert migration.revision == "06373bc38605"
    assert migration.down_revision == "884a2115ebd3"


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with the tables the new foreign keys reference."""
    engine = create_engine("sqlite:///:memory:", future=True)
    metadata = MetaData()
    Table("ab_user", metadata, Column("id", Integer, primary_key=True))
    Table(
        "subjects",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("label", String(255), nullable=False),
    )
    metadata.create_all(engine)
    return engine


def _run(engine: Engine, step: str) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            getattr(migration, step)()


def test_upgrade_creates_the_widget_tables(engine: Engine) -> None:
    _run(engine, "upgrade")

    inspector = inspect(engine)
    assert NEW_TABLES <= set(inspector.get_table_names())

    widget_columns = {col["name"] for col in inspector.get_columns("widgets")}
    assert {
        "id",
        "uuid",
        "widget_type",
        "schema_version",
        "name",
        "description",
        "props",
        "revision",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
    } <= widget_columns

    for junction in ("widget_editors", "widget_viewers"):
        unique_col_sets = [
            set(uc["column_names"]) for uc in inspector.get_unique_constraints(junction)
        ]
        assert {"subject_id", "widget_id"} in unique_col_sets
        referenced = {
            fk["referred_table"] for fk in inspector.get_foreign_keys(junction)
        }
        assert referenced == {"subjects", "widgets"}


def test_downgrade_drops_the_widget_tables(engine: Engine) -> None:
    _run(engine, "upgrade")
    _run(engine, "downgrade")

    assert not NEW_TABLES & set(inspect(engine).get_table_names())
