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

from superset.commands.async_tasks import CancelAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskCancelFailedError,
    AsyncTaskForbiddenError,
    AsyncTaskNotFoundError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def test_cancel_task_success(mocker: MockerFixture) -> None:
    """Test successful task cancellation"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"
    mock_task.status = TaskStatus.PENDING.value

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.cancel_task.return_value = True

    security_manager = mocker.patch(
        "superset.commands.async_tasks.cancel.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    db_session = mocker.patch("superset.commands.async_tasks.cancel.db.session")

    command = CancelAsyncTaskCommand(task_uuid="test-uuid")
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.cancel_task.assert_called_once_with("test-uuid")
    db_session.refresh.assert_called_once_with(mock_task)


def test_cancel_in_progress_task(mocker: MockerFixture) -> None:
    """Test cancelling an in-progress task"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"
    mock_task.status = TaskStatus.IN_PROGRESS.value

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.cancel_task.return_value = True

    security_manager = mocker.patch(
        "superset.commands.async_tasks.cancel.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    mocker.patch("superset.commands.async_tasks.cancel.db.session")

    command = CancelAsyncTaskCommand(task_uuid="test-uuid")
    result = command.run()

    assert result == mock_task
    AsyncTaskDAO.cancel_task.assert_called_once_with("test-uuid")


def test_cancel_task_not_found(mocker: MockerFixture) -> None:
    """Test cancel fails when task not found"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = None

    command = CancelAsyncTaskCommand(task_uuid="nonexistent-uuid")

    with pytest.raises(AsyncTaskNotFoundError):
        command.run()


def test_cancel_task_forbidden(mocker: MockerFixture) -> None:
    """Test cancel fails when user doesn't own task"""
    mock_task = MagicMock()

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
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
        "superset.commands.async_tasks.cancel.security_manager"
    )
    security_manager.raise_for_ownership = raise_security_exception

    command = CancelAsyncTaskCommand(task_uuid="test-uuid")

    with pytest.raises(AsyncTaskForbiddenError):
        command.run()


def test_cancel_task_already_finished(mocker: MockerFixture) -> None:
    """Test cancel fails when task already finished"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"
    mock_task.status = TaskStatus.SUCCESS.value

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.cancel_task.return_value = False  # Already finished

    security_manager = mocker.patch(
        "superset.commands.async_tasks.cancel.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    command = CancelAsyncTaskCommand(task_uuid="test-uuid")

    with pytest.raises(AsyncTaskCancelFailedError):
        command.run()


def test_cancel_task_already_cancelled(mocker: MockerFixture) -> None:
    """Test cancel fails when task already cancelled"""
    mock_task = MagicMock()
    mock_task.uuid = "test-uuid"
    mock_task.status = TaskStatus.CANCELLED.value

    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.cancel.AsyncTaskDAO"
    )
    AsyncTaskDAO.find_by_id.return_value = mock_task
    AsyncTaskDAO.cancel_task.return_value = False  # Already cancelled

    security_manager = mocker.patch(
        "superset.commands.async_tasks.cancel.security_manager"
    )
    security_manager.raise_for_ownership.return_value = None

    command = CancelAsyncTaskCommand(task_uuid="test-uuid")

    with pytest.raises(AsyncTaskCancelFailedError):
        command.run()
