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
"""End-to-end integration tests for task event handlers (abort and cleanup)

These tests verify that abort and cleanup handlers work correctly through
the full task execution path using real @task decorated functions executed
via the Celery executor (synchronously via .apply()).
"""

from __future__ import annotations

import uuid
from typing import Any

from superset_core.api.tasks import TaskScope, TaskStatus

from superset.commands.tasks.cancel import CancelTaskCommand
from superset.daos.tasks import TaskDAO
from superset.extensions import db
from superset.models.tasks import Task
from superset.tasks.ambient_context import get_context
from superset.tasks.context import TaskContext
from superset.tasks.registry import TaskRegistry
from superset.tasks.scheduler import execute_task
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

# Module-level state to track handler calls across test executions
# (Since decorated functions are defined at module level)
_handler_state: dict[str, Any] = {}


def _reset_handler_state():
    """Reset handler state before each test."""
    global _handler_state
    _handler_state = {
        "cleanup_called": False,
        "abort_called": False,
        "cleanup_order": [],
        "abort_order": [],
        "cleanup_data": {},
    }


def cleanup_test_task() -> None:
    """Task that registers a cleanup handler."""
    ctx = get_context()

    @ctx.on_cleanup
    def handle_cleanup() -> None:
        _handler_state["cleanup_called"] = True

    # Simulate some work
    ctx.update_task(progress=1.0)


def abort_test_task() -> None:
    """Task that registers an abort handler."""
    ctx = get_context()

    @ctx.on_abort
    def handle_abort() -> None:
        _handler_state["abort_called"] = True


def both_handlers_task() -> None:
    """Task that registers both abort and cleanup handlers."""
    ctx = get_context()

    @ctx.on_abort
    def handle_abort() -> None:
        _handler_state["abort_called"] = True
        _handler_state["abort_order"].append("abort")

    @ctx.on_cleanup
    def handle_cleanup() -> None:
        _handler_state["cleanup_called"] = True
        _handler_state["cleanup_order"].append("cleanup")


def multiple_cleanup_handlers_task() -> None:
    """Task that registers multiple cleanup handlers."""
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup_first() -> None:
        _handler_state["cleanup_order"].append("first")

    @ctx.on_cleanup
    def cleanup_second() -> None:
        _handler_state["cleanup_order"].append("second")

    @ctx.on_cleanup
    def cleanup_third() -> None:
        _handler_state["cleanup_order"].append("third")


def cleanup_with_data_task() -> None:
    """Task that uses cleanup handler to clean up partial work."""
    ctx = get_context()

    # Simulate partial work in module-level state
    _handler_state["cleanup_data"]["temp_key"] = "temp_value"

    @ctx.on_cleanup
    def handle_cleanup() -> None:
        # Clean up the partial work
        _handler_state["cleanup_data"].clear()
        _handler_state["cleanup_called"] = True


def _register_test_tasks() -> None:
    """Register test task functions if not already registered.

    Called in setUp() to ensure tasks are registered regardless of
    whether other tests have cleared the registry.
    """
    registrations = [
        ("test_cleanup_task", cleanup_test_task),
        ("test_abort_task", abort_test_task),
        ("test_both_handlers_task", both_handlers_task),
        ("test_multiple_cleanup_task", multiple_cleanup_handlers_task),
        ("test_cleanup_with_data", cleanup_with_data_task),
    ]
    for name, func in registrations:
        if not TaskRegistry.is_registered(name):
            TaskRegistry.register(name, func)


class TestCleanupHandlers(SupersetTestCase):
    """E2E tests for on_cleanup functionality using Celery executor."""

    def setUp(self):
        """Set up test fixtures."""
        super().setUp()
        self.login(ADMIN_USERNAME)
        _register_test_tasks()
        _reset_handler_state()

    def test_cleanup_handler_fires_on_success(self):
        """Test cleanup handler runs when task completes successfully."""
        # Create task entry directly
        task_obj = TaskDAO.create_task(
            task_type="test_cleanup_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Cleanup",
            scope=TaskScope.SYSTEM,
        )

        # Execute task synchronously through Celery executor
        # Use str(uuid) since Celery serializes args as JSON strings
        result = execute_task.apply(
            args=[str(task_obj.uuid), "test_cleanup_task", (), {}]
        )

        # Verify task completed successfully
        assert result.successful()
        assert result.result["status"] == TaskStatus.SUCCESS.value

        # Verify cleanup handler was called
        assert _handler_state["cleanup_called"]

    def test_multiple_cleanup_handlers_in_lifo_order(self):
        """Test multiple cleanup handlers execute in LIFO order."""
        task_obj = TaskDAO.create_task(
            task_type="test_multiple_cleanup_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Multiple Cleanup",
            scope=TaskScope.SYSTEM,
        )

        result = execute_task.apply(
            args=[str(task_obj.uuid), "test_multiple_cleanup_task", (), {}]
        )

        assert result.successful()

        # Handlers should execute in LIFO order (last registered first)
        assert _handler_state["cleanup_order"] == ["third", "second", "first"]

    def test_cleanup_handler_cleans_up_partial_work(self):
        """Test cleanup handler can clean up partial work."""
        task_obj = TaskDAO.create_task(
            task_type="test_cleanup_with_data",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Cleanup Data",
            scope=TaskScope.SYSTEM,
        )

        result = execute_task.apply(
            args=[str(task_obj.uuid), "test_cleanup_with_data", (), {}]
        )

        assert result.successful()
        assert _handler_state["cleanup_called"]
        # Cleanup handler should have cleared the data
        assert len(_handler_state["cleanup_data"]) == 0


