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
"""AsyncTask model for Global Async Task Framework (GATF)"""

import uuid
from datetime import datetime
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from superset_core.api.models import AsyncTask as CoreAsyncTask
from superset_core.api.types import TaskStatus

from superset.models.helpers import AuditMixinNullable
from superset.utils import json


class AsyncTask(CoreAsyncTask, AuditMixinNullable, Model):
    """
    Concrete AsyncTask model for the Global Async Task Framework (GATF).

    This model represents async tasks in Superset, providing unified tracking
    for all background operations including SQL queries, thumbnail generation,
    reports, and other async operations.
    """

    __tablename__ = "async_tasks"

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4())
    )
    task_id = Column(String(256), nullable=False, index=True)  # For deduplication
    task_type = Column(String(100), nullable=False, index=True)  # e.g., 'sql_execution'
    task_name = Column(String(256), nullable=True)  # Human readable name
    status = Column(
        String(50), nullable=False, index=True, default=TaskStatus.PENDING.value
    )
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

    # Relationships
    database = relationship("Database", foreign_keys=[database_id])

    def __repr__(self) -> str:
        return f"<AsyncTask {self.task_type}:{self.task_id} [{self.status}]>"

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
        Update task status.

        :param status: New task status
        """
        if isinstance(status, TaskStatus):
            status = status.value
        self.status = status

        # Update timestamps based on status
        now = datetime.utcnow()
        if status == TaskStatus.IN_PROGRESS.value and not self.started_at:
            self.started_at = now
        elif status in [
            TaskStatus.SUCCESS.value,
            TaskStatus.FAILURE.value,
            TaskStatus.CANCELLED.value,
        ]:
            if not self.ended_at:
                self.ended_at = now

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
        """Check if task has finished (success, failure, or cancelled)."""
        return self.status in [
            TaskStatus.SUCCESS.value,
            TaskStatus.FAILURE.value,
            TaskStatus.CANCELLED.value,
        ]

    @property
    def is_successful(self) -> bool:
        """Check if task completed successfully."""
        return self.status == TaskStatus.SUCCESS.value

    @property
    def is_cancelled(self) -> bool:
        """Check if task was cancelled."""
        return self.status == TaskStatus.CANCELLED.value

    @property
    def duration_seconds(self) -> float | None:
        """Get task duration in seconds if both start and end times are set."""
        if self.started_at and self.ended_at:
            return (self.ended_at - self.started_at).total_seconds()
        return None

    def to_dict(self) -> dict[str, Any]:
        """
        Convert task to dictionary representation.

        :returns: Dictionary representation of the task
        """
        return {
            "id": self.id,
            "uuid": self.uuid,
            "task_id": self.task_id,
            "task_type": self.task_type,
            "task_name": self.task_name,
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
            "duration_seconds": self.duration_seconds,
            "is_finished": self.is_finished,
            "is_successful": self.is_successful,
            "is_cancelled": self.is_cancelled,
        }
