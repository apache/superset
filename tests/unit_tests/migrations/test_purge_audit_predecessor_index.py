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
"""Tests for purge-audit predecessor index and timestamp precision."""

from importlib import import_module
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock, patch

from sqlalchemy.dialects import mysql, sqlite
from sqlalchemy.dialects.mysql.mariadb import MariaDBDialect
from sqlalchemy.types import TypeEngine

from superset.models.purge_audit_log import PurgeAuditLog

migration: ModuleType = import_module(
    "superset.migrations.versions."
    "2026-08-06_18-00_b8d2f4a6c901_index_purge_audit_predecessor"
)


def test_model_uses_fractional_mysql_and_mariadb_timestamp() -> None:
    column_type: TypeEngine[Any] = PurgeAuditLog.__table__.c.created_on.type

    mysql_type: TypeEngine[Any] = column_type.dialect_impl(mysql.dialect())
    mariadb_dialect: MariaDBDialect = MariaDBDialect()
    mariadb_type: TypeEngine[Any] = column_type.dialect_impl(mariadb_dialect)
    sqlite_type: TypeEngine[Any] = column_type.dialect_impl(sqlite.dialect())

    assert mysql_type.compile(dialect=mysql.dialect()) == "DATETIME(6)"
    assert mariadb_type.compile(dialect=mariadb_dialect) == "DATETIME(6)"
    assert sqlite_type.compile(dialect=sqlite.dialect()) == "DATETIME"


def test_upgrade_expands_mysql_timestamp_precision() -> None:
    bind: MagicMock = MagicMock()
    bind.dialect = mysql.dialect()
    alter_column: MagicMock

    with (
        patch.object(migration.op, "get_bind", return_value=bind),
        patch.object(migration.op, "alter_column") as alter_column,
        patch.object(migration, "create_index"),
    ):
        migration.upgrade()

    alter_column.assert_called_once()
    arguments: dict[str, object] = alter_column.call_args.kwargs
    existing_type: object = arguments["existing_type"]
    target_type: object = arguments["type_"]
    assert isinstance(existing_type, mysql.DATETIME)
    assert existing_type.fsp == 0
    assert isinstance(target_type, mysql.DATETIME)
    assert target_type.fsp == 6


def test_upgrade_leaves_non_mysql_timestamp_unchanged() -> None:
    bind: MagicMock = MagicMock()
    bind.dialect = sqlite.dialect()
    alter_column: MagicMock

    with (
        patch.object(migration.op, "get_bind", return_value=bind),
        patch.object(migration.op, "alter_column") as alter_column,
        patch.object(migration, "create_index"),
    ):
        migration.upgrade()

    alter_column.assert_not_called()


def test_downgrade_preserves_expanded_timestamp_precision() -> None:
    alter_column: MagicMock
    drop_index: MagicMock
    with (
        patch.object(migration.op, "alter_column") as alter_column,
        patch.object(migration, "drop_index") as drop_index,
    ):
        migration.downgrade()

    drop_index.assert_called_once_with("purge_audit_log", migration._INDEX_NAME)
    alter_column.assert_not_called()
