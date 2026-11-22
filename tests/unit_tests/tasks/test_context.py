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
"""Unit tests for TaskContext writes and cleanup."""

import threading
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from superset_core.tasks.types import TaskStatus

from superset.tasks.context import TaskContext

TEST_UUID = UUID("b8b61b7b-1cd3-4a31-a74a-0a95341afc06")


@pytest.fixture
def context():
    """Build a TaskContext with DB writes and app config mocked out.

    Throttling is set to a long interval so that, absent an explicit override,
    updates after the first are deferred rather than written.
    """
    task = MagicMock()
    task.uuid = TEST_UUID
    task.status = TaskStatus.PENDING.value
    task.properties_dict = {}
    task.payload_dict = {}

    with (
        patch("superset.tasks.context.current_app") as mock_current_app,
        patch("superset.daos.tasks.TaskDAO"),
    ):
        mock_current_app.config = {
            "TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL": 100,
            "STATS_LOGGER": MagicMock(),
        }
        mock_current_app._get_current_object = Mock(return_value=MagicMock())
        ctx = TaskContext(task)
        with patch.object(ctx, "_write_to_db") as write:
            yield ctx, write
        ctx._cancel_deferred_flush_timer()


def test_first_update_writes_then_throttles(context) -> None:
    ctx, write = context

    ctx.update_task(payload={"a": 1})
    assert write.call_count == 1

    # Second update inside the throttle window is deferred, not written.
    ctx.update_task(payload={"b": 2})
    assert write.call_count == 1
    assert ctx._has_pending_updates is True


def test_immediate_write_bypasses_throttle_window(context) -> None:
    ctx, write = context

    # Prime the throttle window with a first (immediate) write.
    ctx.update_task(payload={"a": 1})
    assert write.call_count == 1

    # A subsequent immediate=True update writes synchronously even though the
    # throttle window has not elapsed, and clears any pending deferred state.
    ctx.update_task(payload={"b": 2})  # deferred
    assert write.call_count == 1
    ctx.update_task(payload={"cache_key": "abc"}, immediate=True)
    assert write.call_count == 2
    assert ctx._has_pending_updates is False
    assert ctx._deferred_flush_timer is None


def test_immediate_write_on_first_update(context) -> None:
    ctx, write = context

    ctx.update_task(payload={"cache_key": "abc"}, immediate=True)
    assert write.call_count == 1
    assert ctx._last_db_write_time is not None


def test_persist_cancellation_writes_immediately_and_flushes_pending_updates(
    context,
) -> None:
    ctx, write = context

    ctx.update_task(payload={"a": 1})  # opens the throttle window
    ctx.update_task(payload={"b": 2})  # deferred
    assert write.call_count == 1

    # A replaced or cleared cancel handle is written at once, so the orphan
    # reaper never reads a handle the task is done with; the write also carries
    # the deferred update.
    ctx.persist_cancellation(7, "42")
    assert write.call_count == 2
    assert ctx._has_pending_updates is False
    assert ctx._deferred_flush_timer is None
    assert ctx._properties_cache["private"]["task"] == {
        "cancel_database_id": 7,
        "cancel_query_id": "42",
    }

    ctx.persist_cancellation(7, None)
    assert write.call_count == 3
    assert ctx._properties_cache["private"]["task"]["cancel_query_id"] is None


def _abort_on_another_thread(
    ctx: TaskContext,
) -> tuple[threading.Thread, threading.Event]:
    """Run ``ctx``'s abort handlers on another thread, as an abort, timeout or
    self-fence does, and return once they are running, with the event that lets
    them return.

    The handler stands in for one that flags the task's work to stop, then
    cancels its query over a new connection: the work can end before it returns.
    """
    cancelling, cancelled = threading.Event(), threading.Event()

    def handle_abort() -> None:
        cancelling.set()
        cancelled.wait(5)

    ctx._abort_handlers.append(handle_abort)
    thread = threading.Thread(target=ctx._on_abort_detected)
    thread.start()
    assert cancelling.wait(5)
    # As the executor does once the task's work has ended.
    ctx.mark_execution_completed()
    return thread, cancelled


def test_cleanup_waits_for_abort_handlers_running_on_another_thread(
    context,
) -> None:
    ctx, _ = context
    cleaned_up_while_aborting: list[bool] = []
    thread, cancelled = _abort_on_another_thread(ctx)
    ctx.on_cleanup(
        lambda: cleaned_up_while_aborting.append(not ctx._abort_handlers_done.is_set())
    )
    threading.Timer(0.1, cancelled.set).start()

    ctx._run_cleanup()

    # The executor reads this next: TIMED_OUT or ABORTED, not FAILURE.
    assert ctx.abort_handlers_completed is True
    assert cleaned_up_while_aborting == [False]
    thread.join()


def test_cleanup_waits_for_abort_handlers_for_a_bounded_time(context) -> None:
    ctx, _ = context
    thread, cancelled = _abort_on_another_thread(ctx)

    with patch("superset.tasks.context.ABORT_HANDLERS_WAIT_SECONDS", 0.05):
        ctx._run_cleanup()

    # Still running: the executor finalizes the task FAILURE.
    assert ctx.abort_handlers_completed is False
    cancelled.set()
    thread.join()
