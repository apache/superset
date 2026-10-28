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
"""Tests for migration ``d5f6b7c8a9e0_add_user_ui_prefs_table``."""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import Column, create_engine, inspect, Integer, MetaData, String, Table

migration = import_module(
    "superset.migrations.versions."
    "2026-10-28_12-01_d5f6b7c8a9e0_add_user_ui_prefs_table"
)


@pytest.fixture
def engine():
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    Table(
        "ab_user",
        md,
        Column("id", Integer, primary_key=True),
        Column("username", String(64)),
    )
    md.create_all(engine)
    return engine


def test_user_ui_prefs_migration_upgrade_downgrade(engine) -> None:
    def _run(fn) -> None:
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                fn()

    _run(migration.upgrade)
    inspector = inspect(engine)
    assert "user_ui_prefs" in inspector.get_table_names()
    columns = {col["name"] for col in inspector.get_columns("user_ui_prefs")}
    assert {"id", "user_id", "key", "value", "created_on", "changed_on"}.issubset(columns)

    _run(migration.downgrade)
    inspector = inspect(engine)
    assert "user_ui_prefs" not in inspector.get_table_names()
