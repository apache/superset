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

"""
Core types for superset-core.

Provides type definitions for query execution, async task management, and other
core functionality. Query types are partially aligned with frontend types in
superset-ui-core/src/query/types/.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd


class QueryStatus(Enum):
    """
    Status of query execution.
    """

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    STOPPED = "stopped"


@dataclass
class CacheOptions:
    """
    Options for query result caching.
    """

    timeout: int | None = None  # Override default cache timeout (seconds)
    force_refresh: bool = False  # Bypass cache and re-execute query


@dataclass
class QueryOptions:
    """
    Options for query execution via Database.execute() and execute_async().

    Supports customization of:
    - Basic: catalog, schema, limit, timeout
    - Templates: Jinja2 template parameters
    - Caching: Cache timeout and refresh control
    - Dry run: Return transformed SQL without execution
    """

    # Basic options
    catalog: str | None = None
    schema: str | None = None
    limit: int | None = None
    timeout_seconds: int | None = None

    # Template options
    template_params: dict[str, Any] | None = None  # For Jinja2 rendering

    # Caching options
    cache: CacheOptions | None = None

    # Dry run option
    dry_run: bool = False  # Return transformed SQL without executing


@dataclass
class StatementResult:
    """
    Result of a single SQL statement execution.

    For SELECT queries: data contains DataFrame, row_count is len(data)
    For DML queries: data is None, row_count contains affected rows
    """

    original_sql: str  # The SQL statement as submitted by the user
    executed_sql: (
        str  # The SQL statement after transformations (RLS, mutations, limits)
    )
    data: pd.DataFrame | None = None
    row_count: int = 0
    execution_time_ms: float | None = None


@dataclass
class QueryResult:
    """
    Result of a multi-statement query execution.

    On success: statements contains all executed statements
    On failure: statements contains successful statements before failure

    Fields:
        status: Overall query status (SUCCESS or FAILED)
        statements: Results from each executed statement
        query_id: Query model ID for entire execution (None if dry_run=True)
        total_execution_time_ms: Total execution time across all statements
        is_cached: Whether result came from cache
        error_message: Query-level error (e.g., "Statement 2 of 3: error")
    """

    status: QueryStatus
    statements: list[StatementResult] = field(default_factory=list)
    query_id: int | None = None
    total_execution_time_ms: float | None = None
    is_cached: bool = False
    error_message: str | None = None


@dataclass
class AsyncQueryHandle:
    """
    Handle for tracking an asynchronous query.

    Provides methods to check status, retrieve results, and cancel the query.
    The methods are bound to concrete implementations at runtime.

    This is the return type of Database.execute_async().
    """

    query_id: int | None  # None for cached results
    status: QueryStatus = field(default=QueryStatus.PENDING)
    started_at: datetime | None = None

    def get_status(self) -> QueryStatus:
        """
        Get the current status of the async query.

        :returns: Current QueryStatus
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def get_result(self) -> QueryResult:
        """
        Get the result of the async query.

        :returns: QueryResult with data if successful
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def cancel(self) -> bool:
        """
        Cancel the async query.

        :returns: True if cancellation was successful
        """
        raise NotImplementedError("Method will be replaced during initialization")


class TaskStatus(Enum):
    """
    Status of async task execution.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"


# TaskOptions stub - host will provide concrete implementation
# This is a placeholder that will be replaced during initialization
try:
    from dataclasses import dataclass

    @dataclass(frozen=True)
    class TaskOptions:
        """
        Execution metadata for async tasks.

        Host implementations will replace this class during initialization
        with a concrete implementation providing actual functionality.

        Example:
            from superset_core.api.types import TaskOptions

            task = my_task.schedule(
                arg1,
                options=TaskOptions(idempotency_key="custom_key")
            )
        """

        idempotency_key: str | None = None
except ImportError:
    TaskOptions = None  # type: ignore[misc, assignment]


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
    def task(self) -> Any:  # Returns AsyncTask model
        """
        Get the latest task entity from the metastore.

        This property refetches the task from the database each time it's accessed,
        ensuring you always have the most current status (e.g., for cancellation
        checks).

        :returns: AsyncTask entity with latest state
        """
        ...

    @abstractmethod
    def update_task(self, task: Any) -> None:  # Takes AsyncTask model
        """
        Update the task entity in the metastore.

        Use this to persist changes to the task, such as payload updates or
        status changes.

        :param task: AsyncTask entity to update
        """
        ...

    @abstractmethod
    def is_cancelled(self) -> bool:
        """
        Check if the task has been cancelled.

        Returns True if the task status is CANCELLED. Fetches fresh state
        from the database to ensure current status.

        :returns: True if task is cancelled, False otherwise
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
) -> Callable[..., Any]:
    """
    Decorator to register an async task.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param name: Optional unique task name (e.g., "superset.generate_thumbnail").
                 If not provided, uses the function name as the task name.
    :returns: Decorated function with .schedule() method

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
        task = generate_chart_thumbnail.schedule(chart_id=123)
    """
    raise NotImplementedError("Function will be replaced during initialization")


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
    # Query execution types
    "QueryStatus",
    "QueryOptions",
    "QueryResult",
    "StatementResult",
    "AsyncQueryHandle",
    "CacheOptions",
    # Async task types
    "TaskStatus",
    "TaskContext",
    "TaskOptions",
    "async_task",
    "create_async_task",
    "get_context",
]
