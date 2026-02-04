# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Unit tests for GTF handlers (abort, cleanup) and related Task model behavior."""

import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from superset_core.api.tasks import TaskStatus

from superset.tasks.context import TaskContext
from superset.tasks.manager import TaskManager


@pytest.fixture
def mock_task():
    """Create a mock task for testing."""
    task = MagicMock()
    task.uuid = "test-uuid-1234"
    task.status = TaskStatus.PENDING.value
    return task


@pytest.fixture
def mock_task_dao(mock_task):
    """Mock TaskDAO to return our test task."""
    with patch("superset.daos.tasks.TaskDAO") as mock_dao:
        mock_dao.find_one_or_none.return_value = mock_task
        yield mock_dao


@pytest.fixture
def mock_update_command():
    """Mock UpdateTaskCommand to avoid database operations."""
    with patch("superset.commands.tasks.update.UpdateTaskCommand") as mock_cmd:
        mock_cmd.return_value.run.return_value = None
        yield mock_cmd


@pytest.fixture
def mock_flask_app():
    """Create a properly configured mock Flask app."""
    mock_app = MagicMock()
    mock_app.config = {
        "TASK_ABORT_POLLING_DEFAULT_INTERVAL": 0.1,
    }
    # Make app_context() return a proper context manager
    mock_app.app_context.return_value.__enter__ = MagicMock(return_value=None)
    mock_app.app_context.return_value.__exit__ = MagicMock(return_value=None)
    return mock_app


@pytest.fixture
def task_context(mock_task, mock_task_dao, mock_update_command, mock_flask_app):
    """Create TaskContext with mocked dependencies."""
    # Save original TaskManager Redis state and disable it
    original_redis = TaskManager._redis
    TaskManager._redis = None

    # Ensure mock_task has properties_dict and payload_dict (TaskContext accesses them)
    mock_task.properties_dict = {"is_abortable": False}
    mock_task.payload_dict = {}

    with patch("superset.tasks.context.current_app") as mock_current_app:
        # Configure current_app mock
        mock_current_app.config = mock_flask_app.config
        mock_current_app._get_current_object.return_value = mock_flask_app

        ctx = TaskContext(mock_task)
        # Manually set _app to avoid the coroutine issue from _get_current_object
        ctx._app = mock_flask_app

        yield ctx

        # Cleanup: stop polling if started
        if ctx._abort_listener:
            ctx.stop_abort_polling()

    # Restore original Redis state
    TaskManager._redis = original_redis


class TestTaskStatusEnum:
    """Test TaskStatus enum values."""

    def test_aborting_status_exists(self):
        """Test that ABORTING status is defined."""
        assert hasattr(TaskStatus, "ABORTING")
        assert TaskStatus.ABORTING.value == "aborting"

    def test_all_statuses_present(self):
        """Test all expected statuses are present."""
        expected_statuses = [
            "pending",
            "in_progress",
            "success",
            "failure",
            "aborting",
            "aborted",
        ]
        actual_statuses = [s.value for s in TaskStatus]

        for status in expected_statuses:
            assert status in actual_statuses, f"Missing status: {status}"


class TestTaskAbortProperties:
    """Test Task model abort-related properties via status and properties accessor."""

    def test_aborting_status(self):
        """Test ABORTING status check."""
        from superset.models.tasks import Task

        task = Task()
        task.status = TaskStatus.ABORTING.value

        assert task.status == TaskStatus.ABORTING.value

    def test_is_abortable_in_properties(self):
        """Test is_abortable is accessible via properties."""
        from superset.models.tasks import Task

        task = Task()
        task.update_properties({"is_abortable": True})

        assert task.properties_dict.get("is_abortable") is True

    def test_is_abortable_default_none(self):
        """Test is_abortable defaults to None for new tasks."""
        from superset.models.tasks import Task

        task = Task()

        assert task.properties_dict.get("is_abortable") is None


