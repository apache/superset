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
"""Task model for Global Task Framework (GTF)"""

from __future__ import annotations

import uuid as uuid_module
from typing import Any, cast

from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType
from superset_core.tasks.models import Task as CoreTask
from superset_core.tasks.types import TaskProperties, TaskStatus

from superset.models.helpers import AuditMixinNullable
from superset.models.task_dependencies import TaskDependency
from superset.models.task_subscribers import TaskSubscriber
from superset.tasks.constants import TERMINAL_STATES
from superset.tasks.utils import (
    error_update,
    get_finished_dedup_key,
    merge_properties,
    naive_utcnow,
    parse_payload,
    parse_properties,
    serialize_properties,
)
from superset.utils import json


class Task(CoreTask, AuditMixinNullable, Model):
    """
    Concrete Task model for the Global Task Framework (GTF).

    This model represents async tasks in Superset, providing unified tracking
    for all background operations including SQL queries, thumbnail generation,
    reports, and other async operations.

    Non-filterable fields (progress, error info, execution config) are stored
    in a `properties` JSON blob for schema flexibility.
    """

    __tablename__ = "tasks"

    # Primary key and identifiers
    id = Column(Integer, primary_key=True)
    uuid = Column(
        UUIDType(binary=True), nullable=False, unique=True, default=uuid_module.uuid4
    )

    # Task metadata (filterable)
    task_key = Column(String(256), nullable=False, index=True)  # For deduplication
    task_type = Column(String(100), nullable=False, index=True)  # e.g., 'sql_execution'
    task_name = Column(String(256), nullable=True)  # Human readable name
    scope = Column(
        String(20), nullable=False, index=True, default="private"
    )  # private/shared/system
    status = Column(
        String(50), nullable=False, index=True, default=TaskStatus.PENDING.value
    )
    dedup_key = Column(
        String(64), nullable=False, unique=True, index=True
    )  # Hashed deduplication key (SHA-256 = 64 chars, UUID = 36 chars)

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Liveness marker bumped by the executing worker's heartbeat thread while it
    # holds the task. The reap_orphaned_tasks beat job reaps ACTIVE tasks whose
    # heartbeat has gone stale (a dead/orphaned worker). Written out-of-band via a
    # raw UPDATE (see TaskDAO.touch_heartbeat) so a heartbeat never advances
    # changed_on and thus never resurfaces the task in the status-change poll.
    last_heartbeat = Column(DateTime, nullable=True, index=True)

    # User context for execution
    user_id = Column(Integer, nullable=True)

    # Task-specific output data (set by task code via ctx.update_task(payload=...))
    payload = Column(Text, nullable=True, default="{}")

    # Properties JSON blob - contains runtime state and execution config:
    # - is_abortable: bool - has abort handler registered
    # - progress_percent: float - progress 0.0-1.0
    # - progress_current: int - current iteration count
    # - progress_total: int - total iterations
    # - error_message: str - human-readable error message (public)
    # - dedupe_count: int - times this task was reused by a later submit
    # - timeout: int - timeout in seconds
    # - private: dict - internal, debug-only; two isolated namespaces:
    #     - framework: celery_task_id, exception_type, stack_trace (framework-owned)
    #     - task: freeform task-type handles, e.g. cancel_query_id/cancel_database_id
    properties = Column(Text, nullable=True, default="{}")

    # Relationships
    # Use lazy="selectin" to avoid N+1 queries when listing tasks with subscribers
    subscribers = relationship(
        TaskSubscriber,
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Upstream prerequisite tasks (self-referential many-to-many over
    # task_dependencies). `depends_on` is the list of Task entities this task
    # depends on, loaded in a single selectin fetch alongside the task (no
    # per-edge round trips). It is viewonly: edges are written through
    # TaskDAO.add_dependencies, not by mutating this collection. Cleanup on task
    # deletion relies on the DB-level FK ON DELETE CASCADE (see the migration),
    # since TaskPruneCommand bulk-deletes via core DELETE, not the ORM.
    depends_on = relationship(
        "Task",
        secondary=TaskDependency.__table__,
        primaryjoin=id == TaskDependency.task_id,
        secondaryjoin=id == TaskDependency.depends_on_task_id,
        order_by=TaskDependency.id,
        lazy="selectin",
        viewonly=True,
    )

    # Downstream tasks that depend on this task: the reverse of `depends_on`
    # (same viewonly selectin pattern, joins swapped). Exposing both DAG
    # directions on the entity means callers read them directly rather than
    # issuing a separate reverse-edge query.
    required_by = relationship(
        "Task",
        secondary=TaskDependency.__table__,
        primaryjoin=id == TaskDependency.depends_on_task_id,
        secondaryjoin=id == TaskDependency.task_id,
        order_by=TaskDependency.id,
        lazy="selectin",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<Task {self.task_type}:{self.task_key} [{self.status}]>"

    # -------------------------------------------------------------------------
    # Properties accessor
    # -------------------------------------------------------------------------

    @property
    def properties_dict(self) -> TaskProperties:
        """
        Get typed properties.

        Properties contain runtime state and execution config that doesn't
        need database filtering. Always use .get() for reads since keys may
        be absent.

        :returns: TaskProperties dict (sparse - only contains keys that were set)
        """
        return parse_properties(self.properties)

    def update_properties(self, updates: TaskProperties) -> None:
        """
        Update specific properties fields (merge semantics).

        Only updates fields present in the updates dict. Top-level keys are
        shallow-merged, but the ``private`` subtree is merged *recursively* — its
        ``framework``, ``task`` and ``subscription`` namespaces (and the keys
        within each) merge independently, so a write to one namespace never
        clobbers the others or drops earlier keys. The ``subscription`` namespace
        is written through ``TaskDAO.merge_subscription_state`` (a row-locked
        merge) rather than directly, see that method for why.

        :param updates: TaskProperties dict with fields to update

        Example:
            task.update_properties({"is_abortable": True})
            task.update_properties(progress_update((50, 100)))
        """
        current = merge_properties(self.properties_dict, updates)
        self.properties = serialize_properties(current)

    def update_framework_private(self, updates: dict[str, Any]) -> None:
        """Merge keys into ``private["framework"]`` (framework-owned internal state).

        Named orchestration/error-debug handles the framework writes (e.g.
        ``celery_task_id``); never surfaced to users except in debug mode.
        """
        self.update_properties(
            cast(TaskProperties, {"private": {"framework": updates}})
        )

    def update_task_private(self, updates: dict[str, Any]) -> None:
        """Merge keys into ``private["task"]`` (freeform task-type internal state).

        Task-execution handles written by task/framework-on-behalf-of-task code
        (e.g. the engine cancel handle). Isolated from the ``framework`` namespace
        so a task key can never collide with a framework key.
        """
        self.update_properties(cast(TaskProperties, {"private": {"task": updates}}))

    # -------------------------------------------------------------------------
    # Payload accessor (for task-specific output data)
    # -------------------------------------------------------------------------

    @property
    def payload_dict(self) -> dict[str, Any]:
        """
        Get payload as parsed JSON.

        Payload contains task-specific output data set by task code via
        ctx.update_task(payload=...).

        :returns: Dictionary containing payload data
        """
        return parse_payload(self.payload)

    def set_payload(self, data: dict[str, Any]) -> None:
        """
        Update payload with new data.

        The payload is merged with existing data, not replaced.

        :param data: Dictionary of data to merge into payload
        """
        current = self.payload_dict
        current.update(data)
        self.payload = json.dumps(current)

    # -------------------------------------------------------------------------
    # Error handling
    # -------------------------------------------------------------------------

    def set_error_from_exception(self, exception: BaseException) -> None:
        """
        Set error fields from an exception.

        Captures the error message, exception type, and full stack trace.
        Called automatically by the executor when a task raises an exception.

        :param exception: The exception that caused the failure
        """
        self.update_properties(error_update(exception))

    # -------------------------------------------------------------------------
    # Status management
    # -------------------------------------------------------------------------

    def set_status(self, status: TaskStatus | str) -> None:
        """
        Update task status and dedup_key.

        When a task finishes (success, failure, or abort), the dedup_key is
        changed to the task's UUID. This frees up the slot so new tasks with
        the same parameters can be created.

        :param status: New task status
        """
        if isinstance(status, TaskStatus):
            status = status.value
        self.status = status

        # Update timestamps and is_abortable based on status. started_at/ended_at
        # are stored as naive UTC (created_on/changed_on from FAB remain naive
        # local, but nothing computes a delta across the two conventions); see
        # ``naive_utcnow``.
        now = naive_utcnow()
        if status == TaskStatus.IN_PROGRESS.value and not self.started_at:
            self.started_at = now
            # Set is_abortable to False when task starts executing
            # (will be set to True if/when an abort handler is registered)
            if self.properties_dict.get("is_abortable") is None:
                self.update_properties({"is_abortable": False})
        elif status in TERMINAL_STATES:
            if not self.ended_at:
                self.ended_at = now
            # Update dedup_key to UUID to free up the slot for new tasks
            self.dedup_key = get_finished_dedup_key(self.uuid)
        # Note: ABORTING status doesn't set ended_at yet - that happens when
        # the task transitions to ABORTED after handlers complete

    @property
    def is_pending(self) -> bool:
        """Check if task is pending."""
        return self.status == TaskStatus.PENDING.value

    @property
    def is_running(self) -> bool:
        """Check if task is currently running."""
        return self.status == TaskStatus.IN_PROGRESS.value

    @property
    def is_finished(self) -> bool:
        """Check if task has finished (success, failure, aborted, or timed out)."""
        return self.status in TERMINAL_STATES

    @property
    def is_successful(self) -> bool:
        """Check if task completed successfully."""
        return self.status == TaskStatus.SUCCESS.value

    @property
    def duration_seconds(self) -> float | None:
        """
        Get task duration in seconds (execution time), or ``None`` before a task
        has started.

        - Finished tasks: Time from started_at to ended_at (None if never started)
        - Running/aborting tasks: Time from started_at to now
        - Pending tasks: None — a task that hasn't started has no duration to show
          (queue time is not execution time)

        started_at/ended_at are stored as naive UTC; a value read back from the
        DB is treated as naive UTC (any tzinfo is stripped defensively) for the
        "still running" delta.
        """
        if self.is_finished:
            # Task has completed - use fixed timestamps, never increment
            if self.started_at and self.ended_at:
                return (self.ended_at - self.started_at).total_seconds()
            # Never started (e.g., aborted while pending) - no duration
            return None
        if self.started_at:
            # Running or aborting - elapsed since it started (both naive UTC)
            now = naive_utcnow()
            started = (
                self.started_at.replace(tzinfo=None)
                if self.started_at.tzinfo is not None
                else self.started_at
            )
            return (now - started).total_seconds()
        # Pending (not yet started) - no duration.
        return None

    # Scope-related properties
    @property
    def is_private(self) -> bool:
        """Check if task is private (user-specific)."""
        return self.scope == "private"

    @property
    def is_shared(self) -> bool:
        """Check if task is shared (multi-user)."""
        return self.scope == "shared"

    @property
    def is_system(self) -> bool:
        """Check if task is system (admin-only)."""
        return self.scope == "system"

    # Subscriber-related methods
    @property
    def subscriber_count(self) -> int:
        """Get number of subscribers to this task."""
        return len(self.subscribers)

    def has_subscriber(self, user_id: int) -> bool:
        """
        Check if a user is subscribed to this task.

        :param user_id: User ID to check
        :returns: True if user is subscribed
        """
        return any(sub.user_id == user_id for sub in self.subscribers)

    def has_guest_subscriber(self, guest_key: str) -> bool:
        """
        Check if an embedded guest (by token-derived key) is subscribed.

        :param guest_key: Guest identity to check (see superset.tasks.guest)
        :returns: True if the guest is subscribed
        """
        return any(sub.guest_key == guest_key for sub in self.subscribers)

    def get_subscriber_ids(self) -> list[int]:
        """
        Get list of all subscriber user IDs.

        :returns: List of user IDs subscribed to this task
        """
        return [sub.user_id for sub in self.subscribers if sub.user_id is not None]

    def to_dict(self) -> dict[str, Any]:
        """
        Convert task to dictionary representation.

        Minimal API payload - frontend derives status booleans and abort logic
        from status and properties.is_abortable.

        :returns: Dictionary representation of the task
        """
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "task_key": self.task_key,
            "task_type": self.task_type,
            "task_name": self.task_name,
            "scope": self.scope,
            "status": self.status,
            "created_on": self.created_on.isoformat() if self.created_on else None,
            "changed_on": self.changed_on.isoformat() if self.changed_on else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "created_by_fk": self.created_by_fk,
            "user_id": self.user_id,
            "payload": self.payload_dict,
            "properties": self.properties_dict,
            "subscriber_count": self.subscriber_count,
            "subscriber_ids": self.get_subscriber_ids(),
        }
