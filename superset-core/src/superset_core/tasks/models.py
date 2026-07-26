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

"""
Task model API for superset-core.

Provides task-related model classes that will be replaced by host implementations
during initialization for extension developers to use.

Usage:
    from superset_core.tasks.models import Task, TaskSubscriber
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, TYPE_CHECKING
from uuid import UUID

from superset_core.common.models import CoreModel

if TYPE_CHECKING:
    from superset_core.tasks.types import TaskProperties


class Task(CoreModel):
    """
    Abstract Task model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.

    This model represents async tasks in the Global Task Framework (GTF).

    Non-filterable fields (progress, error info, execution config) are stored
    in a `properties` JSON blob for schema flexibility.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    id: int
    uuid: UUID
    task_key: str  # For deduplication
    task_type: str  # e.g., 'sql_execution'
    task_name: str | None  # Human readable name
    scope: str  # private/shared/system
    status: str
    dedup_key: str  # Computed deduplication key

    # Timestamps (from AuditMixinNullable)
    created_on: datetime | None
    changed_on: datetime | None
    started_at: datetime | None
    ended_at: datetime | None

    # User context
    created_by_fk: int | None
    user_id: int | None

    # Task output data
    payload: str  # JSON serialized task output data

    def get_payload(self) -> dict[str, Any]:
        """
        Get payload as parsed JSON.

        Payload contains task-specific output data set by task code.

        Host implementations will replace this method during initialization
        with concrete implementation providing actual functionality.

        :returns: Dictionary containing payload data
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def set_payload(self, data: dict[str, Any]) -> None:
        """
        Update payload with new data (merges with existing).

        Host implementations will replace this method during initialization
        with concrete implementation providing actual functionality.

        :param data: Dictionary of data to merge into payload
        """
        raise NotImplementedError("Method will be replaced during initialization")

    @property
    def properties(self) -> Any:
        """
        Get typed properties (runtime state and execution config).

        Properties contain:
        - is_abortable: bool | None - has abort handler registered
        - progress_percent: float | None - progress 0.0-1.0
        - progress_current: int | None - current iteration count
        - progress_total: int | None - total iterations
        - error_message: str | None - human-readable error message
        - exception_type: str | None - exception class name
        - stack_trace: str | None - full formatted traceback
        - timeout: int | None - timeout in seconds

        Host implementations will replace this property during initialization.

        :returns: TaskProperties dataclass instance
        """
        raise NotImplementedError("Property will be replaced during initialization")

    def update_properties(self, updates: "TaskProperties") -> None:
        """
        Update specific properties fields (merge semantics).

        Only updates fields present in the updates dict.

        Host implementations will replace this method during initialization.

        :param updates: TaskProperties dict with fields to update

        Example:
            task.update_properties({"is_abortable": True})
        """
        raise NotImplementedError("Method will be replaced during initialization")


class TaskSubscriber(CoreModel):
    """
    Abstract TaskSubscriber model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.

    This model tracks task subscriptions for multi-user shared tasks. When a user
    schedules a shared task with the same parameters as an existing task,
    they are subscribed to that task instead of creating a duplicate.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    task_id: int
    user_id: int
    subscribed_at: datetime

    # Audit fields from AuditMixinNullable
    created_on: datetime | None
    changed_on: datetime | None
    created_by_fk: int | None
    changed_by_fk: int | None


__all__ = [
    "Task",
    "TaskSubscriber",
]
