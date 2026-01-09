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
from superset.commands.async_tasks import BulkAbortAsyncTasksCommand
from superset.commands.async_tasks.exceptions import AsyncTaskInvalidError
from superset.models.async_tasks import AsyncTask


def test_bulk_abort_success(app_context, get_user, login_as) -> None:
    """Test successful bulk abort of multiple tasks"""
    admin = get_user("admin")
    login_as("admin")

    # Create multiple pending tasks
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_bulk_abort_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = admin

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_bulk_abort_2",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task2.created_by = admin

    task3 = AsyncTask(
        task_type="test_type",
        task_key="test_bulk_abort_3",
        status=TaskStatus.PENDING.value,
    )
    task3.created_by = admin

    db.session.add_all([task1, task2, task3])
    db.session.commit()

    try:
        # Bulk abort all tasks
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid, task3.uuid])
        aborted_count, total_requested = command.run()

        # Verify all tasks were aborted
        assert aborted_count == 3
        assert total_requested == 3

        # Verify in database
        db.session.refresh(task1)
        db.session.refresh(task2)
        db.session.refresh(task3)
        assert task1.status == TaskStatus.ABORTED.value
        assert task2.status == TaskStatus.ABORTED.value
        assert task3.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.delete(task3)
        db.session.commit()


def test_bulk_abort_empty_list(app_context, login_as) -> None:
    """Test bulk abort with empty list raises validation error"""
    login_as("admin")

    command = BulkAbortAsyncTasksCommand([])

    with pytest.raises(AsyncTaskInvalidError):
        command.run()


def test_bulk_abort_partial_success(app_context, get_user, login_as) -> None:
    """Test bulk abort with partial success (some tasks already finished)"""
    admin = get_user("admin")
    login_as("admin")

    # Create tasks with different statuses
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_partial_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = admin

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_partial_2",
        status=TaskStatus.SUCCESS.value,  # Already finished
    )
    task2.created_by = admin

    task3 = AsyncTask(
        task_type="test_type",
        task_key="test_partial_3",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task3.created_by = admin

    db.session.add_all([task1, task2, task3])
    db.session.commit()

    try:
        # Bulk abort all tasks
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid, task3.uuid])
        aborted_count, total_requested = command.run()

        # Only 2 tasks should be aborted (task2 was already finished)
        assert aborted_count == 2
        assert total_requested == 3

        # Verify in database
        db.session.refresh(task1)
        db.session.refresh(task2)
        db.session.refresh(task3)
        assert task1.status == TaskStatus.ABORTED.value
        assert task2.status == TaskStatus.SUCCESS.value  # Unchanged
        assert task3.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.delete(task3)
        db.session.commit()


def test_bulk_abort_non_admin_own_tasks(app_context, get_user, login_as) -> None:
    """Test non-admin can only bulk abort their own tasks"""
    gamma = get_user("gamma")
    login_as("gamma")

    # Create tasks owned by gamma
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_gamma_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = gamma

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_gamma_2",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task2.created_by = gamma

    db.session.add_all([task1, task2])
    db.session.commit()

    try:
        # Gamma user aborts their own tasks
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid])
        aborted_count, total_requested = command.run()

        # Both tasks should be aborted
        assert aborted_count == 2
        assert total_requested == 2

        # Verify in database
        db.session.refresh(task1)
        db.session.refresh(task2)
        assert task1.status == TaskStatus.ABORTED.value
        assert task2.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.commit()


def test_bulk_abort_non_admin_forbidden(app_context, get_user, login_as) -> None:
    """Test non-admin cannot bulk abort other users' tasks"""
    admin = get_user("admin")

    # Create tasks owned by admin
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_forbidden_bulk_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = admin

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_forbidden_bulk_2",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task2.created_by = admin

    db.session.add_all([task1, task2])
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to abort admin's tasks as gamma user
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid])
        aborted_count, total_requested = command.run()

        # No tasks should be aborted (base filter prevents access)
        assert aborted_count == 0
        assert total_requested == 2

        # Verify tasks were NOT aborted
        db.session.refresh(task1)
        db.session.refresh(task2)
        assert task1.status == TaskStatus.PENDING.value
        assert task2.status == TaskStatus.IN_PROGRESS.value
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.commit()


def test_bulk_abort_admin_all_tasks(app_context, get_user, login_as) -> None:
    """Test admin can bulk abort tasks from multiple users"""
    admin = get_user("admin")
    gamma = get_user("gamma")
    login_as("admin")

    # Create tasks owned by different users
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_admin_bulk_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = admin

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_admin_bulk_2",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task2.created_by = gamma

    task3 = AsyncTask(
        task_type="test_type",
        task_key="test_admin_bulk_3",
        status=TaskStatus.PENDING.value,
    )
    task3.created_by = gamma

    db.session.add_all([task1, task2, task3])
    db.session.commit()

    try:
        # Admin aborts tasks from both users
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid, task3.uuid])
        aborted_count, total_requested = command.run()

        # All tasks should be aborted (admin bypasses base filter)
        assert aborted_count == 3
        assert total_requested == 3

        # Verify in database
        db.session.refresh(task1)
        db.session.refresh(task2)
        db.session.refresh(task3)
        assert task1.status == TaskStatus.ABORTED.value
        assert task2.status == TaskStatus.ABORTED.value
        assert task3.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.delete(task3)
        db.session.commit()


def test_bulk_abort_mixed_ownership(app_context, get_user, login_as) -> None:
    """Test non-admin can only abort their own tasks in a mixed list"""
    admin = get_user("admin")
    gamma = get_user("gamma")

    # Create tasks owned by both users
    task1 = AsyncTask(
        task_type="test_type",
        task_key="test_mixed_1",
        status=TaskStatus.PENDING.value,
    )
    task1.created_by = gamma

    task2 = AsyncTask(
        task_type="test_type",
        task_key="test_mixed_2",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task2.created_by = admin  # Owned by admin

    db.session.add_all([task1, task2])
    db.session.commit()

    try:
        # Login as gamma user
        login_as("gamma")

        # Try to abort both tasks (including admin's task)
        command = BulkAbortAsyncTasksCommand([task1.uuid, task2.uuid])
        aborted_count, total_requested = command.run()

        # Only gamma's task should be aborted
        assert aborted_count == 1
        assert total_requested == 2

        # Verify in database
        db.session.refresh(task1)
        db.session.refresh(task2)
        assert task1.status == TaskStatus.ABORTED.value
        assert task2.status == TaskStatus.IN_PROGRESS.value  # Unchanged
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.delete(task2)
        db.session.commit()
