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

from unittest.mock import patch

import pytest
from superset_core.api.tasks import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks import AbortTaskCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskNotFoundError,
)
from superset.daos.tasks import TaskDAO


@patch("superset.tasks.utils.get_current_user")
def test_abort_task_success(mock_get_user, app_context, get_user, login_as) -> None:
    """Test successful task abortlation"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create a pending task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="test_abort_success",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # Abort the task
        command = AbortTaskCommand(task_uuid=task.uuid)
        result = command.run()

        # Verify task was aborted
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.ABORTED.value

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


@patch("superset.tasks.utils.get_current_user")
def test_abort_in_progress_task(mock_get_user, app_context, get_user, login_as) -> None:
    """Test aborting an in-progress task"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create an in-progress task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="test_abort_in_progress",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # abort the task
        command = AbortTaskCommand(task_uuid=task.uuid)
        result = command.run()

        # Verify task was aborted
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.ABORTED.value

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_abort_task_not_found(app_context, login_as) -> None:
    """Test abort fails when task not found"""
    login_as("admin")

    # Use a non-existent UUID
    command = AbortTaskCommand(task_uuid="00000000-0000-0000-0000-000000000000")

    with pytest.raises(TaskNotFoundError):
        command.run()


@patch("superset.tasks.utils.get_current_user")
def test_abort_task_forbidden(mock_get_user, app_context, get_user, login_as) -> None:
    """Test abort fails when user doesn't own task (via base filter)"""
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    # Create a task owned by admin using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="test_abort_forbidden",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to abort admin's task as gamma user
        command = AbortTaskCommand(task_uuid=task.uuid)

        # Should raise NotFoundError because base filter hides the task
        with pytest.raises(TaskNotFoundError):
            command.run()

        # Verify task was NOT aborted
        db.session.refresh(task)
        assert task.status == TaskStatus.PENDING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


@patch("superset.tasks.utils.get_current_user")
def test_abort_task_already_finished(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test abort fails when task already finished"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create a successful (finished) task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="test_abort_finished",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.SUCCESS)
    db.session.commit()

    try:
        # Try to abort finished task
        command = AbortTaskCommand(task_uuid=task.uuid)

        with pytest.raises(TaskAbortFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


@patch("superset.tasks.utils.get_current_user")
def test_abort_task_already_aborted(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test abort fails when task already aborted"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create an already aborted task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="test_abort_already_aborted",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.ABORTED)
    db.session.commit()

    try:
        # Try to abort already aborted task
        command = AbortTaskCommand(task_uuid=task.uuid)

        with pytest.raises(TaskAbortFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()
