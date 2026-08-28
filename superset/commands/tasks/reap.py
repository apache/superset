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
"""Reap GTF tasks abandoned by a dead worker."""

import logging
from typing import cast
from uuid import UUID

from flask import current_app
from superset_core.tasks.types import TaskProperties, TaskStatus

from superset import db
from superset.commands.base import BaseCommand
from superset.daos.tasks import TaskDAO
from superset.extensions import celery_app
from superset.models.tasks import Task
from superset.stats_logger import BaseStatsLogger
from superset.tasks.constants import ACTIVE_STATES
from superset.tasks.utils import parse_properties

logger = logging.getLogger(__name__)

ORPHAN_ERROR_MESSAGE = "Task orphaned: worker heartbeat timed out"


class ReapOrphanedTasksCommand(BaseCommand):
    """Recover tasks abandoned by a worker that stopped refreshing its heartbeat.

    Run from the prune cron before row deletion. For each orphan (an active task
    whose liveness heartbeat has gone stale — see ``TaskDAO.find_orphaned``) the
    command transitions the row to ``FAILURE`` and publishes completion so waiters
    (sync joiners, DAG dependents, chart-data pollers) unblock, then revokes the
    Celery job so a redelivered copy cannot run.

    It acts only on tasks with no live worker; a task still being worked on keeps
    a fresh heartbeat and is left entirely to its own cooperative abort/cleanup.
    The status transition is an atomic compare-and-swap, so a worker that revives
    and commits its own terminal status simply makes the reaper's update a no-op.
    """

    def run(self) -> int:
        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        timeout = current_app.config["GTF_ORPHAN_TASK_TIMEOUT"]

        uuids = TaskDAO.find_orphaned(timeout)
        reaped = 0
        for task_uuid in uuids:
            # Isolate each task: a transient DB error on one must neither abort the
            # loop nor escape as a non-CommandException (which would skip the
            # retention prune pass that runs after this command).
            try:
                if self._reap(task_uuid, stats_logger):
                    reaped += 1
            except Exception:  # noqa: BLE001 pylint: disable=broad-except
                db.session.rollback()  # pylint: disable=consider-using-transaction
                stats_logger.incr("gtf.task.reap_error")
                logger.exception("Failed to reap orphaned task %s", task_uuid)
        if uuids:
            logger.info(
                "Orphan reaper processed %d task(s), reaped %d", len(uuids), reaped
            )
        return reaped

    def _reap(self, task_uuid: UUID, stats_logger: BaseStatsLogger) -> bool:
        """Recover one orphaned task; return True if it was transitioned to FAILURE."""
        # Read the current properties so the FAILURE write preserves existing
        # runtime state (celery_task_id, is_abortable, ...) rather than replacing
        # the whole column with just the error fields.
        properties = cast(
            TaskProperties,
            dict(
                parse_properties(
                    db.session.query(Task.properties)
                    .filter(Task.uuid == task_uuid)
                    .scalar()
                )
            ),
        )
        self._revoke(properties.get("celery_task_id"), stats_logger)

        properties["error_message"] = ORPHAN_ERROR_MESSAGE
        properties["exception_type"] = "OrphanedTaskError"

        if not TaskDAO.conditional_status_update(
            task_uuid,
            TaskStatus.FAILURE,
            expected_status=list(ACTIVE_STATES),
            properties=properties,
            set_ended_at=True,
        ):
            # The worker revived and committed a terminal status first.
            return False

        db.session.commit()  # pylint: disable=consider-using-transaction

        from superset.tasks.manager import TaskManager

        TaskManager.publish_completion(task_uuid, TaskStatus.FAILURE.value)
        TaskManager.publish_entity_change(task_uuid)
        stats_logger.incr("gtf.task.orphan_reaped")
        logger.warning("Reaped orphaned task %s (worker heartbeat stale)", task_uuid)
        return True

    def _revoke(
        self, celery_task_id: str | None, stats_logger: BaseStatsLogger
    ) -> None:
        """Revoke the orphan's Celery job so a redelivered copy will not run.

        Deliberately not ``terminate=True``: a stale heartbeat means the worker is
        gone (nothing to signal), and force-terminating would risk killing a
        healthy task on a false-positive detection. This only marks the job id
        revoked, which matters when ``task_acks_late`` is enabled and the broker
        redelivers. Best-effort; the DB transition is authoritative.
        """
        if not celery_task_id:
            return
        try:
            celery_app.control.revoke(celery_task_id)
            stats_logger.incr("gtf.task.revoke")
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            stats_logger.incr("gtf.task.revoke_failure")
            logger.warning(
                "Failed to revoke Celery task %s", celery_task_id, exc_info=True
            )

    def validate(self) -> None:
        pass
