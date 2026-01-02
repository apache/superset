# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file to you under
# the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain
# a copy of the License at
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
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.commands.async_tasks import CreateAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskCreateFailedError,
    AsyncTaskInvalidError,
)
from superset.daos.exceptions import DAOCreateFailedError


def test_create_task_success(mocker: MockerFixture) -> None:
    """Test successful task creation"""
    mock_task = MagicMock()
    mock_task.id = 1
    mock_task.uuid = "test-uuid"
    mock_task.task_type = "test_type"

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.create.AsyncTaskDAO"
    )
    AsyncTaskDAO.create_task.return_value = mock_task

    command = CreateAsyncTaskCommand(
        data={
            "task_type": "test_type",
            "task_id": "test-id",
            "task_name": "Test Task",
        }
    )
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.create_task.assert_called_once_with(
        task_type="test_type",
        task_id="test-id",
        task_name="Test Task",
        user_id=None,
        database_id=None,
        payload="{}",
    )


def test_create_task_with_all_fields(mocker: MockerFixture) -> None:
    """Test task creation with all optional fields"""
    mock_task = MagicMock()

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.create.AsyncTaskDAO"
    )
    AsyncTaskDAO.create_task.return_value = mock_task

    command = CreateAsyncTaskCommand(
        data={
            "task_type": "test_type",
            "task_id": "test-id",
            "task_name": "Test Task",
            "user_id": 123,
            "database_id": 456,
            "payload": '{"key": "value"}',
        }
    )
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.create_task.assert_called_once_with(
        task_type="test_type",
        task_id="test-id",
        task_name="Test Task",
        user_id=123,
        database_id=456,
        payload='{"key": "value"}',
    )


def test_create_task_missing_task_type(mocker: MockerFixture) -> None:
    """Test creation fails when task_type is missing"""
    mocker.patch("superset.commands.async_tasks.create.AsyncTaskDAO")

    command = CreateAsyncTaskCommand(data={})

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert isinstance(exc_info.value._exceptions[0], ValidationError)
    assert "task_type" in exc_info.value._exceptions[0].field_name


def test_create_task_dao_failure(mocker: MockerFixture) -> None:
    """Test creation fails when DAO raises error"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.create.AsyncTaskDAO"
    )
    AsyncTaskDAO.create_task.side_effect = DAOCreateFailedError("Duplicate task")

    command = CreateAsyncTaskCommand(data={"task_type": "test_type"})

    with pytest.raises(AsyncTaskCreateFailedError):
        command.run()


def test_create_task_without_task_id(mocker: MockerFixture) -> None:
    """Test task creation without task_id (DAO generates UUID)"""
    mock_task = MagicMock()

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.create.AsyncTaskDAO"
    )
    AsyncTaskDAO.create_task.return_value = mock_task

    command = CreateAsyncTaskCommand(
        data={
            "task_type": "test_type",
            "task_name": "Test Task",
        }
    )
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.create_task.assert_called_once_with(
        task_type="test_type",
        task_id=None,  # DAO will generate UUID
        task_name="Test Task",
        user_id=None,
        database_id=None,
        payload="{}",
    )
