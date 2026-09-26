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
"""Tests for migration ``c9e4a7b1d2f3_add_sql_filters``."""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Column, create_engine, inspect, Integer, MetaData, String, Table
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions.2026-08-16_17-20_c9e4a7b1d2f3_add_sql_filters"
)

TABLE_NAME = migration.TABLE_NAME


@pytest.fixture
def engine() -> Engine:
    engine = create_engine("sqlite:///:memory:", future=True)
    md = MetaData()
    Table(
        "ab_user",
        md,
        Column("id", Integer, primary_key=True),
        Column("username", String(64), nullable=False),
    )
    Table(
        "tables",
        md,
        Column("id", Integer, primary_key=True),
        Column("table_name", String(250), nullable=False),
    )
    md.create_all(engine)
    return engine


def _tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _columns(engine: Engine) -> set[str]:
    return {col["name"] for col in inspect(engine).get_columns(TABLE_NAME)}


def test_upgrade_creates_sql_filters(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert TABLE_NAME in _tables(engine)
    assert {
        "id",
        "uuid",
        "filter_name",
        "verbose_name",
        "description",
        "warning_text",
        "table_id",
        "expression",
        "extra",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
    }.issubset(_columns(engine))


def test_downgrade_drops_sql_filters(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()

    assert TABLE_NAME not in _tables(engine)


def test_upgrade_is_idempotent(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.upgrade()


def test_downgrade_is_idempotent(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()
            migration.downgrade()
