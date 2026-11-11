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
"""Tests for the logs (dttm, dashboard_id) index migration."""

from importlib import import_module
from types import ModuleType
from unittest.mock import MagicMock

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pytest_mock import MockerFixture
from sqlalchemy import (
    Column,
    create_engine,
    DateTime,
    inspect,
    Integer,
    MetaData,
    Table,
)
from sqlalchemy.engine import Engine

from superset.models.core import Log

migration: ModuleType = import_module(
    "superset.migrations.versions."
    "2026-11-11_00-00_c74a534819bf_add_dttm_dashboard_id_idx_to_logs"
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
        Column("user_id", Integer),
        Column("dashboard_id", Integer),
        Column("dttm", DateTime),
    )
    metadata.create_all(engine)
    return engine


def _indexes(engine: Engine) -> dict[str, list[str]]:
    return {
        index["name"]: index["column_names"]
        for index in inspect(engine).get_indexes(migration.TABLE_NAME)
    }


def _postgres_context(mocker: MockerFixture, *, as_sql: bool) -> MagicMock:
    context = MagicMock()
    context.dialect.name = "postgresql"
    context.as_sql = as_sql
    mocker.patch.object(migration.op, "get_context", return_value=context)
    return context


def test_upgrade_creates_dttm_dashboard_id_index(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

    assert _indexes(engine)[migration.INDEX_NAME] == ["dttm", "dashboard_id"]


def test_downgrade_drops_dttm_dashboard_id_index(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
            migration.downgrade()

    assert migration.INDEX_NAME not in _indexes(engine)


def test_upgrade_is_idempotent(engine: Engine) -> None:
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
            migration.upgrade()

    assert _indexes(engine)[migration.INDEX_NAME] == ["dttm", "dashboard_id"]


@pytest.mark.parametrize(
    "direction,statement",
    [
        (
            "upgrade",
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_logs_dttm_dashboard_id "
            "ON logs (dttm, dashboard_id)",
        ),
        ("downgrade", "DROP INDEX CONCURRENTLY IF EXISTS ix_logs_dttm_dashboard_id"),
    ],
)
def test_postgres_builds_index_concurrently(
    mocker: MockerFixture, direction: str, statement: str
) -> None:
    context = _postgres_context(mocker, as_sql=False)
    execute = mocker.patch.object(migration.op, "execute")

    getattr(migration, direction)()

    context.autocommit_block.assert_called_once()
    execute.assert_called_once_with(statement)


@pytest.mark.parametrize(
    "direction,statement",
    [
        (
            "upgrade",
            "CREATE INDEX IF NOT EXISTS ix_logs_dttm_dashboard_id "
            "ON logs (dttm, dashboard_id)",
        ),
        ("downgrade", "DROP INDEX IF EXISTS ix_logs_dttm_dashboard_id"),
    ],
)
def test_postgres_offline_skips_concurrently(
    mocker: MockerFixture, direction: str, statement: str
) -> None:
    context = _postgres_context(mocker, as_sql=True)
    execute = mocker.patch.object(migration.op, "execute")

    getattr(migration, direction)()

    context.autocommit_block.assert_not_called()
    execute.assert_called_once_with(statement)


def test_model_declares_dttm_dashboard_id_index() -> None:
    indexes = {index.name: index for index in Log.__table__.indexes}

    assert [column.name for column in indexes[migration.INDEX_NAME].columns] == [
        "dttm",
        "dashboard_id",
    ]
