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

"""Integration tests for sync join-and-wait functionality in GTF."""

import time

from superset_core.api.tasks import TaskStatus

from superset import db
from superset.commands.tasks import SubmitTaskCommand
from superset.daos.tasks import TaskDAO
from superset.tasks.manager import TaskManager


def test_submit_task_distinguishes_new_vs_existing(
    app_context, login_as, get_user
) -> None:
    """
    Test that SubmitTaskCommand.run_with_info() correctly returns is_new flag.
    """
    login_as("admin")
    admin = get_user("admin")

    # First submission - should be new
    task1, is_new1 = SubmitTaskCommand(
        data={
            "task_type": "test-type",
            "task_key": "distinguish-key",
            "task_name": "First Task",
        }
    ).run_with_info()

    assert is_new1 is True
    assert task1.user_id == admin.id

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


def test_wait_for_completion_timeout(app_context, login_as, get_user) -> None:
    """
    Test that wait_for_completion raises TimeoutError on timeout.
    """
    from unittest.mock import patch

    import pytest

    login_as("admin")
    admin = get_user("admin")

    # Create a pending task (won't complete)
    task, _ = SubmitTaskCommand(
        data={
            "task_type": "test-timeout",
            "task_key": "timeout-key",
            "task_name": "Timeout Task",
        }
    ).run_with_info()
    assert task.user_id == admin.id

    try:
        # Force polling mode by mocking signal_cache as None
        with patch("superset.tasks.manager.cache_manager") as mock_cache_manager:
            mock_cache_manager.signal_cache = None
            with pytest.raises(TimeoutError):
                TaskManager.wait_for_completion(
                    task.uuid,
                    timeout=0.2,
                    poll_interval=0.05,
                )
    finally:
        db.session.delete(task)
        db.session.commit()


def test_wait_returns_immediately_for_terminal_task(
    app_context, login_as, get_user
) -> None:
    """
    Test that wait_for_completion returns immediately if task is already terminal.
    """
    login_as("admin")
    admin = get_user("admin")

    # Create and immediately complete a task
    task, _ = SubmitTaskCommand(
        data={
            "task_type": "test-immediate",
            "task_key": "immediate-key",
            "task_name": "Immediate Task",
        }
    ).run_with_info()
    assert task.user_id == admin.id

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
