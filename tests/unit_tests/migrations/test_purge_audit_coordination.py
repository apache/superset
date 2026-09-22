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
"""Tests for the purge-audit pruning coordination migration."""

from importlib import import_module
from types import ModuleType
from unittest.mock import MagicMock, patch

migration: ModuleType = import_module(
    "superset.migrations.versions."
    "2026-08-24_16-20_c7f53d184ea2_coordinate_purge_audit_pruning"
)
index_migration: ModuleType = import_module(
    "superset.migrations.versions."
    "2026-08-24_15-50_a6c21e5b4d93_index_purge_audit_pruning"
)


def test_index_upgrade_creates_pruning_index() -> None:
    create_index: MagicMock
    with patch.object(index_migration, "create_index") as create_index:
        index_migration.upgrade()

    create_index.assert_called_once_with(
        index_migration._TABLE_NAME,
        index_migration._INDEX_NAME,
        ["status", "entity_type", "entity_uuid", "created_on"],
    )


def test_index_downgrade_drops_pruning_index() -> None:
    drop_index: MagicMock
    with patch.object(index_migration, "drop_index") as drop_index:
        index_migration.downgrade()

    drop_index.assert_called_once_with(
        index_migration._TABLE_NAME,
        index_migration._INDEX_NAME,
    )


def test_upgrade_creates_and_seeds_coordination_table() -> None:
    create_table: MagicMock
    bulk_insert: MagicMock
    with (
        patch.object(migration, "create_table") as create_table,
        patch.object(migration.op, "bulk_insert") as bulk_insert,
    ):
        migration.upgrade()

    create_table.assert_called_once()
    assert create_table.call_args.args[0] == migration._TABLE_NAME
    bulk_insert.assert_called_once()
    assert bulk_insert.call_args.args[1] == [
        {"id": migration._SENTINEL_ID, "lock_version": 0}
    ]


def test_downgrade_drops_coordination_table() -> None:
    drop_table: MagicMock
    with patch.object(migration, "drop_table") as drop_table:
        migration.downgrade()

    drop_table.assert_called_once_with(migration._TABLE_NAME)
