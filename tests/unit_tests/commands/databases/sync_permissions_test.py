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
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset import db
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.commands.database.sync_permissions import SyncPermissionsCommand
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError
from superset.extensions import security_manager
from tests.conftest import with_config


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_sync_mode(
    mocker: MockerFixture,
    database_with_catalog: MagicMock,
):
    """
    Test ``SyncPermissionsCommand`` in sync mode.
    """
    mock_ssh = mocker.MagicMock()
    user_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)
    find_pvm_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.find_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    add_pvm_mock = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    cmmd = SyncPermissionsCommand(
        1, "admin", db_connection=database_with_catalog, ssh_tunnel=mock_ssh
    )
    mock_refresh_schemas = mocker.patch.object(cmmd, "_refresh_schemas")
    mock_rename_db_perm = mocker.patch.object(cmmd, "_rename_database_in_permissions")

    cmmd.run()

    assert cmmd.db_connection == database_with_catalog
    assert cmmd.old_db_connection_name == "my_db"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    user_mock.assert_called_once_with("admin")
    add_pvm_mock.assert_has_calls(
        [
            mocker.call(
                db.session, security_manager, "catalog_access", "[my_db].[catalog2]"
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_db].[catalog2].[schema3]",
            ),
            mocker.call(
                db.session,
                security_manager,
                "schema_access",
                "[my_db].[catalog2].[schema4]",
            ),
        ]
    )
    mock_refresh_schemas.assert_called_once_with("catalog1", ["schema1", "schema2"])
    mock_rename_db_perm.assert_not_called()


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": True})
def test_sync_permissions_command_async_mode(
    mocker: MockerFixture, database_with_catalog: MagicMock
) -> None:
    """
    Test ``SyncPermissionsCommand`` in async mode.
    """
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mock_database_dao.find_by_id.return_value = database_with_catalog
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    async_task_mock = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions_task"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)

    cmmd = SyncPermissionsCommand(1, "admin")
    cmmd.run()
    async_task_mock.delay.assert_called_once_with(1, "admin", "my_db")


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_passing_all_values(
    mocker: MockerFixture, database_with_catalog: MagicMock
):
    """
    Test ``SyncPermissionsCommand`` when providing all arguments to the constructor.
    """
    mock_ssh = mocker.MagicMock()
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)

    cmmd = SyncPermissionsCommand(
        1,
        "admin",
        old_db_connection_name="old name",
        db_connection=database_with_catalog,
        ssh_tunnel=mock_ssh,
    )
    mocker.patch.object(cmmd, "sync_database_permissions")
    cmmd.run()

    assert cmmd.db_connection == database_with_catalog
    assert cmmd.old_db_connection_name == "old name"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    mock_database_dao.find_by_id.assert_not_called()
    mock_database_dao.get_ssh_tunnel.assert_not_called()


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_raise(mocker: MockerFixture):
    """
    Test ``SyncPermissionsCommand`` when an exception is raised.
    """
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mock_database_dao.find_by_id.return_value = mocker.MagicMock()
    mock_database_dao.get_ssh_tunnel.return_value = mocker.MagicMock()
    mock_user = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )

    # Connection issues
    mock_ping = mocker.patch(
        "superset.commands.database.sync_permissions.ping", return_value=False
    )
    with pytest.raises(DatabaseConnectionFailedError):
        SyncPermissionsCommand(1, "admin").run()
    mock_ping.reset_mock()
    mock_ping.side_effect = Exception
    with pytest.raises(DatabaseConnectionFailedError):
        SyncPermissionsCommand(1, "admin").run()

    # User not found in session
    mock_user.reset_mock()
    mock_user.return_value = None
    with pytest.raises(UserNotFoundInSessionError):
        SyncPermissionsCommand(1, "admin").run()
    mock_user.reset_mock()
    mock_user.return_value = mocker.MagicMock()

    # DB connection not found
    mock_database_dao.reset_mock()
    mock_database_dao.find_by_id.return_value = None
    with pytest.raises(DatabaseNotFoundError):
        SyncPermissionsCommand(1, "admin").run()


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_new_db_name(
    mocker: MockerFixture, database_with_catalog: MagicMock
):
    """
    Test ``SyncPermissionsCommand`` when the database name changed.
    """
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    cmmd = SyncPermissionsCommand(
        1,
        "admin",
        old_db_connection_name="Old Name",
        db_connection=database_with_catalog,
    )
    cmmd.run()

    assert cmmd.old_db_connection_name == "Old Name"


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": True})
def test_sync_permissions_command_async_mode_new_db_name(
    mocker: MockerFixture, database_with_catalog: MagicMock
):
    """
    Test ``SyncPermissionsCommand`` in async mode when the
    database name changed.
    """
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    async_task_mock = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions_task"
    )
    cmmd = SyncPermissionsCommand(
        1,
        "admin",
        old_db_connection_name="Old Name",
        db_connection=database_with_catalog,
    )
    cmmd.run()

    async_task_mock.delay.assert_called_once_with(1, "admin", "Old Name")


def test_resync_permissions_command_get_catalogs(database_with_catalog: MagicMock):
    """
    Test the ``_get_catalog_names`` method.
    """
    cmmd = SyncPermissionsCommand(1, None, db_connection=database_with_catalog)
    assert cmmd._get_catalog_names() == ["catalog1", "catalog2"]


