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
"""Unit tests for GTF timeout handling."""

import time
from unittest.mock import MagicMock, patch

import pytest
from superset_core.api.tasks import TaskOptions, TaskScope

from superset.tasks.context import TaskContext
from superset.tasks.decorators import TaskWrapper
from superset.tasks.manager import TaskManager

# =============================================================================
# Fixtures
# =============================================================================


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
def mock_task_abortable():
    """Create a mock task that is abortable."""
    task = MagicMock()
    task.uuid = "test-uuid-timeout"
    task.status = "in_progress"
    task.properties_dict = {"is_abortable": True}
    task.payload_dict = {}
    # Set real values for dedup_key generation (used by UpdateTaskCommand lock)
    task.scope = "shared"
    task.task_type = "test_task"
    task.task_key = "test_key"
    task.user_id = 1
    return task


@pytest.fixture
def mock_task_not_abortable():
    """Create a mock task that is NOT abortable."""
    task = MagicMock()
    task.uuid = "test-uuid-timeout"
    task.status = "in_progress"
    task.properties_dict = {}  # No is_abortable means it's not abortable
    task.payload_dict = {}
    # Set real values for dedup_key generation (used by UpdateTaskCommand lock)
    task.scope = "shared"
    task.task_type = "test_task"
    task.task_key = "test_key"
    task.user_id = 1
    return task


@pytest.fixture
def task_context_for_timeout(mock_flask_app, mock_task_abortable):
    """Create TaskContext with mocked dependencies for timeout tests."""
    # Save original TaskManager Redis state and disable it
    original_redis = TaskManager._redis
    TaskManager._redis = None

    # Ensure mock_task has required attributes for TaskContext
    mock_task_abortable.payload_dict = {}

    with (
        patch("superset.tasks.context.current_app") as mock_current_app,
        patch("superset.daos.tasks.TaskDAO") as mock_dao,
    ):
        # Configure current_app mock
        mock_current_app.config = mock_flask_app.config
        mock_current_app._get_current_object.return_value = mock_flask_app

        # Configure TaskDAO mock
        mock_dao.find_one_or_none.return_value = mock_task_abortable

        ctx = TaskContext(mock_task_abortable)
        ctx._app = mock_flask_app

        yield ctx

        # Cleanup: stop timers if started
        ctx.stop_timeout_timer()
        if ctx._abort_listener:
            ctx.stop_abort_polling()

    # Restore original Redis state
    TaskManager._redis = original_redis


# =============================================================================
# TaskWrapper._merge_options Timeout Tests
# =============================================================================


class TestTimeoutMerging:
    """Test timeout merging behavior in TaskWrapper._merge_options."""

    def test_merge_options_decorator_timeout_used_when_no_override(self):
        """Test that decorator timeout is used when no override is provided."""

        def dummy_func():
            pass

        wrapper = TaskWrapper(
            name="test_task",
            func=dummy_func,
            default_options=TaskOptions(),
            scope=TaskScope.PRIVATE,
            default_timeout=300,  # 5-minute default
        )

        merged = wrapper._merge_options(None)
        assert merged.timeout == 300

    def test_merge_options_override_timeout_takes_precedence(self):
        """Test that TaskOptions timeout overrides decorator default."""

        def dummy_func():
            pass

        wrapper = TaskWrapper(
            name="test_task",
            func=dummy_func,
            default_options=TaskOptions(),
            scope=TaskScope.PRIVATE,
            default_timeout=300,  # 5-minute default
        )

        override = TaskOptions(timeout=600)  # 10-minute override
        merged = wrapper._merge_options(override)
        assert merged.timeout == 600

    def test_merge_options_no_timeout_when_not_configured(self):
        """Test that no timeout is set when not configured anywhere."""

        def dummy_func():
            pass

        wrapper = TaskWrapper(
            name="test_task",
            func=dummy_func,
            default_options=TaskOptions(),
            scope=TaskScope.PRIVATE,
            default_timeout=None,  # No default timeout
        )

        merged = wrapper._merge_options(None)
        assert merged.timeout is None

    def test_merge_options_override_with_other_options_preserves_timeout(self):
        """Test that setting other options doesn't lose decorator timeout."""

        def dummy_func():
            pass

        wrapper = TaskWrapper(
            name="test_task",
            func=dummy_func,
            default_options=TaskOptions(),
            scope=TaskScope.PRIVATE,
            default_timeout=300,
        )

        # Override only task_key, not timeout
        override = TaskOptions(task_key="my-key")
        merged = wrapper._merge_options(override)

        # Should keep decorator timeout since override.timeout is None
        assert merged.timeout == 300
        assert merged.task_key == "my-key"


