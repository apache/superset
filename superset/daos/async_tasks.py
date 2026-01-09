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

from superset_core.api.async_tasks import TaskStatus

from superset.async_tasks.filters import AsyncTaskFilter
from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAOCreateFailedError
from superset.extensions import db
from superset.models.async_tasks import AsyncTask
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class AsyncTaskDAO(BaseDAO[AsyncTask]):
    """
    Concrete AsyncTaskDAO for the Global Async Task Framework (GATF).

    Provides database access operations for async tasks including
    creation, status management, and filtering.
    """

    base_filter = AsyncTaskFilter

    @classmethod
    def find_by_task_key(cls, task_type: str, task_key: str) -> AsyncTask | None:
        """
        Find active task by type and deduplication ID.

        Only returns tasks that are pending or in progress.
        Completed/aborted tasks are kept for logging but not returned here.

        :param task_type: Task type to filter by
        :param task_key: Task identifier for deduplication
        :returns: AsyncTask instance or None if not found or not active
        """
        return (
            db.session.query(AsyncTask)
            .filter(
                AsyncTask.task_type == task_type,
                AsyncTask.task_key == task_key,
                AsyncTask.status.in_(
                    [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]
                ),
            )
            .one_or_none()
        )

    @classmethod
    @transaction()
    def create_task(
        cls, task_type: str, task_key: str | None = None, **kwargs: Any
    ) -> AsyncTask:
        """
        Create a new async task.

        :param task_type: Type of task to create
        :param task_key: Optional task identifier for deduplication. If not provided,
                         a random UUID will be generated.
        :param kwargs: Additional task attributes
        :returns: Created AsyncTask instance
        :raises DAOCreateFailedError: If task with same task_key already exists and is
                active
        """
        # Generate task_key if not provided
        if task_key is None:
            task_key = str(uuid.uuid4())

        # Check if task with same task_type and task_key already exists and is active
        if existing := cls.find_by_task_key(task_type, task_key):
            raise DAOCreateFailedError(
                f"Task with key '{task_key}' already exists "
                f"and is active (status: {existing.status})"
            )

        # Create new task
        task_data = {
            "task_type": task_type,
            "task_key": task_key,
            "status": TaskStatus.PENDING.value,
            **kwargs,
        }

        task = cls.create(attributes=task_data)

        logger.info("Created new async task: %s (type: %s)", task_key, task_type)
        return task

    @classmethod
    @transaction()
    def abort_task(cls, task_uuid: str, skip_base_filter: bool = False) -> bool:
        """
        Abort a task by UUID.

        :param task_uuid: UUID of task to abort
        :param skip_base_filter: If True, skip base filter (for admin abortions)
        :returns: True if task was aborted, False if not found or already finished
        """
        task = cls.find_one_or_none(skip_base_filter=skip_base_filter, uuid=task_uuid)
        if not task:
            return False

        if task.status not in [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]:
            return False

        task.set_status(TaskStatus.ABORTED.value)

        logger.info("Aborted task: %s", task_uuid)
        return True

    @classmethod
    def bulk_abort_tasks(
        cls, task_uuids: list[str], skip_base_filter: bool = False
    ) -> tuple[int, int]:
        """
        Abort multiple tasks by UUIDs.

        This method does NOT use @transaction() to allow partial success -
        successfully aborted tasks will be committed even if some fail.

        :param task_uuids: List of task UUIDs to abort
        :param skip_base_filter: If True, skip base filter (for admin abortions)
        :returns: Tuple of (aborted_count, total_requested)
        """
        if not task_uuids:
            return 0, 0

        total_requested = len(task_uuids)

        all_tasks = cls.find_by_ids(
            task_uuids, skip_base_filter=skip_base_filter, id_column="uuid"
        )

        abortable_tasks = [
            task
            for task in all_tasks
            if task.status in [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]
        ]

        aborted_count = 0
        for task in abortable_tasks:
            try:
                task.set_status(TaskStatus.ABORTED.value)
                db.session.commit()
                aborted_count += 1
            except Exception as ex:
                logger.error("Failed to abort task %s: %s", task.uuid, str(ex))
                db.session.rollback()
                # Continue with other tasks

        logger.info("Bulk aborted %d out of %d tasks", aborted_count, total_requested)
        return aborted_count, total_requested

    @classmethod
    @transaction()
    def delete_old_completed_tasks(cls, older_than: Any, batch_size: int = 1000) -> int:
        """
        Delete old completed async tasks.

        This method does NOT apply base filter as it's intended for
        administrative cleanup of old tasks across all users.

        :param older_than: Delete tasks completed before this datetime
        :param batch_size: Number of tasks to delete per batch
        :returns: Count of deleted tasks
        """
        from datetime import datetime

        total_deleted = 0

        while True:
            # Find batch of old completed tasks
            tasks_to_delete = (
                db.session.query(AsyncTask)
                .filter(
                    AsyncTask.ended_at < older_than,
                    AsyncTask.status.in_(
                        [
                            TaskStatus.SUCCESS.value,
                            TaskStatus.FAILURE.value,
                            TaskStatus.ABORTED.value,
                        ]
                    ),
                )
                .limit(batch_size)
                .all()
            )

            if not tasks_to_delete:
                break

            # Delete batch
            for task in tasks_to_delete:
                db.session.delete(task)

            batch_count = len(tasks_to_delete)
            total_deleted += batch_count

            logger.info("Deleted batch of %d old async tasks", batch_count)

        logger.info(
            "Completed deletion of %d old async tasks older than %s",
            total_deleted,
            older_than if isinstance(older_than, datetime) else str(older_than),
        )

        return total_deleted
