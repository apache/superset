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

from __future__ import annotations

import inspect
import logging
from typing import (
    Any,
    Callable,
    cast,
    Generic,
    overload,
    ParamSpec,
    TYPE_CHECKING,
    TypeVar,
)

from superset_core.tasks.types import TaskOptions, TaskScope, TaskStatus

from superset import is_feature_enabled
from superset.commands.tasks.exceptions import GlobalTaskFrameworkDisabledError
from superset.tasks.ambient_context import use_context
from superset.tasks.constants import TERMINAL_STATES
from superset.tasks.context import TaskContext
from superset.tasks.manager import TaskManager
from superset.tasks.registry import TaskRegistry
from superset.tasks.utils import generate_random_task_key

if TYPE_CHECKING:
    from uuid import UUID

    from superset.models.tasks import Task
    from superset.tasks.subscription import TaskSubscriptionPolicy

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


@overload
def task(func: Callable[P, R]) -> "TaskWrapper[P]": ...


@overload
def task(
    func: None = None,
    *,
    name: str | None = None,
    scope: TaskScope = TaskScope.PRIVATE,
    timeout: int | None = None,
    subscription_policy: "TaskSubscriptionPolicy | None" = None,
) -> Callable[[Callable[P, R]], "TaskWrapper[P]"]: ...


