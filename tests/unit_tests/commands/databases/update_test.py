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

from superset.commands.database.update import UpdateDatabaseCommand
from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import OAuth2RedirectError
from superset.extensions import security_manager
from superset.utils import json

oauth2_client_info = {
    "id": "client_id",
    "secret": "client_secret",
    "scope": "scope-a",
    "redirect_uri": "redirect_uri",
    "authorization_request_uri": "auth_uri",
    "token_request_uri": "token_uri",
    "request_content_type": "json",
}


@pytest.fixture
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        ["schema1", "schema2"],
        ["schema3", "schema4"],
    ]
    database.get_default_catalog.return_value = "catalog2"

    return database


@pytest.fixture
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.return_value = ["schema1", "schema2"]

    return database


@pytest.fixture
def database_needs_oauth2(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs that needs OAuth2.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.side_effect = OAuth2RedirectError(
        "url",
        "tab_id",
        "redirect_uri",
    )
    database.encrypted_extra = json.dumps({"oauth2_client_info": oauth2_client_info})
    database.db_engine_spec.unmask_encrypted_extra = (
        BaseEngineSpec.unmask_encrypted_extra
    )

    return database


def test_update_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are updated correctly.

    In this test, the database has two catalogs with two schemas each:

        - catalog1
            - schema1
            - schema2
        - catalog2
            - schema3
            - schema4

    When update is called, only `catalog2.schema3` has permissions associated with it,
    so `catalog1.*` and `catalog2.schema4` are added.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_with_catalog
    databaseDao.update.return_value = database_with_catalog

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # first catalog is new
        "[my_db].[catalog2]",  # second catalog already exists
        "[my_db].[catalog2].[schema3]",  # first schema already exists
        None,  # second schema is new
        # these are called when checking for existing perms in [db].[schema] format
        None,
        None,
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {}).run()

    add_permission_view_menu.assert_has_calls(
        [
            # first catalog is added with all schemas
            mocker.call("catalog_access", "[my_db].[catalog1]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_db].[catalog1].[schema2]"),
            # second catalog already exists, only `schema4` is added
            mocker.call("schema_access", "[my_db].[catalog2].[schema4]"),
        ],
    )


def test_update_without_catalog(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are updated correctly.

    In this test, the database has no catalogs and two schemas:

        - schema1
        - schema2

    When update is called, only `schema2` has permissions associated with it, so `schema1`
    is added.
    """  # noqa: E501
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_without_catalog
    databaseDao.update.return_value = database_without_catalog

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {}).run()

    add_permission_view_menu.assert_called_with(
        "schema_access",
        "[my_db].[schema1]",
    )


def test_rename_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are renamed correctly.

    In this test, the database has two catalogs with two schemas each:

        - catalog1
            - schema1
            - schema2
        - catalog2
            - schema3
            - schema4

    When update is called, only `catalog2.schema3` has permissions associated with it,
    so `catalog1.*` and `catalog2.schema4` are added. Additionally, the database has
    been renamed from `my_db` to `my_other_db`.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    original_database = mocker.MagicMock()
    original_database.database_name = "my_db"
    databaseDao.find_by_id.return_value = original_database
    database_with_catalog.database_name = "my_other_db"
    databaseDao.update.return_value = database_with_catalog

    dataset = mocker.MagicMock()
    chart = mocker.MagicMock()
    databaseDao.get_datasets.return_value = [dataset]
    DatasetDAO = mocker.patch("superset.commands.database.update.DatasetDAO")  # noqa: N806
    DatasetDAO.get_related_objects.return_value = {"charts": [chart]}

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    catalog2_pvm = mocker.MagicMock()
    catalog2_schema3_pvm = mocker.MagicMock()
    find_permission_view_menu.side_effect = [
        # these are called when adding the permissions:
        None,  # first catalog is new
        "[my_db].[catalog2]",  # second catalog already exists
        "[my_db].[catalog2].[schema3]",  # first schema already exists
        None,  # second schema is new
        # these are called when renaming the permissions:
        catalog2_pvm,  # old [my_db].[catalog2]
        catalog2_schema3_pvm,  # old [my_db].[catalog2].[schema3]
        None,  # [my_db].[catalog2].[schema4] doesn't exist
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {}).run()

    add_permission_view_menu.assert_has_calls(
        [
            # first catalog is added with all schemas with the new DB name
            mocker.call("catalog_access", "[my_other_db].[catalog1]"),
            mocker.call("schema_access", "[my_other_db].[catalog1].[schema1]"),
            mocker.call("schema_access", "[my_other_db].[catalog1].[schema2]"),
            # second catalog already exists, only `schema4` is added
            mocker.call("schema_access", "[my_other_db].[catalog2].[schema4]"),
        ],
    )

    assert catalog2_pvm.view_menu.name == "[my_other_db].[catalog2]"
    assert catalog2_schema3_pvm.view_menu.name == "[my_other_db].[catalog2].[schema3]"

    assert dataset.catalog_perm == "[my_other_db].[catalog2]"
    assert dataset.schema_perm == "[my_other_db].[catalog2].[schema4]"
    assert chart.catalog_perm == "[my_other_db].[catalog2]"
    assert chart.schema_perm == "[my_other_db].[catalog2].[schema4]"


def test_rename_without_catalog(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are renamed correctly.

    In this test, the database has no catalogs and two schemas:

        - schema1
        - schema2

    When update is called, only `schema2` has permissions associated with it, so `schema1`
    is added. Additionally, the database has been renamed from `my_db` to `my_other_db`.
    """  # noqa: E501
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    original_database = mocker.MagicMock()
    original_database.database_name = "my_db"
    databaseDao.find_by_id.return_value = original_database
    database_without_catalog.database_name = "my_other_db"
    databaseDao.update.return_value = database_without_catalog
    databaseDao.get_datasets.return_value = []

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    schema2_pvm = mocker.MagicMock()
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
        None,  # [my_db].[schema1] doesn't exist
        schema2_pvm,  # old [my_db].[schema2]
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {}).run()

    add_permission_view_menu.assert_called_with(
        "schema_access",
        "[my_other_db].[schema1]",
    )

    assert schema2_pvm.view_menu.name == "[my_other_db].[schema2]"


