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
from datetime import datetime, timezone
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
from superset_core.api.models import Task as CoreTask
from superset_core.api.tasks import TaskProperties, TaskStatus

from superset.models.helpers import AuditMixinNullable
from superset.models.task_subscribers import TaskSubscriber
from superset.tasks.constants import TERMINAL_STATES
from superset.tasks.utils import (
    error_update,
    get_finished_dedup_key,
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

    # User context for execution
    user_id = Column(Integer, nullable=True)

    # Task-specific output data (set by task code via ctx.update_task(payload=...))
    payload = Column(Text, nullable=True, default="{}")

    # Properties JSON blob - contains runtime state and execution config:
    # - is_abortable: bool - has abort handler registered
    # - progress_percent: float - progress 0.0-1.0
    # - progress_current: int - current iteration count
    # - progress_total: int - total iterations
    # - error_message: str - human-readable error message
    # - exception_type: str - exception class name
    # - stack_trace: str - full formatted traceback
    # - timeout: int - timeout in seconds
    properties = Column(Text, nullable=True, default="{}")

    # Relationships
    # Use lazy="selectin" to avoid N+1 queries when listing tasks with subscribers
    subscribers = relationship(
        TaskSubscriber,
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
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

        Only updates fields present in the updates dict.

        :param updates: TaskProperties dict with fields to update

        Example:
            task.update_properties({"is_abortable": True})
            task.update_properties(progress_update((50, 100)))
        """
        current = cast(TaskProperties, dict(self.properties_dict))
        current.update(updates)  # Merge updates
        self.properties = serialize_properties(current)

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
        try:
            return json.loads(self.payload or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

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

        # Update timestamps and is_abortable based on status
        now = datetime.now(timezone.utc)
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
        Get task duration in seconds.

        - Finished tasks: Time from started_at to ended_at (None if never started)
        - Running/aborting tasks: Time from started_at to now
        - Pending tasks: Time from created_on to now (queue time)

        Note: started_at/ended_at are stored in UTC, but created_on from
        AuditMixinNullable is stored as naive local time. We handle both cases.
        """
        if self.is_finished:
            # Task has completed - use fixed timestamps, never increment
            if self.started_at and self.ended_at:
                # Finished task - both timestamps use the same timezone (UTC)
                # Just compute the difference directly
                return (self.ended_at - self.started_at).total_seconds()
            # Never started (e.g., aborted while pending) - no duration
            return None
        elif self.started_at:
            # Running or aborting - started_at is UTC (set by set_status)
            # Use UTC now for comparison
            now = datetime.now(timezone.utc)
            started = (
                self.started_at.replace(tzinfo=timezone.utc)
                if self.started_at.tzinfo is None
                else self.started_at
            )
            return (now - started).total_seconds()
        elif self.created_on:
            # Pending - created_on is naive LOCAL time (from AuditMixinNullable)
            # Use naive local time for comparison
            now = datetime.now()  # Local time, no timezone
            created = (
                self.created_on.replace(tzinfo=None)
                if self.created_on.tzinfo is not None
                else self.created_on
            )
            return (now - created).total_seconds()
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

    def get_subscriber_ids(self) -> list[int]:
        """
        Get list of all subscriber user IDs.

        :returns: List of user IDs subscribed to this task
        """
        return [sub.user_id for sub in self.subscribers]

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
