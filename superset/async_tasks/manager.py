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
Async Task Manager - simplified Celery-focused implementation.

This manager coordinates database operations with Celery task execution,
while maintaining a clean interface for future backend extensibility.
"""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import UUID

from flask import g, has_app_context
from superset_core.api.async_tasks import TaskStatus

from superset.daos.async_task import AsyncTaskDAO
from superset.extensions import celery_app, db

logger = logging.getLogger(__name__)


class AsyncTaskManager:
    """
    Central coordinator for async task operations using Celery.

    This manager coordinates between the database layer (DAO) and
    Celery for task execution. The interface is designed to be easily
    extensible to other backends in the future.
    """

    def __init__(self) -> None:
        """Initialize the task manager with Celery backend."""
        self.dao = AsyncTaskDAO

    def submit_task(
        self,
        task_name: str,
        parameters: dict[str, Any],
        max_retries: int = 3,
        task_signature: str | None = None,
        user_id: int | None = None,
    ) -> UUID:
        """
        Submit a task for asynchronous execution using Celery.

        Args:
            task_name: Name of the task function to execute
            parameters: Task input parameters
            max_retries: Maximum number of retry attempts
            task_signature: Optional signature for deduplication
            user_id: ID of the user submitting the task

        Returns:
            UUID of the created task

        Raises:
            RuntimeError: If task submission fails
        """
        # Get user ID from Flask context if not provided
        if user_id is None and has_app_context() and hasattr(g, "user") and g.user:
            user_id = g.user.id

        # Create task in database
        task = self.dao.create_task(
            task_name=task_name,
            parameters=parameters,
            user_id=user_id,
            max_retries=max_retries,
            task_signature=task_signature,
        )

        try:
            # Commit the task to database before submitting to Celery
            db.session.commit()

            # Submit to Celery using our executor
            celery_result = celery_app.send_task(
                "async_task_executor",
                args=[str(task.uuid)],
                task_id=str(task.uuid),
                retry_policy={
                    "max_retries": max_retries,
                    "interval_start": 1.0,
                    "interval_step": 2.0,
                    "interval_max": 60.0,
                },
            )

            if not celery_result:
                # Mark task as failed if Celery submission failed
                self.dao.update_status(
                    task.uuid,
                    TaskStatus.COMPLETED,
                    error_message="Failed to submit task to Celery",
                )
                db.session.commit()
                raise RuntimeError(f"Failed to submit task {task.uuid} to Celery")

            logger.info(
                "Successfully submitted task %s (%s) for user %s",
                task_name,
                task.uuid,
                user_id,
            )

            return task.uuid

        except Exception as ex:
            # Rollback database changes if submission failed
            db.session.rollback()
            logger.exception("Failed to submit task %s: %s", task_name, ex)
            raise

    def get_task(self, task_uuid: UUID) -> dict[str, Any] | None:
        """
        Get task information by UUID.

        Args:
            task_uuid: UUID of the task to retrieve

        Returns:
            Task data dictionary or None if not found
        """
        task = self.dao.get_by_uuid(task_uuid)
        return task.data if task else None

    def get_status(self, task_uuid: UUID) -> TaskStatus:
        """
        Get current task status.

        Args:
            task_uuid: UUID of the task to check

        Returns:
            Current task status
        """
        task = self.dao.get_by_uuid(task_uuid)
        if not task:
            return TaskStatus.COMPLETED  # Assume completed if not found

        return TaskStatus(task.status)

    def is_ready(self, task_uuid: UUID) -> bool:
        """
        Check if task has completed execution.

        Args:
            task_uuid: UUID of the task to check

        Returns:
            True if task is completed, False otherwise
        """
        status = self.get_status(task_uuid)
        return status in (TaskStatus.COMPLETED, TaskStatus.CANCELLED)

    def is_successful(self, task_uuid: UUID) -> bool:
        """
        Check if task completed successfully.

        Args:
            task_uuid: UUID of the task to check

        Returns:
            True if task completed successfully, False otherwise
        """
        task = self.dao.get_by_uuid(task_uuid)
        if not task:
            return False

        return task.status == TaskStatus.COMPLETED.value and task.error_message is None

    def is_failed(self, task_uuid: UUID) -> bool:
        """
        Check if task failed.

        Args:
            task_uuid: UUID of the task to check

        Returns:
            True if task failed, False otherwise
        """
        task = self.dao.get_by_uuid(task_uuid)
        if not task:
            return False

        return (
            task.status == TaskStatus.COMPLETED.value and task.error_message is not None
        )

    def get_result(self, task_uuid: UUID, timeout: float | None = None) -> Any:
        """
        Get task result, blocking until completion if necessary.

        Args:
            task_uuid: UUID of the task
            timeout: Maximum time to wait in seconds

        Returns:
            Task result data

        Raises:
            TimeoutError: If timeout is exceeded
            RuntimeError: If task failed
        """
        start_time = time.time()

        while True:
            task = self.dao.get_by_uuid(task_uuid)
            if not task:
                raise RuntimeError(f"Task {task_uuid} not found")

            # Check if task is completed
            if task.status == TaskStatus.COMPLETED.value:
                if task.error_message:
                    raise RuntimeError(f"Task failed: {task.error_message}")
                return task.result_json.get("data") if task.result_json else None

            elif task.status == TaskStatus.CANCELLED.value:
                raise RuntimeError("Task was cancelled")

            # Check timeout
            if timeout is not None:
                elapsed = time.time() - start_time
                if elapsed >= timeout:
                    raise TimeoutError(
                        f"Task {task_uuid} did not complete within {timeout} seconds"
                    )

            # Wait before checking again
            time.sleep(0.5)

    def cancel_task(self, task_uuid: UUID) -> bool:
        """
        Cancel a running or pending task using Celery.

        Args:
            task_uuid: UUID of the task to cancel

        Returns:
            True if cancellation was successful, False otherwise
        """
        try:
            # Cancel in Celery first
            celery_app.control.revoke(str(task_uuid), terminate=True)

            # Update status in database
            dao_success = self.dao.update_status(
                task_uuid,
                TaskStatus.CANCELLED,
            )

            if dao_success:
                db.session.commit()
                logger.info("Cancelled task %s", task_uuid)
                return True
            else:
                return False

        except Exception as ex:
            logger.exception("Failed to cancel task %s: %s", task_uuid, ex)
            db.session.rollback()
            return False

    def retry_task(self, task_uuid: UUID) -> bool:
        """
        Retry a failed task by resubmitting to Celery.

        Args:
            task_uuid: UUID of the task to retry

        Returns:
            True if retry was successful, False otherwise
        """
        try:
            # Get original task details
            task = self.dao.get_by_uuid(task_uuid)
            if not task:
                return False

            # Reset task status
            dao_success = self.dao.update_status(
                task_uuid,
                TaskStatus.PENDING,
                started_at=None,
                completed_at=None,
                error_message=None,
            )

            if not dao_success:
                return False

            # Resubmit to Celery
            celery_result = celery_app.send_task(
                "async_task_executor",
                args=[str(task_uuid)],
                task_id=str(task_uuid),
                retry_policy={
                    "max_retries": task.max_retries,
                    "interval_start": 1.0,
                    "interval_step": 2.0,
                    "interval_max": 60.0,
                },
            )

            if celery_result:
                db.session.commit()
                logger.info("Retrying task %s", task_uuid)
                return True
            else:
                db.session.rollback()
                return False

        except Exception as ex:
            logger.exception("Failed to retry task %s: %s", task_uuid, ex)
            db.session.rollback()
            return False

    def list_tasks(
        self,
        user_id: int | None = None,
        status: TaskStatus | None = None,
        task_name: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        List tasks with optional filtering.

        Args:
            user_id: Filter by user ID
            status: Filter by task status
            task_name: Filter by task name
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of task data dictionaries
        """
        tasks = self.dao.list_tasks(
            user_id=user_id,
            status=status,
            task_name=task_name,
            limit=limit,
            offset=offset,
        )

        return [task.data for task in tasks]

    def cleanup_completed_tasks(self, older_than_days: int = 30) -> int:
        """
        Clean up completed tasks older than specified days.

        Args:
            older_than_days: Delete tasks completed more than this many days ago

        Returns:
            Number of tasks deleted
        """
        try:
            count = self.dao.cleanup_completed_tasks(older_than_days)
            if count > 0:
                db.session.commit()
            return count
        except Exception as ex:
            logger.exception("Failed to cleanup tasks: %s", ex)
            db.session.rollback()
            return 0

    def get_stats(self) -> dict[str, Any]:
        """
        Get statistics about async tasks and Celery.

        Returns:
            Dictionary containing task and backend statistics
        """
        stats = self.dao.get_task_stats()

        # Add Celery-specific stats
        try:
            inspect = celery_app.control.inspect()
            active_tasks = inspect.active()
            scheduled_tasks = inspect.scheduled()

            # Calculate totals across all workers
            total_active = sum(len(tasks) for tasks in (active_tasks or {}).values())
            total_scheduled = sum(
                len(tasks) for tasks in (scheduled_tasks or {}).values()
            )

            stats["backend_info"] = {
                "type": "celery",
                "active_tasks": total_active,
                "scheduled_tasks": total_scheduled,
                "workers": list((active_tasks or {}).keys()),
                "healthy": True,
            }

        except Exception as ex:
            logger.warning("Could not get Celery stats: %s", ex)
            stats["backend_info"] = {
                "type": "celery",
                "healthy": False,
                "error": str(ex),
            }

        return stats


# Global instance - simplified singleton pattern
_manager_instance: AsyncTaskManager | None = None


def get_async_task_manager() -> AsyncTaskManager:
    """
    Get the global async task manager instance.

    Returns:
        AsyncTaskManager instance using Celery backend
    """
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = AsyncTaskManager()
    return _manager_instance
