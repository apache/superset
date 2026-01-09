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
"""Decorators for the Global Async Task Framework (GATF)"""

import inspect
import logging
from datetime import datetime
from typing import Callable, Generic, ParamSpec, TypeVar

from superset_core.api.async_tasks import TaskOptions, TaskStatus

from superset.async_tasks.ambient_context import use_context
from superset.async_tasks.context import TaskContext
from superset.async_tasks.manager import TaskManager
from superset.async_tasks.registry import TaskRegistry
from superset.async_tasks.utils import generate_random_task_key
from superset.daos.async_tasks import AsyncTaskDAO
from superset.models.async_tasks import AsyncTask

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def async_task(
    name: str | None = None,
) -> Callable[[Callable[P, R]], "AsyncTaskWrapper[P, R]"]:
    """
    Decorator to register an async task.

    Args:
        name: Optional unique task name (e.g., "superset.generate_thumbnail").
              If not provided, uses the function name as the task name.

    Usage:
        @async_task(name="generate_thumbnail")
        def my_async_func(chart_id: int) -> None:
            ctx = get_context()
            ...  # task name will be "generate_thumbnail"

        # Or with auto-generated name:
        @async_task()
        def generate_thumbnail(chart_id: int) -> None:
            ctx = get_context()
            ...  # task name will be "generate_thumbnail"
    """

    def decorator(func: Callable[P, R]) -> "AsyncTaskWrapper[P, R]":
        # Use function name if no name provided
        task_name = name if name is not None else func.__name__

        # Validate function signature - must not have ctx or options params
        sig = inspect.signature(func)
        forbidden = {"ctx", "options"}
        if any(param in forbidden for param in sig.parameters):
            raise TypeError(
                f"Task function {func.__name__} must not define 'ctx' or "
                "'options' parameters. "
                f"Use get_context() instead for ambient context access."
            )

        # Register task
        TaskRegistry.register(task_name, func)

        # Create wrapper with schedule() method
        wrapper = AsyncTaskWrapper(task_name, func)

        # Preserve signature for introspection
        wrapper.__signature__ = sig  # type: ignore[attr-defined]

        return wrapper

    return decorator


class AsyncTaskWrapper(Generic[P, R]):
    """
    Wrapper for async task functions that provides .schedule() method.

    Direct calls execute synchronously (for testing), .schedule() runs async via Celery.
    """

    def __init__(self, name: str, func: Callable[P, R]) -> None:
        self.name = name
        self.func = func
        self.__name__ = func.__name__
        self.__doc__ = func.__doc__
        self.__module__ = func.__module__

        # Patch schedule.__signature__ to mirror function + options parameter
        # This enables proper IDE support and introspection
        sig = inspect.signature(func)
        params = list(sig.parameters.values())
        # Add keyword-only options parameter
        params.append(
            inspect.Parameter(
                "options",
                inspect.Parameter.KEYWORD_ONLY,
                default=None,
                annotation=TaskOptions | None,
            )
        )
        self.schedule.__func__.__signature__ = sig.replace(  # type: ignore[attr-defined]
            parameters=params, return_annotation=AsyncTask
        )

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> AsyncTask:
        """
        Call the function synchronously.

        This is invoked when you call the decorated function directly:
            task = generate_thumbnail(chart_id)  # Blocks until completion

        Flow:
        1. Create task entry in metastore (PENDING status)
        2. Set ambient context (task + user)
        3. Execute function synchronously in current thread
        4. Return task entity upon success/failure

        Perfect for testing since execution is immediate and in-process.
        Returns the AsyncTask entity in SUCCESS or FAILURE state (blocking).
        """
        # Generate task_id (random UUID - no deduplication in sync mode)
        task_key = generate_random_task_key()

        # Create task entry
        task = AsyncTaskDAO.create_task(
            task_type=self.name,
            task_key=task_key,
            task_name=f"{self.name}:{task_key[:50]}",
        )

        # Build context and execute synchronously
        ctx = TaskContext(task_uuid=task.uuid)

        # Update status to IN_PROGRESS
        task = ctx.task
        task.status = TaskStatus.IN_PROGRESS.value
        task.started_at = datetime.utcnow()
        ctx.update_task(task)

        try:
            # Execute with ambient context
            with use_context(ctx):
                self.func(*args, **kwargs)

            # Update to SUCCESS and return completed task
            task = ctx.task
            task.status = TaskStatus.SUCCESS.value
            task.ended_at = datetime.utcnow()
            ctx.update_task(task)

            logger.debug(
                "Synchronous execution of task %s (uuid=%s) completed successfully",
                self.name,
                task.uuid,
            )

            # Return the completed task entity (not the function result)
            return task

        except Exception as ex:
            # Update to FAILURE and return failed task
            task = ctx.task
            task.status = TaskStatus.FAILURE.value
            task.error_message = str(ex)
            task.ended_at = datetime.utcnow()
            ctx.update_task(task)

            logger.error(
                "Synchronous execution of task %s (uuid=%s) failed: %s",
                self.name,
                task.uuid,
                str(ex),
                exc_info=True,
            )

            # Return the failed task entity (don't re-raise in sync mode)
            return task

    def schedule(self, *args: P.args, **kwargs: P.kwargs) -> AsyncTask:
        """
        Schedule this task for asynchronous execution via Celery.

        The signature mirrors the original task function, with an additional
        keyword-only 'options' parameter for execution metadata.

        Args:
            *args, **kwargs: Business arguments for the task function
            options: Execution options

        Returns:
            AsyncTask model representing the scheduled task (PENDING status)

        Usage:
            # Auto-generated task_key (random UUID, no deduplication):
            task = generate_thumbnail.schedule(chart_id)

            # Custom task_key for task deduplication:
            task = generate_thumbnail.schedule(
                chart_id,
                options=TaskOptions(task_key=f"thumb_{chart_id}")
            )

        Note: Unlike direct calls (__call__), this schedules async execution via Celery.
        The function returns immediately with the AsyncTask model in PENDING status.
        """
        # Extract options from kwargs if present
        options_raw = kwargs.pop("options", None)
        if options_raw is None:
            options = TaskOptions()
        else:
            options = options_raw  # type: ignore[assignment]

        # Extract task_name and task_key from options
        task_name = options.task_name
        task_key = options.task_key

        # Create task entry in metastore and schedule execution
        return TaskManager.submit_task(
            task_type=self.name,
            task_name=task_name,
            task_key=task_key,
            args=args,
            kwargs=kwargs,
        )
