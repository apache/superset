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

"""Integration tests for sync join-and-wait functionality in GTF.

Note: Full threading tests require PostgreSQL or MySQL. SQLite has thread-safety
limitations that prevent cross-thread database access.
"""

import threading
import time
from typing import Any

from superset_core.api.tasks import TaskStatus

from superset import db
from superset.commands.tasks import SubmitTaskCommand
from superset.daos.tasks import TaskDAO
from superset.tasks.manager import TaskManager
from superset.utils.core import backend


def test_submit_task_distinguishes_new_vs_existing(app_context, login_as) -> None:
    """
    Test that SubmitTaskCommand.run_with_info() correctly returns is_new flag.
    """
    login_as("admin")

    # First submission - should be new
    task1, is_new1 = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "distinguish-key",
            "task_name": "First Task",
        }
    ).run_with_info()

    assert is_new1 is True

    try:
        # Second submission with same key - should join existing
        task2, is_new2 = SubmitTaskCommand(
            data={
                "task_type": "test-type",
                "task_key": "distinguish-key",
                "task_name": "Second Task",
            }
        ).run_with_info()

        assert is_new2 is False
        assert task2.uuid == task1.uuid

    finally:
        # Cleanup
        db.session.delete(task1)
        db.session.commit()


def test_terminal_states_recognized_correctly(app_context) -> None:
    """
    Test that TaskManager.TERMINAL_STATES contains the expected values.
    """
    assert TaskStatus.SUCCESS.value in TaskManager.TERMINAL_STATES
    assert TaskStatus.FAILURE.value in TaskManager.TERMINAL_STATES
    assert TaskStatus.ABORTED.value in TaskManager.TERMINAL_STATES
    assert TaskStatus.TIMED_OUT.value in TaskManager.TERMINAL_STATES

    # Non-terminal states should not be in the set
    assert TaskStatus.PENDING.value not in TaskManager.TERMINAL_STATES
    assert TaskStatus.IN_PROGRESS.value not in TaskManager.TERMINAL_STATES
    assert TaskStatus.ABORTING.value not in TaskManager.TERMINAL_STATES


def test_sync_joiner_waits_for_completion(app_context, login_as) -> None:  # noqa: C901
    """
    Test that a sync caller joining an existing task blocks until completion.

    This test creates a task in a background thread, then has another "joiner"
    call wait_for_completion. The joiner should block until the task completes.
    """
    from flask import current_app

    from superset.extensions import security_manager
    from superset.utils.core import override_user

    # SQLite doesn't support cross-thread database connections reliably
    if backend() == "sqlite":
        return

    login_as("admin")

    # Get the Flask app instance for use in background threads
    app = current_app._get_current_object()

    # Get admin user for use in background threads via override_user
    admin_user = security_manager.find_user(username="admin")
    task_uuid: str | None = None
    joiner_result: dict[str, Any] = {}
    errors: list[Exception] = []
    stop_joiner = threading.Event()

    def background_task_creator():
        """Create and complete a task in a background thread."""
        nonlocal task_uuid
        with app.app_context():
            try:
                # Use override_user context manager (like celery tasks do)
                with override_user(admin_user):
                    # Create task
                    task, _ = SubmitTaskCommand(
                        data={
                            "task_type": "test-wait",
                            "task_key": "wait-test-key",
                            "task_name": "Background Task",
                        }
                    ).run_with_info()
                    task_uuid = task.uuid

                    # Simulate some work
                    time.sleep(0.5)

                    # Complete the task
                    TaskDAO.update(
                        task,
                        {"status": TaskStatus.SUCCESS.value},
                    )
                    db.session.commit()

                    # Publish completion signal
                    TaskManager.publish_completion(task.uuid, task.status)
            except Exception as e:
                errors.append(e)

    def joiner_thread():
        """Wait for the task to complete."""
        nonlocal joiner_result
        with app.app_context():
            try:
                # Wait for task to be created (with timeout to avoid hanging)
                wait_count = 0
                while task_uuid is None and wait_count < 100:
                    if stop_joiner.is_set():
                        return
                    time.sleep(0.05)
                    wait_count += 1

                if task_uuid is None:
                    return  # Bail out if task never created

                start = time.time()
                result_task = TaskManager.wait_for_completion(
                    task_uuid,
                    timeout=5.0,
                    poll_interval=0.1,
                )
                elapsed = time.time() - start

                joiner_result["task"] = result_task
                joiner_result["elapsed"] = elapsed
            except Exception as e:
                errors.append(e)

    # Start background task
    creator = threading.Thread(target=background_task_creator, daemon=True)
    joiner = threading.Thread(target=joiner_thread, daemon=True)

    try:
        creator.start()
        joiner.start()

        creator.join(timeout=10)
        joiner.join(timeout=10)

        if errors:
            raise errors[0]

        # Verify joiner waited and got terminal state
        assert "task" in joiner_result
        assert joiner_result["task"].status == TaskStatus.SUCCESS.value
        # Joiner should have waited at least as long as the background task took
        assert joiner_result["elapsed"] >= 0.4  # Some margin for timing
    finally:
        # Signal joiner to stop if still waiting
        stop_joiner.set()
        # Cleanup
        if task_uuid:
            task = TaskDAO.find_one_or_none(uuid=task_uuid)
            if task:
                db.session.delete(task)
                db.session.commit()


def test_wait_for_completion_timeout(app_context, login_as) -> None:
    """
    Test that wait_for_completion raises TimeoutError on timeout.
    """
    import pytest

    login_as("admin")

    # Create a pending task (won't complete)
    task, _ = SubmitTaskCommand(
        data={
            "task_type": "test-timeout",
            "task_key": "timeout-key",
            "task_name": "Timeout Task",
        }
    ).run_with_info()

    # Save original Redis state and force polling mode
    original_redis = TaskManager._redis
    TaskManager._redis = None

    try:
        with pytest.raises(TimeoutError):
            TaskManager.wait_for_completion(
                task.uuid,
                timeout=0.2,
                poll_interval=0.05,
            )
    finally:
        # Restore original Redis state
        TaskManager._redis = original_redis
        db.session.delete(task)
        db.session.commit()


def test_wait_returns_immediately_for_terminal_task(app_context, login_as) -> None:
    """
    Test that wait_for_completion returns immediately if task is already terminal.
    """
    login_as("admin")

    # Create and immediately complete a task
    task, _ = SubmitTaskCommand(
        data={
            "task_type": "test-immediate",
            "task_key": "immediate-key",
            "task_name": "Immediate Task",
        }
    ).run_with_info()

    TaskDAO.update(task, {"status": TaskStatus.SUCCESS.value})
    db.session.commit()

    try:
        start = time.time()
        result = TaskManager.wait_for_completion(
            task.uuid,
            timeout=5.0,
            poll_interval=0.5,
        )
        elapsed = time.time() - start

        assert result.status == TaskStatus.SUCCESS.value
        # Should return almost immediately since task is already terminal
        assert elapsed < 0.2
    finally:
        db.session.delete(task)
        db.session.commit()
