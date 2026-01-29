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
from typing import Callable, cast, Generic, ParamSpec, TYPE_CHECKING, TypeVar

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
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
    scope: TaskScope = TaskScope.PRIVATE,
    timeout: int | None = None,
) -> Callable[[Callable[P, R]], "TaskWrapper[P]"] | "TaskWrapper[P]":
    """
    Decorator to register a task with default scope.

    Can be used with or without parentheses:
        @task
        def my_func(): ...

        @task()
        def my_func(): ...

        @task(name="custom_name", scope=TaskScope.SHARED)
        def my_func(): ...

        @task(timeout=300)  # 5-minute timeout
        def long_running_func(): ...

    Args:
        func: The function to decorate (when used without parentheses).
        name: Optional unique task name (e.g., "superset.generate_thumbnail").
              If not provided, uses the function name as the task name.
        scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM).
               Defaults to TaskScope.PRIVATE.
        timeout: Optional timeout in seconds. When the timeout is reached,
                 abort handlers are triggered if registered. Can be overridden
                 at call time via TaskOptions(timeout=...).

    Usage:
        # Private task (default scope) - no parentheses
        @task
        def my_async_func(chart_id: int) -> None:
            ctx = get_context()
            ...

        # Named task with shared scope
        @task(name="generate_report", scope=TaskScope.SHARED)
        def generate_expensive_report(report_id: int) -> None:
            ctx = get_context()
            ...

        # System task (admin-only)
        @task(scope=TaskScope.SYSTEM)
        def cleanup_task() -> None:
            ctx = get_context()
            ...

        # Task with timeout
        @task(timeout=300)
        def long_task() -> None:
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                # Called when timeout is reached or user cancels
                ...

    Note:
        Both direct calls and .schedule() return Task, regardless of the
        original function's return type. The decorated function's return value
        is discarded; only side effects and context updates matter.
    """

    def decorator(f: Callable[P, R]) -> "TaskWrapper[P]":
        # Use function name if no name provided
        task_name = name if name is not None else f.__name__

        # Create default options with no scope (scope is now in decorator)
        default_options = TaskOptions()

        # Validate function signature - must not have ctx or options params
        sig = inspect.signature(f)
        forbidden = {"ctx", "options"}
        if any(param in forbidden for param in sig.parameters):
            raise TypeError(
                f"Task function {f.__name__} must not define 'ctx' or "
                "'options' parameters. "
                f"Use get_context() instead for ambient context access."
            )

        # Register task
        TaskRegistry.register(task_name, f)

        # Create wrapper with schedule() method, default options, scope, and timeout
        wrapper = TaskWrapper(task_name, f, default_options, scope, timeout)

        # Preserve signature for introspection
        wrapper.__signature__ = sig  # type: ignore[attr-defined]

        return wrapper

    if func is None:
        # Called with parentheses: @task() or @task(name="foo", scope=TaskScope.SHARED)
        return decorator
    else:
        # Called without parentheses: @task
        return decorator(func)


