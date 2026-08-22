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
"""Task manager for the Global Task Framework (GTF)"""

from __future__ import annotations

import logging
from typing import Any, Callable, TYPE_CHECKING
from uuid import UUID

import redis
from flask import has_app_context
from superset_core.tasks.types import TaskProperties, TaskScope

from superset.tasks.constants import ABORT_STATES, TERMINAL_STATES
from superset.tasks.utils import generate_random_task_key

if TYPE_CHECKING:
    from flask import Flask

    from superset.coordination.types import SignalListener
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class TaskManager:
    """
    Handles task creation, scheduling, and abort notifications.

    The TaskManager is responsible for:
    1. Creating task entries in the metastore (Task model)
    2. Scheduling task execution via Celery
    3. Handling deduplication (returning existing active task if duplicate)
    4. Managing real-time abort notifications (optional)

    Signal delivery is opt-in via DISTRIBUTED_COORDINATION_CONFIG. When configured,
    completion/abort are delivered over Redis Streams; when not, tasks use database
    polling for abort detection and completion waits.
    """

    # Class-level state (initialized once via init_app)
    _channel_prefix: str = "gtf:abort:"
    _completion_channel_prefix: str = "gtf:complete:"
    _initialized: bool = False

    @classmethod
    def init_app(cls, app: Flask) -> None:
        """
        Initialize the TaskManager with Flask app config.

        Redis connection is managed by CacheManager - this just reads channel prefixes.

        :param app: Flask application instance
        """
        if cls._initialized:
            return

        cls._channel_prefix = app.config.get("TASKS_ABORT_CHANNEL_PREFIX", "gtf:abort:")
        cls._completion_channel_prefix = app.config.get(
            "TASKS_COMPLETION_CHANNEL_PREFIX", "gtf:complete:"
        )

        cls._initialized = True

    @classmethod
    def get_abort_channel(cls, task_uuid: UUID) -> str:
        """
        Get the abort channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's abort notifications
        """
        return f"{cls._channel_prefix}{task_uuid}"

    @classmethod
    def publish_abort(cls, task_uuid: UUID) -> bool:
        """
        Signal that the task should abort so any abort listener wakes and re-checks.

        Emits the abort signal through the coordination service (Redis Streams when
        a backend is configured), so an abort listener wakes and re-checks. Best-effort:
        no-op (returns False) when no coordination backend is configured, in which case
        listeners poll the task row instead.

        :param task_uuid: UUID of the task to abort
        :returns: True if the signal was emitted, False if no backend / Redis error
        """
        from superset.coordination.base import CoordinationService

        if not CoordinationService.is_backend_defined():
            return False

        try:
            channel = cls.get_abort_channel(task_uuid)
            CoordinationService.notify(channel, "abort")
            logger.debug("Signalled abort on %s", channel)
            return True
        except redis.RedisError as ex:
            # Best-effort: listeners fall back to polling, so a transient Redis
            # error here is not a correctness problem.
            logger.warning("Failed to signal abort for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def get_completion_channel(cls, task_uuid: UUID) -> str:
        """
        Get the completion channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's completion notifications
        """
        return f"{cls._completion_channel_prefix}{task_uuid}"

    @classmethod
    def publish_completion(cls, task_uuid: UUID, status: str) -> bool:
        """
        Signal task completion so any waiter wakes and re-checks.

        Called when the task reaches a terminal state (SUCCESS, FAILURE, ABORTED,
        TIMED_OUT); wakes waiters (e.g. sync join-and-wait, DAG dependents) through
        the coordination service (Redis Streams when a backend is configured).
        Best-effort: no-op (returns False) when no coordination backend is configured,
        in which case waiters poll the task row instead.

        :param task_uuid: UUID of the completed task
        :param status: Final status of the task
        :returns: True if the signal was emitted, False if no backend / Redis error
        """
        from superset.coordination.base import CoordinationService

        if not CoordinationService.is_backend_defined():
            return False

        try:
            channel = cls.get_completion_channel(task_uuid)
            CoordinationService.notify(channel, status)
            logger.debug("Signalled completion on %s (status=%s)", channel, status)
            return True
        except redis.RedisError as ex:
            # Best-effort: waiters fall back to polling, so a transient Redis
            # error here is not a correctness problem.
            logger.warning("Failed to signal completion for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def wait_for_completion(
        cls,
        task_uuid: UUID,
        timeout: float | None = None,
        poll_interval: float = 1.0,
        app: Any = None,
    ) -> "Task":
        """
        Block until task reaches terminal state.

        Delegates the wake-else-poll orchestration to
        :meth:`CoordinationService.wait_for_signal`; here we only supply the
        completion channel and a metastore predicate that returns the task once it is
        terminal.

        :param task_uuid: UUID of the task to wait for
        :param timeout: Maximum time to wait in seconds (None = no limit)
        :param poll_interval: Interval for database polling (seconds)
        :param app: Flask app for database access
        :returns: Task in terminal state
        :raises TimeoutError: If timeout expires before task completes
        :raises ValueError: If task not found
        """
        from superset.coordination.base import CoordinationService
        from superset.daos.tasks import TaskDAO

        def get_task() -> "Task | None":
            # Reads back the task named by the caller's own task_uuid, not
            # a user-requested lookup; see TaskFilter for the
            # request-scoped vs. internal-plumbing split.
            if app and not has_app_context():
                with app.app_context():
                    return TaskDAO.find_one_or_none(
                        uuid=task_uuid, skip_base_filter=True
                    )
            return TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)

        # Fail fast if the task doesn't exist at all.
        if get_task() is None:
            raise ValueError(f"Task {task_uuid} not found")

        def terminal_task() -> "Task | None":
            task = get_task()
            return task if task and task.status in TERMINAL_STATES else None

        return CoordinationService.wait_for_signal(
            cls.get_completion_channel(task_uuid),
            terminal_task,
            timeout=timeout,
            poll_interval=poll_interval,
        )

    @classmethod
    def listen_for_abort(
        cls,
        task_uuid: UUID,
        callback: Callable[[], None],
        poll_interval: float,
        app: Any = None,
    ) -> "SignalListener":
        """
        Start listening for abort notifications for a task.

        Delegates the pub/sub-wake-else-poll orchestration to
        :meth:`CoordinationService.listen_for_signal`; here we only supply the abort
        channel and an (app-context-aware) abort predicate + callback.

        :param task_uuid: UUID of the task to monitor (native UUID)
        :param callback: Function to call when abort is detected
        :param poll_interval: Interval for database polling (when Redis not configured)
        :param app: Flask app for database access in background thread
        :returns: SignalListener handle to stop listening
        """
        from superset.coordination.base import CoordinationService

        def in_context(fn: Callable[[], Any]) -> Callable[[], Any]:
            # The listener runs in a background thread; DB access needs app context.
            def wrapped() -> Any:
                if app and not has_app_context():
                    with app.app_context():
                        return fn()
                return fn()

            return wrapped

        return CoordinationService.listen_for_signal(
            cls.get_abort_channel(task_uuid),
            check=in_context(lambda: cls._check_abort_status(task_uuid)),
            on_signal=in_context(callback),
            poll_interval=poll_interval,
            name=str(task_uuid),
        )

    @classmethod
    def _check_abort_status(cls, task_uuid: UUID) -> bool:
        """
        Check if task has been aborted via database query.

        :param task_uuid: UUID of the task to check (native UUID)
        :returns: True if task is in ABORTING or ABORTED state
        """
        from superset.daos.tasks import TaskDAO

        # Internal control-flow check on the task the executor is already
        # running, not a user-facing lookup; see TaskFilter.
        task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
        return task is not None and task.status in ABORT_STATES

    @staticmethod
    def submit_task(
        task_type: str,
        task_key: str | None,
        task_name: str | None,
        scope: TaskScope,
        timeout: int | None,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        depends_on: list[Task | UUID | str] | None = None,
    ) -> "Task":
        """
        Create task entry and schedule for async execution.

        Flow:
        1. Generate task_key if not provided (random UUID)
        2. Submit to SubmitTaskCommand which handles locking and create-vs-join
        3. Schedule Celery task ONLY for new tasks (not deduplicated ones)
        4. Return Task model to caller

        The SubmitTaskCommand uses a distributed lock to prevent race conditions,
        returning either a new task or an existing active task with the same key.

        :param task_type: Task type identifier (e.g., "superset.generate_thumbnail")
        :param task_key: Optional deduplication key (None for random UUID)
        :param task_name: Human readable task name
        :param scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM)
        :param timeout: Optional timeout in seconds
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :param depends_on: Optional prerequisite tasks (as Task entities, UUIDs,
            or UUID strings). The task is still enqueued immediately
            (block-and-wait model); ordering is enforced in the scheduler, which
            waits for prerequisites before running the body.
        :returns: Task model representing the scheduled task
        """
        from superset.commands.tasks.submit import SubmitTaskCommand

        if task_key is None:
            task_key = generate_random_task_key()

        # Build properties with execution_mode and timeout
        properties: TaskProperties = {"execution_mode": "async"}
        if timeout:
            properties["timeout"] = timeout

        # Create or join task entry in metastore
        # SubmitTaskCommand handles locking and create-vs-join logic:
        # - Acquires distributed lock on dedup_key
        # - If active task exists: adds subscriber and returns existing task
        #   (is_new=False)
        # - If no active task: creates new task (is_new=True)
        task, is_new = SubmitTaskCommand(
            {
                "task_key": task_key,
                "task_type": task_type,
                "task_name": task_name,
                "scope": scope.value,
                "properties": properties,
                "depends_on": depends_on,
            }
        ).run_with_info()

        # Only schedule Celery task for NEW tasks, not deduplicated ones
        # Deduplicated tasks are already pending or running
        if is_new:
            # Import here to avoid circular dependency
            from superset.tasks.scheduler import execute_task

            # Schedule Celery task for async execution
            execute_task.delay(
                task_uuid=str(task.uuid),
                task_type=task_type,
                args=args,
                kwargs=kwargs,
            )

            logger.debug(
                "Scheduled task %s (uuid=%s) for async execution",
                task_type,
                task.uuid,
            )
        else:
            logger.debug(
                "Joined existing task %s (uuid=%s) - no new Celery task scheduled",
                task_type,
                task.uuid,
            )

        return task
