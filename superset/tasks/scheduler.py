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
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING
from uuid import UUID

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
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


def _resolve_failed_prerequisite(task: "TaskModel") -> "TaskModel | None":
    """
    Return the first direct prerequisite of ``task`` that did not end in ``SUCCESS``,
    blocking until every prerequisite has reached a terminal state.

    Implements the ``all_success`` trigger rule for the task DAG: the task may
    run only if *all* of its direct prerequisites ended in ``SUCCESS``, so a
    non-``None`` return means the dependent must fail.

    ``task.depends_on`` is already ``selectin``-loaded (in one query) with the
    task, so a prerequisite that is *already* terminal in that snapshot is
    evaluated with **no extra database reads** — a terminal status never changes,
    so the snapshot is authoritative for it (the common case under Model A, where
    FIFO enqueue order means parents usually finish before the dependent runs).
    Only prerequisites that are not yet terminal fall through to
    ``TaskManager.wait_for_completion`` (wake-on-completion else poll), and they
    are awaited one at a time (≈1 read/poll-interval total, not per-prerequisite).
    Transitive failure propagation is emergent — a dependent that fails here is
    itself non-SUCCESS, so its own dependents fail in turn.

    :param task: The dependent task about to run (with ``depends_on`` loaded)
    :returns: The first prerequisite that did not end in ``SUCCESS``, or ``None``
        if the task has no prerequisites or all of them succeeded
    """
    prerequisites = list(task.depends_on)
    if not prerequisites:
        return None

    for prerequisite in prerequisites:
        # Trust an already-terminal status from the loaded snapshot (no extra
        # read); otherwise block on a fresh wait until it becomes terminal.
        if prerequisite.status not in TERMINAL_STATES:
            try:
                prerequisite = TaskManager.wait_for_completion(prerequisite.uuid)
            except ValueError:
                # Prerequisite no longer exists (e.g. pruned mid-wait) — treat as
                # a failed prerequisite rather than blocking or crashing.
                return prerequisite
        if prerequisite.status != TaskStatus.SUCCESS.value:
            return prerequisite

    return None


def _persist_celery_task_id(task: "TaskModel", celery_task_id: str | None) -> None:
    """Record the Celery job id on the task so the reaper can revoke it.

    Mutates the in-memory task (so the ``TaskContext`` built later carries the id
    through its property writes) and commits. Written once at pickup, before the
    DAG gate and the status transition, so the reaper can revoke even a task
    still waiting on prerequisites. The id is dropped on the terminal transition
    along with the rest of ``properties``, which is fine — only ACTIVE tasks are
    ever reaped.
    """
    if not celery_task_id:
        return
    task.update_private_properties({"celery_task_id": celery_task_id})
    # One-shot write at pickup, outside the lifecycle transaction below.
    db.session.commit()  # pylint: disable=consider-using-transaction


@celery_app.task(name="tasks.execute", bind=True)
def execute_task(
    self: Any,  # Celery task instance
    task_uuid: str,
    task_type: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> dict[str, Any]:
    """
    Generic task executor for GTF tasks.

    Loads the task, records the Celery job id, and runs the lifecycle body under
    a liveness heartbeat that spans the whole time this worker holds the task
    (DAG wait, IN_PROGRESS, ABORTING) so the prune cron can revoke and reap it if
    this worker dies. See ``_execute_task_body`` for the lifecycle itself.

    :param task_uuid: UUID of the task to execute
    :param task_type: Type of the task (for registry lookup)
    :param args: Positional arguments for the task function
    :param kwargs: Keyword arguments for the task function
    :returns: Dict with status and task_uuid
    """
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
    1. Checks if task was aborted before execution starts
    2. Builds context (task + user) and sets ambient context via contextvars
    3. Executes the task function (which accesses context via get_context())
    4. Updates task status throughout lifecycle using atomic conditional updates
    5. Runs cleanup handlers on task end (success/failure/abortion)
    6. Resets context after execution

    Uses atomic conditional status updates to prevent race conditions with
    concurrent abort operations.
    """
    from superset.commands.tasks.internal_update import InternalStatusTransitionCommand

    task_uuid = str(native_uuid)

    # AUTOMATIC PRE-EXECUTION CHECK: Don't execute if already aborted/aborting
    if task.status in ABORT_STATES:
        logger.info(
            "Task %s (uuid=%s) was aborted before execution started",
            task_type,
            task_uuid,
        )
        # Atomic transition to ABORTED (if not already)
        InternalStatusTransitionCommand(
            task_uuid=native_uuid,
            new_status=TaskStatus.ABORTED,
            expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
            set_ended_at=True,
        ).run()
        return {"status": TaskStatus.ABORTED.value, "task_uuid": task_uuid}

    # DAG gate: wait for prerequisites before claiming the task. The task stays
    # PENDING while waiting, so the "waiting on prerequisites" indicator applies
    # and an abort mid-wait is caught by the PENDING → IN_PROGRESS transition
    # below. If any prerequisite did not succeed, fail without running the body
    # (all_success semantics); the failure then cascades to this task's own
    # dependents.
    if (failed_prerequisite := _resolve_failed_prerequisite(task)) is not None:
        logger.info(
            "Task %s (uuid=%s) failing: prerequisite %s did not succeed (status=%s)",
            task_type,
            task_uuid,
            failed_prerequisite.uuid,
            failed_prerequisite.status,
        )
        failed_transition = InternalStatusTransitionCommand(
            task_uuid=native_uuid,
            new_status=TaskStatus.FAILURE,
            expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
            set_ended_at=True,
            properties={
                "error_message": (
                    f"Prerequisite task {failed_prerequisite.uuid} did not "
                    f"succeed (status={failed_prerequisite.status})"
                )
            },
        ).run()
        if failed_transition:
            TaskManager.publish_completion(native_uuid, TaskStatus.FAILURE.value)
            return {"status": TaskStatus.FAILURE.value, "task_uuid": task_uuid}
        # The dependent was moved to a terminal state concurrently (e.g. aborted
        # while waiting on prerequisites), so the FAILURE transition was a no-op.
        # Report the status that actually committed rather than publishing a
        # FAILURE completion that contradicts the DB.
        refreshed = TaskDAO.find_one_or_none(uuid=native_uuid, skip_base_filter=True)
        return {
            "status": refreshed.status if refreshed else "unknown",
            "task_uuid": task_uuid,
        }

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
        # Get registered executor function
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
                # Emit stats metric for success
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
                properties={"error_message": str(ex)},
                set_ended_at=True,
            ).run()

            logger.error(
                "Task %s (uuid=%s) failed with error: %s",
                task_type,
                task_uuid,
                str(ex),
                exc_info=True,
            )

            # Emit stats metric for failure
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
                properties={"error_message": SELF_FENCE_ERROR_MESSAGE},
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
                    properties={"error_message": "Abort handlers did not complete"},
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