class TaskWrapper(Generic[P]):
    """
    Wrapper for task functions that provides .schedule() method.

    Both direct calls and .schedule() return Task. The original function's
    return value is discarded.

    Direct calls execute synchronously, .schedule() runs async via Celery.
    """

    def __init__(
        self,
        name: str,
        func: Callable[P, R],
        default_options: TaskOptions,
        scope: TaskScope = TaskScope.PRIVATE,
        default_timeout: int | None = None,
    ) -> None:
        self.name = name
        self.func = func
        self.default_options = default_options
        self.scope = scope
        self.default_timeout = default_timeout
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
        For timeout, an explicit None in TaskOptions disables the decorator timeout.

        Args:
            override_options: Options provided at call time, or None

        Returns:
            Merged TaskOptions with overrides applied
        """
        if override_options is None:
            return TaskOptions(
                task_key=self.default_options.task_key,
                task_name=self.default_options.task_name,
                timeout=self.default_timeout,  # Use decorator default
            )

        # Merge: use override if provided, otherwise use default
        # For timeout: if override_options.timeout is explicitly set (even to None),
        # use it; otherwise fall back to decorator default
        return TaskOptions(
            task_key=override_options.task_key or self.default_options.task_key,
            task_name=override_options.task_name or self.default_options.task_name,
            timeout=override_options.timeout
            if override_options.timeout is not None
            else self.default_timeout,
        )

    def _validate_task(self, options: TaskOptions) -> None:
        """
        Validate task configuration before execution.

        Args:
            options: Merged task options to validate

        Raises:
            ValueError: If validation fails
        """
        # Shared tasks must have an explicit task_key for deduplication
        if self.scope == TaskScope.SHARED and options.task_key is None:
            raise ValueError(
                f"Shared task '{self.name}' requires an explicit task_key in "
                "TaskOptions for deduplication. Without a task_key, each "
                "invocation creates a separate task with a random UUID, "
                "defeating the purpose of shared tasks."
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

        Raises:
            ValueError: If task validation fails
        """
        from superset.commands.tasks.submit import SubmitTaskCommand
        from superset.commands.tasks.update import UpdateTaskCommand

        # Extract and merge options (decorator defaults + call-time overrides)
        override_options = cast(TaskOptions | None, kwargs.pop("options", None))
        options = self._merge_options(override_options)

        # Validate task configuration
        self._validate_task(options)

        # Extract task_name and task_key from merged options, scope from decorator
        task_name = (
            options.task_name or f"{self.name}:{generate_random_task_key()[:50]}"
        )
        task_key = options.task_key or generate_random_task_key()
        scope = self.scope  # Use scope from decorator

        # Build properties with execution_mode and timeout
        properties: dict[str, str | int] = {"execution_mode": "sync"}
        if options.timeout:
            properties["timeout"] = options.timeout

        task = SubmitTaskCommand(
            {
                "task_type": self.name,
                "task_key": task_key,
                "task_name": task_name,
                "scope": scope.value,
                "properties": properties,
            }
        ).run()

        # Build context and execute synchronously
        ctx = TaskContext(task_uuid=task.uuid)

        # Update status to IN_PROGRESS
        task = UpdateTaskCommand(
            task_uuid=task.uuid,
            status=TaskStatus.IN_PROGRESS.value,
            skip_security_check=True,
        ).run()

        # Start timeout timer if configured
        if options.timeout:
            ctx.start_timeout_timer(options.timeout)
            logger.debug(
                "Started timeout timer for task %s: %d seconds",
                task.uuid,
                options.timeout,
            )

        try:
            # Execute with ambient context
            with use_context(ctx):
                self.func(*args, **kwargs)

            # Check if task was aborted/aborting during execution
            task = ctx._task
            if task.status == TaskStatus.ABORTING.value:
                # Handlers ran successfully - determine terminal state
                if ctx.timeout_triggered:
                    task = UpdateTaskCommand(
                        task_uuid=task.uuid,
                        status=TaskStatus.TIMED_OUT.value,
                        skip_security_check=True,
                    ).run()
                    logger.info(
                        "Task %s (uuid=%s) timed out and completed cleanup",
                        self.name,
                        task.uuid,
                    )
                else:
                    task = UpdateTaskCommand(
                        task_uuid=task.uuid,
                        status=TaskStatus.ABORTED.value,
                        skip_security_check=True,
                    ).run()
                    logger.info(
                        "Task %s (uuid=%s) was aborted by user",
                        self.name,
                        task.uuid,
                    )
            elif task.status == TaskStatus.IN_PROGRESS.value:
                # Normal completion - update to SUCCESS
                task = UpdateTaskCommand(
                    task_uuid=task.uuid,
                    status=TaskStatus.SUCCESS.value,
                    skip_security_check=True,
                ).run()

                logger.debug(
                    "Synchronous execution of task %s (uuid=%s) completed successfully",
                    self.name,
                    task.uuid,
                )

            # Return the completed task entity (not the function result)
            return task

        except Exception as ex:
            # Update to FAILURE and return failed task
            task = UpdateTaskCommand(
                task_uuid=task.uuid,
                status=TaskStatus.FAILURE.value,
                properties={"error_message": str(ex)},
                skip_security_check=True,
            ).run()

            logger.error(
                "Synchronous execution of task %s (uuid=%s) failed: %s",
                self.name,
                task.uuid,
                str(ex),
                exc_info=True,
            )

            # Return the failed task entity (don't re-raise in sync mode)
            return task

        finally:
            # Always clean up timer and handlers
            ctx._run_cleanup()

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

        Raises:
            ValueError: If task is SHARED scope but no task_key is provided

        Usage:
            # Auto-generated task_key (random UUID, no deduplication):
            task = generate_thumbnail.schedule(chart_id)

            # Custom task_key for task deduplication:
            task = generate_thumbnail.schedule(
                chart_id,
                options=TaskOptions(task_key=f"thumb_{chart_id}")
            )

            # SHARED tasks require task_key:
            task = shared_task.schedule(
                data_id,
                options=TaskOptions(task_key=f"shared_{data_id}")
            )

        Note: Unlike direct calls (__call__), this schedules async execution.
        The function returns immediately with the Task model in PENDING status.
        """
        # Extract and merge options (decorator defaults + call-time overrides)
        override_options = cast(TaskOptions | None, kwargs.pop("options", None))
        options = self._merge_options(override_options)

        # Validate task configuration
        self._validate_task(options)

        # Extract task_name and task_key from merged options, scope from decorator
        task_name = options.task_name
        task_key = options.task_key
        scope = self.scope  # Use scope from decorator

        # Create task entry in metastore and schedule execution
        return TaskManager.submit_task(
            task_type=self.name,
            task_name=task_name,
            task_key=task_key,
            scope=scope,
            timeout=options.timeout,
            args=args,
            kwargs=kwargs,
        )
