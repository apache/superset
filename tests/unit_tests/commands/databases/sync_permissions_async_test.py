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
    UserNotFoundError,
)
from superset.commands.database.sync_permissions_async import (
    SyncPermissionsAsyncCommand,
)


def test_sync_permissions_async_command_validate(mocker: MockerFixture) -> None:
    """
    Test the ``validate`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Connection Name"
    mocker.patch(
        "superset.commands.database.sync_permissions_async.DatabaseDAO.find_by_id",
        return_value=mock_db,
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.security_manager.get_user_by_username",
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.ping", return_value=True
    )

    command = SyncPermissionsAsyncCommand(1, "username")
    command.validate()

    # Asserts
    assert command.db_connection_id == 1
    assert command.username == "username"
    assert command.old_db_connection_name == "Connection Name"


def test_sync_permissions_async_command_validate_new_db_name(mocker: MockerFixture):
    """
    Test the ``validate`` method when the DB connection has a new name.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Connection Name"
    mocker.patch(
        "superset.commands.database.sync_permissions_async.DatabaseDAO.find_by_id",
        return_value=mock_db,
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.security_manager.get_user_by_username",
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.ping", return_value=True
    )

    command = SyncPermissionsAsyncCommand(
        1, "username", old_db_connection_name="Old Connection Name"
    )
    command.validate()

    # Asserts
    assert command.db_connection_id == 1
    assert command.username == "username"
    assert command.old_db_connection_name == "Old Connection Name"


def test_sync_permissions_async_command_validate_database_not_found(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``validate`` method when the database connection is not found.
    """
    mocker.patch(
        "superset.commands.database.sync_permissions_async.DatabaseDAO.find_by_id",
        return_value=None,
    )

    command = SyncPermissionsAsyncCommand(1, "username")
    with pytest.raises(DatabaseNotFoundError):
        command.validate()


def test_sync_permissions_async_command_validate_user_not_found(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``validate`` method when the user is not found.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Connection Name"
    mocker.patch(
        "superset.commands.database.sync_permissions_async.DatabaseDAO.find_by_id",
        return_value=mock_db,
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.security_manager.get_user_by_username",
        return_value=None,
    )

    command = SyncPermissionsAsyncCommand(1, "username")
    with pytest.raises(UserNotFoundError):
        command.validate()


def test_synsc_permissions_async_command_validate_db_connection_error(
    mocker: MockerFixture,
):
    """
    Test the ``validate`` method when the database connection fails.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Connection Name"
    mocker.patch(
        "superset.commands.database.sync_permissions_async.DatabaseDAO.find_by_id",
        return_value=mock_db,
    )
    mocker.patch(
        "superset.commands.database.sync_permissions_async.security_manager.get_user_by_username",
    )
    mock_ping = mocker.patch(
        "superset.commands.database.sync_permissions_async.ping", return_value=False
    )

    command = SyncPermissionsAsyncCommand(1, "username")
    with pytest.raises(DatabaseConnectionFailedError):
        command.validate()

    mock_ping.reset_mock()
    mock_ping.side_effect = Exception

    with pytest.raises(DatabaseConnectionFailedError):
        command.validate()
