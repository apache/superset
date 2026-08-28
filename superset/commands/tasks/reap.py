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
"""Reap GTF tasks abandoned by a dead worker or wedged in ABORTING."""

import logging
from typing import cast

from flask import current_app
from superset_core.tasks.types import TaskProperties, TaskStatus

from superset import db
from superset.commands.base import BaseCommand
from superset.daos.tasks import OrphanCandidate, TaskDAO
from superset.extensions import celery_app
from superset.stats_logger import BaseStatsLogger
from superset.tasks.constants import ACTIVE_STATES
from superset.tasks.utils import parse_properties

logger = logging.getLogger(__name__)

ORPHAN_ERROR_MESSAGE = "Task orphaned: worker heartbeat timed out"


class ReapOrphanedTasksCommand(BaseCommand):
    """Detect and clean up tasks abandoned by a dead or wedged worker.

    Run from the prune cron before row deletion. Candidates come from
    ``TaskDAO.find_orphaned``:

    - **Orphans** (dead worker, stale heartbeat): revoke any lingering Celery
      job, then force the row to FAILURE and publish completion so waiters
      (sync joiners, DAG dependents, chart-data pollers) unblock — the worker is
      gone and cannot finalize itself.
    - **Wedged aborts** (live worker still ABORTING past the grace window): only
      escalate with a forced revoke, letting the worker's own ``finally`` block
      finalize the status once ``SoftTimeLimitExceeded`` is raised.

    All Celery/DB operations are best-effort accelerators; the atomic
    compare-and-swap transition is authoritative, so a worker that revives and
    commits its own terminal status simply makes the reaper's CAS a no-op.
    """

    def run(self) -> int:
        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        # A single threshold governs both "no heartbeat for this long → orphaned"
        # and "ABORTING for this long despite a live heartbeat → escalate".
        timeout = current_app.config["GTF_ORPHAN_TASK_TIMEOUT"]

        candidates = TaskDAO.find_orphaned(timeout, timeout)
        reaped = sum(self._process(candidate, stats_logger) for candidate in candidates)
        if candidates:
            logger.info(
                "Orphan reaper processed %d task(s), reaped %d", len(candidates), reaped
            )
        return reaped

    def _process(
        self, candidate: OrphanCandidate, stats_logger: BaseStatsLogger
    ) -> bool:
        """Handle one candidate; return True if it was reaped to FAILURE."""
        # Preserve existing runtime state (is_abortable, timeout, celery_task_id,
        # ...); conditional_status_update replaces the whole properties column.
        properties = cast(TaskProperties, dict(parse_properties(candidate.properties)))
        self._revoke(properties.get("celery_task_id"), stats_logger)

        if not candidate.is_orphan:
            # Wedged abort: the live worker finalizes its own status once the
            # forced revoke raises SoftTimeLimitExceeded in it.
            stats_logger.incr("gtf.task.abort_escalated")
            logger.warning(
                "Escalated wedged abort for task %s via forced revoke", candidate.uuid
            )
            return False

        properties["error_message"] = ORPHAN_ERROR_MESSAGE
        properties["exception_type"] = "OrphanedTaskError"

        if not TaskDAO.conditional_status_update(
            candidate.uuid,
            TaskStatus.FAILURE,
            expected_status=list(ACTIVE_STATES),
            properties=properties,
            set_ended_at=True,
        ):
            # The worker revived and committed a terminal status first.
            return False

        db.session.commit()

        from superset.tasks.manager import TaskManager

        TaskManager.publish_completion(candidate.uuid, TaskStatus.FAILURE.value)
        TaskManager.publish_entity_change(candidate.uuid)
        stats_logger.incr("gtf.task.orphan_reaped")
        logger.warning(
            "Reaped orphaned task %s (worker heartbeat stale)", candidate.uuid
        )
        return True

    def _revoke(
        self, celery_task_id: str | None, stats_logger: BaseStatsLogger
    ) -> None:
        """Forcibly revoke a Celery job (SIGUSR1 → SoftTimeLimitExceeded).

        ``terminate=True`` signals the worker child running the task so it raises
        and reclaims the slot; for a not-yet-started job it prevents execution.
        Best-effort — the DB transition is the source of truth.
        """
        if not celery_task_id:
            return
        try:
            celery_app.control.revoke(celery_task_id, terminate=True, signal="SIGUSR1")
            stats_logger.incr("gtf.task.revoke")
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            stats_logger.incr("gtf.task.revoke_failure")
            logger.warning(
                "Failed to revoke Celery task %s", celery_task_id, exc_info=True
            )

    def validate(self) -> None:
        pass
