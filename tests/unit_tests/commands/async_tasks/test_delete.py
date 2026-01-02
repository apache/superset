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

from datetime import datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from superset.commands.async_tasks import DeleteOldAsyncTasksCommand
from superset.commands.async_tasks.exceptions import AsyncTaskInvalidError


def test_delete_old_tasks_success(mocker: MockerFixture) -> None:
    """Test successful deletion of old tasks"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.delete.AsyncTaskDAO"
    )
    AsyncTaskDAO.delete_old_completed_tasks.return_value = 42

    cutoff_date = datetime.utcnow() - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=1000,
    )
    result = command.run()

    assert result == 42
    AsyncTaskDAO.delete_old_completed_tasks.assert_called_once_with(
        older_than=cutoff_date,
        batch_size=1000,
    )


def test_delete_old_tasks_custom_batch_size(mocker: MockerFixture) -> None:
    """Test deletion with custom batch size"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.delete.AsyncTaskDAO"
    )
    AsyncTaskDAO.delete_old_completed_tasks.return_value = 100

    cutoff_date = datetime.utcnow() - timedelta(days=7)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=500,
    )
    result = command.run()

    assert result == 100
    AsyncTaskDAO.delete_old_completed_tasks.assert_called_once_with(
        older_than=cutoff_date,
        batch_size=500,
    )


def test_delete_old_tasks_no_tasks_found(mocker: MockerFixture) -> None:
    """Test deletion when no old tasks exist"""
    AsyncTaskDAO = mocker.patch(  # noqa: N806
        "superset.commands.async_tasks.delete.AsyncTaskDAO"
    )
    AsyncTaskDAO.delete_old_completed_tasks.return_value = 0

    cutoff_date = datetime.utcnow() - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=1000,
    )
    result = command.run()

    assert result == 0


def test_delete_old_tasks_invalid_date(mocker: MockerFixture) -> None:
    """Test deletion fails with invalid date"""
    mocker.patch("superset.commands.async_tasks.delete.AsyncTaskDAO")

    command = DeleteOldAsyncTasksCommand(
        older_than="not-a-date",  # type: ignore
        batch_size=1000,
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "older_than" in exc_info.value._exceptions[0].field_name


def test_delete_old_tasks_invalid_batch_size(mocker: MockerFixture) -> None:
    """Test deletion fails with invalid batch size"""
    mocker.patch("superset.commands.async_tasks.delete.AsyncTaskDAO")

    cutoff_date = datetime.utcnow() - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=0,  # Invalid
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "batch_size" in exc_info.value._exceptions[0].field_name


def test_delete_old_tasks_negative_batch_size(mocker: MockerFixture) -> None:
    """Test deletion fails with negative batch size"""
    mocker.patch("superset.commands.async_tasks.delete.AsyncTaskDAO")

    cutoff_date = datetime.utcnow() - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=-100,  # Invalid
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
