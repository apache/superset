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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.tables import TablesDatabaseCommand
from superset.extensions import security_manager
from superset.utils.core import DatasourceName


@pytest.fixture()
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    mocker.patch("superset.commands.database.tables.db")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.get_all_table_names_in_schema.return_value = [
        DatasourceName("table1", "schema1", "catalog1"),
        DatasourceName("table2", "schema1", "catalog1"),
    ]
    database.get_all_view_names_in_schema.return_value = [
        DatasourceName("view1", "schema1", "catalog1"),
    ]

    DatabaseDAO = mocker.patch("superset.commands.database.tables.DatabaseDAO")
    DatabaseDAO.find_by_id.return_value = database

    return database


@pytest.fixture()
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs but with schemas.
    """
    mocker.patch("superset.commands.database.tables.db")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.get_all_table_names_in_schema.return_value = [
        DatasourceName("table1", "schema1"),
        DatasourceName("table2", "schema1"),
    ]
    database.get_all_view_names_in_schema.return_value = [
        DatasourceName("view1", "schema1"),
    ]

    DatabaseDAO = mocker.patch("superset.commands.database.tables.DatabaseDAO")
    DatabaseDAO.find_by_id.return_value = database

    return database


def test_tables_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database with a catalog is created.
    """
    get_datasources_accessible_by_user = mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[
            {
                DatasourceName("table1", "schema1", "catalog1"),
                DatasourceName("table2", "schema1", "catalog1"),
            },
            {DatasourceName("view1", "schema1", "catalog1")},
        ],
    )

    db = mocker.patch("superset.commands.database.tables.db")
    table = mocker.MagicMock()
    table.name = "table1"
    table.extra_dict = {"foo": "bar"}
    db.session.query().filter().options().all.return_value = [table]

    payload = TablesDatabaseCommand(1, "catalog1", "schema1", False).run()
    assert payload == {
        "count": 3,
        "result": [
            {"value": "table1", "type": "table", "extra": {"foo": "bar"}},
            {"value": "table2", "type": "table", "extra": None},
            {"value": "view1", "type": "view"},
        ],
    }

    get_datasources_accessible_by_user.assert_has_calls(
        [
            mocker.call(
                database=database_with_catalog,
                catalog="catalog1",
                schema="schema1",
                datasource_names=[
                    DatasourceName("table1", "schema1", "catalog1"),
                    DatasourceName("table2", "schema1", "catalog1"),
                ],
            ),
            mocker.call(
                database=database_with_catalog,
                catalog="catalog1",
                schema="schema1",
                datasource_names=[
                    DatasourceName("view1", "schema1", "catalog1"),
                ],
            ),
        ],
    )

    database_with_catalog.get_all_table_names_in_schema.assert_called_with(
        catalog="catalog1",
        schema="schema1",
        force=False,
        cache=database_with_catalog.table_cache_enabled,
        cache_timeout=database_with_catalog.table_cache_timeout,
    )


def test_tables_without_catalog(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database without a catalog is created.
    """
    get_datasources_accessible_by_user = mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[
            {
                DatasourceName("table1", "schema1"),
                DatasourceName("table2", "schema1"),
            },
            {DatasourceName("view1", "schema1")},
        ],
    )

    db = mocker.patch("superset.commands.database.tables.db")
    table = mocker.MagicMock()
    table.name = "table1"
    table.extra_dict = {"foo": "bar"}
    db.session.query().filter().options().all.return_value = [table]

    payload = TablesDatabaseCommand(1, None, "schema1", False).run()
    assert payload == {
        "count": 3,
        "result": [
            {"value": "table1", "type": "table", "extra": {"foo": "bar"}},
            {"value": "table2", "type": "table", "extra": None},
            {"value": "view1", "type": "view"},
        ],
    }

    get_datasources_accessible_by_user.assert_has_calls(
        [
            mocker.call(
                database=database_without_catalog,
                catalog=None,
                schema="schema1",
                datasource_names=[
                    DatasourceName("table1", "schema1"),
                    DatasourceName("table2", "schema1"),
                ],
            ),
            mocker.call(
                database=database_without_catalog,
                catalog=None,
                schema="schema1",
                datasource_names=[
                    DatasourceName("view1", "schema1"),
                ],
            ),
        ],
    )

    database_without_catalog.get_all_table_names_in_schema.assert_called_with(
        catalog=None,
        schema="schema1",
        force=False,
        cache=database_without_catalog.table_cache_enabled,
        cache_timeout=database_without_catalog.table_cache_timeout,
    )