@pytest.mark.parametrize(
    ("inner_exception, outer_exception"),
    [
        (
            OAuth2RedirectError("Missing token", "mock_tab", "mock_url"),
            OAuth2RedirectError,
        ),
        (GenericDBException, DatabaseConnectionFailedError),
    ],
)
def test_resync_permissions_command_raise_on_getting_catalogs(
    inner_exception: Exception,
    outer_exception: Exception,
    database_with_catalog: MagicMock,
):
    """
    Test the ``_get_catalog_names`` method when raising an exception.
    """
    database_with_catalog.get_all_catalog_names.side_effect = inner_exception
    cmmd = SyncPermissionsCommand(1, None, db_connection=database_with_catalog)
    with pytest.raises(outer_exception):
        cmmd._get_catalog_names()


def test_resync_permissions_command_get_schemas(database_with_catalog: MagicMock):
    """
    Test the ``_get_schema_names`` method.
    """
    cmmd = SyncPermissionsCommand(1, None, db_connection=database_with_catalog)
    assert cmmd._get_schema_names("catalog1") == ["schema1", "schema2"]
    assert cmmd._get_schema_names("catalog2") == ["schema3", "schema4"]


@pytest.mark.parametrize(
    ("inner_exception, outer_exception"),
    [
        (
            OAuth2RedirectError("Missing token", "mock_tab", "mock_url"),
            OAuth2RedirectError,
        ),
        (GenericDBException, DatabaseConnectionFailedError),
    ],
)
def test_resync_permissions_command_raise_on_getting_schemas(
    inner_exception: Exception,
    outer_exception: Exception,
    database_with_catalog: MagicMock,
):
    """
    Test the ``_get_schema_names`` method when raising an exception.
    """
    database_with_catalog.get_all_schema_names.side_effect = inner_exception
    cmmd = SyncPermissionsCommand(1, None, db_connection=database_with_catalog)
    with pytest.raises(outer_exception):
        cmmd._get_schema_names("blah")


def test_resync_permissions_command_refresh_schemas(
    mocker: MockerFixture, database_with_catalog: MagicMock
):
    """
    Test the ``_refresh_schemas`` method.
    """
    find_pvm_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.find_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    add_pvm_mock = mocker.patch("superset.commands.database.sync_permissions.add_pvm")

    cmmd = SyncPermissionsCommand(1, None, db_connection=database_with_catalog)
    cmmd._refresh_schemas("catalog1", ["schema1", "schema2"])

    add_pvm_mock.assert_called_once_with(
        db.session,
        security_manager,
        "schema_access",
        f"[{database_with_catalog.name}].[catalog1].[schema2]",
    )


def test_resync_permissions_command_rename_db_in_perms(
    mocker: MockerFixture, database_with_catalog: MagicMock
):
    """
    Test the ``_rename_database_in_permissions`` method.
    """
    find_pvm_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.find_permission_view_menu"
    )
    mock_catalog_perm = mocker.MagicMock()
    mock_catalog_perm.view_menu.name = "[old_name].[catalog]"
    mock_schema_perm = mocker.MagicMock()
    mock_schema_perm.view_menu.name = "[old_name].[catalog].[schema1]"
    find_pvm_mock.side_effect = [
        mock_catalog_perm,
        mock_schema_perm,
        None,
    ]

    mock_dataset = mocker.MagicMock()
    mock_dataset.id = 1
    mock_dataset.catalog_perm = "[old_name].[catalog1]"
    mock_dataset.schema_perm = "[old_name].[catalog1].[schema1]"
    mock_chart = mocker.MagicMock()
    mock_chart.catalog_perm = "[old_name].[catalog1]"
    mock_chart.schema_perm = "[old_name].[catalog1].[schema1]"

    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mock_database_dao.get_datasets.side_effect = [
        [mock_dataset],
        [],
    ]
    mock_dataset_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatasetDAO"
    )
    mock_dataset_dao.get_related_objects.return_value = {"charts": [mock_chart]}

    cmmd = SyncPermissionsCommand(
        1, None, old_db_connection_name="old_name", db_connection=database_with_catalog
    )
    cmmd._rename_database_in_permissions("catalog1", ["schema1", "schema2"])

    find_pvm_mock.assert_has_calls(
        [
            mocker.call("catalog_access", "[old_name].[catalog1]"),
            mocker.call("schema_access", "[old_name].[catalog1].[schema1]"),
            mocker.call("schema_access", "[old_name].[catalog1].[schema2]"),
        ]
    )

    assert (
        mock_catalog_perm.view_menu.name == f"[{database_with_catalog.name}].[catalog1]"
    )
    assert (
        mock_schema_perm.view_menu.name
        == f"[{database_with_catalog.name}].[catalog1].[schema1]"
    )
    assert mock_dataset.catalog_perm == f"[{database_with_catalog.name}].[catalog1]"
    assert (
        mock_dataset.schema_perm
        == f"[{database_with_catalog.name}].[catalog1].[schema1]"
    )
    assert mock_chart.catalog_perm == f"[{database_with_catalog.name}].[catalog1]"
    assert (
        mock_chart.schema_perm == f"[{database_with_catalog.name}].[catalog1].[schema1]"
    )
