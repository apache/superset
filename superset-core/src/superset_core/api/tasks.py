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

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Generic, Literal, ParamSpec, TypedDict, TypeVar

from superset_core.api.models import Task

P = ParamSpec("P")
R = TypeVar("R")


class TaskStatus(str, Enum):
    """
    Status of task execution.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILURE = "failure"
    ABORTING = "aborting"  # Abort/timeout requested, handlers running
    ABORTED = "aborted"  # User/admin cancelled
    TIMED_OUT = "timed_out"  # Timeout expired


class TaskScope(str, Enum):
    """
    Scope of task visibility and access control.
    """

    PRIVATE = "private"  # User-specific tasks (default)
    SHARED = "shared"  # Multi-user collaborative tasks
    SYSTEM = "system"  # Admin-only background tasks


class TaskProperties(TypedDict, total=False):
    """
    TypedDict for task runtime state and execution config.

    Stored as JSON in the database, accessed as a dict throughout the codebase.
    All fields are optional (total=False) - only set keys are present in the dict.

    Usage:
        # Reading - always use .get() since keys may not be present
        if task.properties.get("is_abortable"):
            ...

        # Writing/updating - only include keys you want to set
        task.update_properties({"is_abortable": True, "progress_percent": 0.5})

    Notes:
        - Sparse dict: only keys that are explicitly set are present
        - Unknown keys from JSON are preserved (forward compatibility)
        - Always use .get() for reads since keys may be absent
    """

    # Execution config - set at task creation
    execution_mode: Literal["async", "sync"]
    timeout: int

    # Runtime state - set by framework during execution
    is_abortable: bool
    progress_percent: float
    progress_current: int
    progress_total: int

    # Error info - set when task fails
    error_message: str
    exception_type: str
    stack_trace: str


@dataclass(frozen=True)
class TaskOptions:
    """
    Execution metadata for tasks.

    NOTE: This is intentionally minimal for the initial implementation.
    Additional options (queue, priority, run_at, delay_s,
    max_retries, retry_backoff_s, tags, etc.) can be added later when needed.

    Future enhancements will include:
    - Validation (e.g., run_at vs delay_s mutual exclusion)
    - Queue routing and priority management
    - Retry policies and backoff strategies

    Example:
        from superset_core.api.tasks import TaskOptions, TaskScope

        # Private task (default)
        task = my_task.schedule(arg1)

        # Custom task with deduplication
        task = my_task.schedule(
            arg1,
            options=TaskOptions(
                task_key="custom_key",
                task_name="Custom Task Name"
            )
        )

        # Task with custom name
        task = admin_task.schedule(
            options=TaskOptions(task_name="Admin Operation")
        )

        # Task with timeout (overrides decorator default)
        task = long_task.schedule(
            options=TaskOptions(timeout=600)  # 10 minute timeout
        )
    """

    task_key: str | None = None
    task_name: str | None = None
    timeout: int | None = None  # Timeout in seconds


class TaskContext(ABC):
    """
    Abstract task context for write-only task state updates.

    Tasks use this context to update their state (progress, payload) and
    check for cancellation. Tasks should not need to read their own state -
    they are the source of state, not consumers of it.

    Host implementations will replace this abstract class during initialization
    with a concrete implementation providing actual functionality.
    """

    @abstractmethod
    def update_task(
        self,
        progress: float | int | tuple[int, int] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing data,
        not replaced. All updates occur in a single database transaction.

        Progress can be specified in three ways:
        - float (0.0-1.0): Percentage only, e.g., 0.5 means 50%
        - int: Count only (total unknown), e.g., 42 means "42 items processed"
        - tuple[int, int]: Count and total, e.g., (3, 100) means "3 of 100"
          The percentage is automatically computed from count/total.

        :param progress: Progress value, or None to leave unchanged
        :param payload: Payload data to merge (dict), or None to leave unchanged

        Examples:
            # Percentage only - displays as "In progress: 50 %"
            ctx.update_task(progress=0.5)

            # Count only (total unknown) - displays as "In progress: 42"
            ctx.update_task(progress=42)

            # Count and total - displays as "In progress: 3 of 100 (3 %)"
            ctx.update_task(progress=(3, 100))

            # Update payload only
            ctx.update_task(payload={"step": "processing"})

            # Update both atomically
            ctx.update_task(
                progress=(80, 100),
                payload={"processed": 80, "total": 100}
            )
        """
        ...

    @abstractmethod
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
        ...

    @abstractmethod
    def on_abort(self, handler: Callable[[], None]) -> Callable[[], None]:
        """
        Register handler that runs when task is aborted.

        When the first handler is registered, background polling starts
        automatically. The handler will be called when an abort is detected.

        The handler executes in a background thread and the task code
        continues running unless the handler takes action to stop it.

        :param handler: Callback function to execute when abort is detected
        :returns: The handler (for decorator compatibility)

        Example:
            @ctx.on_abort
            def handle_abort():
                logger.info("Task was aborted!")
                cleanup_partial_work()
        """
        ...


