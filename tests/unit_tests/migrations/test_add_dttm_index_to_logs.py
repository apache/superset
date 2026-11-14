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
"""Tests for the logs.dttm index migration."""

from importlib import import_module
from types import ModuleType

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    create_engine,
    DateTime,
    inspect,
    Integer,
    MetaData,
    String,
    Table,
)
from sqlalchemy.engine import Engine

migration: ModuleType = import_module(
    "superset.migrations.versions.2026-11-06_03-40_bccfd8e7dfa2_add_dttm_index_to_logs"
)


@pytest.fixture
def engine() -> Engine:
    """Create a minimal pre-migration logs table."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        migration.TABLE_NAME,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("action", String(512)),
        Column("user_id", Integer),
        Column("dttm", DateTime),
    )
    metadata.create_all(engine)
    return engine


def _indexes(engine: Engine) -> dict[str, list[str]]:
    return {
        index["name"]: index["column_names"]
        for index in inspect(engine).get_indexes(migration.TABLE_NAME)
    }


def test_sqlite_upgrade_creates_index(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

    assert _indexes(engine)[migration.INDEX_NAME] == ["dttm"]


def test_sqlite_downgrade_drops_index(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
            migration.downgrade()

    assert migration.INDEX_NAME not in _indexes(engine)
