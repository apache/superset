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
from typing import Any, Callable, Literal, TYPE_CHECKING, TypedDict, Union
from uuid import UUID

if TYPE_CHECKING:
    from superset_core.tasks.models import Task


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
    dedupe_count: int

    # Error info - set when task fails. ``error_message`` is the consumer-facing
    # failure reason (public); the exception class and traceback are internal
    # debug detail and live under ``private["framework"]`` instead.
    error_message: str

    # Internal runtime state, surfaced to user-facing API payloads only in debug
    # mode (the Task REST API strips this key otherwise). Holds framework/task
    # plumbing rather than task output. See ``PrivateProperties``.
    private: "PrivateProperties"


class FrameworkPrivateProperties(TypedDict, total=False):
    """Framework-owned internal task state, under ``private["framework"]``.

    Named keys written *only* by the framework, common to every task type: the
    Celery job id the orphan reaper revokes, and error-debug detail (exception
    class + traceback). Isolated from task-owned keys so a task type can never
    clobber them. Task-execution handles specific to one kind of task (e.g. a
    warehouse-query cancel handle) belong in the freeform ``task`` namespace, not
    here.
    """

    celery_task_id: str
    exception_type: str
    stack_trace: str


class PrivateProperties(TypedDict, total=False):
    """Internal task runtime state, stored under ``TaskProperties["private"]``.

    Never surfaced to user-facing API payloads except in debug mode; distinct
    from task output, which belongs in the task's ``payload``. Split into three
    structurally isolated namespaces so a task type's freeform key can never
    collide with a framework orchestration key or a subscription policy's
    bookkeeping:

    - ``framework``: named framework-owned keys, common to all tasks (see
      ``FrameworkPrivateProperties``).
    - ``task``: freeform, task-type-specific internal handles, written only by
      task/execution code. E.g. the chart-data query task stores its engine
      cancel handle here (``cancel_query_id`` / ``cancel_database_id``).
    - ``subscription``: freeform bookkeeping owned by the task type's
      ``SubscriptionPolicy`` (see ``superset_core.tasks.subscription``), written
      only through the policy hooks. E.g. the chart-data policy stores its
      per-client consumer list here. The framework never inspects it.
    """

    framework: "FrameworkPrivateProperties"
    task: dict[str, Any]
    subscription: dict[str, Any]


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
        from superset_core.tasks.types import TaskOptions, TaskScope

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

        # Task that waits for prerequisite tasks to succeed before running.
        # Pass the scheduled Task objects (canonical); UUIDs are also accepted.
        parent = parent_task.schedule()
        task = dependent_task.schedule(
            options=TaskOptions(depends_on=[parent])
        )
    """

    task_key: str | None = None
    task_name: str | None = None
    timeout: int | None = None  # Timeout in seconds
    # Prerequisite tasks this task depends on. Each entry may be a scheduled
    # Task, its UUID, or a UUID string. The task only runs once every
    # prerequisite has reached a terminal SUCCESS; if any prerequisite ends in a
    # non-SUCCESS terminal state the task fails without running (all_success
    # semantics).
    depends_on: list[Union["Task", UUID, str]] | None = None


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
        *,
        immediate: bool = False,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing data,
        not replaced. All updates occur in a single database transaction.

        Writes are throttled by default to protect the database from eager
        tasks. Pass ``immediate=True`` to force a synchronous write, bypassing
        throttling, when a downstream consumer must observe this update as soon
        as the task completes (e.g. a dependent task reading a published value).

        Progress can be specified in three ways:
        - float (0.0-1.0): Percentage only, e.g., 0.5 means 50%
        - int: Count only (total unknown), e.g., 42 means "42 items processed"
        - tuple[int, int]: Count and total, e.g., (3, 100) means "3 of 100"
          The percentage is automatically computed from count/total.

        :param progress: Progress value, or None to leave unchanged
        :param payload: Payload data to merge (dict), or None to leave unchanged
        :param immediate: When True, write synchronously and bypass throttling

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
    def get_dependency_payloads(self) -> list[dict[str, Any]]:
        """
        Return payloads published by prerequisite tasks.

        The payloads are returned in dependency edge order. They let dependent
        task code consume small pieces of output metadata from tasks that have
        already satisfied the DAG all-success gate.
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
