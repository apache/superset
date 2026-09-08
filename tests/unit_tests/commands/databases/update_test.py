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

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset import db
from superset.commands.database.exceptions import DatabaseConnectionFailedError
from superset.commands.database.update import UpdateDatabaseCommand
from superset.constants import PASSWORD_MASK
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.extensions import security_manager
from superset.models.core import Database
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


@pytest.fixture
def unreachable_database(mocker: MockerFixture) -> Database:
    """Set up a database whose permission-sync ping fails, without persistence."""
    database = Database(
        id=1,
        database_name="Druid",
        expose_in_sqllab=True,
        impersonate_user=False,
        extra='{"engine_params": {}, "metadata_params": {}}',
        encrypted_extra='{"connect_args": {"jwt": "original-token"}}',
    )
    database.set_sqlalchemy_uri("druid://user:secret@localhost:8082/druid/v2/sql/")
    mocker.patch(
        "superset.commands.database.update.DatabaseDAO.find_by_id",
        return_value=database,
    )

    def update(model: Database, properties: dict[str, Any]) -> Database:
        """Apply the command's properties in place, as the DAO does."""
        for key, value in properties.items():
            setattr(model, key, value)
        return model

    mocker.patch(
        "superset.commands.database.update.DatabaseDAO.update", side_effect=update
    )
    mocker.patch(
        "superset.commands.database.update.DatabaseDAO.validate_update_uniqueness",
        return_value=True,
    )
    mocker.patch("superset.commands.database.update.get_username", return_value="admin")
    mocker.patch.object(security_manager, "get_user_by_username")
    mocker.patch.object(database, "get_sqla_engine")
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=False)
    return database


@pytest.mark.parametrize("full_payload", [False, True])
@pytest.mark.parametrize("async_mode", [False, True])
def test_update_unreachable_database_metadata(
    mocker: MockerFixture,
    unreachable_database: Database,
    caplog: pytest.LogCaptureFixture,
    full_payload: bool,
    async_mode: bool,
) -> None:
    """An offline database can be hidden from SQL Lab with unchanged settings."""
    from flask import current_app

    mocker.patch.dict(
        current_app.config, {"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": async_mode}
    )
    enqueue = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions_task.delay"
    )
    update_catalog = mocker.patch.object(
        UpdateDatabaseCommand, "_update_catalog_attribute"
    )
    properties: dict[str, Any] = {"expose_in_sqllab": False}
    if full_payload:
        properties.update(
            database_name="Druid",
            sqlalchemy_uri=unreachable_database.sqlalchemy_uri,
            masked_encrypted_extra=json.dumps({"connect_args": {"jwt": PASSWORD_MASK}}),
            extra='{"metadata_params": {}, "engine_params": {}}',
            impersonate_user=False,
            server_cert=None,
            ssh_tunnel=None,
        )

    result = UpdateDatabaseCommand(1, properties).run()

    assert result is unreachable_database
    assert result.expose_in_sqllab is False
    assert result.password == "secret"  # noqa: S105
    assert json.loads(result.encrypted_extra)["connect_args"]["jwt"] == "original-token"
    assert "Skipping permission sync for database 1" in caplog.text
    assert "original-token" not in caplog.text
    enqueue.assert_not_called()
    update_catalog.assert_not_called()


@pytest.mark.parametrize(
    "properties",
    [
        {"database_name": "Renamed"},
        {"sqlalchemy_uri": "druid://user:secret@other-host:8082/druid/v2/sql/"},
        {"sqlalchemy_uri": "druid://user:changed@localhost:8082/druid/v2/sql/"},
        {"masked_encrypted_extra": '{"connect_args": {"jwt": "changed"}}'},
        {"extra": '{"engine_params": {"connect_args": {"scheme": "https"}}}'},
        {"extra": '{"allow_multi_catalog": true}'},
        {"server_cert": "changed-certificate"},
        {"impersonate_user": True},
        {"ssh_tunnel": None},
    ],
    ids=[
        "rename",
        "host",
        "password",
        "encrypted-extra",
        "engine-params",
        "catalogs",
        "certificate",
        "impersonation",
        "remove-tunnel",
    ],
)
def test_update_unreachable_database_changed_connection_fails(
    mocker: MockerFixture,
    unreachable_database: Database,
    properties: dict[str, Any],
) -> None:
    """Changed connection settings or names still require a successful sync."""
    if "ssh_tunnel" in properties:
        unreachable_database.ssh_tunnel = SSHTunnel(server_address="localhost")
    rollback = mocker.patch.object(db.session, "rollback")
    commit = mocker.patch.object(db.session, "commit")

    with pytest.raises(DatabaseConnectionFailedError):
        UpdateDatabaseCommand(1, {"expose_in_sqllab": False, **properties}).run()

    rollback.assert_called_once()
    commit.assert_not_called()


@pytest.mark.parametrize("connection_alive", [False, True])
def test_update_with_missing_old_password(
    mocker: MockerFixture,
    unreachable_database: Database,
    connection_alive: bool,
) -> None:
    """An unavailable old password must not prevent repairing the connection."""
    from flask import current_app
    from sqlalchemy.engine.url import URL

    def password_store(uri: URL) -> str:
        """Only the replacement connection has a stored password."""
        if uri.host == "localhost":
            raise KeyError("The old password was removed")
        return "new-secret"

    mocker.patch.dict(
        current_app.config, {"SQLALCHEMY_CUSTOM_PASSWORD_STORE": password_store}
    )
    mocker.patch(
        "superset.commands.database.sync_permissions.ping",
        return_value=connection_alive,
    )
    sync = mocker.patch(
        "superset.commands.database.sync_permissions."
        "SyncPermissionsCommand.sync_database_permissions"
    )
    new_uri = "druid://user:new-secret@replacement:8082/druid/v2/sql/"
    command = UpdateDatabaseCommand(1, {"sqlalchemy_uri": new_uri})

    if connection_alive:
        result = command.run()
        assert result is unreachable_database
        assert result.sqlalchemy_uri_decrypted == new_uri
        sync.assert_called_once()
    else:
        with pytest.raises(DatabaseConnectionFailedError):
            command.run()
        sync.assert_not_called()
