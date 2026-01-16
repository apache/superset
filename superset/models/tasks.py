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

import uuid
from datetime import datetime, timezone
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from superset_core.api.models import Task as CoreTask
from superset_core.api.tasks import TaskStatus

from superset.models.helpers import AuditMixinNullable
from superset.models.task_subscribers import TaskSubscriber  # noqa: F401
from superset.tasks.utils import get_finished_dedup_key
from superset.utils import json


class Task(CoreTask, AuditMixinNullable, Model):
    """
    Concrete Task model for the Global Task Framework (GTF).

    This model represents async tasks in Superset, providing unified tracking
    for all background operations including SQL queries, thumbnail generation,
    reports, and other async operations.
    """

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4())
    )
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
        String(512), nullable=False, unique=True, index=True
    )  # Computed deduplication key
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    user_id = Column(Integer, nullable=True)  # User context for execution
    database_id = Column(
        Integer, ForeignKey("dbs.id", ondelete="SET NULL"), nullable=True
    )
    error_message = Column(Text, nullable=True)
    payload = Column(
        Text, nullable=True, default="{}"
    )  # JSON serialized task-specific data
    # Progress tracking - supports three modes:
    # 1. Percentage only: progress_percent set, others null
    # 2. Count only: progress_current set, others null
    # 3. Count+total: progress_current and progress_total set, percent auto-computed
    progress_percent = Column(Float, nullable=True)  # Progress 0.0-1.0
    progress_current = Column(Integer, nullable=True)  # Current iteration count
    progress_total = Column(Integer, nullable=True)  # Total iterations (if known)
    # Abort handling: null=pending/finished, false=in_progress no handler,
    # true=has abort handler
    is_abortable = Column(Boolean, nullable=True)

    # Relationships
    database = relationship("Database", foreign_keys=[database_id])
    subscribers = relationship(
        "TaskSubscriber",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Task {self.task_type}:{self.task_key} [{self.status}]>"

    def get_payload(self) -> dict[str, Any]:
        """
        Get payload as parsed JSON.

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
        current = self.get_payload()
        current.update(data)
        self.payload = json.dumps(current)

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
            if self.is_abortable is None:
                self.is_abortable = False
        elif status in [
            TaskStatus.SUCCESS.value,
            TaskStatus.FAILURE.value,
            TaskStatus.ABORTED.value,
        ]:
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
        """Check if task has finished (success, failure, or aborted)."""
        return self.status in [
            TaskStatus.SUCCESS.value,
            TaskStatus.FAILURE.value,
            TaskStatus.ABORTED.value,
        ]

    @property
    def is_successful(self) -> bool:
        """Check if task completed successfully."""
        return self.status == TaskStatus.SUCCESS.value

    @property
    def is_aborted(self) -> bool:
        """Check if task was aborted."""
        return self.status == TaskStatus.ABORTED.value

    @property
    def is_aborting(self) -> bool:
        """Check if task is in the process of being aborted."""
        return self.status == TaskStatus.ABORTING.value

    @property
    def can_be_aborted(self) -> bool:
        """
        Check if task can be aborted based on status and is_abortable flag.

        - Pending tasks: Always abortable
        - In-progress tasks: Only if is_abortable=True (has abort handler)
        - Aborting tasks: Already aborting (idempotent)
        - Finished tasks: Cannot be aborted
        """
        if self.is_pending:
            return True
        if self.is_running:
            return self.is_abortable is True
        if self.is_aborting:
            return True  # Already aborting (idempotent)
        return False

    @property
    def duration_seconds(self) -> float | None:
        """
        Get task duration in seconds.

        - Finished tasks: Time from started_at to ended_at
        - Running/aborting tasks: Time from started_at to now
        - Pending tasks: Time from created_on to now (queue time)

        Note: started_at/ended_at are stored in UTC, but created_on from
        AuditMixinNullable is stored as naive local time. We handle both cases.
        """
        if self.started_at and self.ended_at:
            # Finished task - both timestamps use the same timezone (UTC)
            # Just compute the difference directly
            return (self.ended_at - self.started_at).total_seconds()
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

        :returns: Dictionary representation of the task
        """
        return {
            "id": self.id,
            "uuid": self.uuid,
            "task_key": self.task_key,
            "task_type": self.task_type,
            "task_name": self.task_name,
            "scope": self.scope,
            "status": self.status,
            "created_at": self.created_on.isoformat() if self.created_on else None,
            "updated_at": self.changed_on.isoformat() if self.changed_on else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "created_by": self.created_by_fk,
            "user_id": self.user_id,
            "database_id": self.database_id,
            "error_message": self.error_message,
            "payload": self.get_payload(),
            "progress_percent": self.progress_percent,
            "progress_current": self.progress_current,
            "progress_total": self.progress_total,
            "duration_seconds": self.duration_seconds,
            "is_finished": self.is_finished,
            "is_successful": self.is_successful,
            "is_aborted": self.is_aborted,
            "subscriber_count": self.subscriber_count,
            "subscriber_ids": self.get_subscriber_ids(),
            "is_abortable": self.is_abortable,
            "is_aborting": self.is_aborting,
            "can_be_aborted": self.can_be_aborted,
        }
