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
from superset.commands.tasks import SubmitTaskCommand
from superset.commands.tasks.exceptions import (
    TaskInvalidError,
)


def test_submit_task_success(app_context, login_as, get_user) -> None:
    """Test successful task submission"""
    login_as("admin")
    admin = get_user("admin")

    command = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "test-key",
            "task_name": "Test Task",
        }
    )

    try:
        result = command.run()

        # Verify task was created
        assert result.task_type == "test-type"
        assert result.task_key == "test-key"
        assert result.task_name == "Test Task"
        assert result.status == TaskStatus.PENDING.value
        assert result.payload == "{}"
        assert result.user_id == admin.id

        # Verify in database
        db.session.refresh(result)
        assert result.id is not None
        assert result.uuid is not None
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()


def test_submit_task_with_all_fields(app_context, login_as, get_user) -> None:
    """Test task submission with all optional fields"""
    login_as("admin")
    admin = get_user("admin")

    command = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "test-key-full",
            "task_name": "Test Task Full",
            "payload": {"key": "value"},
            "properties": {"execution_mode": "async", "timeout": 300},
        }
    )

    try:
        result = command.run()

        # Verify all fields were set
        assert result.task_type == "test-type"
        assert result.task_key == "test-key-full"
        assert result.task_name == "Test Task Full"
        assert result.user_id == admin.id
        assert result.payload_dict == {"key": "value"}
        assert result.properties_dict.get("execution_mode") == "async"
        assert result.properties_dict.get("timeout") == 300
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()


def test_submit_task_missing_task_type(app_context, login_as) -> None:
    """Test submission fails when task_type is missing"""
    login_as("admin")

    command = SubmitTaskCommand(data={})

    with pytest.raises(TaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "task_type" in exc_info.value._exceptions[0].field_name


def test_submit_task_joins_existing(app_context, login_as, get_user) -> None:
    """Test that submitting with duplicate key joins existing task"""
    login_as("admin")
    admin = get_user("admin")

    # Create first task
    command1 = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "shared-key",
            "task_name": "First Task",
        }
    )
    task1 = command1.run()
    assert task1.user_id == admin.id

    try:
        # Submit second task with same task_key and type
        command2 = SubmitTaskCommand(
            data={
                "task_type": "test-type",
                "task_key": "shared-key",
                "task_name": "Second Task",
            }
        )

        # Should return existing task, not create new one
        task2 = command2.run()
        assert task2.id == task1.id
        assert task2.uuid == task1.uuid
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.commit()


def test_submit_task_without_task_key(app_context, login_as, get_user) -> None:
    """Test task submission without task_key (command generates UUID)"""
    login_as("admin")
    admin = get_user("admin")

    command = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_name": "Test Task No ID",
        }
    )

    try:
        result = command.run()

        # Verify task was created and command generated a task_key
        assert result.task_type == "test-type"
        assert result.task_name == "Test Task No ID"
        assert result.task_key is not None  # Command generated UUID
        assert result.uuid is not None
        assert result.user_id == admin.id
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()


def test_submit_task_run_with_info_returns_is_new_true(
    app_context, login_as, get_user
) -> None:
    """Test run_with_info returns is_new=True for new task"""
    login_as("admin")
    admin = get_user("admin")

    command = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "unique-key-is-new",
            "task_name": "Test Task",
        }
    )

    try:
        task, is_new = command.run_with_info()

        assert is_new is True
        assert task.task_key == "unique-key-is-new"
        assert task.user_id == admin.id
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_submit_task_run_with_info_returns_is_new_false(
    app_context, login_as, get_user
) -> None:
    """Test run_with_info returns is_new=False when joining existing task"""
    login_as("admin")
    admin = get_user("admin")

    # Create first task
    command1 = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "shared-key-is-new",
            "task_name": "First Task",
        }
    )
    task1, is_new1 = command1.run_with_info()
    assert is_new1 is True
    assert task1.user_id == admin.id

    try:
        # Submit second task with same key
        command2 = SubmitTaskCommand(
            data={
                "task_type": "test-type",
                "task_key": "shared-key-is-new",
                "task_name": "Second Task",
            }
        )
        task2, is_new2 = command2.run_with_info()

        # Should return existing task with is_new=False
        assert is_new2 is False
        assert task2.id == task1.id
        assert task2.uuid == task1.uuid
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.commit()
