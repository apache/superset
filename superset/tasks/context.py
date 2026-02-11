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
import time
import traceback
from typing import Any, Callable, cast, TYPE_CHECKING, TypeVar

from flask import current_app
from superset_core.api.tasks import (
    TaskContext as CoreTaskContext,
    TaskProperties,
    TaskStatus,
)

from superset.stats_logger import BaseStatsLogger
from superset.tasks.constants import ABORT_STATES
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

    # Type alias for handler failures: (handler_type, exception, stack_trace)
    HandlerFailure = tuple[str, Exception, str]

    def __init__(self, task: "Task") -> None:
        """
        Initialize TaskContext with a pre-fetched task entity.

        The task entity must be pre-fetched by the caller (executor) to ensure
        caching works correctly and to enforce the pattern of single initial fetch.

        :param task: Pre-fetched Task entity (required)
        """
        self._task_uuid = task.uuid
        self._cleanup_handlers: list[Callable[[], None]] = []
        self._abort_handlers: list[Callable[[], None]] = []
        self._abort_listener: "AbortListener | None" = None
        self._abort_detected = False
        self._abort_handlers_completed = False  # Track if all abort handlers finished
        self._execution_completed = False  # Set by executor after task work completes

        # Collected handler failures for unified reporting
        self._handler_failures: list[TaskContext.HandlerFailure] = []

        # Timeout timer state
        self._timeout_timer: threading.Timer | None = None
        self._timeout_triggered = False

        # Throttling state for update_task()
        # These manage the minimum interval between DB writes
        self._last_db_write_time: float | None = None
        self._has_pending_updates: bool = False
        self._deferred_flush_timer: threading.Timer | None = None
        self._throttle_lock = threading.Lock()

        # Cached task entity - avoids repeated DB fetches.
        # Updated only by _refresh_task() when checking external state changes.
        self._task: "Task" = task

        # In-memory state caches - authoritative during execution
        # These are initialized from the task entity and updated locally
        # before being written to DB via targeted SQL updates.
        # We copy the dicts to avoid mutating the Task's cached instances.
        self._properties_cache: TaskProperties = cast(
            TaskProperties, {**task.properties_dict}
        )
        self._payload_cache: dict[str, Any] = {**task.payload_dict}

        # Store Flask app reference for background thread database access
        # Use _get_current_object() to get actual app, not proxy
        try:
            self._app = current_app._get_current_object()
            # Cache stats logger to avoid repeated config lookups
            self._stats_logger: BaseStatsLogger = current_app.config.get(
                "STATS_LOGGER", BaseStatsLogger()
            )
        except RuntimeError:
            # Handle case where app context isn't available (e.g., tests)
            self._app = None
            self._stats_logger = BaseStatsLogger()

    def _refresh_task(self) -> "Task":
        """
        Force refresh the task entity from the database.

        Use this method when you need to check for external state changes,
        such as whether the task has been aborted by a concurrent operation.

        This method:
        - Fetches fresh task entity from database
        - Updates the cached _task reference
        - Updates properties/payload caches from fresh data

        :returns: Fresh task entity from database
        :raises ValueError: If task is not found
        """
        from superset.daos.tasks import TaskDAO

        fresh_task = TaskDAO.find_one_or_none(uuid=self._task_uuid)
        if not fresh_task:
            raise ValueError(f"Task {self._task_uuid} not found")

        self._task = fresh_task

        # Update caches from fresh data (copy to avoid mutating Task's cache)
        self._properties_cache = cast(TaskProperties, {**fresh_task.properties_dict})
        self._payload_cache = {**fresh_task.payload_dict}

        return self._task

    def update_task(
        self,
        progress: float | int | tuple[int, int] | None = None,
        payload: dict[str, object] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing cached data.
        In-memory caches are always updated immediately, but DB writes are
        throttled according to TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL to prevent
        excessive database load from eager tasks.

        Progress can be specified in three ways:
        - float (0.0-1.0): Percentage only, e.g., 0.5 means 50%
        - int: Count only (total unknown), e.g., 42 means "42 items processed"
        - tuple[int, int]: Count and total, e.g., (3, 100) means "3 of 100"
          The percentage is automatically computed from count/total.

        :param progress: Progress value, or None to leave unchanged
        :param payload: Payload data to merge (dict), or None to leave unchanged
        """
        has_updates = False

        # Handle progress updates - always update in-memory cache
        if progress is not None:
            progress_props = progress_update(progress)
            if progress_props:
                # Merge progress into cached properties
                self._properties_cache.update(progress_props)
                has_updates = True
            else:
                # Invalid progress format - progress_update returns empty dict
                logger.warning(
                    "Invalid progress value for task %s: %s "
                    "(expected float, int, or tuple[int, int])",
                    self._task_uuid,
                    progress,
                )

        # Handle payload updates - always update in-memory cache
        if payload is not None:
            # Merge payload into cached payload
            self._payload_cache.update(payload)
            has_updates = True

        if not has_updates:
            return

        # Get throttle interval from config
        throttle_interval = current_app.config["TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL"]

        # If throttling is disabled (0), write immediately
        if throttle_interval <= 0:
            self._write_to_db()
            return

        # Apply throttling with deferred flush
        with self._throttle_lock:
            now = time.time()

            if self._last_db_write_time is None:
                # First update - write immediately
                self._write_to_db()
                self._last_db_write_time = now
            elif now - self._last_db_write_time >= throttle_interval:
                # Throttle window has passed - write immediately
                self._cancel_deferred_flush_timer()
                self._write_to_db()
                self._last_db_write_time = now
                self._has_pending_updates = False
            else:
                # Within throttle window - defer the write
                self._has_pending_updates = True
                self._stats_logger.incr("gtf.task.update_deferred")

                # Start deferred flush timer if not already running
                if self._deferred_flush_timer is None:
                    remaining_time = throttle_interval - (
                        now - self._last_db_write_time
                    )
                    self._deferred_flush_timer = threading.Timer(
                        remaining_time, self._deferred_flush
                    )
                    self._deferred_flush_timer.daemon = True
                    self._deferred_flush_timer.start()

    def _write_to_db(self) -> None:
        """
        Write current cached state to database.

        This method performs the actual DB write using InternalUpdateTaskCommand.
        It writes whatever is in the caches at the time of the call.
        """
        from superset.commands.tasks.internal_update import InternalUpdateTaskCommand

        self._stats_logger.incr("gtf.task.update_write")

        InternalUpdateTaskCommand(
            task_uuid=self._task_uuid,
            properties=self._properties_cache,
            payload=self._payload_cache,
        ).run()

    def _deferred_flush(self) -> None:
        """
        Timer callback that flushes pending updates at end of throttle window.

        This ensures the UI never shows stale progress for longer than the
        throttle interval.
        """
        with self._throttle_lock:
            self._deferred_flush_timer = None

            if self._has_pending_updates:
                # Need app context for DB operations in timer thread
                if self._app:
                    with self._app.app_context():
                        self._write_to_db()
                else:
                    self._write_to_db()

                self._last_db_write_time = time.time()
                self._has_pending_updates = False

    def _cancel_deferred_flush_timer(self) -> None:
        """Cancel the deferred flush timer if running."""
        if self._deferred_flush_timer is not None:
            self._deferred_flush_timer.cancel()
            self._deferred_flush_timer = None

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
        from superset.commands.tasks.internal_update import InternalUpdateTaskCommand

        # Update local cache and write to DB
        self._properties_cache["is_abortable"] = True
        InternalUpdateTaskCommand(
            task_uuid=self._task_uuid,
            properties=self._properties_cache,
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

        # Check if task execution has already completed (late abort race).
        # Executor sets _execution_completed after task work finishes.
        if self._execution_completed:
            logger.info(
                "Abort detected for task %s but execution already completed",
                self._task_uuid,
            )
            return

        self._abort_detected = True
        logger.info("Abort detected for task %s", self._task_uuid)
        self._trigger_abort_handlers()

    def mark_execution_completed(self) -> None:
        """
        Mark that the task's main execution has completed.

        Called by the executor after the task function returns (successfully
        or with an exception). This prevents late abort callbacks from running
        handlers when the task work has already finished. Cleanup handlers
        still run after this is set.
        """
        self._execution_completed = True

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
        Execute all registered abort handlers (called by polling thread or cleanup).

        All handlers are attempted even if some fail (best-effort cleanup).
        Failures are collected in self._handler_failures for unified reporting.

        Note: This method never writes to DB directly. All failures are collected
        and written by _run_cleanup() in the executor's finally block, ensuring
        abort and cleanup handler failures are combined into a single record.
        """
        for handler in reversed(self._abort_handlers):
            try:
                handler()
            except Exception as ex:
                stack_trace = traceback.format_exc()
                logger.error(
                    "Abort handler failed for task %s: %s",
                    self._task_uuid,
                    str(ex),
                    exc_info=True,
                )
                self._handler_failures.append(("abort", ex, stack_trace))

        # Check if all abort handlers completed successfully
        abort_failures = [f for f in self._handler_failures if f[0] == "abort"]
        if not abort_failures:
            self._abort_handlers_completed = True

    def _write_handler_failures_to_db(self) -> None:
        """
        Write collected handler failures to the database.

        Combines all failures (abort + cleanup) into a single error record.
        If the task already has an error (e.g., task function threw exception),
        handler failures are APPENDED to preserve the original error context.
        """
        from superset.commands.tasks.update import UpdateTaskCommand

        if not self._handler_failures:
            return

        # Build error message from all handler failures
        error_messages = [str(ex) for _, ex, _ in self._handler_failures]
        handler_types = {htype for htype, _, _ in self._handler_failures}

        if len(self._handler_failures) == 1:
            htype, ex, handler_stack_trace = self._handler_failures[0]
            handler_error_msg = (
                f"{htype.capitalize()} handler failed: {error_messages[0]}"
            )
            handler_exception_type = type(ex).__name__
        else:
            # Multiple failures
            handler_error_msg = f"Handler(s) failed: {'; '.join(error_messages)}"
            if handler_types == {"abort"}:
                handler_exception_type = "MultipleAbortHandlerFailures"
            elif handler_types == {"cleanup"}:
                handler_exception_type = "MultipleCleanupHandlerFailures"
            else:
                handler_exception_type = "MultipleHandlerFailures"

            # Combine stack traces with clear separators
            handler_stack_trace = "\n--- Next handler failure ---\n".join(
                f"[{htype}:{type(ex).__name__}]\n{trace}"
                for htype, ex, trace in self._handler_failures
            )

        if self._app:
            with self._app.app_context():
                # Check if task already has an error (preserve original context)
                task = self._task
                original_error = task.properties_dict.get("error_message")
                original_type = task.properties_dict.get("exception_type")
                original_trace = task.properties_dict.get("stack_trace")

                if original_error:
                    # Append handler failures to original error
                    error_msg = f"{original_error} | {handler_error_msg}"
                    exception_type = (
                        f"{original_type}+{handler_exception_type}"
                        if original_type
                        else handler_exception_type
                    )
                    stack_trace = (
                        f"{original_trace}\n\n"
                        f"=== Handler failures during cleanup ===\n\n"
                        f"{handler_stack_trace}"
                        if original_trace
                        else handler_stack_trace
                    )
                else:
                    # No original error, just use handler failures
                    error_msg = handler_error_msg
                    exception_type = handler_exception_type
                    stack_trace = handler_stack_trace

                # Update task with combined error info
                UpdateTaskCommand(
                    self._task_uuid,
                    status=TaskStatus.FAILURE.value,
                    properties={
                        "error_message": error_msg,
                        "exception_type": exception_type,
                        "stack_trace": stack_trace,
                    },
                    skip_security_check=True,
                ).run()

        # Clear failures after writing
        self._handler_failures = []

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
                if task.properties_dict.get("is_abortable", False):
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
        # Timer is daemon so it won't prevent process exit. If the worker dies,
        # the task is already in an inconsistent state (stuck IN_PROGRESS) that
        # requires external recovery (orphan detection). A non-daemon timer with
        # long timeouts (hours) would block graceful worker shutdown.
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
        1. Flushes any pending throttled updates to ensure final state is persisted
        2. Abort handlers if task was aborting/aborted (but not yet detected)
        3. All cleanup handlers (always)

        All handler failures (abort + cleanup) are collected and written to DB
        as a unified error record at the end.
        """
        # Flush any pending throttled updates before cleanup
        with self._throttle_lock:
            self._cancel_deferred_flush_timer()
            if self._has_pending_updates:
                self._write_to_db()
                self._has_pending_updates = False

        # Stop abort listener and timeout timer
        self.stop_abort_polling()
        self.stop_timeout_timer()

        # If aborting/aborted but handlers haven't run yet, run them now
        # (This catches the case where task ended before listener detected abort)
        if self._app:
            with self._app.app_context():
                task = self._task
                if task.status in ABORT_STATES and not self._abort_detected:
                    self._trigger_abort_handlers()
        else:
            # Fallback without app context
            try:
                task = self._task
                if task.status in ABORT_STATES and not self._abort_detected:
                    self._trigger_abort_handlers()
            except Exception as ex:
                logger.warning(
                    "Could not check abort status during cleanup for task %s: %s",
                    self._task_uuid,
                    str(ex),
                )

        # Always run cleanup handlers, collecting failures
        for handler in reversed(self._cleanup_handlers):
            try:
                handler()
            except Exception as ex:
                stack_trace = traceback.format_exc()
                logger.error(
                    "Cleanup handler failed for task %s: %s",
                    self._task_uuid,
                    str(ex),
                    exc_info=True,
                )
                self._handler_failures.append(("cleanup", ex, stack_trace))

        # Write all collected failures (abort + cleanup) to DB as unified record
        if self._handler_failures:
            self._write_handler_failures_to_db()
