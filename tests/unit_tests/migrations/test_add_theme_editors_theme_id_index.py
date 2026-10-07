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
"""Tests for the theme_editors.theme_id index migration."""

from importlib import import_module
from types import ModuleType
from unittest.mock import MagicMock

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pytest_mock import MockerFixture
from sqlalchemy import Column, create_engine, inspect, Integer, MetaData, Table
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.engine import Engine

migration: ModuleType = import_module(
    "superset.migrations.versions."
    "2026-09-16_00-01_00fab727cd0a_add_theme_editors_theme_id_index"
)


@pytest.fixture
def engine() -> Engine:
    """Create a minimal pre-migration theme_editors table."""
    engine = create_engine("sqlite:///:memory:")
    metadata = MetaData()
    Table(
        migration.TABLE_NAME,
        metadata,
        Column("id", Integer, primary_key=True),
        Column("subject_id", Integer, nullable=False),
        Column("theme_id", Integer, nullable=False),
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

    assert _indexes(engine)[migration.INDEX_NAME] == ["theme_id"]


def test_sqlite_downgrade_drops_index(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
            migration.downgrade()

    assert migration.INDEX_NAME not in _indexes(engine)


@pytest.mark.parametrize("direction", ["upgrade", "downgrade"])
def test_mysql_skips_index_ddl(mocker: MockerFixture, direction: str) -> None:
    bind = MagicMock()
    bind.dialect = MySQLDialect()
    mocker.patch.object(migration.op, "get_bind", return_value=bind)
    create = mocker.patch.object(migration, "create_index")
    drop = mocker.patch.object(migration, "drop_index")

    getattr(migration, direction)()

    create.assert_not_called()
    drop.assert_not_called()
