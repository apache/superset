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
"""Worker liveness heartbeat for the Global Task Framework (GTF)."""

from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Callable, Iterator, TYPE_CHECKING

from superset.stats_logger import BaseStatsLogger
from superset.tasks.utils import naive_utcnow

if TYPE_CHECKING:
    from flask import Flask

logger = logging.getLogger(__name__)

SELF_FENCE_ERROR_MESSAGE = (
    "Task self-terminated: worker lost contact with the metastore "
    "(heartbeat failed for longer than GTF_ORPHAN_TASK_TIMEOUT)"
)


class HeartbeatController:
    """Handle yielded by :func:`task_heartbeat` for wiring the self-fence.

    The heartbeat thread starts before the ``TaskContext`` exists (it spans the
    whole time the worker holds the task, including the DAG wait), so the
    executor registers the fence callback once the context is built. The worker
    only self-fences once it is ``armed`` (a callback is registered); before that
    there is no running query to cancel, so a stalled heartbeat is simply left
    for the reaper and the loop keeps trying in case connectivity recovers.
    """

    def __init__(self) -> None:
        self._fence_callback: Callable[[], None] | None = None

    def on_fence(self, callback: Callable[[], None]) -> None:
        """Register the callback invoked when the worker self-fences."""
        self._fence_callback = callback

    @property
    def armed(self) -> bool:
        """True once a fence callback is registered (task is executing)."""
        return self._fence_callback is not None

    def invoke_fence(self) -> None:
        """Invoke the registered fence callback, if one has been registered."""
        if self._fence_callback is not None:
            self._fence_callback()


@contextmanager
def task_heartbeat(  # noqa: C901
    task_id: int, app: "Flask"
) -> Iterator[HeartbeatController]:
    """Keep ``tasks.last_heartbeat`` fresh while a worker holds the task.

    Stamps an initial heartbeat synchronously (so the task reads as "picked up
    by a worker" immediately — a NULL heartbeat means still queued), then runs a
    daemon thread that bumps it every ``GTF_TASK_HEARTBEAT_INTERVAL`` seconds
    until the context exits. The prune cron uses this to tell a live task (fresh
    heartbeat) from one abandoned by a dead worker (stale heartbeat).

    Self-fencing: if heartbeat writes keep failing for longer than
    ``GTF_ORPHAN_TASK_TIMEOUT`` — the same window after which the reaper declares
    the task orphaned — the worker can no longer prove liveness to the metastore
    (network partition, metastore outage). Rather than keep running a query the
    reaper has already (or will shortly) mark FAILURE, the worker fails itself
    via the registered fence callback. A single failed write is tolerated; only
    a sustained outage spanning the orphan window fences, so a transient blip
    never kills a healthy task. Fencing only kicks in once the controller is
    armed (the task is executing and has a fence callback); a stalled heartbeat
    during the pre-execution DAG wait keeps retrying so recovered connectivity
    resumes the task rather than forfeiting it.

    The thread is a daemon so it never blocks worker shutdown (matching the
    existing timeout/abort threads) and relies on DB drivers releasing the GIL
    during query I/O, so a task blocked in a long warehouse query still
    heartbeats and is not reaped.

    :param task_id: integer primary key of the running task
    :param app: Flask app for DB access from the background thread
    :returns: a :class:`HeartbeatController` for registering the fence callback
    """
    interval: float = app.config["GTF_TASK_HEARTBEAT_INTERVAL"]
    orphan_timeout: float = app.config["GTF_ORPHAN_TASK_TIMEOUT"]
    stats_logger: BaseStatsLogger = app.config.get("STATS_LOGGER", BaseStatsLogger())
    controller = HeartbeatController()
    stop = threading.Event()

    # Absolute time by which a heartbeat must succeed or the worker self-fences.
    # Seeded optimistically so even a never-succeeding heartbeat fences after the
    # orphan window rather than running unbounded.
    def _new_deadline() -> datetime:
        return naive_utcnow() + timedelta(seconds=orphan_timeout)

    deadline = _new_deadline()

    def _write() -> bool:
        from superset.daos.tasks import TaskDAO

        try:
            TaskDAO.touch_heartbeat(task_id)
            stats_logger.incr("gtf.task.heartbeat")
            return True
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            stats_logger.incr("gtf.task.heartbeat_failure")
            logger.warning(
                "Heartbeat write failed for task id=%s", task_id, exc_info=True
            )
            return False

    def _fence() -> None:
        stats_logger.incr("gtf.task.self_fenced")
        logger.warning(
            "Task id=%s self-fencing: heartbeat failed for longer than the "
            "orphan window (%ss); failing the task from the worker",
            task_id,
            orphan_timeout,
        )
        try:
            controller.invoke_fence()
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            logger.exception("Self-fence callback failed for task id=%s", task_id)

    # Initial stamp runs in the worker's existing app context.
    if _write():
        deadline = _new_deadline()

    def _beat() -> None:
        nonlocal deadline
        while not stop.wait(interval):
            with app.app_context():
                if _write():
                    deadline = _new_deadline()
                elif controller.armed and naive_utcnow() >= deadline:
                    # Only fence an executing task; a pre-execution stall is left
                    # to the reaper and keeps retrying in case the outage clears.
                    _fence()
                    return

    thread = threading.Thread(
        target=_beat, name=f"gtf-heartbeat-{task_id}", daemon=True
    )
    thread.start()
    try:
        yield controller
    finally:
        stop.set()
