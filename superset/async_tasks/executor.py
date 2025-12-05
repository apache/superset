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
Async Task Executor - Celery task implementation for executing async tasks.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from superset_core.api.async_tasks import TaskStatus

from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="async_task_executor", bind=True)
def execute_async_task(
    self,
    task_uuid_str: str,
) -> Any:
    """
    Celery task that executes async tasks by UUID lookup.

    This is the main Celery task that:
    1. Looks up the task details from the database by UUID
    2. Dynamically imports and executes the target function
    3. Updates task status and handles errors/retries
    4. Supports cancellation checks during execution

    Args:
        task_uuid_str: String representation of the task UUID

    Returns:
        Task result data

    Raises:
        Exception: If task execution fails after all retries
    """
    from superset.daos.async_task import AsyncTaskDAO
    from superset.extensions import db

    task_uuid = UUID(task_uuid_str)
    logger.info("Executing async task %s", task_uuid)

    # Get task details from database
    task = AsyncTaskDAO.get_by_uuid(task_uuid)
    if not task:
        raise RuntimeError(f"Task {task_uuid} not found in database")

    try:
        # Update task status to running
        AsyncTaskDAO.update_status(
            task_uuid,
            TaskStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        db.session.commit()

        # Check if task was cancelled before execution
        task = AsyncTaskDAO.get_by_uuid(task_uuid)
        if task and task.status == TaskStatus.CANCELLED.value:
            logger.info("Task %s was cancelled before execution", task_uuid)
            return None

        # Import and execute the actual task function
        if not task:
            raise RuntimeError(f"Task {task_uuid} not found")

        module_path, func_name = task.task_name.rsplit(".", 1)
        module = __import__(module_path, fromlist=[func_name])
        task_func = getattr(module, func_name)

        # Execute the task with parameters
        parameters = task.parameters_json or {}
        args = parameters.get("args", [])
        kwargs = parameters.get("kwargs", {})

        # Add task_uuid to kwargs for cancellation support
        kwargs["task_uuid"] = task_uuid

        result = task_func(*args, **kwargs)

        # Check if task was cancelled during execution
        task = AsyncTaskDAO.get_by_uuid(task_uuid)
        if task and task.status == TaskStatus.CANCELLED.value:
            logger.info("Task %s was cancelled during execution", task_uuid)
            return None

        # Update task status to completed with result
        AsyncTaskDAO.update_status(
            task_uuid,
            TaskStatus.COMPLETED,
            completed_at=datetime.utcnow(),
            result={"data": result} if result is not None else None,
        )
        db.session.commit()

        logger.info("Completed async task %s", task_uuid)
        return result

    except Exception as ex:
        logger.exception("Failed to execute async task %s: %s", task_uuid, ex)

        try:
            # Increment retry count
            AsyncTaskDAO.increment_retry_count(task_uuid)
            db.session.commit()

            # Get updated task to check retry count
            task = AsyncTaskDAO.get_by_uuid(task_uuid)
            if task and task.retry_count < task.max_retries:
                logger.info(
                    "Retrying task %s (attempt %d/%d)",
                    task_uuid,
                    task.retry_count + 1,
                    task.max_retries,
                )
                # Let Celery handle the retry with exponential backoff
                raise self.retry(
                    countdown=min(60 * (2**task.retry_count), 300),  # Cap at 5 minutes
                    max_retries=task.max_retries,
                )
            else:
                # Max retries exceeded, mark as failed
                AsyncTaskDAO.update_status(
                    task_uuid,
                    TaskStatus.COMPLETED,
                    completed_at=datetime.utcnow(),
                    error_message=str(ex),
                )
                db.session.commit()
                raise

        except Exception as db_ex:
            logger.exception("Failed to update task status after error: %s", db_ex)
            db.session.rollback()
            raise


def check_task_cancelled(task_uuid: UUID) -> bool:
    """
    Utility function for tasks to check if they should be cancelled.

    Tasks can call this periodically during long-running operations
    to support graceful cancellation.

    Args:
        task_uuid: UUID of the task to check

    Returns:
        True if task should be cancelled, False otherwise
    """
    try:
        from superset.daos.async_task import AsyncTaskDAO

        task = AsyncTaskDAO.get_by_uuid(task_uuid)
        return task is not None and task.status == TaskStatus.CANCELLED.value

    except Exception as ex:
        logger.warning(
            "Failed to check cancellation status for task %s: %s", task_uuid, ex
        )
        return False
