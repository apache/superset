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
from __future__ import annotations

import logging
import random
from datetime import datetime, timezone
from typing import Any, cast, TYPE_CHECKING
from uuid import UUID

from celery import Task
from celery.exceptions import Retry, SoftTimeLimitExceeded
from celery.signals import task_failure
from flask import current_app
from superset_core.tasks.types import TaskStatus

from superset import is_feature_enabled
from superset.commands.exceptions import CommandException
from superset.commands.logs.prune import LogPruneCommand
from superset.commands.report.exceptions import ReportScheduleUnexpectedError
from superset.commands.report.execute import AsyncExecuteReportScheduleCommand
from superset.commands.report.log_prune import AsyncPruneReportScheduleLogCommand
from superset.commands.sql_lab.query import QueryPruneCommand
from superset.commands.tasks.prune import TaskPruneCommand
from superset.commands.tasks.reap import ReapOrphanedTasksCommand
from superset.daos.report import ReportScheduleDAO
from superset.daos.tasks import TaskDAO
from superset.extensions import celery_app, db
from superset.key_value.commands.prune import KeyValuePruneCommand
from superset.reports.models import ReportScheduleType
from superset.stats_logger import BaseStatsLogger
from superset.tasks.ambient_context import use_context
from superset.tasks.constants import ABORT_STATES, TERMINAL_STATES
from superset.tasks.context import TaskContext
from superset.tasks.cron_util import cron_schedule_window
from superset.tasks.dependencies import (
    DAG_WAITING,
    fail_dependent_on_unmet_prerequisite,
    unmet_prerequisite,
)
from superset.tasks.heartbeat import (
    HeartbeatController,
    SELF_FENCE_ERROR_MESSAGE,
    task_heartbeat,
)
from superset.tasks.manager import TaskManager
from superset.tasks.registry import TaskRegistry
from superset.utils.core import LoggerLevel
from superset.utils.log import get_logger_from_status
from superset.utils.report_execution import get_report_task_timeout_options

if TYPE_CHECKING:
    from superset.models.tasks import Task as TaskModel

logger = logging.getLogger(__name__)


@task_failure.connect
def log_task_failure(  # pylint: disable=unused-argument
    sender: Task | None = None,
    task_id: str | None = None,
    exception: Exception | None = None,
    args: tuple[Any, ...] | None = None,
    kwargs: dict[str, Any] | None = None,
    traceback: Any = None,
    einfo: Any = None,
    **kw: Any,
) -> None:
    task_name = sender.name if sender else "Unknown"
    logger.exception("Celery task %s failed: %s", task_name, exception, exc_info=einfo)


@celery_app.task(
    name="reports.scheduler",
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={
        "max_retries": 3,
        "countdown": 60,
    },  # Retry up to 3 times, wait 60s between
    retry_backoff=True,  # exponential backoff
)
def scheduler(self: Task) -> None:  # pylint: disable=unused-argument
    """
    Celery beat main scheduler for reports
    """
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.scheduler")

    if not is_feature_enabled("ALERT_REPORTS"):
        return
    active_schedules = ReportScheduleDAO.find_active()
    triggered_at = (
        datetime.fromisoformat(scheduler.request.expires)
        - current_app.config["CELERY_BEAT_SCHEDULER_EXPIRES"]
        if scheduler.request.expires
        else datetime.now(tz=timezone.utc)
    )
    for active_schedule in active_schedules:
        for schedule in cron_schedule_window(
            triggered_at, active_schedule.crontab, active_schedule.timezone
        ):
            logger.info("Scheduling alert %s eta: %s", active_schedule.name, schedule)
            async_options = {
                "eta": schedule,
                **get_report_task_timeout_options(
                    is_report=active_schedule.type == ReportScheduleType.REPORT,
                    working_timeout=active_schedule.working_timeout,
                    config=current_app.config,
                ),
            }
            execute.apply_async((active_schedule.id,), **async_options)


