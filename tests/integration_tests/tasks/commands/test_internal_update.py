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
"""Integration tests for internal task state update commands."""

from superset_core.api.tasks import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks.internal_update import (
    InternalStatusTransitionCommand,
    InternalUpdateTaskCommand,
)
from superset.daos.tasks import TaskDAO


def test_internal_update_properties(app_context, get_user, login_as) -> None:
    """Test updating only properties without reading task first."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_props",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Perform zero-read update
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            properties={"is_abortable": True, "progress_percent": 0.5},
        )
        result = command.run()

        assert result is True

        # Verify in database
        db.session.refresh(task)
        assert task.properties_dict.get("is_abortable") is True
        assert task.properties_dict.get("progress_percent") == 0.5
    finally:
        db.session.delete(task)
        db.session.commit()


def test_internal_update_payload(app_context, get_user, login_as) -> None:
    """Test updating only payload without reading task first."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_payload",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Perform zero-read update
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            payload={"custom_key": "value", "count": 42},
        )
        result = command.run()

        assert result is True

        # Verify in database
        db.session.refresh(task)
        assert task.payload_dict == {"custom_key": "value", "count": 42}
    finally:
        db.session.delete(task)
        db.session.commit()


def test_internal_update_both_properties_and_payload(
    app_context, get_user, login_as
) -> None:
    """Test updating both properties and payload in one call."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_both",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Perform zero-read update of both
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            properties={"progress_current": 50, "progress_total": 100},
            payload={"last_item": "xyz"},
        )
        result = command.run()

        assert result is True

        # Verify in database
        db.session.refresh(task)
        assert task.properties_dict.get("progress_current") == 50
        assert task.properties_dict.get("progress_total") == 100
        assert task.payload_dict == {"last_item": "xyz"}
    finally:
        db.session.delete(task)
        db.session.commit()


def test_internal_update_returns_false_for_nonexistent_task(
    app_context, login_as
) -> None:
    """Test that updating non-existent task returns False."""
    login_as("admin")

    command = InternalUpdateTaskCommand(
        task_uuid="00000000-0000-0000-0000-000000000000",
        properties={"is_abortable": True},
    )
    result = command.run()

    assert result is False


def test_internal_update_returns_false_when_nothing_to_update(
    app_context, get_user, login_as
) -> None:
    """Test that passing no properties or payload returns False early."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_empty",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # No properties or payload provided
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            properties=None,
            payload=None,
        )
        result = command.run()

        assert result is False
    finally:
        db.session.delete(task)
        db.session.commit()


def test_internal_update_does_not_change_status(
    app_context, get_user, login_as
) -> None:
    """Test that internal update leaves status unchanged (safe for concurrent abort)."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_status",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Update properties - status should not change
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            properties={"progress_percent": 0.75},
        )
        result = command.run()

        assert result is True

        # Verify status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.IN_PROGRESS.value
    finally:
        db.session.delete(task)
        db.session.commit()


def test_internal_update_replaces_entire_properties(
    app_context, get_user, login_as
) -> None:
    """Test that internal update replaces properties entirely (no merge)."""
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="internal_update_replace",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
        properties={"is_abortable": True, "timeout": 300},
    )
    task.created_by = admin
    db.session.commit()

    try:
        # Replace with new properties (caller is responsible for merging if needed)
        command = InternalUpdateTaskCommand(
            task_uuid=task.uuid,
            properties={"error_message": "new_value"},
        )
        result = command.run()

        assert result is True

        # Verify entire replacement occurred
        db.session.refresh(task)
        # The caller should have merged if they wanted to preserve is_abortable
        assert task.properties_dict == {"error_message": "new_value"}
        assert "is_abortable" not in task.properties_dict
        assert "timeout" not in task.properties_dict
    finally:
        db.session.delete(task)
        db.session.commit()


# =============================================================================
# InternalStatusTransitionCommand Tests
# =============================================================================


def test_status_transition_atomic_compare_and_swap(
    app_context, get_user, login_as
) -> None:
    """Test atomic conditional status transitions with comprehensive scenarios.

    Covers: success case, failure case, list of expected statuses, properties update,
    ended_at timestamp, and string status values.
    """
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="status_transition_comprehensive",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # 1. SUCCESS CASE: PENDING → IN_PROGRESS (expected matches)
        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.IN_PROGRESS,
            expected_status=TaskStatus.PENDING,
        ).run()
        assert result is True
        db.session.refresh(task)
        assert task.status == TaskStatus.IN_PROGRESS.value

        # 2. FAILURE CASE: Try wrong expected status (should fail, status unchanged)
        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.SUCCESS,
            expected_status=TaskStatus.PENDING,  # Wrong! Current is IN_PROGRESS
        ).run()
        assert result is False
        db.session.refresh(task)
        assert task.status == TaskStatus.IN_PROGRESS.value  # Unchanged

        # 3. LIST OF EXPECTED: Transition with multiple acceptable source statuses
        task.set_status(TaskStatus.ABORTING)
        db.session.commit()

        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.FAILURE,
            expected_status=[TaskStatus.IN_PROGRESS, TaskStatus.ABORTING],
            properties={"error_message": "Test error"},
        ).run()
        assert result is True
        db.session.refresh(task)
        assert task.status == TaskStatus.FAILURE.value
        assert task.properties_dict.get("error_message") == "Test error"

        # 4. ENDED_AT: Reset to IN_PROGRESS and test ended_at timestamp
        task.set_status(TaskStatus.IN_PROGRESS)
        task.ended_at = None
        db.session.commit()
        assert task.ended_at is None

        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.SUCCESS,
            expected_status=TaskStatus.IN_PROGRESS,
            set_ended_at=True,
        ).run()
        assert result is True
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
        assert task.ended_at is not None

        # 5. STRING VALUES: Reset and test string status values
        task.set_status(TaskStatus.PENDING)
        db.session.commit()

        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status="in_progress",
            expected_status="pending",
        ).run()
        assert result is True
        db.session.refresh(task)
        assert task.status == "in_progress"

    finally:
        db.session.delete(task)
        db.session.commit()


def test_status_transition_prevents_race_condition(
    app_context, get_user, login_as
) -> None:
    """Test that conditional update prevents overwriting concurrent abort.

    This is the key race condition fix: if task is aborted concurrently,
    the executor's attempt to set SUCCESS should fail (return False),
    preserving the ABORTING state.
    """
    admin = get_user("admin")
    login_as("admin")

    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="status_transition_race",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Simulate concurrent abort: directly set ABORTING in DB
        # (as if CancelTaskCommand ran in another process)
        task.set_status(TaskStatus.ABORTING)
        db.session.commit()

        # Executor tries to set SUCCESS (expecting IN_PROGRESS) - stale expectation
        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.SUCCESS,
            expected_status=TaskStatus.IN_PROGRESS,
        ).run()

        # Should fail - task was aborted concurrently
        assert result is False

        # Verify ABORTING is preserved (not overwritten to SUCCESS)
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTING.value

        # Verify correct transition from ABORTING still works
        result = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.ABORTED,
            expected_status=TaskStatus.ABORTING,
            set_ended_at=True,
        ).run()
        assert result is True
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value

    finally:
        db.session.delete(task)
        db.session.commit()


def test_status_transition_nonexistent_task(app_context, login_as) -> None:
    """Test that transitioning non-existent task returns False."""
    login_as("admin")

    result = InternalStatusTransitionCommand(
        task_uuid="00000000-0000-0000-0000-000000000000",
        new_status=TaskStatus.IN_PROGRESS,
        expected_status=TaskStatus.PENDING,
    ).run()

    assert result is False
