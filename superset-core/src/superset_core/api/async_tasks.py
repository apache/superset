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
from typing import Any, Callable, Generic, ParamSpec, TypeVar

from superset_core.api.models import AsyncTask

P = ParamSpec("P")
R = TypeVar("R")


class TaskStatus(Enum):
    """
    Status of async task execution.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILURE = "failure"
    ABORTED = "aborted"


@dataclass(frozen=True)
class TaskOptions:
    """
    Execution metadata for async tasks.

    NOTE: This is intentionally minimal for the initial implementation.
    Additional options (queue, priority, run_at, delay_s, timeout_s,
    max_retries, retry_backoff_s, tags, etc.) can be added later when needed.

    Future enhancements will include:
    - Options merging (decorator defaults + call-time overrides)
    - Validation (e.g., run_at vs delay_s mutual exclusion)
    - Queue routing and priority management
    - Retry policies and backoff strategies

    Example:
        from superset_core.api.async_tasks import TaskOptions

        task = my_task.schedule(
            arg1,
            options=TaskOptions(task_key="custom_key")
        )
    """

    task_key: str | None = None
    task_name: str | None = None


class TaskContext(ABC):
    """
    Abstract task context for interaction with the async task framework.

    Tasks receive a TaskContext object as their first parameter, which provides
    access to the task entity and methods to update it in the metastore.

    The context fetches the latest task state from the database on each access,
    enabling tasks to check for cancellation and other status changes.

    Host implementations will replace this abstract class during initialization
    with a concrete implementation providing actual functionality.
    """

    @property
    @abstractmethod
    def task(self) -> AsyncTask:
        """
        Get the latest task entity from the metastore.

        This property refetches the task from the database each time it's accessed,
        ensuring you always have the most current status (e.g., for cancellation
        checks).

        :returns: AsyncTask entity with latest state
        """
        ...

    @abstractmethod
    def update_task(self, task: TaskContext) -> None:
        """
        Update the task entity in the metastore.

        Use this to persist changes to the task, such as payload updates or
        status changes.

        :param task: AsyncTask entity to update
        """
        ...

    @abstractmethod
    def is_aborted(self) -> bool:
        """
        Check if the task has been aborted.

        Returns True if the task status is ABORTED. Fetches fresh state
        from the database to ensure current status.

        :returns: True if task is aborted, False otherwise
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
    def run(self, operation: Callable[..., Any]) -> Any:
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
        ...

    @abstractmethod
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
        ...


def async_task(
    name: str | None = None,
) -> Callable[[Callable[P, R]], "AsyncTaskWrapper[P]"]:
    """
    Decorator to register an async task.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param name: Optional unique task name (e.g., "superset.generate_thumbnail").
                 If not provided, uses the function name as the task name.
    :returns: AsyncTaskWrapper with .schedule() method

    Note:
        Both direct calls and .schedule() return AsyncTask, regardless of the
        original function's return type. The decorated function's return value
        is discarded; only side effects and context updates matter.

    Example:
        from superset_core.api.types import async_task, get_context

        @async_task(name="generate_thumbnail")
        def generate_chart_thumbnail(chart_id: int) -> None:
            ctx = get_context()  # Access ambient context
            task = ctx.task
            task.set_payload({"chart_id": chart_id})
            ctx.update_task(task)
            # ... task implementation

        # Schedule async execution
        task = generate_chart_thumbnail.schedule(chart_id=123)  # Returns AsyncTask

        # Direct call (for testing)
        task = generate_chart_thumbnail(chart_id=123)  # Also returns AsyncTask
    """
    raise NotImplementedError("Function will be replaced during initialization")


class AsyncTaskWrapper(Generic[P]):
    """
    Type stub for async task wrapper returned by @async_task decorator.

    Both __call__ and .schedule() return AsyncTask.
    """

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> AsyncTask:
        """Call the task synchronously (for testing)."""
        raise NotImplementedError("Will be replaced during initialization")

    def schedule(self, *args: P.args, **kwargs: P.kwargs) -> AsyncTask:
        """Schedule the task for async execution."""
        raise NotImplementedError("Will be replaced during initialization")


def create_async_task(
    task_type: str,
    task_id: str,
    executor: Callable[..., Any],
    task_name: str | None = None,
    **executor_kwargs: Any,
) -> Any:  # Returns AsyncTask model
    """
    Create and submit an async task directly.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param task_type: Type of task to execute
    :param task_id: Unique identifier for deduplication
    :param executor: Task executor function
    :param task_name: Human-readable task name
    :param executor_kwargs: Arguments to pass to executor
    :returns: AsyncTask model instance

    Example:
        task = create_async_task(
            task_type="thumbnail_generation",
            task_id="thumbnail_chart_123",
            executor=generate_chart_thumbnail,
            chart_id=123
        )
    """
    raise NotImplementedError("Function will be replaced during initialization")


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
        @async_task("thumbnail_generation")
        def generate_chart_thumbnail(chart_id: int):
            ctx = get_context()  # Access ambient context
            task = ctx.task
            task.set_payload({"chart_id": chart_id})
            ctx.update_task(task)
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "TaskStatus",
    "TaskContext",
    "TaskOptions",
    "async_task",
    "create_async_task",
    "get_context",
]
