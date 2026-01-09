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
from superset_core.api.async_tasks import TaskStatus

from superset import db
from superset.commands.async_tasks import AbortAsyncTaskCommand
from superset.commands.async_tasks.exceptions import (
    AsyncTaskAbortFailedError,
    AsyncTaskNotFoundError,
)
from superset.models.async_tasks import AsyncTask


def test_abort_task_success(app_context, get_user, login_as) -> None:
    """Test successful task abortlation"""
    admin = get_user("admin")
    login_as("admin")

    # Create a pending task
    task = AsyncTask(
        task_type="test_type",
        task_key="test_abort_success",
        status=TaskStatus.PENDING.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Abort the task
        command = AbortAsyncTaskCommand(task_uuid=task.uuid)
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


def test_abort_in_progress_task(app_context, get_user, login_as) -> None:
    """Test aborting an in-progress task"""
    admin = get_user("admin")
    login_as("admin")

    # Create an in-progress task
    task = AsyncTask(
        task_type="test_type",
        task_key="test_abort_in_progress",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # abort the task
        command = AbortAsyncTaskCommand(task_uuid=task.uuid)
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
    command = AbortAsyncTaskCommand(task_uuid="00000000-0000-0000-0000-000000000000")

    with pytest.raises(AsyncTaskNotFoundError):
        command.run()


def test_abort_task_forbidden(app_context, get_user, login_as) -> None:
    """Test abort fails when user doesn't own task (via base filter)"""
    admin = get_user("admin")

    # Create a task owned by admin
    task = AsyncTask(
        task_type="test_type",
        task_key="test_abort_forbidden",
        status=TaskStatus.PENDING.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to abort admin's task as gamma user
        command = AbortAsyncTaskCommand(task_uuid=task.uuid)

        # Should raise NotFoundError because base filter hides the task
        with pytest.raises(AsyncTaskNotFoundError):
            command.run()

        # Verify task was NOT aborted
        db.session.refresh(task)
        assert task.status == TaskStatus.PENDING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_abort_task_already_finished(app_context, get_user, login_as) -> None:
    """Test abort fails when task already finished"""
    admin = get_user("admin")
    login_as("admin")

    # Create a successful (finished) task
    task = AsyncTask(
        task_type="test_type",
        task_key="test_abort_finished",
        status=TaskStatus.SUCCESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Try to abort finished task
        command = AbortAsyncTaskCommand(task_uuid=task.uuid)

        with pytest.raises(AsyncTaskAbortFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_abort_task_already_aborted(app_context, get_user, login_as) -> None:
    """Test abort fails when task already aborted"""
    admin = get_user("admin")
    login_as("admin")

    # Create an already aborted task
    task = AsyncTask(
        task_type="test_type",
        task_key="test_abort_already_aborted",
        status=TaskStatus.ABORTED.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Try to abort already aborted task
        command = AbortAsyncTaskCommand(task_uuid=task.uuid)

        with pytest.raises(AsyncTaskAbortFailedError):
            command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()
