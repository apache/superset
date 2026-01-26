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
from superset.commands.tasks import UpdateTaskCommand
from superset.commands.tasks.exceptions import (
    TaskNotFoundError,
)
from superset.daos.tasks import TaskDAO


@patch("superset.tasks.utils.get_current_user")
def test_update_task_success(mock_get_user, app_context, get_user, login_as) -> None:
    """Test successful task update"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create a task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="update_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Update the task status
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            status=TaskStatus.SUCCESS.value,
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
        status=TaskStatus.SUCCESS.value,
    )

    with pytest.raises(TaskNotFoundError):
        command.run()


@patch("superset.tasks.utils.get_current_user")
def test_update_task_forbidden(mock_get_user, app_context, get_user, login_as) -> None:
    """Test update fails when user doesn't own task (via base filter)"""
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    # Create a task owned by admin using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="forbidden_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Login as gamma user (non-admin, non-owner)
        login_as("gamma")

        # Try to update admin's task as gamma user
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            status=TaskStatus.SUCCESS.value,
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


@patch("superset.tasks.utils.get_current_user")
def test_update_task_payload(mock_get_user, app_context, get_user, login_as) -> None:
    """Test updating task payload"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create a task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="payload_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
        payload='{"initial": "data"}',
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Update payload
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            payload={"progress": 50, "message": "halfway"},
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


@patch("superset.tasks.utils.get_current_user")
def test_update_all_supported_fields(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test updating all supported task fields (status, error, progress, abortable)"""
    admin = get_user("admin")
    login_as("admin")
    mock_get_user.return_value = admin.username

    # Create a task using DAO
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="all_fields_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Update all field types at once
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            status=TaskStatus.FAILURE.value,
            properties={
                "error_message": "Task failed due to error",
                "progress_percent": 0.75,
                "progress_current": 75,
                "progress_total": 100,
                "is_abortable": True,
            },
        )
        result = command.run()

        # Verify all fields were updated
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.FAILURE.value
        assert result.properties.error_message == "Task failed due to error"
        assert result.properties.progress_percent == 0.75
        assert result.properties.progress_current == 75
        assert result.properties.progress_total == 100
        assert result.properties.is_abortable is True

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.FAILURE.value
        assert task.properties.error_message == "Task failed due to error"
        assert task.properties.progress_percent == 0.75
        assert task.properties.progress_current == 75
        assert task.properties.progress_total == 100
        assert task.properties.is_abortable is True
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


@patch("superset.tasks.utils.get_current_user")
def test_update_task_skip_security_check(
    mock_get_user, app_context, get_user, login_as
) -> None:
    """Test skip_security_check allows updating any task"""
    admin = get_user("admin")
    mock_get_user.return_value = admin.username

    # Create a task owned by admin
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="skip_security_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Login as gamma user (non-owner)
        login_as("gamma")

        # With skip_security_check=True, should succeed even though gamma doesn't own it
        command = UpdateTaskCommand(
            task_uuid=task.uuid,
            properties={"progress_percent": 0.75},
            skip_security_check=True,
        )
        result = command.run()

        # Verify update succeeded
        assert result.uuid == task.uuid
        assert result.properties.progress_percent == 0.75

        # Verify in database
        db.session.refresh(task)
        assert task.properties.progress_percent == 0.75
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()