@celery_app.task(name="reports.execute", bind=True)
def execute(
    self: Task,
    report_schedule_id: int,
    scheduled_dttm_iso: str | None = None,
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.execute")

    task_id = None
    try:
        task_id = execute.request.id
        # Retry tasks pass the original crontab trigger time so the retry
        # window check can detect whether a new crontab window has fired.
        # Fresh crontab triggers leave scheduled_dttm_iso as None and fall
        # back to request.eta.
        if scheduled_dttm_iso is not None:
            scheduled_dttm = datetime.fromisoformat(scheduled_dttm_iso)
        else:
            eta = execute.request.eta
            if isinstance(eta, str):
                scheduled_dttm = datetime.fromisoformat(eta)
            elif eta is not None:
                scheduled_dttm = eta
            else:
                scheduled_dttm = datetime.now(tz=timezone.utc)
        logger.info(
            "Executing alert/report, task id: %s, scheduled_dttm: %s",
            task_id,
            scheduled_dttm,
        )
        AsyncExecuteReportScheduleCommand(
            task_id,
            report_schedule_id,
            scheduled_dttm,
        ).run()
    except SoftTimeLimitExceeded:
        stats_logger.incr("reports.execute.celery_soft_timeout")
        logger.warning(
            "Alert/report execution hit Celery soft timeout; execution_id=%s "
            "report_schedule_id=%s terminal_reason=celery_soft_timeout",
            task_id,
            report_schedule_id,
            exc_info=True,
        )
        self.update_state(state="FAILURE")
        raise
    except ReportScheduleUnexpectedError:
        logger.exception(
            "An unexpected error occurred while executing the report: %s", task_id
        )
        self.update_state(state="FAILURE")
    except CommandException as ex:
        logger_func, level = get_logger_from_status(ex.status)
        logger_func(
            f"A downstream {level} occurred "
            f"while generating a report: {task_id}. {ex.message}",
            exc_info=True,
        )
        if level == LoggerLevel.EXCEPTION:
            self.update_state(state="FAILURE")


@celery_app.task(name="reports.prune_log")
def prune_log() -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.prune_log")

    try:
        AsyncPruneReportScheduleLogCommand().run()
    except SoftTimeLimitExceeded as ex:
        logger.warning("A timeout occurred while pruning report schedule logs: %s", ex)
    except CommandException:
        logger.exception("An exception occurred while pruning report schedule logs")


@celery_app.task(name="prune_query", bind=True)
def prune_query(
    self: Task, retention_period_days: int | None = None, **kwargs: Any
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_query")

    # TODO: Deprecated: Remove support for passing retention period via options in 6.0
    if retention_period_days is None:
        retention_period_days = prune_query.request.properties.get(
            "retention_period_days"
        )
        logger.warning(
            "Your `prune_query` beat schedule uses `options` to pass the retention "
            "period, please use `kwargs` instead."
        )

    try:
        QueryPruneCommand(retention_period_days).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning queries: %s", ex)


@celery_app.task(name="prune_logs", bind=True)
def prune_logs(
    self: Task,
    retention_period_days: int | None = None,
    max_rows_per_run: int | None = None,
    **kwargs: Any,
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_logs")

    # TODO: Deprecated: Remove support for passing retention period via options in 6.0
    if retention_period_days is None:
        retention_period_days = prune_logs.request.properties.get(
            "retention_period_days"
        )
        logger.warning(
            "Your `prune_logs` beat schedule uses `options` to pass the retention "
            "period, please use `kwargs` instead."
        )

    try:
        LogPruneCommand(retention_period_days, max_rows_per_run).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning logs: %s", ex)


@celery_app.task(name="prune_tasks", bind=True)
def prune_tasks(
    self: Task,
    retention_period_days: int | None = None,
    max_rows_per_run: int | None = None,
    **kwargs: Any,
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_tasks")

    # TODO: Deprecated: Remove support for passing retention period via options in 6.0
    if retention_period_days is None:
        retention_period_days = prune_tasks.request.properties.get(
            "retention_period_days"
        )
        logger.warning(
            "Your `prune_tasks` beat schedule uses `options` to pass the "
            "retention period, please use `kwargs` instead."
        )

    try:
        TaskPruneCommand(retention_period_days, max_rows_per_run).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning async tasks: %s", ex)


@celery_app.task(name="reap_orphaned_tasks", bind=True)
def reap_orphaned_tasks(self: Task, **kwargs: Any) -> None:
    """Recover tasks abandoned by a worker that stopped refreshing its heartbeat.

    Runs on its own (short) beat schedule, separate from ``prune_tasks``: reaping
    wants to detect a dead worker — and cancel its warehouse query — promptly,
    whereas the retention prune is a heavy, infrequent bulk delete.
    """
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reap_orphaned_tasks")

    try:
        ReapOrphanedTasksCommand().run()
    except CommandException as ex:
        logger.exception("An error occurred while reaping orphaned tasks: %s", ex)


@celery_app.task(name="prune_key_value", bind=True)
def prune_key_value(
    self: Task,
    max_rows_per_run: int | None = None,
    **kwargs: Any,
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_key_value")

    try:
        KeyValuePruneCommand(max_rows_per_run).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning the key-value store: %s", ex)


# Non-blocking DAG dependency gate: a dependent picked up before its
# prerequisites are terminal is deferred (Celery retry) rather than parking the
# worker slot. Growing backoff (1s, 3s, 5s… capped) keyed off Celery's per-message
# retry count, with jitter to avoid a thundering herd. The cap stays below
# GTF_ORPHAN_TASK_TIMEOUT so a deferred task never looks abandoned.
_DAG_DEFER_BASE_SECONDS = 1.0
_DAG_DEFER_STEP_SECONDS = 2.0
_DAG_DEFER_MAX_SECONDS = 30.0

# Sentinel: at least one prerequisite is not yet terminal (defer and re-check).
# The DAG decision and the fail action live in superset.tasks.dependencies so the
# Celery and inline paths share one implementation; only the wait action (defer via
# self.retry below vs. block on the coordination signal inline) is path-specific.


def _dag_defer_countdown(retries: int) -> float:
    """Growing, jittered backoff (seconds) for a DAG-deferred task.

    ``retries`` is Celery's per-message retry count (preserved across
    ``self.retry()`` on the same task id), so the backoff needs no persisted
    state. 1s, 3s, 5s, … capped at ``_DAG_DEFER_MAX_SECONDS``, plus up to ~1s of
    jitter so many dependents of the same prerequisite don't wake in lockstep.
    """
    base = min(
        _DAG_DEFER_BASE_SECONDS + retries * _DAG_DEFER_STEP_SECONDS,
        _DAG_DEFER_MAX_SECONDS,
    )
    # Jitter only spreads wake-ups; it is not security-sensitive.
    return base + random.uniform(0, min(base, 1.0))  # noqa: S311


def _persist_celery_task_id(task: "TaskModel", celery_task_id: str | None) -> None:
    """Record the Celery job id on the task so the reaper can revoke it.

    Mutates the in-memory task (so the ``TaskContext`` built later carries the id
    through its property writes) and commits. Written once when the task is
    claimed — after the DAG gate has confirmed the prerequisites are met and
    immediately before the heartbeat/status transition — so the reaper can revoke
    the running job. A task still deferred on prerequisites carries no Celery id
    or heartbeat and is simply re-enqueued rather than reaped. The id is dropped
    on the terminal transition along with the rest of ``properties``, which is
    fine — only ACTIVE tasks are ever reaped.
    """
    if not celery_task_id:
        return
    task.update_framework_private({"celery_task_id": celery_task_id})
    # One-shot write at pickup, outside the lifecycle transaction below.
    db.session.commit()  # pylint: disable=consider-using-transaction


# max_retries=None makes the DAG-defer retries truly unlimited. Celery's
# self.retry(max_retries=None) falls back to the *task's* max_retries attribute
# (default 3), not infinity — so the ceiling has to be lifted here, on the task,
# or a parent that runs longer than a few defer intervals would exhaust retries
# and leave the dependent stuck PENDING. Only the DAG defer path retries; real
# failures go through the FAILURE transition instead.
@celery_app.task(name="tasks.execute", bind=True, max_retries=None)
def execute_task(
    self: Any,  # Celery task instance
    task_uuid: str,
    task_type: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> dict[str, Any]:
    """
    Generic task executor for GTF tasks.

    Loads the task, resolves the DAG gate (deferring via Celery retry while
    prerequisites are pending, rather than blocking a worker slot), records the
    Celery job id, and runs the lifecycle body under a liveness heartbeat that
    spans IN_PROGRESS/ABORTING so the prune cron can revoke and reap it if this
    worker dies. See ``_execute_task_body`` for the lifecycle itself.

    :param task_uuid: UUID of the task to execute
    :param task_type: Type of the task (for registry lookup)
    :param args: Positional arguments for the task function
    :param kwargs: Keyword arguments for the task function
    :returns: Dict with status and task_uuid
    """
    from superset.commands.tasks.internal_update import InternalStatusTransitionCommand

    # Convert string UUID to native UUID (Celery deserializes as string)
    native_uuid = UUID(task_uuid)

    # Internal executor path: load the task Celery was dispatched to run,
    # keyed on the UUID passed at enqueue time, not a user-requested
    # lookup; see TaskFilter for the request-scoped vs. internal-plumbing
    # split. The refreshes below load the same task for the same reason.
    task = TaskDAO.find_one_or_none(uuid=native_uuid, skip_base_filter=True)
    if not task:
        logger.error("Task %s not found in metastore", task_uuid)
        return {"status": "error", "message": "Task not found"}

    # Abort-before-claim: a task aborted while queued or DAG-deferred finalizes
    # here (this also stops the defer loop below from retrying an aborted task).
    if task.status in ABORT_STATES:
        logger.info(
            "Task %s (uuid=%s) was aborted before execution started",
            task_type,
            task_uuid,
        )
        transitioned = InternalStatusTransitionCommand(
            task_uuid=native_uuid,
            new_status=TaskStatus.ABORTED,
            expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
            set_ended_at=True,
        ).run()
        # Wake waiters (websocket-mode chart clients don't poll). Only when this
        # path performed the transition, so a cancel that already published
        # completion for the same task isn't echoed.
        if transitioned:
            TaskManager.publish_completion(native_uuid, TaskStatus.ABORTED.value)
        return {"status": TaskStatus.ABORTED.value, "task_uuid": task_uuid}

    # DAG gate (non-blocking): defer via Celery retry until every prerequisite is
    # terminal, instead of parking this worker slot. Crucially this runs BEFORE
    # _persist_celery_task_id and the heartbeat, so a merely-deferred PENDING task
    # carries no heartbeat and can't be mistaken for abandoned active work by the
    # reaper (which ignores null-heartbeat tasks). all_success semantics: if any
    # prerequisite ended non-success, fail without running (cascades to dependents).
    unmet = unmet_prerequisite(task)
    if unmet is DAG_WAITING:
        countdown = _dag_defer_countdown(self.request.retries)
        current_app.config["STATS_LOGGER"].incr("gtf.task.dag_deferred")
        logger.info(
            "Task %s (uuid=%s) waiting on prerequisites; deferring ~%.0fs "
            "(retry %d) without holding the worker",
            task_type,
            task_uuid,
            countdown,
            self.request.retries,
        )
        # Re-sends the same task id/args/kwargs. self.retry raises the Retry
        # sentinel Celery expects; if it instead fails to publish the replacement
        # message (broker down), that would escape as a non-Retry exception and
        # leave this task PENDING with no heartbeat — unreapable, the same shape as
        # a failed enqueue. So only the Retry sentinel is allowed to propagate;
        # any other error fails the task terminally.
        try:
            raise self.retry(countdown=countdown, max_retries=None)
        except Retry:
            raise
        except Exception:  # noqa: BLE001  pylint: disable=broad-except
            logger.exception(
                "Failed to defer task %s (uuid=%s); failing it so it is not "
                "stranded PENDING",
                task_type,
                task_uuid,
            )
            if InternalStatusTransitionCommand(
                task_uuid=native_uuid,
                new_status=TaskStatus.FAILURE,
                expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
                set_ended_at=True,
                properties={"error_message": "Failed to defer task for execution"},
            ).run():
                TaskManager.publish_completion(native_uuid, TaskStatus.FAILURE.value)
            return {"status": TaskStatus.FAILURE.value, "task_uuid": task_uuid}
    if unmet is not None:
        # A prerequisite ended non-success (unmet is that Task): fail without
        # running the body. The DAG_WAITING sentinel was handled above, so this is
        # a Task. Shared with the inline path via the dependencies helper.
        status = fail_dependent_on_unmet_prerequisite(
            native_uuid, cast("TaskModel", unmet)
        )
        return {"status": status, "task_uuid": task_uuid}

    # Prerequisites satisfied → claim the task and run it under the heartbeat.
    _persist_celery_task_id(task, self.request.id)
    app = current_app._get_current_object()  # noqa: SLF001
    with task_heartbeat(task.id, app) as heartbeat:
        return _execute_task_body(task, native_uuid, task_type, args, kwargs, heartbeat)


def _execute_task_body(  # noqa: C901
    task: "TaskModel",
    native_uuid: UUID,
    task_type: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    heartbeat: "HeartbeatController",
) -> dict[str, Any]:
    """
    Run a claimed GTF task through its lifecycle.

    This body:
    1. Builds context (task + user) and sets ambient context via contextvars
    2. Executes the task function (which accesses context via get_context())
    3. Updates task status throughout lifecycle using atomic conditional updates
    4. Runs cleanup handlers on task end (success/failure/abortion)
    5. Resets context after execution

    The pre-claim abort check and the DAG dependency gate run in ``execute_task``
    before the task is claimed (heartbeat + Celery id), so by here the task is
    ready to run; a concurrent abort in the claim window is still caught by the
    PENDING → IN_PROGRESS transition below. Uses atomic conditional status updates
    to prevent race conditions with concurrent abort operations.
    """
    from superset.commands.tasks.internal_update import InternalStatusTransitionCommand

    task_uuid = str(native_uuid)

    # Atomic transition: PENDING → IN_PROGRESS (set started_at for duration tracking)
    if not InternalStatusTransitionCommand(
        task_uuid=native_uuid,
        new_status=TaskStatus.IN_PROGRESS,
        expected_status=TaskStatus.PENDING,
        set_started_at=True,
    ).run():
        # Status wasn't PENDING - task may have been aborted concurrently
        logger.warning(
            "Task %s (uuid=%s) failed PENDING → IN_PROGRESS transition "
            "(may have been aborted concurrently)",
            task_type,
            task_uuid,
        )
        refreshed = TaskDAO.find_one_or_none(uuid=native_uuid, skip_base_filter=True)
        return {
            "status": refreshed.status if refreshed else "unknown",
            "task_uuid": task_uuid,
        }

    # Update cached status (no DB read needed - we just wrote IN_PROGRESS)
    task.status = TaskStatus.IN_PROGRESS.value

    # Build context from task (includes user who created the task)
    ctx = TaskContext(task)

    # Wire the heartbeat's self-fence to the context: if this worker loses
    # contact with the metastore for longer than the orphan window, fail the
    # task from the inside (cancelling any in-flight query) instead of running
    # work the reaper has already given up on.
    heartbeat.on_fence(lambda: ctx.trigger_self_fence(SELF_FENCE_ERROR_MESSAGE))

    # Start timeout timer if configured (timer starts from execution time)
    if timeout := task.properties_dict.get("timeout"):
        ctx.start_timeout_timer(timeout)
        logger.debug(
            "Started timeout timer for task %s: %d seconds",
            task_uuid,
            timeout,
        )

    try:
        executor_fn = TaskRegistry.get_executor(task_type)

        logger.info(
            "Executing task %s (uuid=%s) with function %s.%s",
            task_type,
            task_uuid,
            executor_fn.__module__,
            executor_fn.__name__,
        )

        # Execute with ambient context (no ctx parameter!)
        with use_context(ctx):
            executor_fn(*args, **kwargs)

        # Mark execution as completed to prevent late abort handlers
        ctx.mark_execution_completed()

        # Determine terminal status based on abort detection
        # Use atomic conditional updates to prevent overwriting concurrent abort
        if ctx.aborting_in_flight:
            # Abort/timeout/self-fence detected - will be handled in finally block
            pass
        else:
            # Normal completion - also allow ABORTING → SUCCESS for late abort
            # (task finished before abort was detected)
            if InternalStatusTransitionCommand(
                task_uuid=native_uuid,
                new_status=TaskStatus.SUCCESS,
                expected_status=[TaskStatus.IN_PROGRESS, TaskStatus.ABORTING],
                set_ended_at=True,
            ).run():
                stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
                stats_logger.incr("gtf.task.success")
                logger.info(
                    "Task %s (uuid=%s) completed successfully", task_type, task_uuid
                )
            else:
                # Transition failed - task was likely already in a terminal state
                logger.info(
                    "Task %s (uuid=%s) completion transition failed "
                    "(task may already be in terminal state)",
                    task_type,
                    task_uuid,
                )

    except Exception as ex:
        # Mark execution as completed to prevent late abort handlers
        ctx.mark_execution_completed()

        # An abort/timeout that actually cancels the work (e.g. an abort handler
        # killing the underlying warehouse query) surfaces here as an exception.
        # That is a successful abort, not a failure: leave the task in ABORTING
        # so the finally block finalizes it as ABORTED/TIMED_OUT/FAILURE. Only a
        # genuine error (no abort in flight) transitions to FAILURE here.
        if ctx.aborting_in_flight:
            logger.info(
                "Task %s (uuid=%s) raised while aborting; finalizing as aborted",
                task_type,
                task_uuid,
            )
        else:
            # Atomic transition to FAILURE (only if still IN_PROGRESS or ABORTING)
            InternalStatusTransitionCommand(
                task_uuid=native_uuid,
                new_status=TaskStatus.FAILURE,
                expected_status=[TaskStatus.IN_PROGRESS, TaskStatus.ABORTING],
                properties=ctx.error_properties(exception=ex),
                set_ended_at=True,
            ).run()

            logger.error(
                "Task %s (uuid=%s) failed with error: %s",
                task_type,
                task_uuid,
                str(ex),
                exc_info=True,
            )

            stats_logger = current_app.config["STATS_LOGGER"]
            stats_logger.incr("gtf.task.failure")

    finally:
        # ALWAYS run cleanup handlers (also stops timeout timer)
        ctx._run_cleanup()

        # Handle abort/timeout/fence terminal transitions
        # Use atomic updates to safely transition ABORTING → terminal state
        if ctx.fence_triggered:
            # Worker lost metastore contact: fail the task (no handover). The
            # status may still be IN_PROGRESS (never became ABORTING if the
            # ABORTING write failed under partition), so accept either.
            InternalStatusTransitionCommand(
                task_uuid=native_uuid,
                new_status=TaskStatus.FAILURE,
                expected_status=[TaskStatus.IN_PROGRESS, TaskStatus.ABORTING],
                properties=ctx.error_properties(error_message=SELF_FENCE_ERROR_MESSAGE),
                set_ended_at=True,
            ).run()
            logger.warning(
                "Task %s (uuid=%s) self-fenced (lost metastore contact) - "
                "marking as FAILURE",
                task_type,
                task_uuid,
            )
        elif ctx._abort_detected or ctx.timeout_triggered:
            if ctx.abort_handlers_completed:
                # All handlers succeeded - determine terminal state based on cause
                if ctx.timeout_triggered:
                    InternalStatusTransitionCommand(
                        task_uuid=native_uuid,
                        new_status=TaskStatus.TIMED_OUT,
                        expected_status=TaskStatus.ABORTING,
                        set_ended_at=True,
                    ).run()
                    logger.info(
                        "Task %s (uuid=%s) timed out and completed cleanup",
                        task_type,
                        task_uuid,
                    )
                else:
                    InternalStatusTransitionCommand(
                        task_uuid=native_uuid,
                        new_status=TaskStatus.ABORTED,
                        expected_status=TaskStatus.ABORTING,
                        set_ended_at=True,
                    ).run()
                    logger.info(
                        "Task %s (uuid=%s) was aborted by user",
                        task_type,
                        task_uuid,
                    )
            else:
                # Handlers didn't complete successfully - mark as FAILURE
                InternalStatusTransitionCommand(
                    task_uuid=native_uuid,
                    new_status=TaskStatus.FAILURE,
                    expected_status=TaskStatus.ABORTING,
                    properties=ctx.error_properties(
                        error_message="Abort handlers did not complete"
                    ),
                    set_ended_at=True,
                ).run()
                logger.warning(
                    "Task %s (uuid=%s) stuck in ABORTING - marking as FAILURE",
                    task_type,
                    task_uuid,
                )

        # Refresh to get final status for return value and completion notification
        refreshed = TaskDAO.find_one_or_none(uuid=native_uuid, skip_base_filter=True)
        final_status = refreshed.status if refreshed else "unknown"

        # Publish completion notification for any waiters (e.g., sync callers)
        if final_status in TERMINAL_STATES:
            TaskManager.publish_completion(native_uuid, final_status)

    return {"status": final_status, "task_uuid": task_uuid}
