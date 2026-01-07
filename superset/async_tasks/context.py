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
"""Concrete TaskContext implementation for GATF"""

import logging
from typing import Any, Callable, TypeVar

from superset_core.api.types import TaskContext as CoreTaskContext, TaskStatus

from superset.daos.async_tasks import AsyncTaskDAO
from superset.extensions import db
from superset.models.async_tasks import AsyncTask
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TaskContext(CoreTaskContext):
    """
    Concrete implementation of TaskContext for the Global Async Task Framework.

    Tasks receive a TaskContext as their first parameter, which provides access
    to the task entity and methods to update it in the metastore.

    The context fetches the latest task state from the database on each access,
    enabling tasks to check for cancellation and other status changes.
    """

    def __init__(self, task_uuid: str) -> None:
        """
        Initialize TaskContext with a task UUID.

        :param task_uuid: The UUID of the AsyncTask this context manages
        """
        self._task_uuid = task_uuid
        self._cleanup_handlers: list[Callable[[], None]] = []

    @property
    def task(self) -> AsyncTask:
        """
        Get the latest task entity from the metastore.

        This property refetches the task from the database each time it's accessed,
        ensuring you always have the most current status (e.g., for cancellation
        checks).

        :returns: AsyncTask entity with latest state
        :raises ValueError: If task is not found
        """
        task = AsyncTaskDAO.find_one_or_none(uuid=self._task_uuid)
        if not task:
            raise ValueError(f"Task {self._task_uuid} not found")
        return task

    @transaction()
    def update_task(self, task: AsyncTask) -> None:
        """
        Update the task entity in the metastore.

        Use this to persist changes to the task, such as payload updates or status
        changes.

        :param task: AsyncTask entity to update
        """
        db.session.merge(task)

    def is_cancelled(self) -> bool:
        """
        Check if the task has been cancelled.

        Returns True if the task status is CANCELLED. Fetches fresh state
        from the database to ensure current status.

        :returns: True if task is cancelled, False otherwise
        """
        task = self.task
        return task.status == TaskStatus.CANCELLED.value

    def on_cleanup(self, handler: Callable[[], None]) -> Callable[[], None]:
        """
        Register a cleanup handler that runs when the task ends.

        Cleanup handlers are called when the task completes (success),
        fails with an error, or is cancelled. Multiple handlers can be
        registered and will execute in LIFO order (last registered runs first).

        Can be used as a decorator:
            @ctx.on_cleanup
            def cleanup():
                logger.info("Task ended")

        Or called directly:
            ctx.on_cleanup(lambda: logger.info("Task ended"))

        :param handler: Cleanup function to register
        :returns: The handler (for decorator compatibility)
        """
        self._cleanup_handlers.append(handler)
        return handler

    def _run_cleanup(self) -> None:
        """
        Run all cleanup handlers in reverse order.

        Internal method called by the framework when task execution ends.
        Handlers are executed in LIFO order (last registered runs first).
        Errors in handlers are logged but don't stop execution of other handlers.
        """
        for handler in reversed(self._cleanup_handlers):
            try:
                handler()
            except Exception as ex:
                logger.error(
                    "Cleanup handler failed for task %s: %s",
                    self._task_uuid,
                    str(ex),
                    exc_info=True,
                )

    def run(self, operation: Callable[[], T]) -> T | None:
        """
        Execute an operation if the task is not cancelled.

        Checks cancellation status before executing the operation. If the
        task is cancelled, returns None without executing. Cannot interrupt
        an operation once it has started.

        :param operation: Callable to execute
        :returns: Operation result if not cancelled, None if cancelled

        Example:
            response = ctx.run(lambda: requests.get(url, timeout=60))
            if response is None:
                return  # Task was cancelled
        """
        if self.is_cancelled():
            return None
        return operation()

    @transaction()
    def update_progress(self, current: int, total: int, **extra: Any) -> bool:
        """
        Update task progress and check for cancellation.

        Convenience method that combines progress update with cancellation check.
        Updates the task payload with progress information and returns whether
        execution should continue.

        :param current: Current progress value
        :param total: Total expected value
        :param extra: Additional payload fields to update
        :returns: True if should continue, False if cancelled

        Example:
            for i, item in enumerate(items):
                if not ctx.update_progress(i + 1, len(items)):
                    return  # Cancelled
                process(item)
        """
        if self.is_cancelled():
            return False

        task = self.task
        task.set_payload(
            {
                "progress": f"{current}/{total}",
                "progress_pct": (current / total * 100) if total > 0 else 0,
                **extra,
            }
        )
        db.session.merge(task)
        return True
