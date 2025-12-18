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
"""AsyncTask DAO for Global Async Task Framework (GATF)"""

import logging
import uuid
from typing import Any

from superset_core.api.types import TaskStatus

from superset.async_tasks.filters import AsyncTaskFilter
from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAOCreateFailedError
from superset.extensions import db
from superset.models.async_tasks import AsyncTask

logger = logging.getLogger(__name__)


class AsyncTaskDAO(BaseDAO[AsyncTask]):
    """
    Concrete AsyncTaskDAO for the Global Async Task Framework (GATF).

    Provides database access operations for async tasks including
    creation, status management, and filtering.
    """

    base_filter = AsyncTaskFilter

    @classmethod
    def find_by_task_id(cls, task_id: str) -> AsyncTask | None:
        """
        Find active task by deduplication ID.

        Only returns tasks that are pending or in progress.
        Completed/cancelled tasks are kept for logging but not returned here.

        :param task_id: Task identifier for deduplication
        :returns: AsyncTask instance or None if not found or not active
        """
        return (
            db.session.query(AsyncTask)
            .filter(
                AsyncTask.task_id == task_id,
                AsyncTask.status.in_(
                    [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]
                ),
            )
            .one_or_none()
        )

    @classmethod
    def create_task(
        cls, task_type: str, task_id: str | None = None, **kwargs: Any
    ) -> AsyncTask:
        """
        Create a new async task.

        :param task_type: Type of task to create
        :param task_id: Optional task identifier for deduplication. If not provided,
                       a random UUID will be generated.
        :param kwargs: Additional task attributes
        :returns: Created AsyncTask instance
        :raises DAOCreateFailedError: If task with same task_id already exists and is
                active
        """
        # Generate task_id if not provided
        if task_id is None:
            task_id = str(uuid.uuid4())

        # Check if task with same task_id already exists and is active
        if existing := cls.find_by_task_id(task_id):
            raise DAOCreateFailedError(
                f"Task with ID '{task_id}' already exists "
                f"and is active (status: {existing.status})"
            )

        # Create new task
        task_data = {
            "task_id": task_id,
            "task_type": task_type,
            "status": TaskStatus.PENDING.value,
            **kwargs,
        }

        task = cls.create(attributes=task_data)
        db.session.commit()

        logger.info("Created new async task: %s (type: %s)", task_id, task_type)
        return task

    @classmethod
    def cancel_task(cls, task_uuid: str) -> bool:
        """
        Cancel a task by UUID.

        :param task_uuid: UUID of task to cancel
        :returns: True if task was cancelled, False if not found or already finished
        """
        task = cls.find_one_or_none(uuid=task_uuid)
        if not task:
            return False

        if task.status not in [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]:
            return False

        task.set_status(TaskStatus.CANCELLED.value)
        db.session.commit()

        logger.info("Cancelled task: %s", task_uuid)
        return True