# =============================================================================
# TaskContext Timeout Timer Tests
# =============================================================================


class TestTimeoutTimer:
    """Test TaskContext timeout timer behavior."""

    def test_start_timeout_timer_sets_timer(self, task_context_for_timeout):
        """Test that start_timeout_timer creates a timer."""
        ctx = task_context_for_timeout

        assert ctx._timeout_timer is None

        ctx.start_timeout_timer(10)

        assert ctx._timeout_timer is not None
        assert ctx._timeout_triggered is False

    def test_start_timeout_timer_is_idempotent(self, task_context_for_timeout):
        """Test that starting timer twice doesn't create duplicate timers."""
        ctx = task_context_for_timeout

        ctx.start_timeout_timer(10)
        first_timer = ctx._timeout_timer

        ctx.start_timeout_timer(20)  # Try to start again
        second_timer = ctx._timeout_timer

        assert first_timer is second_timer

    def test_stop_timeout_timer_cancels_timer(self, task_context_for_timeout):
        """Test that stop_timeout_timer cancels the timer."""
        ctx = task_context_for_timeout

        ctx.start_timeout_timer(10)
        assert ctx._timeout_timer is not None

        ctx.stop_timeout_timer()

        assert ctx._timeout_timer is None

    def test_stop_timeout_timer_safe_when_no_timer(self, task_context_for_timeout):
        """Test that stop_timeout_timer doesn't fail when no timer exists."""
        ctx = task_context_for_timeout

        assert ctx._timeout_timer is None
        ctx.stop_timeout_timer()  # Should not raise
        assert ctx._timeout_timer is None

    def test_timeout_triggered_property_initially_false(self, task_context_for_timeout):
        """Test that timeout_triggered is False initially."""
        ctx = task_context_for_timeout
        assert ctx.timeout_triggered is False

    def test_cleanup_stops_timeout_timer(self, task_context_for_timeout):
        """Test that _run_cleanup stops the timeout timer."""
        ctx = task_context_for_timeout

        ctx.start_timeout_timer(10)
        assert ctx._timeout_timer is not None

        ctx._run_cleanup()

        assert ctx._timeout_timer is None