class TestTaskSetStatus:
    """Test Task.set_status behavior for abort states."""

    def test_set_status_in_progress_sets_is_abortable_false(self):
        """Test that transitioning to IN_PROGRESS sets is_abortable to False."""
        from superset.models.tasks import Task

        task = Task()
        task.uuid = "test-uuid"
        # Default is None

        task.set_status(TaskStatus.IN_PROGRESS)

        assert task.properties_dict.get("is_abortable") is False
        assert task.started_at is not None

    def test_set_status_in_progress_preserves_existing_is_abortable(self):
        """Test that re-setting IN_PROGRESS doesn't override is_abortable."""
        from superset.models.tasks import Task

        task = Task()
        task.uuid = "test-uuid"
        task.update_properties(
            {"is_abortable": True}
        )  # Already set by handler registration
        task.started_at = datetime.now(timezone.utc)  # Already started

        task.set_status(TaskStatus.IN_PROGRESS)

        # Should not override since started_at is already set
        assert task.properties_dict.get("is_abortable") is True

    def test_set_status_aborting_does_not_set_ended_at(self):
        """Test that ABORTING status does not set ended_at."""
        from superset.models.tasks import Task

        task = Task()
        task.uuid = "test-uuid"
        task.started_at = datetime.now(timezone.utc)

        task.status = TaskStatus.ABORTING.value

        assert task.ended_at is None

    def test_set_status_aborted_sets_ended_at(self):
        """Test that ABORTED status sets ended_at."""
        from superset.models.tasks import Task

        task = Task()
        task.uuid = "test-uuid"
        task.started_at = datetime.now(timezone.utc)

        task.set_status(TaskStatus.ABORTED)

        assert task.ended_at is not None


class TestTaskDuration:
    """Test Task duration_seconds property with different states."""

    def test_duration_seconds_finished_task(self):
        """Test duration for finished task returns actual duration."""
        from superset.models.tasks import Task

        task = Task()
        task.status = TaskStatus.SUCCESS.value  # Must be finished to use ended_at
        task.started_at = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        task.ended_at = datetime(2024, 1, 1, 10, 0, 30, tzinfo=timezone.utc)

        # Should use ended_at - started_at = 30 seconds
        assert task.duration_seconds == 30.0

    @freeze_time("2024-01-01 10:00:30")
    def test_duration_seconds_running_task(self):
        """Test duration for running task returns time since start."""
        from superset.models.tasks import Task

        task = Task()
        task.started_at = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        task.ended_at = None

        # 30 seconds since start
        assert task.duration_seconds == 30.0

    @freeze_time("2024-01-01 10:00:15")
    def test_duration_seconds_pending_task(self):
        """Test duration for pending task returns queue time."""
        from superset.models.tasks import Task

        task = Task()
        task.created_on = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        task.started_at = None
        task.ended_at = None

        # 15 seconds since creation
        assert task.duration_seconds == 15.0

    def test_duration_seconds_no_timestamps(self):
        """Test duration returns None when no timestamps available."""
        from superset.models.tasks import Task

        task = Task()
        task.created_on = None
        task.started_at = None
        task.ended_at = None

        assert task.duration_seconds is None


class TestAbortHandlerRegistration:
    """Test abort handler registration and is_abortable flag."""

    def test_on_abort_registers_handler(self, task_context):
        """Test that on_abort registers a handler."""
        handler_called = False

        @task_context.on_abort
        def handle_abort():
            nonlocal handler_called
            handler_called = True

        assert len(task_context._abort_handlers) == 1
        assert not handler_called

    @patch("superset.tasks.context.current_app")
    def test_on_abort_sets_abortable(self, mock_app):
        """Test on_abort sets is_abortable to True on first handler."""
        mock_app.config = {"TASK_ABORT_POLLING_DEFAULT_INTERVAL": 1.0}
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.properties_dict = {"is_abortable": False}
        mock_task.payload_dict = {}

        with (
            patch.object(TaskContext, "_set_abortable") as mock_set_abortable,
            patch.object(TaskContext, "start_abort_polling"),
        ):
            ctx = TaskContext(mock_task)

            @ctx.on_abort
            def handler():
                pass

            mock_set_abortable.assert_called_once()

    @patch("superset.tasks.context.current_app")
    def test_on_abort_only_sets_abortable_once(self, mock_app):
        """Test on_abort only calls _set_abortable for first handler."""
        mock_app.config = {"TASK_ABORT_POLLING_DEFAULT_INTERVAL": 1.0}
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.properties_dict = {"is_abortable": False}
        mock_task.payload_dict = {}

        with (
            patch.object(TaskContext, "_set_abortable") as mock_set_abortable,
            patch.object(TaskContext, "start_abort_polling"),
        ):
            ctx = TaskContext(mock_task)

            @ctx.on_abort
            def handler1():
                pass

            @ctx.on_abort
            def handler2():
                pass

            # Should only be called once for first handler
            assert mock_set_abortable.call_count == 1

    def test_abort_handlers_completed_initially_false(self):
        """Test abort_handlers_completed is False initially."""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.properties_dict = {}
        mock_task.payload_dict = {}

        with patch("superset.tasks.context.current_app"):
            ctx = TaskContext(mock_task)
            assert ctx.abort_handlers_completed is False