def task(
    name: str | None = None,
    scope: TaskScope = TaskScope.PRIVATE,
    timeout: int | None = None,
) -> Callable[[Callable[P, R]], "TaskWrapper[P]"]:
    """
    Decorator to register a task.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param name: Optional unique task name (e.g., "superset.generate_thumbnail").
                 If not provided, uses the function name as the task name.
    :param scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM).
                  Defaults to TaskScope.PRIVATE.
    :param timeout: Optional timeout in seconds. When the timeout is reached,
                    abort handlers are triggered if registered. Can be overridden
                    at call time via TaskOptions(timeout=...).
    :returns: TaskWrapper with .schedule() method

    Note:
        Both direct calls and .schedule() return Task, regardless of the
        original function's return type. The decorated function's return value
        is discarded; only side effects and context updates matter.

    Example:
        from superset_core.api.tasks import task, get_context, TaskScope

        # Private task (default scope)
        @task
        def generate_thumbnail(chart_id: int) -> None:
            ctx = get_context()
            # ... task implementation

        # Named task with shared scope
        @task(name="generate_report", scope=TaskScope.SHARED)
        def generate_chart_thumbnail(chart_id: int) -> None:
            ctx = get_context()

            # Update progress and payload atomically
            ctx.update_task(
                progress=0.5,
                payload={"chart_id": chart_id, "status": "processing"}
            )
            # ... task implementation

            ctx.update_task(progress=1.0)

        # System task (admin-only)
        @task(scope=TaskScope.SYSTEM)
        def cleanup_old_data() -> None:
            ctx = get_context()
            # ... cleanup implementation

        # Task with timeout
        @task(timeout=300)  # 5-minute timeout
        def long_running_task() -> None:
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                # Called when timeout or manual abort
                pass

        # Schedule async execution
        task = generate_chart_thumbnail.schedule(chart_id=123)  # Returns Task

        # Direct call for sync execution (blocks until task is complete)
        task = generate_chart_thumbnail(chart_id=123)  # Also returns Task
    """
    raise NotImplementedError("Function will be replaced during initialization")


class TaskWrapper(Generic[P]):
    """
    Type stub for task wrapper returned by @task decorator.

    Both __call__ and .schedule() return Task.
    """

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> Task:
        """Execute the task synchronously."""
        raise NotImplementedError("Will be replaced during initialization")

    def schedule(self, *args: P.args, **kwargs: P.kwargs) -> Task:
        """Schedule the task for async execution."""
        raise NotImplementedError("Will be replaced during initialization")


def get_context() -> TaskContext:
    """
    Get the current task context from ambient context.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    This function provides ambient access to the task context without
    requiring it to be passed as a parameter. It can only be called
    from within an async task execution.

    :returns: The current TaskContext
    :raises RuntimeError: If called outside a task execution context

    Example:
        @task("thumbnail_generation")
        def generate_chart_thumbnail(chart_id: int):
            ctx = get_context()  # Access ambient context

            # Update task state - no need to fetch task object
            ctx.update_task(
                progress=0.5,
                payload={"chart_id": chart_id}
            )
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "TaskStatus",
    "TaskScope",
    "TaskProperties",
    "TaskContext",
    "TaskOptions",
    "task",
    "get_context",
]
