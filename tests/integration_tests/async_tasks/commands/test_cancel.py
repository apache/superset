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

import pytest
from superset_core.api.types import TaskStatus

from superset import db
from superset.commands.async_tasks import CancelAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskCancelFailedError,
    AsyncTaskNotFoundError,
)
from superset.models.async_tasks import AsyncTask


def test_cancel_task_success(app_context, get_user, login_as) -> None:
    """Test successful task cancellation"""
    admin = get_user("admin")
    login_as("admin")

    # Create a pending task
    task = AsyncTask(
        task_id="test_cancel_success",
        task_type="test_type",
        status=TaskStatus.PENDING.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Cancel the task
        command = CancelAsyncTaskCommand(task_uuid=task.uuid)
        result = command.run()

        # Verify task was cancelled
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.CANCELLED.value

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.CANCELLED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_in_progress_task(app_context, get_user, login_as) -> None:
    """Test cancelling an in-progress task"""
    admin = get_user("admin")
    login_as("admin")

    # Create an in-progress task
    task = AsyncTask(
        task_id="test_cancel_in_progress",
        task_type="test_type",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Cancel the task
        command = CancelAsyncTaskCommand(task_uuid=task.uuid)
        result = command.run()

        # Verify task was cancelled
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.CANCELLED.value

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.CANCELLED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_task_not_found(app_context, login_as) -> None:
    """Test cancel fails when task not found"""
    login_as("admin")

    # Use a non-existent UUID
    command = CancelAsyncTaskCommand(task_uuid="00000000-0000-0000-0000-000000000000")

    with pytest.raises(AsyncTaskNotFoundError):
        command.run()


def test_cancel_task_forbidden(app_context, get_user, login_as) -> None:
    """Test cancel fails when user doesn't own task (via base filter)"""
    admin = get_user("admin")
    gamma = get_user("gamma")

    # Create a task owned by admin
    task = AsyncTask(
        task_id="test_cancel_forbidden",
        task_type="test_type",
        status=TaskStatus.PENDING.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to cancel admin's task as gamma user
        command = CancelAsyncTaskCommand(task_uuid=task.uuid)

        # Should raise NotFoundError because base filter hides the task
        with pytest.raises(AsyncTaskNotFoundError):
            command.run()

        # Verify task was NOT cancelled
        db.session.refresh(task)
        assert task.status == TaskStatus.PENDING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_task_already_finished(app_context, get_user, login_as) -> None:
    """Test cancel fails when task already finished"""
    admin = get_user("admin")
    login_as("admin")

    # Create a successful (finished) task
    task = AsyncTask(
        task_id="test_cancel_finished",
        task_type="test_type",
        status=TaskStatus.SUCCESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Try to cancel finished task
        command = CancelAsyncTaskCommand(task_uuid=task.uuid)

        with pytest.raises(AsyncTaskCancelFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_task_already_cancelled(app_context, get_user, login_as) -> None:
    """Test cancel fails when task already cancelled"""
    admin = get_user("admin")
    login_as("admin")

    # Create an already cancelled task
    task = AsyncTask(
        task_id="test_cancel_already_cancelled",
        task_type="test_type",
        status=TaskStatus.CANCELLED.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Try to cancel already cancelled task
        command = CancelAsyncTaskCommand(task_uuid=task.uuid)

        with pytest.raises(AsyncTaskCancelFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.CANCELLED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()
