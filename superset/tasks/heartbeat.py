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
from typing import Iterator, TYPE_CHECKING

from superset.stats_logger import BaseStatsLogger

if TYPE_CHECKING:
    from flask import Flask

logger = logging.getLogger(__name__)


@contextmanager
def task_heartbeat(task_id: int, app: "Flask") -> Iterator[None]:
    """Keep ``tasks.last_heartbeat`` fresh while a worker holds the task.

    Stamps an initial heartbeat synchronously (so the task reads as "picked up
    by a worker" immediately — a NULL heartbeat means still queued), then runs a
    daemon thread that bumps it every ``GTF_TASK_HEARTBEAT_INTERVAL`` seconds
    until the context exits. The prune cron uses this to tell a live task (fresh
    heartbeat) from one abandoned by a dead worker (stale heartbeat).

    Best-effort: a failed write is counted and logged, and the loop continues —
    the reaper only acts after several missed intervals. The thread is a daemon
    so it never blocks worker shutdown (matching the existing timeout/abort
    threads) and relies on DB drivers releasing the GIL during query I/O, so a
    task blocked in a long warehouse query still heartbeats and is not reaped.

    :param task_id: integer primary key of the running task
    :param app: Flask app for DB access from the background thread
    """
    interval: float = app.config["GTF_TASK_HEARTBEAT_INTERVAL"]
    stats_logger: BaseStatsLogger = app.config.get("STATS_LOGGER", BaseStatsLogger())
    stop = threading.Event()

    def _write() -> None:
        from superset.daos.tasks import TaskDAO

        try:
            TaskDAO.touch_heartbeat(task_id)
            stats_logger.incr("gtf.task.heartbeat")
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            stats_logger.incr("gtf.task.heartbeat_failure")
            logger.warning(
                "Heartbeat write failed for task id=%s", task_id, exc_info=True
            )

    # Initial stamp runs in the worker's existing app context.
    _write()

    def _beat() -> None:
        while not stop.wait(interval):
            with app.app_context():
                _write()

    thread = threading.Thread(
        target=_beat, name=f"gtf-heartbeat-{task_id}", daemon=True
    )
    thread.start()
    try:
        yield
    finally:
        stop.set()