class TestAbortHandlers(SupersetTestCase):
    """E2E tests for on_abort functionality."""

    def setUp(self):
        """Set up test fixtures."""
        super().setUp()
        self.login(ADMIN_USERNAME)
        _register_test_tasks()
        _reset_handler_state()

    def test_abort_handler_fires_when_task_aborting(self):
        """Test abort handler runs when task is in ABORTING state during cleanup."""
        # Create task entry
        task_obj = TaskDAO.create_task(
            task_type="test_abort_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Abort",
            scope=TaskScope.SYSTEM,
        )

        # Manually set to IN_PROGRESS and then ABORTING to simulate abort
        task_obj.status = TaskStatus.IN_PROGRESS.value
        task_obj.update_properties({"is_abortable": True})
        db.session.merge(task_obj)
        db.session.commit()

        # Refresh to get the updated task
        db.session.refresh(task_obj)

        # Create context (simulating what executor does)
        ctx = TaskContext(task_obj)

        # Register abort handler
        @ctx.on_abort
        def handle_abort():
            _handler_state["abort_called"] = True

        # Set status to ABORTING (simulating CancelTaskCommand)
        task_obj.status = TaskStatus.ABORTING.value
        db.session.merge(task_obj)
        db.session.commit()

        # Run cleanup (simulating executor's finally block)
        ctx._run_cleanup()

        # Verify abort handler was called
        assert _handler_state["abort_called"]

    def test_both_handlers_fire_on_abort(self):
        """Test both abort and cleanup handlers run when task is aborted."""
        task_obj = TaskDAO.create_task(
            task_type="test_both_handlers_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Both Handlers",
            scope=TaskScope.SYSTEM,
        )

        task_obj.status = TaskStatus.IN_PROGRESS.value
        task_obj.update_properties({"is_abortable": True})
        db.session.merge(task_obj)
        db.session.commit()

        # Refresh to get the updated task
        db.session.refresh(task_obj)

        ctx = TaskContext(task_obj)

        @ctx.on_abort
        def handle_abort():
            _handler_state["abort_called"] = True
            _handler_state["abort_order"].append("abort")

        @ctx.on_cleanup
        def handle_cleanup():
            _handler_state["cleanup_called"] = True
            _handler_state["cleanup_order"].append("cleanup")

        # Set to ABORTING
        task_obj.status = TaskStatus.ABORTING.value
        db.session.merge(task_obj)
        db.session.commit()

        ctx._run_cleanup()

        # Both should have been called
        assert _handler_state["abort_called"]
        assert _handler_state["cleanup_called"]

    def test_abort_handler_not_called_on_success(self):
        """Test abort handler doesn't run when task succeeds."""
        task_obj = TaskDAO.create_task(
            task_type="test_abort_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test No Abort on Success",
            scope=TaskScope.SYSTEM,
        )

        task_obj.status = TaskStatus.SUCCESS.value
        db.session.merge(task_obj)
        db.session.commit()

        # Refresh to get the updated task
        db.session.refresh(task_obj)

        ctx = TaskContext(task_obj)

        @ctx.on_abort
        def handle_abort():
            _handler_state["abort_called"] = True

        @ctx.on_cleanup
        def handle_cleanup():
            _handler_state["cleanup_called"] = True

        ctx._run_cleanup()

        # Abort handler should NOT be called
        assert not _handler_state["abort_called"]
        # Cleanup handler should still be called
        assert _handler_state["cleanup_called"]


class TestTaskContextMethods(SupersetTestCase):
    """Tests for TaskContext public methods."""

    def setUp(self):
        """Set up test fixtures."""
        super().setUp()
        self.login(ADMIN_USERNAME)

    def test_on_abort_marks_task_abortable(self):
        """Test that registering an on_abort handler marks task as abortable."""
        task_obj = TaskDAO.create_task(
            task_type="test_abortable_flag",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Abortable",
            scope=TaskScope.SYSTEM,
        )

        assert task_obj.properties_dict.get("is_abortable") is not True

        ctx = TaskContext(task_obj)

        @ctx.on_abort
        def handle_abort():
            pass

        db.session.expire_all()
        task_obj = db.session.query(Task).filter_by(uuid=task_obj.uuid).first()
        assert task_obj.properties_dict.get("is_abortable") is True


class TestAbortBeforeExecution(SupersetTestCase):
    """Tests for aborting tasks before they start executing."""

    def setUp(self):
        """Set up test fixtures."""
        super().setUp()
        self.login(ADMIN_USERNAME)
        _register_test_tasks()

    def test_abort_pending_task(self):
        """Test that pending tasks can be aborted directly."""
        task_obj = TaskDAO.create_task(
            task_type="test_abort_before_start",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Before Start",
            scope=TaskScope.SYSTEM,
        )

        # Cancel immediately (task is still PENDING)
        CancelTaskCommand(task_obj.uuid, force=True).run()

        db.session.expire_all()
        task_obj = db.session.query(Task).filter_by(uuid=task_obj.uuid).first()
        assert task_obj.status == TaskStatus.ABORTED.value

    def test_executor_skips_aborted_task(self):
        """Test that executor skips tasks already aborted before execution."""
        task_obj = TaskDAO.create_task(
            task_type="test_cleanup_task",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Skip Aborted",
            scope=TaskScope.SYSTEM,
        )

        # Abort the task before execution
        task_obj.status = TaskStatus.ABORTED.value
        db.session.merge(task_obj)
        db.session.commit()

        _reset_handler_state()

        # Try to execute - should skip
        result = execute_task.apply(
            args=[str(task_obj.uuid), "test_cleanup_task", (), {}]
        )

        assert result.successful()
        assert result.result["status"] == TaskStatus.ABORTED.value
        # Cleanup handler should NOT have been called (task was skipped)
        assert not _handler_state["cleanup_called"]
