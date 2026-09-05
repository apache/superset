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

from pytest_mock import MockerFixture

from superset.commands.database.utils import add_permissions


def test_add_permissions(mocker: MockerFixture) -> None:
    """
    Test adding permissions to a database when it's created.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [["schema1"], ["schema2"]]
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog2].[schema2]"),
        ]
    )


def test_add_permissions_get_default_catalog(mocker: MockerFixture):
    """
    Test permissions only added to the default catalog if multi-catalog is not enabled.
    Important when the database does not support cross-catalog queries (like Postgres).
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.db_engine_spec.supports_cross_catalog_queries = False
    database.allow_multi_catalog = False
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_default_catalog.return_value = "catalog1"
    database.get_all_schema_names.side_effect = [["schema1"], ["schema2"]]
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
        ]
    )

    assert add_permission_view_menu.call_count == 2


def test_add_permissions_handle_failures(mocker: MockerFixture) -> None:
    """
    Test adding permissions to a database when it's created in case the
    request to get all schemas for one of the catalogs keeps failing --
    each failing catalog is retried once before being given up on.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2", "catalog3"]
    database.get_all_schema_names.side_effect = [
        ["schema1"],
        Exception,
        Exception,
        ["schema3"],
    ]
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("catalog_access", "[my_db].[catalog3]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog3].[schema3]"),
        ]
    )


def test_add_permissions_retries_transient_failure(mocker: MockerFixture) -> None:
    """
    A catalog whose schema listing fails only once (eg a transient driver
    hiccup) must still get its schema permissions granted via the retry,
    instead of being permanently skipped like a genuinely unlistable
    catalog would be.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        ["schema1"],
        Exception,
        ["schema2"],
    ]
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog2].[schema2]"),
        ]
    )


def test_add_permissions_tolerates_failure_creating_permission_view(
    mocker: MockerFixture,
) -> None:
    """
    A failure while granting a schema's permission (as opposed to while
    listing the catalog's schemas) must be tolerated the same way it was
    before the schema-listing retry was introduced: the rest of that
    catalog is abandoned, but the next catalog is still processed. The
    retry is scoped to the schema-listing call only, so it must not narrow
    this pre-existing tolerance.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        ["schema1a", "schema1b"],
        ["schema2"],
    ]
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )
    add_permission_view_menu.side_effect = [
        None,  # catalog_access [catalog1]
        None,  # catalog_access [catalog2]
        Exception,  # schema_access [catalog1].[schema1a] -- fails
        None,  # schema_access [catalog2].[schema2]
    ]

    add_permissions(database)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1a]"),
            mocker.call("schema_access", "[my_db].[catalog2].[schema2]"),
        ]
    )
    # [catalog1].[schema1b] must never be attempted: the exception raised
    # while granting [schema1a] aborts the rest of catalog1, same as before.
    assert add_permission_view_menu.call_count == 4
