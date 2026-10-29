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
"""Unit tests for the GTF worker-liveness heartbeat."""

import threading
import time
from unittest.mock import MagicMock, patch

from superset.tasks.heartbeat import task_heartbeat


def _mock_app(
    interval: float, stats: MagicMock, *, orphan_timeout: float = 60
) -> MagicMock:
    app = MagicMock()
    app.config = {
        "GTF_TASK_HEARTBEAT_INTERVAL": interval,
        "GTF_ORPHAN_TASK_TIMEOUT": orphan_timeout,
        "STATS_LOGGER": stats,
    }
    app.app_context.return_value.__enter__ = MagicMock(return_value=None)
    app.app_context.return_value.__exit__ = MagicMock(return_value=None)
    return app


def test_heartbeat_stamps_immediately_and_stops_on_exit() -> None:
    """An initial heartbeat is written synchronously; none after the context ends."""
    stats = MagicMock()
    # Large interval so the background thread never beats within the test window;
    # only the synchronous initial write should occur.
    app = _mock_app(interval=100, stats=stats)

    with patch("superset.daos.tasks.TaskDAO.touch_heartbeat") as touch:
        with task_heartbeat(42, app):
            assert touch.call_count == 1
            touch.assert_called_once_with(42)
        stats.incr.assert_any_call("gtf.task.heartbeat")

    # No further writes after the context exits.
    assert touch.call_count == 1


def test_heartbeat_beats_periodically() -> None:
    """The background thread keeps bumping the heartbeat on the interval."""
    stats = MagicMock()
    app = _mock_app(interval=0.02, stats=stats)

    with patch("superset.daos.tasks.TaskDAO.touch_heartbeat") as touch:
        with task_heartbeat(7, app):
            deadline = time.time() + 2.0
            while touch.call_count < 3 and time.time() < deadline:
                time.sleep(0.02)
            assert touch.call_count >= 3


def test_heartbeat_failure_is_counted_and_swallowed() -> None:
    """A failed write emits the failure metric and does not raise."""
    stats = MagicMock()
    app = _mock_app(interval=100, stats=stats)

    with patch(
        "superset.daos.tasks.TaskDAO.touch_heartbeat",
        side_effect=RuntimeError("db down"),
    ):
        # Must not raise even though the initial write fails.
        with task_heartbeat(1, app):
            pass

    stats.incr.assert_any_call("gtf.task.heartbeat_failure")


def test_heartbeat_self_fences_after_sustained_failure() -> None:
    """Writes failing past the orphan window fire the fence callback exactly once."""
    stats = MagicMock()
    # orphan_timeout=0 -> the deadline is reached on the first failed beat.
    app = _mock_app(interval=0.02, stats=stats, orphan_timeout=0)
    fenced = threading.Event()

    with patch(
        "superset.daos.tasks.TaskDAO.touch_heartbeat",
        side_effect=RuntimeError("db down"),
    ):
        with task_heartbeat(9, app) as heartbeat:
            heartbeat.on_fence(fenced.set)
            assert fenced.wait(2.0), "worker did not self-fence on sustained failure"

    stats.incr.assert_any_call("gtf.task.self_fenced")


def test_heartbeat_does_not_fence_while_writes_succeed() -> None:
    """A live worker whose writes keep succeeding must never self-fence."""
    stats = MagicMock()
    # Even with a zero orphan window, a successful write always resets the deadline.
    app = _mock_app(interval=0.02, stats=stats, orphan_timeout=0)
    fence_callback = MagicMock()

    with patch("superset.daos.tasks.TaskDAO.touch_heartbeat"):
        with task_heartbeat(3, app) as heartbeat:
            heartbeat.on_fence(fence_callback)
            time.sleep(0.1)  # allow several successful beats

    fence_callback.assert_not_called()


def test_heartbeat_does_not_fence_before_armed() -> None:
    """During the pre-execution DAG wait (no callback yet) a stalled heartbeat
    must not fence — it keeps retrying so recovered connectivity resumes the task."""
    stats = MagicMock()
    app = _mock_app(interval=0.02, stats=stats, orphan_timeout=0)

    with patch(
        "superset.daos.tasks.TaskDAO.touch_heartbeat",
        side_effect=RuntimeError("db down"),
    ):
        with task_heartbeat(11, app):  # never call on_fence -> controller not armed
            time.sleep(0.1)  # deadline passes and several beats fail

    # Writes kept failing and being counted, but no fence fired (not armed).
    stats.incr.assert_any_call("gtf.task.heartbeat_failure")
    assert ("gtf.task.self_fenced",) not in [c.args for c in stats.incr.call_args_list]


def test_heartbeat_tolerates_intermittent_failures() -> None:
    """A transient blip (fail then success) resets the deadline and does not fence."""
    stats = MagicMock()
    # Wide orphan window: a success every other beat keeps the deadline in the
    # future, so the accumulated failures never reach it.
    app = _mock_app(interval=0.02, stats=stats, orphan_timeout=30)
    fence_callback = MagicMock()

    # Alternate failure/success so a beat never fails repeatedly for long enough
    # to span the 30s window; each success pushes the deadline back out.
    fail_then_ok = [RuntimeError("blip"), None] * 20

    with patch("superset.daos.tasks.TaskDAO.touch_heartbeat", side_effect=fail_then_ok):
        with task_heartbeat(5, app) as heartbeat:
            heartbeat.on_fence(fence_callback)
            time.sleep(0.15)  # several fail/success cycles

    fence_callback.assert_not_called()
    # Both the failure and success metrics were exercised.
    stats.incr.assert_any_call("gtf.task.heartbeat_failure")
    stats.incr.assert_any_call("gtf.task.heartbeat")
