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

"""Async Task ORM model for Superset"""

from __future__ import annotations

import logging
from typing import Any

import sqlalchemy as sqla
from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from superset_core.api.async_tasks import TaskStatus
from superset_core.api.models import AsyncTask as CoreAsyncTask

from superset.extensions import security_manager
from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.utils import core as utils, json

logger = logging.getLogger(__name__)

metadata = Model.metadata  # pylint: disable=no-member


class AsyncTask(CoreAsyncTask, AuditMixinNullable, UUIDMixin):
    """
    ORM object for async tasks.

    This model stores information about background tasks that can be
    executed asynchronously by various backend systems (Celery, etc.).
    """

    __tablename__ = "async_tasks"
    __table_args__ = (
        sqla.Index("idx_async_task_status", "status"),
        sqla.Index("idx_async_task_task_name", "task_name"),
        sqla.Index("idx_async_task_signature", "task_signature"),
        sqla.Index("idx_async_task_user_status", "user_id", "status"),
        sqla.Index("idx_async_task_created_on", "created_on"),
    )

    id = Column(Integer, primary_key=True)
    task_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default=TaskStatus.PENDING.value)

    # Execution tracking
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)

    # Data fields (JSON serialized)
    parameters = Column(
        utils.MediumText(), nullable=True
    )  # Task input parameters as JSON
    result = Column(utils.MediumText(), nullable=True)  # Task execution result as JSON
    error_message = Column(Text, nullable=True)  # Error details if failed
    progress_info = Column(
        utils.MediumText(), nullable=True
    )  # Progress tracking info as JSON

    # Deduplication
    task_signature = Column(
        String(64), nullable=True, unique=True
    )  # SHA256 hash for deduplication

    # User context
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    user = relationship(security_manager.user_model, foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AsyncTask {self.uuid}: {self.task_name} ({self.status})>"

    @property
    def duration(self) -> float | None:
        """Task duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def is_active(self) -> bool:
        """Check if task is currently active (pending/running)."""
        return self.status in (TaskStatus.PENDING.value, TaskStatus.RUNNING.value)

    @property
    def parameters_json(self) -> dict[str, Any]:
        """Get parameters as parsed JSON."""
        if not self.parameters:
            return {}
        try:
            return json.loads(self.parameters)
        except json.JSONDecodeError:
            logger.warning("Failed to parse parameters JSON for task %s", self.uuid)
            return {}

    @parameters_json.setter
    def parameters_json(self, value: dict[str, Any]) -> None:
        """Set parameters from dict (will be JSON serialized)."""
        self.parameters = json.dumps(value) if value else None

    @property
    def result_json(self) -> dict[str, Any] | None:
        """Get result as parsed JSON."""
        if not self.result:
            return None
        try:
            return json.loads(self.result)
        except json.JSONDecodeError:
            logger.warning("Failed to parse result JSON for task %s", self.uuid)
            return None

    @result_json.setter
    def result_json(self, value: dict[str, Any] | None) -> None:
        """Set result from dict (will be JSON serialized)."""
        self.result = json.dumps(value) if value else None

    @property
    def progress_info_json(self) -> dict[str, Any]:
        """Get progress_info as parsed JSON."""
        if not self.progress_info:
            return {}
        try:
            return json.loads(self.progress_info)
        except json.JSONDecodeError:
            logger.warning("Failed to parse progress_info JSON for task %s", self.uuid)
            return {}

    @progress_info_json.setter
    def progress_info_json(self, value: dict[str, Any]) -> None:
        """Set progress_info from dict (will be JSON serialized)."""
        self.progress_info = json.dumps(value) if value else None

    @hybrid_property
    def perm(self) -> str:
        return f"[AsyncTask].(uuid:{self.uuid})"

    def get_perm(self) -> str:
        return self.perm

    @property
    def data(self) -> dict[str, Any]:
        """Return task data for API responses."""
        return {
            "id": self.id,
            "uuid": str(self.uuid),
            "task_name": self.task_name,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "duration": self.duration,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "parameters": self.parameters_json,
            "result": self.result_json,
            "error_message": self.error_message,
            "progress_info": self.progress_info_json,
            "task_signature": self.task_signature,
            "user_id": self.user_id,
            "created_on": self.created_on.isoformat() if self.created_on else None,
            "changed_on": self.changed_on.isoformat() if self.changed_on else None,
            "is_active": self.is_active,
        }


# Add event listeners for security manager integration
sqla.event.listen(AsyncTask, "after_insert", security_manager.set_perm)
sqla.event.listen(AsyncTask, "after_update", security_manager.set_perm)
sqla.event.listen(AsyncTask, "after_delete", security_manager.del_perm)