def task(
    func: Callable[P, R] | None = None,
    *,
    name: str | None = None,
    scope: TaskScope = TaskScope.PRIVATE,
    timeout: int | None = None,
    subscription_policy: "TaskSubscriptionPolicy | None" = None,
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
        subscription_policy: Optional per-client subscription policy. The
                 framework's subscriptions are principal-grain; a policy refines
                 that with a finer per-client grain (e.g. one browser tab), so a
                 cancel from one client of a principal does not abort a SHARED
                 task another client of the same principal is still awaiting. See
                 ``superset.tasks.subscription.TaskSubscriptionPolicy``.

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
        base_task_name = name if name is not None else f.__name__

        # Apply ambient context detection for ID prefixing (like MCP decorators)
        from superset.extensions.context import get_current_extension_context

        if context := get_current_extension_context():
            # Extension context: prefix task name to prevent collisions
            task_name = (
                f"extensions.{context.extension.publisher}."
                f"{context.extension.name}.{base_task_name}"
            )
        else:
            # Host context: use original task name
            task_name = base_task_name

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

        TaskRegistry.register(task_name, f, subscription_policy=subscription_policy)

        # Create wrapper with schedule() method, default options, scope, and timeout
        wrapper = TaskWrapper(
            task_name, f, default_options, scope, timeout, subscription_policy
        )

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

    The status-refresh reads below pass ``skip_base_filter=True`` to
    ``TaskDAO.find_one_or_none`` because they read back the task this
    executor itself submitted, keyed on the UUID it already holds -- not
    a task requested by a user. See ``TaskFilter`` for the request-scoped
    vs. internal-plumbing split.
    """

    def __init__(
        self,
        name: str,
        func: Callable[P, R],
        default_options: TaskOptions,
        scope: TaskScope = TaskScope.PRIVATE,
        default_timeout: int | None = None,
        subscription_policy: "TaskSubscriptionPolicy | None" = None,
    ) -> None:
        self.name = name
        self.func = func
        self.default_options = default_options
        self.scope = scope
        self.default_timeout = default_timeout
        self.subscription_policy = subscription_policy
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

        Call-time options take precedence over decorator defaults. A call-time
        ``timeout`` overrides only when set to a concrete value; ``None`` inherits
        the decorator's timeout.

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
                depends_on=self.default_options.depends_on,
            )

        # Merge: use override if provided, otherwise use default.
        # For timeout: use the override only when it is a concrete value; ``None``
        # (the default) falls back to the decorator timeout — it does not disable it.
        return TaskOptions(
            task_key=override_options.task_key or self.default_options.task_key,
            task_name=override_options.task_name or self.default_options.task_name,
            timeout=override_options.timeout
            if override_options.timeout is not None
            else self.default_timeout,
            depends_on=override_options.depends_on or self.default_options.depends_on,
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
        1. Submit task (create new or join existing via deduplication)
        2. If joining existing task: wait for it to complete (blocking)
        3. If new task: execute inline and return completed task

        Sync execution always blocks until completion - even when joining an
        existing task that's running in another process/worker.

        Returns the Task entity in terminal state (SUCCESS, FAILURE, etc.).

        Raises:
            GlobalTaskFrameworkDisabledError: If GTF feature flag is not enabled
            ValueError: If task validation fails
            TimeoutError: If timeout expires while waiting for existing task
        """
        from superset.commands.tasks.submit import SubmitTaskCommand

        if not is_feature_enabled("GLOBAL_TASK_FRAMEWORK"):
            raise GlobalTaskFrameworkDisabledError()

        # Extract and merge options (decorator defaults + call-time overrides)
        options = self._merge_options(
            cast(TaskOptions | None, kwargs.pop("options", None))
        )

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

        # Submit task - may create new or join existing
        task, is_new = SubmitTaskCommand(
            {
                "task_type": self.name,
                "task_key": task_key,
                "task_name": task_name,
                "scope": scope.value,
                "properties": properties,
                "depends_on": options.depends_on,
            }
        ).run_with_info()

        # If joining existing task, wait for it to complete
        if not is_new:
            return self._wait_for_existing_task(task, options.timeout)

        # New task - execute inline
        return self._execute_inline(task, options, args, kwargs)

    def _wait_for_existing_task(self, task: "Task", timeout: int | None) -> "Task":
        """
        Wait for an existing task to complete.

        Called when sync execution joins a pre-existing task via deduplication.
        Blocks until the task reaches a terminal state.

        :param task: The existing task to wait for
        :param timeout: Maximum time to wait in seconds (None = no limit)
        :returns: Task in terminal state
        :raises TimeoutError: If timeout expires before task completes
        """
        from flask import current_app

        from superset.daos.tasks import TaskDAO

        if task.status in TERMINAL_STATES:
            logger.info(
                "Joined already-completed task %s (uuid=%s, status=%s)",
                self.name,
                task.uuid,
                task.status,
            )
            return task

        # Wait for the existing task to complete
        logger.info(
            "Joined active task %s (uuid=%s, status=%s), waiting for completion",
            self.name,
            task.uuid,
            task.status,
        )

        try:
            app = current_app._get_current_object()
        except RuntimeError:
            app = None

        try:
            task = TaskManager.wait_for_completion(
                task_uuid=task.uuid,
                timeout=float(timeout) if timeout else None,
                poll_interval=1.0,
                app=app,
            )
            logger.info(
                "Task %s (uuid=%s) completed with status=%s",
                self.name,
                task.uuid,
                task.status,
            )
            return task

        except TimeoutError:
            logger.warning(
                "Timeout waiting for task %s (uuid=%s)",
                self.name,
                task.uuid,
            )
            # Return task in current state (caller can check status)
            refreshed = TaskDAO.find_one_or_none(uuid=task.uuid, skip_base_filter=True)
            return refreshed if refreshed else task

    def _gate_on_prerequisites(self, task: "Task") -> "Task | None":
        """Block the inline caller until this task's prerequisites are terminal.

        Same ``all_success`` DAG semantics as the async path (shared via
        :mod:`superset.tasks.dependencies`): ready → returns ``None`` (proceed); a
        prerequisite still running → block on the coordination completion signal
        (the sync analogue of the async defer — the caller *is* the executor and
        has no worker slot to free), then re-check; a prerequisite that ended
        non-success → fail this dependent and return its terminal ``Task`` for the
        caller to return.
        """
        from flask import current_app

        from superset.daos.tasks import TaskDAO
        from superset.tasks.dependencies import (
            DAG_WAITING,
            fail_dependent_on_unmet_prerequisite,
            unmet_prerequisite,
        )

        try:
            app = current_app._get_current_object()  # noqa: SLF001
        except RuntimeError:
            app = None

        # Re-read fresh so ``depends_on`` reflects committed edges (the just-created
        # task's selectin collection can be stale), matching the async path's fresh
        # worker load.
        current = (
            TaskDAO.find_one_or_none(uuid=task.uuid, skip_base_filter=True) or task
        )
        unmet = unmet_prerequisite(current)
        while unmet is DAG_WAITING:
            for prerequisite in current.depends_on:
                if prerequisite.status not in TERMINAL_STATES:
                    # Unbounded wait by design: it mirrors the async path's
                    # unbounded defer-retry (wait until the prerequisite is
                    # terminal). Follow-up: bound it by TaskOptions.timeout for the
                    # sync caller if a use case needs it.
                    try:
                        TaskManager.wait_for_completion(
                            task_uuid=prerequisite.uuid, poll_interval=1.0, app=app
                        )
                    except ValueError:
                        # The prerequisite was pruned mid-wait (no row). Stop
                        # waiting and let the re-check below treat it as failed,
                        # matching the async path's missing-prerequisite handling.
                        break
            current = (
                TaskDAO.find_one_or_none(uuid=task.uuid, skip_base_filter=True)
                or current
            )
            unmet = unmet_prerequisite(current)
        if unmet is not None:
            fail_dependent_on_unmet_prerequisite(task.uuid, cast("Task", unmet))
            return (
                TaskDAO.find_one_or_none(uuid=task.uuid, skip_base_filter=True) or task
            )
        return None

    def _abort_if_preaborted(self, task: "Task") -> "Task | None":
        """If the task was aborted before inline execution started, finalize it as
        ABORTED and return the terminal task; otherwise return ``None`` to proceed.
        Matches the async pre-execution check in ``scheduler.py``."""
        from superset.commands.tasks.internal_update import (
            InternalStatusTransitionCommand,
        )
        from superset.daos.tasks import TaskDAO
        from superset.tasks.constants import ABORT_STATES

        if task.status not in ABORT_STATES:
            return None
        logger.info(
            "Task %s (uuid=%s) was aborted before execution started",
            self.name,
            task.uuid,
        )
        # Ensure status is ABORTED (not just ABORTING)
        transitioned = InternalStatusTransitionCommand(
            task_uuid=task.uuid,
            new_status=TaskStatus.ABORTED,
            expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
            set_ended_at=True,
        ).run()
        # Wake waiters (websocket-mode clients don't poll), but only when this path
        # performed the transition, so a cancel that already published completion
        # isn't echoed. Mirrors the async pre-execution check in ``scheduler.py``.
        if transitioned:
            TaskManager.publish_completion(task.uuid, TaskStatus.ABORTED.value)
        refreshed = TaskDAO.find_one_or_none(uuid=task.uuid, skip_base_filter=True)
        return refreshed if refreshed else task

    def _finalize_inline_terminal_status(
        self, ctx: "TaskContext", task_uuid: "UUID"
    ) -> None:
        """After the inline body returned, write the terminal status via atomic
        conditional transitions: TIMED_OUT / ABORTED when an abort was detected, or
        IN_PROGRESS → SUCCESS on normal completion (a no-op if concurrently aborted).
        """
        from superset.commands.tasks.internal_update import (
            InternalStatusTransitionCommand,
        )

        if ctx._abort_detected or ctx.timeout_triggered:  # noqa: SLF001
            new_status = (
                TaskStatus.TIMED_OUT if ctx.timeout_triggered else TaskStatus.ABORTED
            )
            InternalStatusTransitionCommand(
                task_uuid=task_uuid,
                new_status=new_status,
                expected_status=TaskStatus.ABORTING,
                set_ended_at=True,
            ).run()
            logger.info(
                "Task %s (uuid=%s) finalized as %s",
                self.name,
                task_uuid,
                new_status.value,
            )
            return
        # Normal completion - atomic IN_PROGRESS → SUCCESS (a no-op if the task was
        # concurrently aborted).
        if InternalStatusTransitionCommand(
            task_uuid=task_uuid,
            new_status=TaskStatus.SUCCESS,
            expected_status=TaskStatus.IN_PROGRESS,
            set_ended_at=True,
        ).run():
            logger.debug(
                "Synchronous execution of task %s (uuid=%s) completed successfully",
                self.name,
                task_uuid,
            )
        else:
            logger.info(
                "Task %s (uuid=%s) IN_PROGRESS → SUCCESS failed "
                "(may have been aborted concurrently)",
                self.name,
                task_uuid,
            )

    def _execute_inline(
        self,
        task: "Task",
        options: TaskOptions,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> "Task":
        """
        Execute task function inline (synchronously).

        Called when this is a new task (not joining existing).
        Uses atomic conditional status transitions for race-safe execution.

        :param task: The newly created task
        :param options: Merged task options
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :returns: Task in terminal state
        """
        from superset.commands.tasks.internal_update import (
            InternalStatusTransitionCommand,
        )
        from superset.daos.tasks import TaskDAO

        # PRE-EXECUTION CHECK: don't execute if already aborted/aborting.
        if (preaborted := self._abort_if_preaborted(task)) is not None:
            return preaborted

        # DAG gate: block/fail on unmet prerequisites before claiming the task,
        # mirroring the async path's all_success semantics (shared via
        # superset.tasks.dependencies). Returns a terminal task if a prerequisite
        # failed (fail-fast); otherwise proceeds once prerequisites succeed.
        if (gated := self._gate_on_prerequisites(task)) is not None:
            return gated

        # Atomic transition: PENDING → IN_PROGRESS (set started_at for duration
        # tracking)
        task_uuid = task.uuid  # Cache UUID before any potential state changes
        if not InternalStatusTransitionCommand(
            task_uuid=task_uuid,
            new_status=TaskStatus.IN_PROGRESS,
            expected_status=TaskStatus.PENDING,
            set_started_at=True,
        ).run():
            # Status wasn't PENDING - task may have been aborted concurrently
            logger.warning(
                "Task %s (uuid=%s) failed PENDING → IN_PROGRESS transition "
                "(may have been aborted concurrently)",
                self.name,
                task_uuid,
            )
            refreshed = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            return refreshed if refreshed else task

        # Update cached status (no DB read needed - we just wrote IN_PROGRESS)
        task.status = TaskStatus.IN_PROGRESS.value

        ctx = TaskContext(task)

        # Start timeout timer if configured
        if options.timeout:
            ctx.start_timeout_timer(options.timeout)
            logger.debug(
                "Started timeout timer for task %s: %d seconds",
                task.uuid,
                options.timeout,
            )

        # Track final task state for completion notification
        final_task: Task | None = None

        try:
            # Execute with ambient context
            with use_context(ctx):
                self.func(*args, **kwargs)

            # The work finished; stop the abort listener from flipping this to
            # ABORTED if a cancel signal lands now (mirrors the async executor).
            ctx.mark_execution_completed()

            # Determine and write the terminal status (abort/timeout vs success).
            self._finalize_inline_terminal_status(ctx, task_uuid)

            # Refresh once at end to return current state
            final_task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            return final_task if final_task else task

        except Exception as ex:
            # The work is done (it raised); stop a late cancel signal from also
            # running abort handlers on top of failure handling.
            ctx.mark_execution_completed()
            # Atomic transition to FAILURE (only if still IN_PROGRESS)
            InternalStatusTransitionCommand(
                task_uuid=task_uuid,
                new_status=TaskStatus.FAILURE,
                expected_status=[TaskStatus.IN_PROGRESS, TaskStatus.ABORTING],
                properties=ctx.error_properties(exception=ex),
                set_ended_at=True,
            ).run()

            logger.error(
                "Synchronous execution of task %s (uuid=%s) failed: %s",
                self.name,
                task_uuid,
                str(ex),
                exc_info=True,
            )

            # Refresh once at end to return current state
            final_task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            return final_task if final_task else task

        finally:
            # Always clean up timer and handlers
            ctx._run_cleanup()

            # Publish completion notification for any waiters
            # Use final_task if set by try/except, otherwise refresh (fallback)
            if final_task is None:
                final_task = TaskDAO.find_one_or_none(
                    uuid=task_uuid, skip_base_filter=True
                )
            if final_task and final_task.status in TERMINAL_STATES:
                TaskManager.publish_completion(task_uuid, final_task.status)

    def schedule(
        self,
        *args: Any,
        options: TaskOptions | None = None,
        **kwargs: Any,
    ) -> "Task":
        """
        Schedule this task for asynchronous execution.

        The signature mirrors the original task function, with an additional
        keyword-only 'options' parameter for execution metadata. Business args
        are typed as ``Any`` here because PEP 612 does not allow adding a
        keyword-only parameter alongside the captured ``ParamSpec``; the runtime
        ``__signature__`` (patched in ``__init__``) still mirrors the wrapped
        function for introspection and IDE support.

        Args:
            *args, **kwargs: Business arguments for the task function
            options: Execution options

        Returns:
            Task model representing the scheduled task (PENDING status)

        Raises:
            GlobalTaskFrameworkDisabledError: If GTF feature flag is not enabled
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
        if not is_feature_enabled("GLOBAL_TASK_FRAMEWORK"):
            raise GlobalTaskFrameworkDisabledError()

        # Extract and merge options (decorator defaults + call-time overrides)
        merged_options = self._merge_options(options)

        self._validate_task(merged_options)

        # Extract task_name and task_key from merged options, scope from decorator
        task_name = merged_options.task_name
        task_key = merged_options.task_key
        scope = self.scope  # Use scope from decorator

        # Create task entry in metastore and schedule execution
        return TaskManager.submit_task(
            task_type=self.name,
            task_name=task_name,
            task_key=task_key,
            scope=scope,
            timeout=merged_options.timeout,
            args=args,
            kwargs=kwargs,
            depends_on=merged_options.depends_on,
        )
