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

from pytest_mock import MockerFixture

from superset import db
from superset.commands.database.update import UpdateDatabaseCommand
from superset.extensions import security_manager
from superset.utils import json
from tests.conftest import with_config
from tests.unit_tests.commands.databases.conftest import oauth2_client_info


def test_update_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MagicMock,
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
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_with_catalog
    database_dao.update.return_value = database_with_catalog
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_with_catalog
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

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
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {}).run()

    add_pvm.assert_has_calls(
        [
            # first catalog is added with all schemas
            mocker.call(
                db.session, security_manager, "catalog_access", "[my_db].[catalog1]"
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_db].[catalog1].[schema1]",
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_db].[catalog1].[schema2]",
            ),
            # second catalog already exists, only `schema4` is added
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                f"[{database_with_catalog.name}].[catalog2].[schema4]",
            ),
        ],
    )


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": True})
def test_update_sync_perms_in_async_mode(
    mocker: MockerFixture,
    database_with_catalog: MagicMock,
) -> None:
    """
    Test that updating a DB connection with async mode enables
    triggers the celery task to syn perms.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_with_catalog
    database_dao.update.return_value = database_with_catalog
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_with_catalog
    sync_task = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions_task.delay"
    )
    mocker.patch("superset.commands.database.update.get_username", return_value="admin")
    mocker.patch("superset.security_manager.get_user_by_username")

    UpdateDatabaseCommand(1, {}).run()

    sync_task.assert_called_once_with(1, "admin", "my_db")


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
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_without_catalog
    database_dao.update.return_value = database_without_catalog
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_without_catalog
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {}).run()

    add_pvm.assert_called_with(
        db.session,
        security_manager,
        "schema_access",
        f"[{database_without_catalog.name}].[schema1]",
    )


def test_rename_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MagicMock,
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
    original_database = mocker.MagicMock()
    original_database.database_name = "my_db"
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = original_database
    database_with_catalog.database_name = "my_other_db"
    database_dao.update.return_value = database_with_catalog
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_with_catalog
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    dataset = mocker.MagicMock()
    chart = mocker.MagicMock()
    sync_db_perms_dao.get_datasets.return_value = [dataset]
    dataset_dao = mocker.patch("superset.commands.database.sync_permissions.DatasetDAO")
    dataset_dao.get_related_objects.return_value = {"charts": [chart]}

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    catalog2_pvm = mocker.MagicMock()
    catalog2_pvm.view_menu.name = "[my_db].[catalog2]"
    catalog2_schema3_pvm = mocker.MagicMock()
    catalog2_schema3_pvm.view_menu.name = "[my_db].[catalog2].[schema3]"
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
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")
    add_vm = mocker.patch("superset.commands.database.sync_permissions.add_vm")

    UpdateDatabaseCommand(1, {}).run()

    add_pvm.assert_has_calls(
        [
            # first catalog is added with all schemas with the new DB name
            mocker.call(
                db.session,
                security_manager,
                "catalog_access",
                "[my_other_db].[catalog1]",
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_other_db].[catalog1].[schema1]",
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_other_db].[catalog1].[schema2]",
            ),
            # second catalog already exists, only `schema4` is added
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                f"[{database_with_catalog.name}].[catalog2].[schema4]",
            ),
        ],
    )

    assert catalog2_pvm.view_menu == add_vm.return_value
    assert (
        catalog2_schema3_pvm.view_menu.name
        == f"[{database_with_catalog.name}].[catalog2].[schema3]"
    )

    assert dataset.catalog_perm == f"[{database_with_catalog.name}].[catalog2]"
    assert dataset.schema_perm == f"[{database_with_catalog.name}].[catalog2].[schema4]"
    assert chart.catalog_perm == f"[{database_with_catalog.name}].[catalog2]"
    assert chart.schema_perm == f"[{database_with_catalog.name}].[catalog2].[schema4]"


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
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    original_database = mocker.MagicMock()
    original_database.database_name = "my_db"
    database_without_catalog.database_name = "my_other_db"
    database_dao.update.return_value = database_without_catalog
    database_dao.find_by_id.return_value = original_database
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_without_catalog
    sync_db_perms_dao.get_datasets.return_value = []
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    schema2_pvm = mocker.MagicMock()
    schema2_pvm.view_menu.name = "[my_db].[schema2]"
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
        None,  # [my_db].[schema1] doesn't exist
        schema2_pvm,  # old [my_db].[schema2]
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {}).run()

    add_pvm.assert_called_with(
        db.session,
        security_manager,
        "schema_access",
        f"[{database_without_catalog.name}].[schema1]",
    )

    assert schema2_pvm.view_menu.name == f"[{database_without_catalog.name}].[schema2]"


def test_update_with_oauth2(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the database can be updated even if OAuth2 is needed to connect.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_needs_oauth2
    database_dao.update.return_value = database_needs_oauth2
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_needs_oauth2
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {}).run()

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_not_called()


def test_update_with_oauth2_changed(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the database can be updated even if OAuth2 is needed to connect.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_needs_oauth2
    database_dao.update.return_value = database_needs_oauth2
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_needs_oauth2
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,  # schema1 has no permissions
        "[my_db].[schema2]",  # second schema already exists
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

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

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()


def test_remove_oauth_config_purges_tokens(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that removing the OAuth config from a database purges existing tokens.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_needs_oauth2
    database_dao.update.return_value = database_needs_oauth2
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_needs_oauth2
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {"masked_encrypted_extra": None}).run()

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()

    UpdateDatabaseCommand(1, {"masked_encrypted_extra": "{}"}).run()

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()


def test_update_oauth2_removes_masked_encrypted_extra_key(
    mocker: MockerFixture,
    database_needs_oauth2: MockerFixture,
) -> None:
    """
    Test that the ``masked_encrypted_extra`` key is properly purged from the properties.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_needs_oauth2
    database_dao.update.return_value = database_needs_oauth2
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_needs_oauth2
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

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

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_called()
    database_dao.update.assert_called_with(
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
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = database_needs_oauth2
    database_dao.update.return_value = database_needs_oauth2
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_needs_oauth2
    mocker.patch("superset.commands.database.update.get_username")
    mocker.patch("superset.security_manager.get_user_by_username")

    find_permission_view_menu = mocker.patch.object(
        security_manager,
        "find_permission_view_menu",
    )
    find_permission_view_menu.side_effect = [
        None,
        "[my_db].[schema2]",
    ]
    add_pvm = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    UpdateDatabaseCommand(1, {"database_name": "New DB name"}).run()

    add_pvm.assert_not_called()
    database_needs_oauth2.purge_oauth2_tokens.assert_not_called()
