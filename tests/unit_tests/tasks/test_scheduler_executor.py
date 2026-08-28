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
"""Unit tests for the GTF executor body (scheduler._execute_task_body)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from superset_core.tasks.types import TaskStatus


def _run_body_with_raising_executor(*, timeout_triggered: bool, abort_detected: bool):
    """Drive _execute_task_body where the task body raises mid-abort/timeout.

    Returns ``(result, transition_mock, task_manager_mock, stats_logger_mock)`` for
    the caller to assert on the terminal handling.
    """
    native = uuid4()
    task = SimpleNamespace(
        uuid=native,
        status=TaskStatus.PENDING.value,
        properties_dict={},  # no "timeout" key -> no timeout timer started
    )
    # What the finally block's terminal transition commits, read back at the end.
    refreshed = SimpleNamespace(
        status=(
            TaskStatus.TIMED_OUT.value
            if timeout_triggered
            else TaskStatus.ABORTED.value
        )
    )

    ctx = MagicMock()
    ctx._abort_detected = abort_detected
    ctx.timeout_triggered = timeout_triggered
    ctx.abort_handlers_completed = True

    transition = MagicMock()
    transition.return_value.run.return_value = True  # PENDING->IN_PROGRESS succeeds

    def _raise(*_args, **_kwargs):
        # Simulates the abort handler cancelling the warehouse query, which makes
        # the blocked get_df raise inside the task body.
        raise RuntimeError("query cancelled")

    stats_logger = MagicMock()
    app = MagicMock()
    app.config = {"STATS_LOGGER": stats_logger}

    with (
        patch(
            "superset.tasks.scheduler.TaskDAO.find_one_or_none", return_value=refreshed
        ),
        patch(
            "superset.tasks.scheduler._resolve_failed_prerequisite", return_value=None
        ),
        patch("superset.tasks.scheduler.TaskContext", return_value=ctx),
        patch(
            "superset.tasks.scheduler.TaskRegistry.get_executor", return_value=_raise
        ),
        patch("superset.tasks.scheduler.TaskManager") as task_manager,
        patch("superset.tasks.scheduler.current_app", app),
        patch(
            "superset.commands.tasks.internal_update.InternalStatusTransitionCommand",
            transition,
        ),
    ):
        from superset.tasks.scheduler import _execute_task_body

        # SimpleNamespace stands in for the Task ORM row the body only reads from.
        result = _execute_task_body(task, native, "some.task", (), {})  # type: ignore[arg-type]
    return result, transition, task_manager, stats_logger


def _requested_statuses(transition: MagicMock):
    return [call.kwargs.get("new_status") for call in transition.call_args_list]


def _find_call(transition: MagicMock, new_status):
    return next(
        (
            c
            for c in transition.call_args_list
            if c.kwargs.get("new_status") == new_status
        ),
        None,
    )


def test_exception_during_timeout_finalizes_timed_out_not_failure() -> None:
    """A body that raises while timing out must end TIMED_OUT, never FAILURE."""
    result, transition, task_manager, stats_logger = _run_body_with_raising_executor(
        timeout_triggered=True, abort_detected=False
    )

    assert TaskStatus.FAILURE not in _requested_statuses(transition)
    # The finally block must actually issue the ABORTING -> TIMED_OUT transition.
    timed_out = _find_call(transition, TaskStatus.TIMED_OUT)
    assert timed_out is not None
    assert timed_out.kwargs.get("expected_status") == TaskStatus.ABORTING
    assert result["status"] == TaskStatus.TIMED_OUT.value
    task_manager.publish_completion.assert_called_once()
    # The failure metric must not fire for a successful cancellation.
    assert ("gtf.task.failure",) not in [
        c.args for c in stats_logger.incr.call_args_list
    ]


def test_exception_during_abort_finalizes_aborted_not_failure() -> None:
    """A body that raises while aborting must end ABORTED, never FAILURE."""
    result, transition, _task_manager, _stats = _run_body_with_raising_executor(
        timeout_triggered=False, abort_detected=True
    )

    assert TaskStatus.FAILURE not in _requested_statuses(transition)
    aborted = _find_call(transition, TaskStatus.ABORTED)
    assert aborted is not None
    assert aborted.kwargs.get("expected_status") == TaskStatus.ABORTING
    assert result["status"] == TaskStatus.ABORTED.value


def test_persist_celery_task_id_writes_and_commits() -> None:
    from superset.tasks.scheduler import _persist_celery_task_id

    task = MagicMock()
    with patch("superset.tasks.scheduler.db") as db:
        _persist_celery_task_id(task, "celery-9")

    task.update_properties.assert_called_once_with({"celery_task_id": "celery-9"})
    db.session.commit.assert_called_once()


def test_persist_celery_task_id_is_noop_without_an_id() -> None:
    from superset.tasks.scheduler import _persist_celery_task_id

    task = MagicMock()
    with patch("superset.tasks.scheduler.db") as db:
        _persist_celery_task_id(task, None)

    task.update_properties.assert_not_called()
    db.session.commit.assert_not_called()