class TestAbortPolling:
    """Test abort detection polling behavior."""

    def test_on_abort_starts_polling_automatically(self, task_context):
        """Test that registering first handler starts abort listener."""
        assert task_context._abort_listener is None

        @task_context.on_abort
        def handle_abort():
            pass

        assert task_context._abort_listener is not None

    def test_stop_abort_polling(self, task_context):
        """Test that stop_abort_polling stops the abort listener."""

        @task_context.on_abort
        def handle_abort():
            pass

        assert task_context._abort_listener is not None

        task_context.stop_abort_polling()

        assert task_context._abort_listener is None

    def test_start_abort_polling_only_once(self, task_context):
        """Test that start_abort_polling is idempotent."""
        task_context.start_abort_polling(interval=0.1)
        first_listener = task_context._abort_listener

        # Try to start again
        task_context.start_abort_polling(interval=0.1)
        second_listener = task_context._abort_listener

        # Should be the same listener
        assert first_listener is second_listener

    def test_on_abort_with_custom_interval(self, task_context):
        """Test that custom interval can be set via start_abort_polling."""
        with patch("superset.tasks.context.current_app") as mock_app:
            mock_app.config = {"TASK_ABORT_POLLING_DEFAULT_INTERVAL": 0.1}

            @task_context.on_abort
            def handle_abort():
                pass

            # Override with custom interval
            task_context.stop_abort_polling()
            task_context.start_abort_polling(interval=0.05)

            assert task_context._abort_listener is not None

    def test_polling_stops_after_abort_detected(self, task_context, mock_task):
        """Test that abort is detected and handlers are triggered."""

        @task_context.on_abort
        def handle_abort():
            pass

        # Trigger abort
        mock_task.status = TaskStatus.ABORTED.value

        # Wait for detection
        time.sleep(0.3)

        # Abort should have been detected
        assert task_context._abort_detected is True


class TestAbortHandlerExecution:
    """Test abort handler execution behavior."""

    def test_on_abort_handler_fires_when_task_aborted(self, task_context, mock_task):
        """Test that abort handler fires automatically when task is aborted."""
        abort_called = False

        @task_context.on_abort
        def handle_abort():
            nonlocal abort_called
            abort_called = True

        # Simulate task being aborted
        mock_task.status = TaskStatus.ABORTED.value

        # Wait for polling to detect abort (max 0.3s with 0.1s interval)
        time.sleep(0.3)

        assert abort_called
        assert task_context._abort_detected

    def test_on_abort_not_called_on_success(self, task_context, mock_task):
        """Test that abort handlers don't run on success."""
        abort_called = False

        @task_context.on_abort
        def handle_abort():
            nonlocal abort_called
            abort_called = True

        # Keep task in success state
        mock_task.status = TaskStatus.SUCCESS.value

        # Wait and verify handler not called
        time.sleep(0.3)

        assert not abort_called

    def test_multiple_abort_handlers(self, task_context, mock_task):
        """Test that all abort handlers execute in LIFO order."""
        calls = []

        @task_context.on_abort
        def handler1():
            calls.append(1)

        @task_context.on_abort
        def handler2():
            calls.append(2)

        # Trigger abort
        mock_task.status = TaskStatus.ABORTED.value

        # Wait for detection
        time.sleep(0.3)

        # LIFO order: handler2 runs first
        assert calls == [2, 1]

    def test_abort_handler_exception_doesnt_fail_task(self, task_context, mock_task):
        """Test that exception in abort handler is logged but doesn't fail task."""
        handler2_called = False

        @task_context.on_abort
        def bad_handler():
            raise ValueError("Handler error")

        @task_context.on_abort
        def good_handler():
            nonlocal handler2_called
            handler2_called = True

        # Trigger abort
        mock_task.status = TaskStatus.ABORTED.value

        # Wait for detection
        time.sleep(0.3)

        # Second handler should still run despite first handler failing
        assert handler2_called


