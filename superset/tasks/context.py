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
import threading
import time
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import current_app
from superset_core.api.tasks import TaskContext as CoreTaskContext, TaskStatus

from superset.extensions import db
from superset.utils.decorators import transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

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

        :param task_uuid: The UUID of the Task this context manages
        """
        self._task_uuid = task_uuid
        self._cleanup_handlers: list[Callable[[], None]] = []
        self._abort_handlers: list[Callable[[], None]] = []
        self._polling_thread: threading.Thread | None = None
        self._polling_active = False
        self._abort_detected = False

        # Store Flask app reference for background thread database access
        # Use _get_current_object() to get actual app, not proxy
        try:
            self._app = current_app._get_current_object()
        except RuntimeError:
            # Handle case where app context isn't available (e.g., tests)
            self._app = None

    @property
    def _task(self) -> "Task":
        """
        Internal: Get the latest task entity from the metastore.

        This is an internal property used by the framework. Task implementations
        should use update_task() to modify state, not access this property directly.

        :returns: Task entity with latest state
        :raises ValueError: If task is not found
        """
        # Lazy import to avoid circular dependencies
        from superset.daos.tasks import TaskDAO

        task = TaskDAO.find_one_or_none(uuid=self._task_uuid)
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

    def on_abort(self, handler: Callable[[], None]) -> Callable[[], None]:
        """
        Register abort handler with automatic background polling.

        When the first handler is registered, background polling starts
        automatically using the configured default interval. The handler
        will be called automatically when an abort is detected.

        :param handler: Callback function to execute when abort is detected
        :returns: The handler (for decorator compatibility)

        Example:
            @ctx.on_abort
            def handle_abort():
                logger.info("Task was aborted!")
                cleanup_partial_work()

        Note:
            The handler executes in a background polling thread when abort
            is detected. The task code continues running unless the handler
            does something to stop it (e.g., raises an exception, modifies
            shared state, etc.)
        """
        self._abort_handlers.append(handler)

        # Auto-start polling when first handler is registered
        if not self._polling_thread:
            interval = current_app.config["TASK_ABORT_POLLING_DEFAULT_INTERVAL"]
            self.start_abort_polling(interval)

        return handler

    def start_abort_polling(self, interval: float | None = None) -> None:
        """
        Start background thread that polls for abort status.

        Usually called automatically when registering an abort handler.
        Can be called explicitly to override the polling interval.

        :param interval: Polling interval in seconds (uses config default if None)
        """
        if self._polling_thread is not None:
            return  # Already polling

        if interval is None:
            interval = current_app.config["TASK_ABORT_POLLING_DEFAULT_INTERVAL"]

        self._polling_active = True
        self._polling_thread = threading.Thread(
            target=self._poll_for_abort,
            args=(interval,),
            daemon=True,
            name=f"abort-poller-{self._task_uuid[:8]}",
        )
        self._polling_thread.start()
        logger.info(
            "Started abort polling for task %s (interval=%ss)",
            self._task_uuid,
            interval,
        )

    def _poll_for_abort(self, interval: float) -> None:
        """Background polling loop - runs in separate thread"""
        while self._polling_active:
            try:
                # Wrap database access in Flask app context
                if self._app:
                    with self._app.app_context():
                        # Check if task is aborted
                        task = self._task
                        if task.status == TaskStatus.ABORTED.value:
                            if not self._abort_detected:
                                self._abort_detected = True
                                logger.info(
                                    "Abort detected for task %s", self._task_uuid
                                )

                                # Trigger abort handlers automatically
                                self._trigger_abort_handlers()
                            break  # Stop polling once aborted
                else:
                    # Fallback without app context (e.g., in tests)
                    # This may fail with RuntimeError, but we log it
                    task = self._task
                    if task.status == TaskStatus.ABORTED.value:
                        if not self._abort_detected:
                            self._abort_detected = True
                            logger.info("Abort detected for task %s", self._task_uuid)
                            self._trigger_abort_handlers()
                        break

                time.sleep(interval)
            except Exception as ex:
                logger.error(
                    "Error in abort polling for task %s: %s",
                    self._task_uuid,
                    str(ex),
                    exc_info=True,
                )
                break

    def _trigger_abort_handlers(self) -> None:
        """Execute all registered abort handlers (called by polling thread)"""
        for handler in reversed(self._abort_handlers):
            try:
                handler()
            except Exception as ex:
                logger.error(
                    "Abort handler failed for task %s: %s",
                    self._task_uuid,
                    str(ex),
                    exc_info=True,
                )

    def stop_abort_polling(self) -> None:
        """Stop the background polling thread"""
        self._polling_active = False
        if self._polling_thread:
            self._polling_thread.join(timeout=2.0)
            self._polling_thread = None

    def _run_cleanup(self) -> None:
        """
        Run cleanup handlers (called by executor in finally block).

        This runs:
        1. Abort handlers if task was aborted (but not yet detected by polling)
        2. All cleanup handlers (always)
        """
        # Stop polling thread
        self.stop_abort_polling()

        # If aborted but handlers haven't run yet, run them now
        # (This catches the case where task ended before polling detected abort)
        if self._app:
            with self._app.app_context():
                task = self._task
                if task.status == TaskStatus.ABORTED.value and not self._abort_detected:
                    self._trigger_abort_handlers()
        else:
            # Fallback without app context
            try:
                task = self._task
                if task.status == TaskStatus.ABORTED.value and not self._abort_detected:
                    self._trigger_abort_handlers()
            except Exception as ex:
                logger.warning(
                    "Could not check abort status during cleanup for task %s: %s",
                    self._task_uuid,
                    str(ex),
                )

        # Always run cleanup handlers
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
