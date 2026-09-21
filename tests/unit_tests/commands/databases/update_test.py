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

from superset import db
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.commands.database.update import UpdateDatabaseCommand
from superset.constants import PASSWORD_MASK
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
    mock_user = mocker.patch("superset.security_manager.get_user_by_username")

    UpdateDatabaseCommand(1, {}).run()

    sync_task.assert_called_once_with(1, mock_user.return_value.id, "my_db")


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


def test_rename_without_catalog_with_assets(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are renamed correctly when the DB connection does not support
    catalogs, and it has assets associated with it.
    """
    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    original_database = mocker.MagicMock()
    original_database.database_name = "my_db"
    database_without_catalog.database_name = "my_other_db"
    database_without_catalog.get_all_schema_names.return_value = ["schema1"]
    database_dao.update.return_value = database_without_catalog
    database_dao.find_by_id.return_value = original_database
    sync_db_perms_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    sync_db_perms_dao.find_by_id.return_value = database_without_catalog
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
    schema_pvm = mocker.MagicMock()
    schema_pvm.view_menu.name = "[my_db].[schema1]"
    find_permission_view_menu.side_effect = [
        "[my_db].[schema1]",
        schema_pvm,
    ]

    UpdateDatabaseCommand(1, {}).run()

    assert schema_pvm.view_menu.name == f"[{database_without_catalog.name}].[schema1]"
    assert dataset.schema_perm == f"[{database_without_catalog.name}].[schema1]"
    assert dataset.catalog_perm is None
    assert chart.catalog_perm is None
    assert chart.schema_perm == f"[{database_without_catalog.name}].[schema1]"


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

    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")
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

    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")
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
    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")

    update_catalog_attribute = mocker.patch.object(
        UpdateDatabaseCommand,
        "_update_catalog_attribute",
    )
    UpdateDatabaseCommand(1, {}).run()

    update_catalog_attribute.assert_called_once_with(1, "main")


def test_update_host_change_requires_new_credentials(mocker: MockerFixture) -> None:
    """
    An update that repoints an existing database at a different host while
    the URI's password stays masked must not silently reuse the stored
    password: the update persists, so every subsequent use of the database
    (by any user) would send the real credential to the new host.
    """
    existing = mocker.MagicMock()
    existing.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    existing.extra = "{}"
    existing.ssh_tunnel = None

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = existing

    with pytest.raises(DatabaseInvalidError):
        UpdateDatabaseCommand(
            1,
            {
                "sqlalchemy_uri": (
                    "postgresql://user:XXXXXXXXXX@attacker.example.com:5432/prod"
                )
            },
        ).run()

    database_dao.update.assert_not_called()


def test_update_engine_params_change_requires_new_credentials(
    mocker: MockerFixture,
) -> None:
    """
    An update that changes `extra.engine_params` (e.g.
    `connect_args.host`/`port`, merged into the actual DBAPI connect kwargs
    ahead of anything in `sqlalchemy_uri`) while the URI's password stays
    masked must not silently reuse the stored password.
    """
    existing = mocker.MagicMock()
    existing.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    existing.extra = "{}"
    existing.ssh_tunnel = None

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = existing

    with pytest.raises(DatabaseInvalidError):
        UpdateDatabaseCommand(
            1,
            {
                "extra": json.dumps(
                    {
                        "engine_params": {
                            "connect_args": {
                                "host": "attacker.example.com",
                                "port": 15432,
                            }
                        }
                    }
                )
            },
        ).run()

    database_dao.update.assert_not_called()


def test_update_ssh_tunnel_host_change_requires_new_credentials(
    mocker: MockerFixture,
) -> None:
    """
    An update that repoints an existing database's SSH tunnel at a
    different server must not silently reuse the stored tunnel password.
    """
    existing = mocker.MagicMock()
    existing.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    existing.extra = "{}"
    tunnel = mocker.MagicMock()
    tunnel.server_address = "10.0.0.1"
    tunnel.server_port = 22
    existing.ssh_tunnel = tunnel

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = existing

    with pytest.raises(DatabaseInvalidError):
        UpdateDatabaseCommand(
            1,
            {
                "ssh_tunnel": {
                    "server_address": "attacker.example.com",
                    "server_port": 22,
                    "username": "tunnel_user",
                    "password": PASSWORD_MASK,
                }
            },
        ).run()

    database_dao.update.assert_not_called()


def test_update_ssh_tunnel_private_key_password_not_carried_over(
    mocker: MockerFixture,
) -> None:
    """
    An update that repoints the SSH tunnel and supplies a fresh
    private_key but omits private_key_password must not silently keep the
    old, real passphrase attached to the new key.
    """
    tunnel = mocker.MagicMock()
    tunnel.server_address = "10.0.0.1"
    tunnel.server_port = 22
    tunnel.private_key_password = "original-passphrase"  # noqa: S105

    existing = mocker.MagicMock()
    existing.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    existing.extra = "{}"
    existing.ssh_tunnel = tunnel

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = existing

    with pytest.raises(DatabaseInvalidError):
        UpdateDatabaseCommand(
            1,
            {
                "ssh_tunnel": {
                    "server_address": "attacker.example.com",
                    "server_port": 22,
                    "username": "tunnel_user",
                    "private_key": "-----BEGIN PRIVATE KEY-----\nNew\n-----END-----",
                    # private_key_password omitted entirely
                }
            },
        ).run()

    database_dao.update.assert_not_called()


def test_update_encrypted_extra_reused_when_uri_password_fresh_requires_new_credentials(
    mocker: MockerFixture,
) -> None:
    """
    A fresh URI password alone isn't enough: if `encrypted_extra` carries a
    real secret and the submission leaves it masked, the destination change
    must still be refused, or that secret silently rides along to the new
    destination too.
    """

    def _unmask(old: str, new: str) -> str:
        old_config = json.loads(old)
        new_config = json.loads(new)
        for key, value in new_config.items():
            if value == PASSWORD_MASK and key in old_config:
                new_config[key] = old_config[key]
        return json.dumps(new_config)

    old_database = mocker.MagicMock()
    old_database.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    old_database.password = "oldpass"  # noqa: S105
    old_database.extra = "{}"
    old_database.encrypted_extra = json.dumps({"client_secret": "real-secret"})
    old_database.ssh_tunnel = None
    old_database.db_engine_spec.unmask_encrypted_extra.side_effect = _unmask

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database

    with pytest.raises(DatabaseInvalidError):
        UpdateDatabaseCommand(
            1,
            {
                "sqlalchemy_uri": (
                    "postgresql://user:newpass@attacker.example.com:5432/prod"
                ),
                "masked_encrypted_extra": json.dumps({"client_secret": PASSWORD_MASK}),
            },
        ).run()

    database_dao.update.assert_not_called()


def test_update_destination_change_with_fresh_encrypted_extra_and_no_uri_password(
    mocker: MockerFixture,
) -> None:
    """
    Engines that store credentials entirely in `encrypted_extra` and carry
    no URI password at all (BigQuery, GSheets) must still be able to move
    destinations when a genuinely fresh credential is supplied -- gating
    solely on URI-password freshness would block them unconditionally,
    since they never have one to give.
    """

    def _unmask(old: str, new: str) -> str:
        old_config = json.loads(old)
        new_config = json.loads(new)
        for key, value in new_config.items():
            if value == PASSWORD_MASK and key in old_config:
                new_config[key] = old_config[key]
        return json.dumps(new_config)

    old_database = mocker.MagicMock(allow_multi_catalog=False)
    old_database.sqlalchemy_uri = "bigquery://old-project"
    old_database.password = None
    old_database.extra = "{}"
    old_database.encrypted_extra = json.dumps({"credentials_info": "old-creds"})
    old_database.ssh_tunnel = None
    old_database.db_engine_spec.unmask_encrypted_extra.side_effect = _unmask
    old_database.get_default_catalog.return_value = "old-project"
    old_database.id = 1

    new_database = mocker.MagicMock(allow_multi_catalog=False)
    new_database.get_default_catalog.return_value = "new-project"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database
    database_dao.update.return_value = new_database

    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")
    mocker.patch.object(UpdateDatabaseCommand, "_update_catalog_attribute")

    UpdateDatabaseCommand(
        1,
        {
            "sqlalchemy_uri": "bigquery://old-project",
            "extra": json.dumps(
                {"engine_params": {"connect_args": {"host": "new-host"}}}
            ),
            "masked_encrypted_extra": json.dumps(
                {"credentials_info": "brand-new-creds"}
            ),
        },
    ).run()

    database_dao.update.assert_called_once()


def test_update_host_change_with_new_credentials(mocker: MockerFixture) -> None:
    """
    A deliberate connection move is still possible when the update supplies
    a fresh password for the new destination.
    """
    old_database = mocker.MagicMock(allow_multi_catalog=False)
    old_database.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    old_database.password = "oldpass"  # noqa: S105
    old_database.extra = "{}"
    old_database.encrypted_extra = "{}"
    old_database.ssh_tunnel = None
    old_database.get_default_catalog.return_value = "prod"
    old_database.id = 1

    new_database = mocker.MagicMock(allow_multi_catalog=False)
    new_database.get_default_catalog.return_value = "prod"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database
    database_dao.update.return_value = new_database

    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")
    mocker.patch.object(UpdateDatabaseCommand, "_update_catalog_attribute")

    UpdateDatabaseCommand(
        1,
        {"sqlalchemy_uri": "postgresql://user:newpass@host2:5432/prod"},
    ).run()

    database_dao.update.assert_called_once()


def test_update_unrelated_fields_still_work(mocker: MockerFixture) -> None:
    """
    An update that doesn't touch `sqlalchemy_uri`, `extra`, or `ssh_tunnel`
    at all must not be blocked by the new destination-change check.
    """
    old_database = mocker.MagicMock(allow_multi_catalog=False)
    old_database.sqlalchemy_uri = "postgresql://user:XXXXXXXXXX@host1"
    old_database.extra = "{}"
    old_database.ssh_tunnel = None
    old_database.get_default_catalog.return_value = "prod"
    old_database.id = 1

    new_database = mocker.MagicMock(allow_multi_catalog=False)
    new_database.get_default_catalog.return_value = "prod"

    database_dao = mocker.patch("superset.commands.database.update.DatabaseDAO")
    database_dao.find_by_id.return_value = old_database
    database_dao.update.return_value = new_database

    mocker.patch("superset.commands.database.update.SyncPermissionsCommand")
    mocker.patch.object(UpdateDatabaseCommand, "_update_catalog_attribute")

    UpdateDatabaseCommand(1, {"expose_in_sqllab": False}).run()

    database_dao.update.assert_called_once()
