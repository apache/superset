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
"""Integration tests for GTF timeout handling.

Uses module-level task functions with manual registry (like test_event_handlers.py)
to avoid mypy issues with the @task decorator's complex generic types.

NOTE: Tests that use background threads (timeout/abort handlers) are skipped in
SQLite environments because SQLite connections cannot be shared across threads.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest
from superset_core.api.tasks import TaskScope, TaskStatus

from superset.commands.tasks.cancel import CancelTaskCommand
from superset.daos.tasks import TaskDAO
from superset.extensions import db
from superset.models.tasks import Task
from superset.tasks.ambient_context import get_context
from superset.tasks.registry import TaskRegistry
from superset.tasks.scheduler import execute_task
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


def _skip_if_sqlite() -> None:
    """Skip test if running with SQLite database.

    SQLite connections cannot be shared across threads, which breaks
    timeout tests that use background threads for abort handlers.
    Must be called from within a test method (with app context).
    """
    if "sqlite" in db.engine.url.drivername:
        pytest.skip("SQLite connections cannot be shared across threads")


# Module-level state to track handler calls
_handler_state: dict[str, Any] = {}


def _reset_handler_state() -> None:
    """Reset handler state before each test."""
    global _handler_state
    _handler_state = {
        "abort_called": False,
        "handler_exception": None,
    }


def timeout_abortable_task() -> None:
    """Task with abort handler that exits when aborted."""
    ctx = get_context()

    @ctx.on_abort
    def on_abort() -> None:
        _handler_state["abort_called"] = True

    # Poll for abort signal
    for _ in range(50):
        if _handler_state["abort_called"]:
            return
        time.sleep(0.1)


def timeout_handler_fails_task() -> None:
    """Task with abort handler that throws an exception."""
    ctx = get_context()

    @ctx.on_abort
    def on_abort() -> None:
        _handler_state["abort_called"] = True
        raise ValueError("Handler crashed!")

    # Sleep longer than timeout
    time.sleep(5)


def simple_task_with_abort() -> None:
    """Simple task with abort handler for testing."""
    ctx = get_context()

    @ctx.on_abort
    def on_abort() -> None:
        pass


def quick_task_with_abort() -> None:
    """Quick task that completes before timeout."""
    ctx = get_context()

    @ctx.on_abort
    def on_abort() -> None:
        pass

    time.sleep(0.2)


def _register_test_tasks() -> None:
    """Register test task functions if not already registered.

    Called in setUp() to ensure tasks are registered regardless of
    whether other tests have cleared the registry.
    """
    registrations = [
        ("test_timeout_abortable", timeout_abortable_task),
        ("test_timeout_handler_fails", timeout_handler_fails_task),
        ("test_timeout_simple", simple_task_with_abort),
        ("test_timeout_quick", quick_task_with_abort),
    ]
    for name, func in registrations:
        if not TaskRegistry.is_registered(name):
            TaskRegistry.register(name, func)


class TestTimeoutHandling(SupersetTestCase):
    """E2E tests for task timeout functionality."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        super().setUp()
        self.login(ADMIN_USERNAME)
        _register_test_tasks()
        _reset_handler_state()

    def test_timeout_with_abort_handler_results_in_timed_out_status(self) -> None:
        """Task with timeout and abort handler should end with TIMED_OUT status."""
        _skip_if_sqlite()

        # Create task with timeout
        task_obj = TaskDAO.create_task(
            task_type="test_timeout_abortable",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Timeout",
            scope=TaskScope.SYSTEM,
            properties={"timeout": 1},  # 1 second timeout
        )

        # Execute task via Celery executor (synchronously)
        result = execute_task.apply(
            args=[task_obj.uuid, "test_timeout_abortable", (), {}]
        )

        # Verify execution completed
        assert result.successful()
        assert result.result["status"] == TaskStatus.TIMED_OUT.value

        # Verify abort handler was called
        assert _handler_state["abort_called"]

    def test_user_abort_results_in_aborted_status(self) -> None:
        """User-initiated abort on pending task should result in ABORTED."""
        # Create task (pending state)
        task_obj = TaskDAO.create_task(
            task_type="test_timeout_simple",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Abort Task",
            scope=TaskScope.SYSTEM,
        )

        # Cancel before execution (pending task abort)
        CancelTaskCommand(task_obj.uuid, force=True).run()

        # Refresh from DB
        db.session.expire_all()
        task_obj = db.session.query(Task).filter_by(uuid=task_obj.uuid).first()
        assert task_obj.status == TaskStatus.ABORTED.value

    def test_no_timeout_when_not_configured(self) -> None:
        """Task without timeout should run to completion regardless of duration."""
        task_obj = TaskDAO.create_task(
            task_type="test_timeout_quick",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test No Timeout",
            scope=TaskScope.SYSTEM,
            # No timeout property
        )

        result = execute_task.apply(args=[task_obj.uuid, "test_timeout_quick", (), {}])

        assert result.successful()
        assert result.result["status"] == TaskStatus.SUCCESS.value

    def test_abort_handler_exception_results_in_failure(self) -> None:
        """If abort handler throws during timeout, task should be FAILURE."""
        _skip_if_sqlite()

        task_obj = TaskDAO.create_task(
            task_type="test_timeout_handler_fails",
            task_key=f"test_key_{uuid.uuid4().hex[:8]}",
            task_name="Test Handler Fails",
            scope=TaskScope.SYSTEM,
            properties={"timeout": 1},  # 1 second timeout
        )

        result = execute_task.apply(
            args=[task_obj.uuid, "test_timeout_handler_fails", (), {}]
        )

        assert result.successful()
        assert result.result["status"] == TaskStatus.FAILURE.value
        assert _handler_state["abort_called"]
