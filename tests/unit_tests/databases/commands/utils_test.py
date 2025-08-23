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
    ssh_tunnel = mocker.MagicMock()
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database, ssh_tunnel)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog2].[schema2]"),
        ]
    )


def test_add_permissions_handle_failures(mocker: MockerFixture) -> None:
    """
    Test adding permissions to a database when it's created in case
    the request to get all schemas for one fo the catalogs fail.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2", "catalog3"]
    database.get_all_schema_names.side_effect = [["schema1"], Exception, ["schema3"]]
    ssh_tunnel = mocker.MagicMock()
    add_permission_view_menu = mocker.patch(
        "superset.commands.database.importers.v1.utils.security_manager."
        "add_permission_view_menu"
    )

    add_permissions(database, ssh_tunnel)

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("catalog_access", "[my_db].[catalog2]"),
            mocker.call("catalog_access", "[my_db].[catalog3]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog3].[schema3]"),
        ]
    )
