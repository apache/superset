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
"""Task manager for the Global Async Task Framework (GATF)"""

import logging
from typing import Any

from superset.async_tasks.utils import generate_random_task_key
from superset.daos.async_tasks import AsyncTaskDAO
from superset.daos.exceptions import DAOCreateFailedError
from superset.models.async_tasks import AsyncTask

logger = logging.getLogger(__name__)


class TaskManager:
    """
    Handles task creation and scheduling.

    The TaskManager is responsible for:
    1. Creating task entries in the metastore (AsyncTask model)
    2. Scheduling task execution via Celery
    3. Handling deduplication (returning existing active task if duplicate)
    """

    @staticmethod
    def submit_task(
        task_type: str,
        task_key: str | None,
        task_name: str | None,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> AsyncTask:
        """
        Create task entry and schedule for async execution.

        Flow:
        1. Generate task_id if not provided (random UUID)
        2. Create AsyncTask record in metastore (with PENDING status)
        3. If duplicate active task exists, return it instead
        4. Submit to Celery for background execution
        5. Return AsyncTask model to caller

        :param task_type: Task type identifier (e.g., "superset.generate_thumbnail")
        :param task_key: Optional deduplication key (None for random UUID)
        :param task_name: Human readable task name
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :returns: AsyncTask model representing the scheduled task
        """
        if task_key is None:
            task_key = generate_random_task_key()

        try:
            # Create task entry in metastore
            task = AsyncTaskDAO.create_task(
                task_key=task_key,
                task_type=task_type,
                task_name=task_name,
            )

            # Import here to avoid circular dependency
            from superset.async_tasks.executor import execute_async_task

            # Schedule Celery task for background execution
            execute_async_task.delay(
                task_uuid=task.uuid,
                task_type=task_type,
                args=args,
                kwargs=kwargs,
            )

            logger.info(
                "Scheduled async task %s (uuid=%s) for background execution",
                task_type,
                task.uuid,
            )

            return task

        except DAOCreateFailedError:
            # Task with same task_key already exists and is active
            # Return existing task instead of creating duplicate
            existing = AsyncTaskDAO.find_by_task_key(task_type, task_key)
            if existing:
                logger.info(
                    "Task %s with key '%s' already exists (uuid=%s), returning "
                    "existing task",
                    task_type,
                    task_key,
                    existing.uuid,
                )
                return existing

            # Race condition: task completed between check and here
            # Try again to create new task
            logger.warning(
                "Race condition detected for task %s with key '%s', retrying",
                task_type,
                task_key,
            )
            return TaskManager.submit_task(task_type, task_key, task_name, args, kwargs)
