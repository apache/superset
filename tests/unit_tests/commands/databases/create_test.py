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

from superset.commands.database.create import CreateDatabaseCommand
from superset.extensions import security_manager


@pytest.fixture()
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    mocker.patch("superset.commands.database.create.TestConnectionDatabaseCommand")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        {"schema1", "schema2"},
        {"schema3", "schema4"},
    ]

    DatabaseDAO = mocker.patch("superset.commands.database.create.DatabaseDAO")
    DatabaseDAO.create.return_value = database

    return database


@pytest.fixture()
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs.
    """
    mocker.patch("superset.commands.database.create.TestConnectionDatabaseCommand")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.return_value = ["schema1", "schema2"]

    DatabaseDAO = mocker.patch("superset.commands.database.create.DatabaseDAO")
    DatabaseDAO.create.return_value = database

    return database


def test_create_permissions_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database with a catalog is created.
    """
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    CreateDatabaseCommand(
        {
            "database_name": "test_database",
            "sqlalchemy_uri": "sqlite://",
        }
    ).run()

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[test_database].[catalog1]"),
            mocker.call("catalog_access", "[test_database].[catalog2]"),
            mocker.call("schema_access", "[test_database].[catalog1].[schema1]"),
            mocker.call("schema_access", "[test_database].[catalog1].[schema2]"),
            mocker.call("schema_access", "[test_database].[catalog2].[schema3]"),
            mocker.call("schema_access", "[test_database].[catalog2].[schema4]"),
        ],
        any_order=True,
    )


def test_create_permissions_without_catalog(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database without a catalog is created.
    """
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    CreateDatabaseCommand(
        {
            "database_name": "test_database",
            "sqlalchemy_uri": "sqlite://",
        }
    ).run()

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("schema_access", "[test_database].[schema1]"),
            mocker.call("schema_access", "[test_database].[schema2]"),
        ],
        any_order=True,
    )
