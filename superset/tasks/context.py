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
"""Concrete TaskContext implementation for GTF"""

import logging
import threading
from typing import Callable, TYPE_CHECKING, TypeVar

from flask import current_app
from superset_core.api.tasks import TaskContext as CoreTaskContext, TaskStatus

from superset.tasks.types import TaskProperties
from superset.tasks.utils import progress_update

if TYPE_CHECKING:
    from superset.models.tasks import Task
    from superset.tasks.manager import AbortListener

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
        self._abort_listener: "AbortListener | None" = None
        self._abort_detected = False
        self._abort_handlers_completed = False  # Track if all abort handlers finished

        # Timeout timer state
        self._timeout_timer: threading.Timer | None = None
        self._timeout_triggered = False

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

    def update_task(
        self,
        progress: float | int | tuple[int, int] | None = None,
        payload: dict[str, object] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing data.
        All updates occur in a single database transaction.

        Progress can be specified in three ways:
        - float (0.0-1.0): Percentage only, e.g., 0.5 means 50%
        - int: Count only (total unknown), e.g., 42 means "42 items processed"
        - tuple[int, int]: Count and total, e.g., (3, 100) means "3 of 100"
          The percentage is automatically computed from count/total.

        :param progress: Progress value, or None to leave unchanged
        :param payload: Payload data to merge (dict), or None to leave unchanged
        """
        from superset.commands.tasks.update import UpdateTaskCommand

        # Build properties updates for progress using the helper
        properties: TaskProperties | None = None
        if progress is not None:
            properties = progress_update(progress)
            if not properties:
                # Invalid progress format - progress_update returns empty dict
                logger.warning(
                    "Invalid progress value for task %s: %s "
                    "(expected float, int, or tuple[int, int])",
                    self._task_uuid,
                    progress,
                )
                properties = None

        # Only update if there's something to update
        if properties is not None or payload is not None:
            UpdateTaskCommand(
                self._task_uuid,
                payload=payload,
                properties=properties,
                skip_security_check=True,
            ).run()

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
        Register abort handler with automatic background listening.

        When the first handler is registered:
        1. Sets is_abortable=true in the database (marks task as abortable)
        2. Background abort listener starts automatically (pub/sub or polling)

        The handler will be called automatically when an abort is detected.

        :param handler: Callback function to execute when abort is detected
        :returns: The handler (for decorator compatibility)

        Example:
            @ctx.on_abort
            def handle_abort():
                logger.info("Task was aborted!")
                cleanup_partial_work()

        Note:
            The handler executes in a background thread when abort is detected.
            The task code continues running unless the handler does something
            to stop it (e.g., raises an exception, modifies shared state, etc.)
        """
        is_first_handler = len(self._abort_handlers) == 0
        self._abort_handlers.append(handler)

        if is_first_handler:
            # Mark task as abortable in database
            self._set_abortable()

            # Auto-start abort listener when first handler is registered
            interval = current_app.config["TASK_ABORT_POLLING_DEFAULT_INTERVAL"]
            self._start_abort_listener(interval)

        return handler

    def _set_abortable(self) -> None:
        """Mark the task as abortable (abort handler has been registered)."""
        from superset.commands.tasks.update import UpdateTaskCommand

        UpdateTaskCommand(
            self._task_uuid,
            properties={"is_abortable": True},
            skip_security_check=True,
        ).run()

    def _start_abort_listener(self, interval: float) -> None:
        """
        Start background abort listener via TaskManager.

        Uses Redis pub/sub if available, otherwise falls back to database polling.
        The implementation is encapsulated in TaskManager.
        """
        if self._abort_listener is not None:
            return  # Already listening

        from superset.tasks.manager import TaskManager

        self._abort_listener = TaskManager.listen_for_abort(
            task_uuid=self._task_uuid,
            callback=self._on_abort_detected,
            poll_interval=interval,
            app=self._app,
        )

    def _on_abort_detected(self) -> None:
        """
        Callback invoked by TaskManager when abort is detected.

        Triggers all registered abort handlers.
        """
        if self._abort_detected:
            return  # Already handled

        self._abort_detected = True
        logger.info("Abort detected for task %s", self._task_uuid)
        self._trigger_abort_handlers()

    def start_abort_polling(self, interval: float | None = None) -> None:
        """
        Start background abort listener.

        This method is kept for backwards compatibility. It now delegates
        to _start_abort_listener which uses TaskManager.

        :param interval: Polling interval in seconds (uses config default if None)
        """
        if interval is None:
            interval = current_app.config["TASK_ABORT_POLLING_DEFAULT_INTERVAL"]
        self._start_abort_listener(interval)

    def _trigger_abort_handlers(self) -> None:
        """
        Execute all registered abort handlers (called by polling thread).

        If any handler fails, the task is marked as FAILED instead of ABORTED.
        """
        from superset.commands.tasks.update import UpdateTaskCommand

        handler_failed = False
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
                handler_failed = True
                # Mark task as FAILED since handler threw an exception
                if self._app:
                    with self._app.app_context():
                        UpdateTaskCommand(
                            self._task_uuid,
                            status=TaskStatus.FAILURE.value,
                            properties={
                                "error_message": f"Abort handler failed: {str(ex)}"
                            },
                            skip_security_check=True,
                        ).run()
                break  # Stop processing handlers on first failure

        if not handler_failed:
            self._abort_handlers_completed = True

    def stop_abort_polling(self) -> None:
        """Stop the background abort listener."""
        if self._abort_listener is not None:
            self._abort_listener.stop()
            self._abort_listener = None

    def start_timeout_timer(self, timeout_seconds: int) -> None:
        """
        Start a timeout timer that triggers abort when elapsed.

        Called by execute_task when task transitions to IN_PROGRESS.
        Timer only triggers abort handlers if task is abortable.

        :param timeout_seconds: Timeout duration in seconds
        """
        if self._timeout_timer is not None:
            return  # Already started

        def on_timeout() -> None:
            if self._abort_detected:
                return  # Already aborting

            self._timeout_triggered = True

            # Check if task has abort handler (requires app context)
            if not self._app:
                logger.error(
                    "Timeout fired for task %s but no app context available",
                    self._task_uuid,
                )
                return

            with self._app.app_context():
                from superset.commands.tasks.update import UpdateTaskCommand

                task = self._task
                if task.properties.get("is_abortable", False):
                    logger.info(
                        "Timeout reached for task %s after %d seconds - "
                        "transitioning to ABORTING and triggering abort handlers",
                        self._task_uuid,
                        timeout_seconds,
                    )
                    # Set status to ABORTING (same as user abort)
                    # The executor will determine TIMED_OUT vs FAILURE based on
                    # whether handlers complete successfully
                    UpdateTaskCommand(
                        self._task_uuid,
                        status=TaskStatus.ABORTING.value,
                        properties={"error_message": "Task timed out"},
                        skip_security_check=True,
                    ).run()

                    # Trigger abort handlers for cleanup
                    self._on_abort_detected()
                else:
                    # No abort handler - just log warning
                    logger.warning(
                        "Timeout reached for task %s after %d seconds, but no "
                        "abort handler is registered. Task will continue running.",
                        self._task_uuid,
                        timeout_seconds,
                    )

        self._timeout_timer = threading.Timer(timeout_seconds, on_timeout)
        self._timeout_timer.daemon = True
        self._timeout_timer.start()
        logger.debug(
            "Started timeout timer for task %s: %d seconds",
            self._task_uuid,
            timeout_seconds,
        )

    def stop_timeout_timer(self) -> None:
        """Cancel the timeout timer if running."""
        if self._timeout_timer is not None:
            self._timeout_timer.cancel()
            self._timeout_timer = None

    @property
    def timeout_triggered(self) -> bool:
        """Check if the timeout was triggered."""
        return self._timeout_triggered

    @property
    def abort_handlers_completed(self) -> bool:
        """Check if all abort handlers have completed successfully."""
        return self._abort_handlers_completed

    def _run_cleanup(self) -> None:
        """
        Run cleanup handlers (called by executor in finally block).

        This runs:
        1. Abort handlers if task was aborting/aborted (but not yet detected)
        2. All cleanup handlers (always)
        """
        # Stop abort listener and timeout timer
        self.stop_abort_polling()
        self.stop_timeout_timer()

        # If aborting/aborted but handlers haven't run yet, run them now
        # (This catches the case where task ended before listener detected abort)
        if self._app:
            with self._app.app_context():
                task = self._task
                if (
                    task.status in [TaskStatus.ABORTING.value, TaskStatus.ABORTED.value]
                    and not self._abort_detected
                ):
                    self._trigger_abort_handlers()
        else:
            # Fallback without app context
            try:
                task = self._task
                if (
                    task.status in [TaskStatus.ABORTING.value, TaskStatus.ABORTED.value]
                    and not self._abort_detected
                ):
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
