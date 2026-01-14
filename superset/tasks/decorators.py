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
"""Decorators for the Global Task Framework (GTF)"""

import inspect
import logging
from datetime import datetime, timezone
from typing import Callable, Generic, ParamSpec, TYPE_CHECKING, TypeVar

from superset_core.api.tasks import TaskOptions, TaskScope, TaskStatus

from superset.tasks.ambient_context import use_context
from superset.tasks.context import TaskContext
from superset.tasks.manager import TaskManager
from superset.tasks.registry import TaskRegistry
from superset.tasks.utils import generate_random_task_key

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def task(
    name: str | None = None,
    options: TaskOptions | None = None,
) -> Callable[[Callable[P, R]], "TaskWrapper[P]"]:
    """
    Decorator to register a task with default options.

    Args:
        name: Optional unique task name (e.g., "superset.generate_thumbnail").
              If not provided, uses the function name as the task name.
        options: Default TaskOptions for this task (scope, etc.).
                 Callers can override these when scheduling the task.

    Usage:
        # Private task (default scope)
        @task(name="generate_thumbnail")
        def my_async_func(chart_id: int) -> None:
            ctx = get_context()
            ...

        # Shared task (multiple users can subscribe)
        @task(
            name="generate_report",
            options=TaskOptions(scope=TaskScope.SHARED)
        )
        def generate_expensive_report(report_id: int) -> None:
            ctx = get_context()
            ...

        # System task (admin-only)
        @task(
            name="cleanup_old_data",
            options=TaskOptions(scope=TaskScope.SYSTEM)
        )
        def cleanup_task() -> None:
            ctx = get_context()
            ...

    Note:
        Both direct calls and .schedule() return Task, regardless of the
        original function's return type. The decorated function's return value
        is discarded; only side effects and context updates matter.
    """

    def decorator(func: Callable[P, R]) -> "TaskWrapper[P]":
        # Use function name if no name provided
        task_name = name if name is not None else func.__name__

        # Use default options if not provided
        default_options = options if options is not None else TaskOptions()

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

        # Create wrapper with schedule() method and default options
        wrapper = TaskWrapper(task_name, func, default_options)

        # Preserve signature for introspection
        wrapper.__signature__ = sig  # type: ignore[attr-defined]

        return wrapper

    return decorator


class TaskWrapper(Generic[P]):
    """
    Wrapper for task functions that provides .schedule() method.

    Both direct calls and .schedule() return Task. The original function's
    return value is discarded.

    Direct calls execute synchronously, .schedule() runs async via Celery.
    """

    def __init__(
        self, name: str, func: Callable[P, R], default_options: TaskOptions
    ) -> None:
        self.name = name
        self.func = func
        self.default_options = default_options
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
            parameters=params, return_annotation="Task"
        )

    def _merge_options(self, override_options: TaskOptions | None) -> TaskOptions:
        """
        Merge decorator defaults with call-time overrides.

        Call-time options take precedence over decorator defaults.

        Args:
            override_options: Options provided at call time, or None

        Returns:
            Merged TaskOptions with overrides applied
        """
        if override_options is None:
            return self.default_options

        # Merge: use override if provided, otherwise use default
        return TaskOptions(
            task_key=override_options.task_key or self.default_options.task_key,
            task_name=override_options.task_name or self.default_options.task_name,
            scope=override_options.scope
            if override_options.scope != TaskScope.PRIVATE
            else self.default_options.scope,
        )

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> "Task":
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
        Returns the Task entity in SUCCESS or FAILURE state (blocking).
        """
        # Extract and merge options (decorator defaults + call-time overrides)
        override_options: TaskOptions | None = kwargs.pop("options", None)  # type: ignore[assignment]
        options = self._merge_options(override_options)

        # Extract task_name, task_key, and scope from merged options
        task_name = (
            options.task_name or f"{self.name}:{generate_random_task_key()[:50]}"
        )
        task_key = options.task_key or generate_random_task_key()
        scope = TaskScope(options.scope)  # Convert string to TaskScope enum

        # Create task entry
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        task = TaskDAO.create_task(
            task_type=self.name,
            task_key=task_key,
            task_name=task_name,
            scope=scope.value,
        )

        # Build context and execute synchronously
        ctx = TaskContext(task_uuid=task.uuid)

        # Update status to IN_PROGRESS
        task = ctx._task
        task.status = TaskStatus.IN_PROGRESS.value
        task.started_at = datetime.now(timezone.utc)
        from superset.extensions import db

        db.session.merge(task)
        db.session.commit()

        try:
            # Execute with ambient context
            with use_context(ctx):
                self.func(*args, **kwargs)

            # Update to SUCCESS and return completed task
            task = ctx._task
            task.status = TaskStatus.SUCCESS.value
            task.ended_at = datetime.now(timezone.utc)
            from superset.extensions import db

            db.session.merge(task)
            db.session.commit()

            logger.debug(
                "Synchronous execution of task %s (uuid=%s) completed successfully",
                self.name,
                task.uuid,
            )

            # Return the completed task entity (not the function result)
            return task

        except Exception as ex:
            # Update to FAILURE and return failed task
            task = ctx._task
            task.status = TaskStatus.FAILURE.value
            task.error_message = str(ex)
            task.ended_at = datetime.now(timezone.utc)
            from superset.extensions import db

            db.session.merge(task)
            db.session.commit()

            logger.error(
                "Synchronous execution of task %s (uuid=%s) failed: %s",
                self.name,
                task.uuid,
                str(ex),
                exc_info=True,
            )

            # Return the failed task entity (don't re-raise in sync mode)
            return task

    def schedule(self, *args: P.args, **kwargs: P.kwargs) -> "Task":
        """
        Schedule this task for asynchronous execution.

        The signature mirrors the original task function, with an additional
        keyword-only 'options' parameter for execution metadata.

        Args:
            *args, **kwargs: Business arguments for the task function
            options: Execution options

        Returns:
            Task model representing the scheduled task (PENDING status)

        Usage:
            # Auto-generated task_key (random UUID, no deduplication):
            task = generate_thumbnail.schedule(chart_id)

            # Custom task_key for task deduplication:
            task = generate_thumbnail.schedule(
                chart_id,
                options=TaskOptions(task_key=f"thumb_{chart_id}")
            )

        Note: Unlike direct calls (__call__), this schedules async execution.
        The function returns immediately with the Task model in PENDING status.
        """
        # Extract and merge options (decorator defaults + call-time overrides)
        override_options: TaskOptions | None = kwargs.pop("options", None)  # type: ignore[assignment]
        options = self._merge_options(override_options)

        # Extract task_name, task_key, and scope from merged options
        task_name = options.task_name
        task_key = options.task_key
        scope = TaskScope(options.scope)  # Convert string to TaskScope enum

        # Create task entry in metastore and schedule execution
        return TaskManager.submit_task(
            task_type=self.name,
            task_name=task_name,
            task_key=task_key,
            scope=scope,
            args=args,
            kwargs=kwargs,
        )