class TestTimeoutTrigger:
    """Test timeout trigger behavior when timer fires."""

    def test_timeout_triggers_abort_when_abortable(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that timeout triggers abort handlers when task is abortable."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        abort_called = False

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch(
                "superset.commands.tasks.update.UpdateTaskCommand"
            ) as mock_update_cmd,
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                nonlocal abort_called
                abort_called = True

            # Start short timeout
            ctx.start_timeout_timer(1)

            # Wait for timeout to fire
            time.sleep(1.5)

            # Abort handler should have been called
            assert abort_called
            assert ctx._timeout_triggered
            assert ctx._abort_detected

            # Verify UpdateTaskCommand was called with ABORTING status
            mock_update_cmd.assert_called()
            call_kwargs = mock_update_cmd.call_args[1]
            assert call_kwargs.get("status") == "aborting"

            # Cleanup
            ctx.stop_timeout_timer()
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis

    def test_timeout_logs_warning_when_not_abortable(
        self, mock_flask_app, mock_task_not_abortable
    ):
        """Test that timeout logs warning when task has no abort handler."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.tasks.context.logger") as mock_logger,
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_not_abortable

            ctx = TaskContext(mock_task_not_abortable)
            ctx._app = mock_flask_app

            # No abort handler registered

            # Start short timeout
            ctx.start_timeout_timer(1)

            # Wait for timeout to fire
            time.sleep(1.5)

            # Should have logged warning
            mock_logger.warning.assert_called()
            warning_call = mock_logger.warning.call_args
            assert "no abort handler" in warning_call[0][0].lower()
            assert ctx._timeout_triggered
            assert not ctx._abort_detected  # No abort since no handler

            # Cleanup
            ctx.stop_timeout_timer()

        TaskManager._redis = original_redis

    def test_timeout_does_not_trigger_if_already_aborting(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that timeout doesn't re-trigger abort if already aborting."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        abort_count = 0

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.commands.tasks.update.UpdateTaskCommand"),
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                nonlocal abort_count
                abort_count += 1

            # Pre-set abort detected
            ctx._abort_detected = True

            # Start short timeout
            ctx.start_timeout_timer(1)

            # Wait for timeout to fire
            time.sleep(1.5)

            # Handler should NOT have been called since already aborting
            assert abort_count == 0

            # Cleanup
            ctx.stop_timeout_timer()
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis


# =============================================================================
# Task Decorator Timeout Tests
# =============================================================================


class TestTaskDecoratorTimeout:
    """Test @task decorator timeout parameter."""

    def test_task_decorator_accepts_timeout(self):
        """Test that @task decorator accepts timeout parameter."""
        from superset.tasks.decorators import task
        from superset.tasks.registry import TaskRegistry

        @task(name="test_timeout_task_1", timeout=300)
        def timeout_test_task_1():
            pass

        assert isinstance(timeout_test_task_1, TaskWrapper)
        assert timeout_test_task_1.default_timeout == 300

        # Cleanup registry
        TaskRegistry._tasks.pop("test_timeout_task_1", None)

    def test_task_decorator_without_timeout(self):
        """Test that @task decorator works without timeout."""
        from superset.tasks.decorators import task
        from superset.tasks.registry import TaskRegistry

        @task(name="test_timeout_task_2")
        def timeout_test_task_2():
            pass

        assert isinstance(timeout_test_task_2, TaskWrapper)
        assert timeout_test_task_2.default_timeout is None

        # Cleanup registry
        TaskRegistry._tasks.pop("test_timeout_task_2", None)

    def test_task_decorator_with_all_params(self):
        """Test that @task decorator accepts all parameters together."""
        from superset.tasks.decorators import task
        from superset.tasks.registry import TaskRegistry

        @task(name="test_timeout_task_3", scope=TaskScope.SHARED, timeout=600)
        def timeout_test_task_3():
            pass

        assert timeout_test_task_3.name == "test_timeout_task_3"
        assert timeout_test_task_3.scope == TaskScope.SHARED
        assert timeout_test_task_3.default_timeout == 600

        # Cleanup registry
        TaskRegistry._tasks.pop("test_timeout_task_3", None)


# =============================================================================
# Timeout Terminal State Tests
# =============================================================================


class TestTimeoutTerminalState:
    """Test timeout transitions to correct terminal state (TIMED_OUT vs FAILURE)."""

    def test_timeout_triggered_flag_set_on_timeout(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that timeout_triggered flag is set when timeout fires."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.commands.tasks.update.UpdateTaskCommand"),
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                pass

            # Initially not triggered
            assert ctx.timeout_triggered is False

            # Start short timeout
            ctx.start_timeout_timer(1)

            # Wait for timeout to fire
            time.sleep(1.5)

            # Should be set after timeout
            assert ctx.timeout_triggered is True

            # Cleanup
            ctx.stop_timeout_timer()
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis

    def test_user_abort_does_not_set_timeout_triggered(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that user abort doesn't set timeout_triggered flag."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.commands.tasks.update.UpdateTaskCommand"),
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                pass

            # Simulate user abort (not timeout)
            ctx._on_abort_detected()

            # timeout_triggered should still be False
            assert ctx.timeout_triggered is False
            # But abort_detected should be True
            assert ctx._abort_detected is True

            # Cleanup
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis

    def test_abort_handlers_completed_tracks_success(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that abort_handlers_completed flag tracks successful
        handler execution."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.commands.tasks.update.UpdateTaskCommand"),
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                pass  # Successful handler

            # Initially not completed
            assert ctx.abort_handlers_completed is False

            # Trigger abort handlers
            ctx._trigger_abort_handlers()

            # Should be marked as completed
            assert ctx.abort_handlers_completed is True

            # Cleanup
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis

    def test_abort_handlers_completed_false_on_exception(
        self, mock_flask_app, mock_task_abortable
    ):
        """Test that abort_handlers_completed is False when handler throws."""
        original_redis = TaskManager._redis
        TaskManager._redis = None

        with (
            patch("superset.tasks.context.current_app") as mock_current_app,
            patch("superset.daos.tasks.TaskDAO") as mock_dao,
            patch("superset.commands.tasks.update.UpdateTaskCommand"),
        ):
            mock_current_app.config = mock_flask_app.config
            mock_current_app._get_current_object.return_value = mock_flask_app
            mock_dao.find_one_or_none.return_value = mock_task_abortable

            ctx = TaskContext(mock_task_abortable)
            ctx._app = mock_flask_app

            @ctx.on_abort
            def handle_abort():
                raise ValueError("Handler failed")

            # Initially not completed
            assert ctx.abort_handlers_completed is False

            # Trigger abort handlers (will catch the exception internally)
            ctx._trigger_abort_handlers()

            # Should NOT be marked as completed since handler threw
            assert ctx.abort_handlers_completed is False

            # Cleanup
            if ctx._abort_listener:
                ctx.stop_abort_polling()

        TaskManager._redis = original_redis
