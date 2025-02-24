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

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.commands.database.sync_permissions import SyncPermissionsCommand
from tests.conftest import with_config


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_sync_mode(mocker: MockerFixture):
    """
    Test ``SyncPermissionsCommand`` in sync mode.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mock_database_dao.find_by_id.return_value = mock_db
    mock_database_dao.get_ssh_tunnel.return_value = mock_ssh
    user_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    sync_mock = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)

    cmmd = SyncPermissionsCommand(1, "admin")
    cmmd.run()

    assert cmmd.db_connection == mock_db
    assert cmmd.old_db_connection_name == "current name"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    mock_database_dao.find_by_id.assert_called_once_with(1)
    mock_database_dao.get_ssh_tunnel.assert_called_once_with(1)
    user_mock.assert_called_once_with("admin")
    sync_mock.assert_called_once_with(1, "admin", "current name")


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": True})
def test_sync_permissions_command_async_mode(mocker: MockerFixture) -> None:
    """
    Test ``SyncPermissionsCommand`` in async mode.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mock_database_dao.find_by_id.return_value = mock_db
    mock_database_dao.get_ssh_tunnel.return_value = mock_ssh
    user_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    sync_mock = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)

    cmmd = SyncPermissionsCommand(1, "admin")
    cmmd.run()

    assert cmmd.db_connection == mock_db
    assert cmmd.old_db_connection_name == "current name"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    mock_database_dao.find_by_id.assert_called_once_with(1)
    mock_database_dao.get_ssh_tunnel.assert_called_once_with(1)
    user_mock.assert_called_once_with("admin")
    sync_mock.delay.assert_called_once_with(1, "admin", "current name")


@with_config({"SYNC_DB_PERMISSIONS_IN_ASYNC_MODE": False})
def test_sync_permissions_command_passing_all_values(mocker: MockerFixture):
    """
    Test ``SyncPermissionsCommand`` when providing all arguments to the constructor.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_database_dao = mocker.patch(
        "superset.commands.database.sync_permissions.DatabaseDAO"
    )
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
    )
    mocker.patch("superset.commands.database.sync_permissions.ping", return_value=True)

    cmmd = SyncPermissionsCommand(
        1,
        "admin",
        old_db_connection_name="old name",
        db_connection=mock_db,
        ssh_tunnel=mock_ssh,
    )
    cmmd.run()

    assert cmmd.db_connection == mock_db
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
    mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
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
def test_sync_permissions_command_new_db_name(mocker: MockerFixture):
    """
    Test ``SyncPermissionsCommand`` when the database name changed.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "New Name"

    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
    )
    sync_mock = mocker.patch(
        "superset.commands.database.sync_permissions.sync_database_permissions"
    )

    SyncPermissionsCommand(
        1,
        "admin",
        old_db_connection_name="Old Name",
        db_connection=mock_db,
    ).run()

    sync_mock.assert_called_once_with(1, "admin", "Old Name")
