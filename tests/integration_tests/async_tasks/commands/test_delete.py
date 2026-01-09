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

from datetime import datetime, timedelta, timezone

import pytest
from superset_core.api.async_tasks import TaskStatus

from superset import db
from superset.commands.async_tasks import DeleteOldAsyncTasksCommand
from superset.commands.async_tasks.exceptions import AsyncTaskInvalidError
from superset.models.async_tasks import AsyncTask


def test_delete_old_tasks_success(app_context, get_user, login_as) -> None:
    """Test successful deletion of old tasks"""
    login_as("admin")
    admin = get_user("admin")

    # Create old completed tasks
    old_date = datetime.now(timezone.utc) - timedelta(days=35)
    tasks = []
    for i in range(3):
        task = AsyncTask(
            task_type="test_type",
            task_key=f"old_task_{i}",
            status=TaskStatus.SUCCESS.value,
        )
        task.created_by = admin
        task.ended_at = old_date
        db.session.add(task)
        tasks.append(task)

    db.session.commit()

    try:
        # Delete tasks older than 30 days
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
        command = DeleteOldAsyncTasksCommand(
            older_than=cutoff_date,
            batch_size=1000,
        )
        result = command.run()

        # Verify 3 tasks were deleted
        assert result == 3

        # Verify tasks are gone from database (query directly since they're deleted)
        for task in tasks:
            assert db.session.get(AsyncTask, task.id) is None
    except AssertionError:
        # Cleanup if test fails
        for task in tasks:
            existing_task = db.session.get(AsyncTask, task.id)
            if existing_task:
                db.session.delete(existing_task)
        db.session.commit()
        raise


def test_delete_old_tasks_custom_batch_size(app_context, get_user, login_as) -> None:
    """Test deletion with custom batch size"""
    login_as("admin")
    admin = get_user("admin")

    # Create old completed tasks
    old_date = datetime.now(timezone.utc) - timedelta(days=10)
    tasks = []
    for i in range(5):
        task = AsyncTask(
            task_type="test_type",
            task_key=f"batch_task_{i}",
            status=TaskStatus.ABORTED.value,
        )
        task.created_by = admin
        task.ended_at = old_date
        db.session.add(task)
        tasks.append(task)

    db.session.commit()

    try:
        # Delete with custom batch size
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        command = DeleteOldAsyncTasksCommand(
            older_than=cutoff_date,
            batch_size=2,  # Small batch size
        )
        result = command.run()

        # Verify all 5 tasks were deleted despite small batch size
        assert result == 5
    except AssertionError:
        # Cleanup if test fails
        for task in tasks:
            if db.session.get(AsyncTask, task.id):
                db.session.delete(task)
        db.session.commit()
        raise


def test_delete_old_tasks_no_tasks_found(app_context, login_as) -> None:
    """Test deletion when no old tasks exist"""
    login_as("admin")

    # Don't create any tasks - should find nothing to delete
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=1000,
    )
    result = command.run()

    # Should delete 0 tasks
    assert result == 0


def test_delete_old_tasks_invalid_date(app_context, login_as) -> None:
    """Test deletion fails with invalid date"""
    login_as("admin")

    command = DeleteOldAsyncTasksCommand(
        older_than="not-a-date",  # type: ignore
        batch_size=1000,
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "older_than" in exc_info.value._exceptions[0].field_name


def test_delete_old_tasks_invalid_batch_size(app_context, login_as) -> None:
    """Test deletion fails with invalid batch size"""
    login_as("admin")

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=0,  # Invalid
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "batch_size" in exc_info.value._exceptions[0].field_name


def test_delete_old_tasks_negative_batch_size(app_context, login_as) -> None:
    """Test deletion fails with negative batch size"""
    login_as("admin")

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
    command = DeleteOldAsyncTasksCommand(
        older_than=cutoff_date,
        batch_size=-100,  # Invalid
    )

    with pytest.raises(AsyncTaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "batch_size" in exc_info.value._exceptions[0].field_name
