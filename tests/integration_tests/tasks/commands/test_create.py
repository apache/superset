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
from superset.commands.tasks import CreateTaskCommand
from superset.commands.tasks.exceptions import (
    TaskCreateFailedError,
    TaskInvalidError,
)


def test_create_task_success(app_context, login_as) -> None:
    """Test successful task creation"""
    login_as("admin")

    command = CreateTaskCommand(
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

        # Verify in database
        db.session.refresh(result)
        assert result.id is not None
        assert result.uuid is not None
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()


def test_create_task_with_all_fields(app_context, login_as, get_user) -> None:
    """Test task creation with all optional fields"""
    login_as("admin")
    admin = get_user("admin")

    command = CreateTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "test-key-full",
            "task_name": "Test Task Full",
            "user_id": admin.id,
            "database_id": 1,
            "payload": '{"key": "value"}',
        }
    )

    try:
        result = command.run()

        # Verify all fields were set
        assert result.task_type == "test-type"
        assert result.task_key == "test-key-full"
        assert result.task_name == "Test Task Full"
        assert result.user_id == admin.id
        assert result.database_id == 1
        assert result.payload == '{"key": "value"}'
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()


def test_create_task_missing_task_type(app_context, login_as) -> None:
    """Test creation fails when task_type is missing"""
    login_as("admin")

    command = CreateTaskCommand(data={})

    with pytest.raises(TaskInvalidError) as exc_info:
        command.run()

    assert len(exc_info.value._exceptions) == 1
    assert "task_type" in exc_info.value._exceptions[0].field_name


def test_create_task_duplicate_task_key(app_context, login_as) -> None:
    """Test creation fails when task_key already exists"""
    login_as("admin")

    # Create first task
    command1 = CreateTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "duplicate-key",
            "task_name": "First Task",
        }
    )
    task1 = command1.run()

    try:
        # Try to create second task with same task_key and type
        command2 = CreateTaskCommand(
            data={
                "task_type": "test-type",
                "task_key": "duplicate-key",
                "task_name": "Second Task",
            }
        )

        # Should fail due to duplicate task_key
        with pytest.raises(TaskCreateFailedError):
            command2.run()
    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.commit()


def test_create_task_without_task_key(app_context, login_as) -> None:
    """Test task creation without task_key (DAO generates UUID)"""
    login_as("admin")

    command = CreateTaskCommand(
        data={
            "task_type": "test-type",
            "task_name": "Test Task No ID",
        }
    )

    try:
        result = command.run()

        # Verify task was created and DAO generated a task_key
        assert result.task_type == "test-type"
        assert result.task_name == "Test Task No ID"
        assert result.task_key is not None  # DAO generated UUID
        assert result.uuid is not None
    finally:
        # Cleanup
        db.session.delete(result)
        db.session.commit()
