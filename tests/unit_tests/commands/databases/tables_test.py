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

from superset.commands.database.exceptions import (
    DatabaseSchemaNotFoundError,
    DatabaseTablesUnexpectedError,
)
from superset.commands.database.tables import TablesDatabaseCommand
from superset.extensions import security_manager
from superset.utils.core import DatasourceName


@pytest.fixture(autouse=True)
def schemas_accessible_by_user(mocker: MockerFixture) -> MagicMock:
    """
    By default the user can access every schema they ask for.
    """
    return mocker.patch.object(
        security_manager,
        "get_schemas_accessible_by_user",
        side_effect=lambda database, catalog, schemas: set(schemas),
    )


@pytest.fixture
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    mocker.patch("superset.commands.database.tables.db")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.get_default_catalog.return_value = "catalog1"
    database.get_all_schema_names.return_value = {"schema1"}
    database.get_all_table_names_in_schema.return_value = {
        ("table1", "schema1", "catalog1"),
        ("table2", "schema1", "catalog1"),
    }
    database.get_all_view_names_in_schema.return_value = {
        ("view1", "schema1", "catalog1"),
    }
    database.get_all_materialized_view_names_in_schema.return_value = set()

    DatabaseDAO = mocker.patch("superset.commands.database.tables.DatabaseDAO")  # noqa: N806
    DatabaseDAO.find_by_id.return_value = database

    return database


@pytest.fixture
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs but with schemas.
    """
    mocker.patch("superset.commands.database.tables.db")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.get_default_catalog.return_value = None
    database.get_all_schema_names.return_value = {"schema1"}
    database.get_all_table_names_in_schema.return_value = {
        ("table1", "schema1", None),
        ("table2", "schema1", None),
    }
    database.get_all_view_names_in_schema.return_value = {
        ("view1", "schema1", None),
    }
    database.get_all_materialized_view_names_in_schema.return_value = set()

    DatabaseDAO = mocker.patch("superset.commands.database.tables.DatabaseDAO")  # noqa: N806
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
            set(),  # Empty set for materialized views
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
            mocker.call(
                database=database_with_catalog,
                catalog="catalog1",
                schema="schema1",
                datasource_names=[],
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


@pytest.fixture
def database_without_schema_support(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database that does not support schemas (e.g. YDB).
    """
    mocker.patch("superset.commands.database.tables.db")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.get_default_catalog.return_value = None
    database.db_engine_spec.supports_schemas = False
    database.get_all_table_names_in_schema.return_value = {
        ("table1", None, None),
        ("table2", None, None),
    }
    database.get_all_view_names_in_schema.return_value = set()
    database.get_all_materialized_view_names_in_schema.return_value = set()

    DatabaseDAO = mocker.patch("superset.commands.database.tables.DatabaseDAO")  # noqa: N806
    DatabaseDAO.find_by_id.return_value = database

    return database


