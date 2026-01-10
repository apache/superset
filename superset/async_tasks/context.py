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

from superset_core.api.async_tasks import TaskContext as CoreTaskContext, TaskStatus

from superset.daos.async_tasks import AsyncTaskDAO
from superset.extensions import db
from superset.models.async_tasks import AsyncTask
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TaskContext(CoreTaskContext):
    """
    Concrete implementation of TaskContext for the Global Async Task Framework.

    Provides write-only access to task state. Tasks use this context to update
    their progress and payload, and check for cancellation. Tasks should not
    need to read their own state - they are the source of state, not consumers.
    """

    def __init__(self, task_uuid: str) -> None:
        """
        Initialize TaskContext with a task UUID.

        :param task_uuid: The UUID of the AsyncTask this context manages
        """
        self._task_uuid = task_uuid
        self._cleanup_handlers: list[Callable[[], None]] = []

    @property
    def _task(self) -> AsyncTask:
        """
        Internal: Get the latest task entity from the metastore.

        This is an internal property used by the framework. Task implementations
        should use update_task() to modify state, not access this property directly.

        :returns: AsyncTask entity with latest state
        :raises ValueError: If task is not found
        """
        task = AsyncTaskDAO.find_one_or_none(uuid=self._task_uuid)
        if not task:
            raise ValueError(f"Task {self._task_uuid} not found")
        return task

    @transaction()
    def update_task(
        self,
        progress: float | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing data.
        All updates occur in a single database transaction.

        :param progress: Progress value (0.0-1.0), or None to leave unchanged
        :param payload: Payload data to merge (dict), or None to leave unchanged
        """
        task = self._task

        if progress is not None:
            task.progress = progress

        if payload is not None:
            task.set_payload(payload)

        db.session.merge(task)

    def is_aborted(self) -> bool:
        """
        Check if the task has been aborted.

        Returns True if the task status is ABORTED. Fetches fresh state
        from the database to ensure current status.

        :returns: True if task is aborted, False otherwise
        """
        return self._task.status == TaskStatus.ABORTED.value

    def on_cleanup(self, handler: Callable[[], None]) -> Callable[[], None]:
        """
        Register a cleanup handler that runs when the task ends.

        Cleanup handlers are called when the task completes (success),
        fails with an error, or is aborted. Multiple handlers can be
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
        Execute an operation if the task is not aborted.

        Checks abort status before executing the operation. If the
        task is aborted, returns None without executing. Cannot interrupt
        an operation once it has started.

        :param operation: Callable to execute
        :returns: Operation result if not aborted, None if aborted

        Example:
            response = ctx.run(lambda: requests.get(url, timeout=60))
            if response is None:
                return  # Task was aborted
        """
        if self.is_aborted():
            return None
        return operation()
