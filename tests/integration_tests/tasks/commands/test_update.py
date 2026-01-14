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
from superset_core.api.tasks import TaskStatus

from superset import db
from superset.commands.tasks import UpdateTaskCommand
from superset.commands.tasks.exceptions import (
    TaskNotFoundError,
)
from superset.models.tasks import Task


def test_update_task_success(app_context, get_user, login_as) -> None:
    """Test successful task update"""
    admin = get_user("admin")
    login_as("admin")

    # Create a task
    task = Task(
        task_type="test_type",
        task_key="update_test",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Update the task status
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            data={"status": TaskStatus.SUCCESS.value},
        )
        result = command.run()

        # Verify update
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.SUCCESS.value

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_update_task_not_found(app_context, login_as) -> None:
    """Test update fails when task not found"""
    login_as("admin")

    command = UpdateTaskCommand(
        task_uuid="00000000-0000-0000-0000-000000000000",
        data={"status": TaskStatus.SUCCESS.value},
    )

    with pytest.raises(TaskNotFoundError):
        command.run()


def test_update_task_forbidden(app_context, get_user, login_as) -> None:
    """Test update fails when user doesn't own task (via base filter)"""
    admin = get_user("admin")

    # Create a task owned by admin
    task = Task(
        task_type="test_type",
        task_key="forbidden_test",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to update admin's task as gamma user
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            data={"status": TaskStatus.SUCCESS.value},
        )

        # Should raise NotFoundError because base filter hides the task
        with pytest.raises(TaskNotFoundError):
            command.run()

        # Verify task was NOT updated
        db.session.refresh(task)
        assert task.status == TaskStatus.IN_PROGRESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_update_task_payload(app_context, get_user, login_as) -> None:
    """Test updating task payload"""
    admin = get_user("admin")
    login_as("admin")

    # Create a task
    task = Task(
        task_type="test_type",
        task_key="payload_test",
        status=TaskStatus.IN_PROGRESS.value,
        payload='{"initial": "data"}',
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Update payload
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            data={"payload": {"progress": 50, "message": "halfway"}},
        )
        result = command.run()

        # Verify payload was updated
        assert result.uuid == task.uuid
        payload = result.get_payload()
        assert payload["progress"] == 50
        assert payload["message"] == "halfway"

        # Verify in database
        db.session.refresh(task)
        task_payload = task.get_payload()
        assert task_payload["progress"] == 50
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_update_multiple_fields(app_context, get_user, login_as) -> None:
    """Test updating multiple task fields at once"""
    admin = get_user("admin")
    login_as("admin")

    # Create a task
    task = Task(
        task_type="test_type",
        task_key="multiple_test",
        status=TaskStatus.IN_PROGRESS.value,
    )
    task.created_by = admin
    db.session.add(task)
    db.session.commit()

    try:
        # Update multiple fields
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            data={
                "status": TaskStatus.FAILURE.value,
                "error_message": "Task failed due to error",
            },
        )
        result = command.run()

        # Verify all fields were updated
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.FAILURE.value
        assert result.error_message == "Task failed due to error"

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.FAILURE.value
        assert task.error_message == "Task failed due to error"
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()
