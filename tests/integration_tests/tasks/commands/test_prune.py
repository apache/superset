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

from datetime import datetime, timezone
from unittest.mock import patch

from freezegun import freeze_time
from superset_core.api.tasks import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks import TaskPruneCommand
from superset.daos.tasks import TaskDAO
from superset.models.tasks import Task


@freeze_time("2024-02-15")
@patch("superset.tasks.utils.get_current_user")
def test_prune_tasks_success(mock_get_user, app_context, get_user, login_as) -> None:
    """Test successful pruning of old completed tasks"""
    login_as("admin")
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    # Create old completed tasks (35 days ago = Jan 11, 2024)
    old_date = datetime(2024, 1, 11, tzinfo=timezone.utc)
    task_ids = []
    for i in range(3):
        task = TaskDAO.create_task(
            task_type="test_type",
            task_key=f"prune_task_{i}",
            scope=TaskScope.PRIVATE,
            user_id=admin.id,
        )
        task.created_by = admin
        task.set_status(TaskStatus.SUCCESS)
        task.ended_at = old_date
        task_ids.append(task.id)

    # Create a recent task (5 days ago = Feb 10, 2024) that should NOT be deleted
    recent_date = datetime(2024, 2, 10, tzinfo=timezone.utc)
    recent_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="recent_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    recent_task.created_by = admin
    recent_task.set_status(TaskStatus.SUCCESS)
    recent_task.ended_at = recent_date
    recent_task_id = recent_task.id

    db.session.commit()

    try:
        # Prune tasks older than 30 days
        command = TaskPruneCommand(retention_period_days=30)
        command.run()

        # Verify old tasks are deleted
        for task_id in task_ids:
            assert db.session.get(Task, task_id) is None

        # Verify recent task is NOT deleted
        assert db.session.get(Task, recent_task_id) is not None
    finally:
        # Cleanup remaining tasks
        for task_id in task_ids:
            existing = db.session.get(Task, task_id)
            if existing:
                db.session.delete(existing)
        if db.session.get(Task, recent_task_id):
            db.session.delete(db.session.get(Task, recent_task_id))
        db.session.commit()


@freeze_time("2024-02-15")
@patch("superset.tasks.utils.get_current_user")
def test_prune_tasks_with_max_rows(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test pruning with max_rows_per_run limit"""
    login_as("admin")
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    # Create old completed tasks (35 days ago = Jan 11, 2024)
    task_ids = []
    for i in range(5):
        # Different ages for ordering (older tasks have smaller hour values)
        old_date = datetime(2024, 1, 11, i, tzinfo=timezone.utc)
        task = TaskDAO.create_task(
            task_type="test_type",
            task_key=f"max_rows_task_{i}",
            scope=TaskScope.PRIVATE,
            user_id=admin.id,
        )
        task.created_by = admin
        task.set_status(TaskStatus.SUCCESS)
        task.ended_at = old_date
        task_ids.append(task.id)

    db.session.commit()

    try:
        # Prune with max_rows_per_run=2 (should only delete 2 oldest)
        command = TaskPruneCommand(retention_period_days=30, max_rows_per_run=2)
        command.run()

        # Count remaining tasks
        remaining = sum(
            1 for task_id in task_ids if db.session.get(Task, task_id) is not None
        )
        assert remaining == 3  # 5 - 2 = 3 remaining
    finally:
        # Cleanup remaining tasks
        for task_id in task_ids:
            existing = db.session.get(Task, task_id)
            if existing:
                db.session.delete(existing)
        db.session.commit()


@freeze_time("2024-02-15")
@patch("superset.tasks.utils.get_current_user")
def test_prune_does_not_delete_pending_tasks(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test that pruning does not delete pending or in-progress tasks"""
    login_as("admin")
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    pending_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="pending_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    pending_task.created_by = admin
    # Keep as PENDING (no ended_at)

    in_progress_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="in_progress_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    in_progress_task.created_by = admin
    in_progress_task.set_status(TaskStatus.IN_PROGRESS)
    # No ended_at for in-progress tasks

    db.session.commit()

    try:
        # Prune tasks older than 30 days
        command = TaskPruneCommand(retention_period_days=30)
        command.run()

        # Verify non-completed tasks are NOT deleted
        assert db.session.get(Task, pending_task.id) is not None
        assert db.session.get(Task, in_progress_task.id) is not None
    finally:
        # Cleanup
        for task in [pending_task, in_progress_task]:
            existing = db.session.get(Task, task.id)
            if existing:
                db.session.delete(existing)
        db.session.commit()


@freeze_time("2024-02-15")
@patch("superset.tasks.utils.get_current_user")
def test_prune_deletes_all_completed_statuses(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test pruning deletes SUCCESS, FAILURE, and ABORTED tasks"""
    login_as("admin")
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    old_date = datetime(2024, 1, 11, tzinfo=timezone.utc)

    # Create tasks with different completed statuses
    success_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="success_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    success_task.created_by = admin
    success_task.set_status(TaskStatus.SUCCESS)
    success_task.ended_at = old_date
    success_task_id = success_task.id

    failure_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="failure_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    failure_task.created_by = admin
    failure_task.set_status(TaskStatus.FAILURE)
    failure_task.ended_at = old_date
    failure_task_id = failure_task.id

    aborted_task = TaskDAO.create_task(
        task_type="test_type",
        task_key="aborted_task",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    aborted_task.created_by = admin
    aborted_task.set_status(TaskStatus.ABORTED)
    aborted_task.ended_at = old_date
    aborted_task_id = aborted_task.id

    db.session.commit()
    task_ids = [success_task_id, failure_task_id, aborted_task_id]

    try:
        # Prune tasks older than 30 days
        command = TaskPruneCommand(retention_period_days=30)
        command.run()

        # Verify all completed tasks are deleted
        for task_id in task_ids:
            assert db.session.get(Task, task_id) is None
    except AssertionError:
        # Cleanup if test fails
        for task_id in task_ids:
            existing = db.session.get(Task, task_id)
            if existing:
                db.session.delete(existing)
        db.session.commit()
        raise


def test_prune_no_tasks_to_delete(app_context, login_as) -> None:
    """Test pruning when no old tasks exist"""
    login_as("admin")

    # Don't create any tasks - should handle gracefully
    command = TaskPruneCommand(retention_period_days=30)
    command.run()  # Should not raise any errors