class TestBestEffortHandlerExecution:
    """Test that all handlers execute even when some fail (best-effort)."""

    def test_all_abort_handlers_run_even_if_all_fail(self, task_context, mock_task):
        """Test all abort handlers execute even if every one raises an exception."""
        calls = []

        @task_context.on_abort
        def handler1():
            calls.append(1)
            raise ValueError("Handler 1 failed")

        @task_context.on_abort
        def handler2():
            calls.append(2)
            raise RuntimeError("Handler 2 failed")

        @task_context.on_abort
        def handler3():
            calls.append(3)
            raise TypeError("Handler 3 failed")

        # Trigger abort handlers directly (simulating abort detection)
        task_context._trigger_abort_handlers()

        # All handlers should have been called (LIFO order: 3, 2, 1)
        assert calls == [3, 2, 1]

        # Failures should be collected (abort handlers don't write to DB)
        assert len(task_context._handler_failures) == 3
        failure_types = [
            type(ex).__name__ for _, ex, _ in task_context._handler_failures
        ]
        assert "TypeError" in failure_types
        assert "RuntimeError" in failure_types
        assert "ValueError" in failure_types

    def test_all_cleanup_handlers_run_even_if_all_fail(self, task_context, mock_task):
        """Test all cleanup handlers execute even if every one raises an exception."""
        calls = []
        captured_failures = []

        # Mock _write_handler_failures_to_db to capture failures before clearing
        original_write = task_context._write_handler_failures_to_db

        def mock_write():
            captured_failures.extend(task_context._handler_failures)
            original_write()

        task_context._write_handler_failures_to_db = mock_write

        @task_context.on_cleanup
        def cleanup1():
            calls.append(1)
            raise ValueError("Cleanup 1 failed")

        @task_context.on_cleanup
        def cleanup2():
            calls.append(2)
            raise RuntimeError("Cleanup 2 failed")

        @task_context.on_cleanup
        def cleanup3():
            calls.append(3)
            raise TypeError("Cleanup 3 failed")

        # Set task to SUCCESS (not aborting) so only cleanup handlers run
        mock_task.status = TaskStatus.SUCCESS.value

        # Run cleanup
        task_context._run_cleanup()

        # All handlers should have been called (LIFO order: 3, 2, 1)
        assert calls == [3, 2, 1]

        # Failures should have been captured before clearing
        assert len(captured_failures) == 3
        failure_types = [type(ex).__name__ for _, ex, _ in captured_failures]
        assert "TypeError" in failure_types
        assert "RuntimeError" in failure_types
        assert "ValueError" in failure_types

    def test_mixed_abort_and_cleanup_failures_all_collected(
        self, task_context, mock_task
    ):
        """Test abort and cleanup handler failures are collected together."""
        calls = []
        captured_failures = []

        # Mock _write_handler_failures_to_db to capture failures before clearing
        original_write = task_context._write_handler_failures_to_db

        def mock_write():
            captured_failures.extend(task_context._handler_failures)
            original_write()

        task_context._write_handler_failures_to_db = mock_write

        @task_context.on_abort
        def abort1():
            calls.append("abort1")
            raise ValueError("Abort 1 failed")

        @task_context.on_abort
        def abort2():
            calls.append("abort2")
            raise RuntimeError("Abort 2 failed")

        @task_context.on_cleanup
        def cleanup1():
            calls.append("cleanup1")
            raise TypeError("Cleanup 1 failed")

        @task_context.on_cleanup
        def cleanup2():
            calls.append("cleanup2")
            raise KeyError("Cleanup 2 failed")

        # Set task to ABORTING so both abort and cleanup handlers run
        mock_task.status = TaskStatus.ABORTING.value

        # Run cleanup (which triggers abort handlers first, then cleanup handlers)
        task_context._run_cleanup()

        # All handlers should have been called
        # Abort handlers run first (LIFO: abort2, abort1)
        # Then cleanup handlers (LIFO: cleanup2, cleanup1)
        assert calls == ["abort2", "abort1", "cleanup2", "cleanup1"]

        # All 4 failures should have been captured
        assert len(captured_failures) == 4

        # Verify handler types are recorded correctly
        handler_types = [htype for htype, _, _ in captured_failures]
        assert handler_types.count("abort") == 2
        assert handler_types.count("cleanup") == 2


class TestCleanupHandlers:
    """Test cleanup handler behavior."""

    def test_cleanup_triggers_abort_handlers_if_not_detected(
        self, task_context, mock_task
    ):
        """Test that _run_cleanup triggers abort handlers if task ended aborted."""
        abort_called = False

        @task_context.on_abort
        def handle_abort():
            nonlocal abort_called
            abort_called = True

        # Set task as aborted but don't let polling detect it
        mock_task.status = TaskStatus.ABORTED.value
        task_context._abort_detected = False

        # Immediately run cleanup (simulating task ending before poll)
        task_context._run_cleanup()

        assert abort_called

    def test_cleanup_doesnt_duplicate_abort_handlers(self, task_context, mock_task):
        """Test that abort handlers only run once even if called from cleanup."""
        call_count = 0

        @task_context.on_abort
        def handle_abort():
            nonlocal call_count
            call_count += 1

        # Trigger abort via polling
        mock_task.status = TaskStatus.ABORTED.value
        time.sleep(0.3)

        # Handlers should have been called once
        assert call_count == 1
        assert task_context._abort_detected is True

        # Run cleanup - handlers should NOT be called again
        task_context._run_cleanup()

        assert call_count == 1  # Still 1, not 2