def test_update_with_oauth2(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the database can be updated even if OAuth2 is needed to connect.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_needs_oauth2
    databaseDao.update.return_value = database_needs_oauth2

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {}).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_not_called()


def test_update_with_oauth2_changed(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the database can be updated even if OAuth2 is needed to connect.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_needs_oauth2
    databaseDao.update.return_value = database_needs_oauth2

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    modified_oauth2_client_info = oauth2_client_info.copy()
    modified_oauth2_client_info["scope"] = "scope-b"

    UpdateDatabaseCommand(
        1,
        {
            "masked_encrypted_extra": json.dumps(
                {"oauth2_client_info": modified_oauth2_client_info}
            )
        },
    ).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()


def test_remove_oauth_config_purges_tokens(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that removing the OAuth config from a database purges existing tokens.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_needs_oauth2
    databaseDao.update.return_value = database_needs_oauth2

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {"masked_encrypted_extra": None}).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()

    UpdateDatabaseCommand(1, {"masked_encrypted_extra": "{}"}).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()


def test_update_oauth2_removes_masked_encrypted_extra_key(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the ``masked_encrypted_extra`` key is properly purged from the properties.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_needs_oauth2
    databaseDao.update.return_value = database_needs_oauth2

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    modified_oauth2_client_info = oauth2_client_info.copy()
    modified_oauth2_client_info["scope"] = "scope-b"

    UpdateDatabaseCommand(
        1,
        {
            "masked_encrypted_extra": json.dumps(
                {"oauth2_client_info": modified_oauth2_client_info}
            )
        },
    ).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()
    databaseDao.update.assert_called_with(
        database_needs_oauth2,
        {
            "encrypted_extra": json.dumps(
                {"oauth2_client_info": modified_oauth2_client_info}
            )
        },
    )


def test_update_other_fields_dont_affect_oauth(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that not including ``masked_encrypted_extra`` in the payload does not
    touch the OAuth config.
    """
    databaseDao = mocker.patch("superset.commands.database.update.DatabaseDAO")  # noqa: N806
    databaseDao.find_by_id.return_value = database_needs_oauth2
    databaseDao.update.return_value = database_needs_oauth2

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    UpdateDatabaseCommand(1, {"database_name": "New DB name"}).run()

    add_permission_view_menu.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_not_called()


def test_update_with_catalog_change(mocker: MockerFixture) -> None:
    """
    Test that assets are updated when the main catalog changes.
    """
    old_database = mocker.MagicMock(allow_multi_catalog=False)
    old_database.get_default_catalog.return_value = "project-A"
    old_database.id = 1

    new_database = mocker.MagicMock(allow_multi_catalog=False)
    new_database.get_default_catalog.return_value = "project-B"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database
    database_dao.update.return_value = new_database

    mocker.patch.object(
        UpdateDatabaseCommand,
        "validate",
    )
    update_catalog_attribute = mocker.patch.object(
        UpdateDatabaseCommand,
        "_update_catalog_attribute",
    )

    UpdateDatabaseCommand(1, {}).run()

    update_catalog_attribute.assert_called_once_with(1, "project-B")


def test_update_without_catalog_change(mocker: MockerFixture) -> None:
    """
    Test that assets are not updated when the main catalog doesn't change.
    """
    old_database = mocker.MagicMock(allow_multi_catalog=False)
    old_database.database_name = "Ye Old DB"
    old_database.get_default_catalog.return_value = "project-A"
    old_database.id = 1

    new_database = mocker.MagicMock(allow_multi_catalog=False)
    new_database.database_name = "Fancy new DB"
    new_database.get_default_catalog.return_value = "project-A"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database
    database_dao.update.return_value = new_database

    mocker.patch.object(
        UpdateDatabaseCommand,
        "validate",
    )
    update_catalog_attribute = mocker.patch.object(
        UpdateDatabaseCommand,
        "_update_catalog_attribute",
    )

    UpdateDatabaseCommand(1, {}).run()

    update_catalog_attribute.assert_not_called()


def test_update_broken_connection(mocker: MockerFixture) -> None:
    """
    Test that updating a database with a broken connection works
    even if it has to run a query to get the default catalog.
    """
    database = mocker.MagicMock()
    database.get_default_catalog.side_effect = Exception("Broken connection")
    database.id = 1
    new_db = mocker.MagicMock()
    new_db.get_default_catalog.return_value = "main"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database
    database_dao.update.return_value = new_db

    update_catalog_attribute = mocker.patch.object(
        UpdateDatabaseCommand,
        "_update_catalog_attribute",
    )
    UpdateDatabaseCommand(1, {}).run()

    update_catalog_attribute.assert_called_once_with(1, "main")
