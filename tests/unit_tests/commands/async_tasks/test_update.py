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
from pytest_mock import MockerFixture
from superset_core.api.types import TaskStatus

from superset.commands.async_tasks import UpdateAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskForbiddenError,
    AsyncTaskNotFoundError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def test_update_task_success(mocker: MockerFixture) -> None:
    """Test successful task update"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"
    mock_task.status = TaskStatus.IN_PROGRESS.value

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.update.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.update.return_value = mock_task

    security_manager = mocker.patch(
        "superset.commands.async_tasks.update.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    command = UpdateAsyncTaskCommand(
        task_uuid="test-uuid",
        data={"status": TaskStatus.SUCCESS.value},
    )
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.update.assert_called_once()
    AsyncTaskDAO.find_by_id.assert_called_once_with("test-uuid")


def test_update_task_not_found(mocker: MockerFixture) -> None:
    """Test update fails when task not found"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.update.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = None

    command = UpdateAsyncTaskCommand(
        task_uuid="nonexistent-uuid",
        data={"status": TaskStatus.SUCCESS.value},
    )

    with pytest.raises(AsyncTaskNotFoundError):
        command.run()


def test_update_task_forbidden(mocker: MockerFixture) -> None:
    """Test update fails when user doesn't own task"""
    mock_task = MagicMock()

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.update.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task

    # Create a function that raises the exception
    def raise_security_exception(model):  # noqa: ARG001
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message="Not owner",
                level=ErrorLevel.ERROR,
            )
        )

    security_manager = mocker.patch(
        "superset.commands.async_tasks.update.security_manager"
    )
    security_manager.raise_for_ownership = raise_security_exception

    command = UpdateAsyncTaskCommand(
        task_uuid="test-uuid",
        data={"status": TaskStatus.SUCCESS.value},
    )

    with pytest.raises(AsyncTaskForbiddenError):
        command.run()


def test_update_task_payload(mocker: MockerFixture) -> None:
    """Test updating task payload"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.update.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.update.return_value = mock_task

    security_manager = mocker.patch(
        "superset.commands.async_tasks.update.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    command = UpdateAsyncTaskCommand(
        task_uuid="test-uuid",
        data={"payload": {"progress": 50}},
    )
    result = command.run()

    assert result == mock_task
    mock_task.set_payload.assert_called_once_with({"progress": 50})


def test_update_multiple_fields(mocker: MockerFixture) -> None:
    """Test updating multiple task fields at once"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.update.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.update.return_value = mock_task

    security_manager = mocker.patch(
        "superset.commands.async_tasks.update.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    command = UpdateAsyncTaskCommand(
        task_uuid="test-uuid",
        data={
            "status": TaskStatus.FAILURE.value,
            "error_message": "Task failed",
        },
    )
    result = command.run()

    assert result == mock_task
    assert mock_task.status == TaskStatus.FAILURE.value
    assert mock_task.error_message == "Task failed"