def test_tables_without_schema_support(
    mocker: MockerFixture,
    database_without_schema_support: MagicMock,
) -> None:
    """
    Test that schema is overridden to None for databases that don't support schemas.
    Any schema name passed to the command is ignored.
    """
    get_datasources_accessible_by_user = mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[
            {
                DatasourceName("table1", None),  # type: ignore[arg-type]
                DatasourceName("table2", None),  # type: ignore[arg-type]
            },
            set(),  # Empty set for views
            set(),  # Empty set for materialized views
        ],
    )

    db = mocker.patch("superset.commands.database.tables.db")
    db.session.query().filter().options().all.return_value = []

    # Schema name should be overridden to None when supports_schemas=False
    payload = TablesDatabaseCommand(1, None, "any_schema", False).run()

    assert payload["count"] == 2
    assert {item["value"] for item in payload["result"]} == {"table1", "table2"}

    # Verify schema was set to None when calling the underlying DB methods
    database_without_schema_support.get_all_table_names_in_schema.assert_called_with(
        catalog=None,
        schema=None,
        force=False,
        cache=database_without_schema_support.table_cache_enabled,
        cache_timeout=database_without_schema_support.table_cache_timeout,
    )

    # Verify security_manager was called with schema=None
    get_datasources_accessible_by_user.assert_any_call(
        database=database_without_schema_support,
        catalog=None,
        schema=None,
        datasource_names=mocker.ANY,
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
            set(),  # Empty set for materialized views
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
            mocker.call(
                database=database_without_catalog,
                catalog=None,
                schema="schema1",
                datasource_names=[],
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


def test_tables_unknown_schema(
    mocker: MockerFixture,
    database_without_catalog: MagicMock,
) -> None:
    """
    A schema that does not exist in the database is rejected before any
    table or view lookup runs.
    """
    get_datasources_accessible_by_user = mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
    )

    with pytest.raises(DatabaseSchemaNotFoundError):
        TablesDatabaseCommand(1, None, "not_a_schema", False).run()

    database_without_catalog.get_all_table_names_in_schema.assert_not_called()
    database_without_catalog.get_all_view_names_in_schema.assert_not_called()
    database_without_catalog.get_all_materialized_view_names_in_schema.assert_not_called()
    get_datasources_accessible_by_user.assert_not_called()


def test_tables_schema_not_accessible(
    mocker: MockerFixture,
    database_without_catalog: MagicMock,
    schemas_accessible_by_user: MagicMock,
) -> None:
    """
    A schema the user cannot access is rejected before any table or view
    lookup runs.
    """
    schemas_accessible_by_user.side_effect = None
    schemas_accessible_by_user.return_value = set()

    with pytest.raises(DatabaseSchemaNotFoundError):
        TablesDatabaseCommand(1, None, "schema1", False).run()

    schemas_accessible_by_user.assert_called_once_with(
        database_without_catalog,
        None,
        {"schema1"},
    )
    database_without_catalog.get_all_table_names_in_schema.assert_not_called()


def test_tables_schema_list_uses_catalog_and_force(
    mocker: MockerFixture,
    database_with_catalog: MagicMock,
) -> None:
    """
    The schema check uses the resolved catalog and honours ``force``.
    """
    mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[set(), set(), set()],
    )

    TablesDatabaseCommand(1, None, "schema1", True).run()

    database_with_catalog.get_all_schema_names.assert_called_once_with(
        catalog="catalog1",
        cache=database_with_catalog.schema_cache_enabled,
        cache_timeout=database_with_catalog.schema_cache_timeout or None,
        force=True,
    )


def test_tables_schema_not_checked_without_schema_support(
    mocker: MockerFixture,
    database_without_schema_support: MagicMock,
) -> None:
    """
    Databases without schemas skip the schema check entirely.
    """
    mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[set(), set(), set()],
    )

    TablesDatabaseCommand(1, None, "any_schema", False).run()

    database_without_schema_support.get_all_schema_names.assert_not_called()


def test_tables_schema_list_uses_cache(
    mocker: MockerFixture,
    database_without_catalog: MagicMock,
) -> None:
    """
    The schema check reads the cached schema list, which may be deserialized as a
    list, and does not force a refresh unless requested.
    """
    database_without_catalog.get_all_schema_names.return_value = ["schema1"]
    mocker.patch.object(
        security_manager,
        "get_datasources_accessible_by_user",
        side_effect=[set(), set(), set()],
    )

    TablesDatabaseCommand(1, None, "schema1", False).run()

    database_without_catalog.get_all_schema_names.assert_called_once_with(
        catalog=None,
        cache=database_without_catalog.schema_cache_enabled,
        cache_timeout=database_without_catalog.schema_cache_timeout or None,
        force=False,
    )


def test_tables_schema_check_unexpected_error(
    database_without_catalog: MagicMock,
    schemas_accessible_by_user: MagicMock,
) -> None:
    """
    An unexpected error while checking the schema is reported as
    ``DatabaseTablesUnexpectedError``.
    """
    schemas_accessible_by_user.side_effect = Exception("Test Error")

    with pytest.raises(DatabaseTablesUnexpectedError, match="Test Error"):
        TablesDatabaseCommand(1, None, "schema1", False).run()

    database_without_catalog.get_all_table_names_in_schema.assert_not_called()
