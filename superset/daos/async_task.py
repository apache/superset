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

"""Async Task DAO for Superset"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from superset_core.api.async_tasks import TaskStatus

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.async_task import AsyncTask

logger = logging.getLogger(__name__)


class AsyncTaskDAO(BaseDAO[AsyncTask]):
    """
    Concrete DAO for async task operations.

    This DAO provides database operations for async tasks, including
    creation, status updates, deduplication, and cleanup operations.
    """

    model_cls: type[AsyncTask] = AsyncTask
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"

    @classmethod
    def create(
        cls,
        task_name: str,
        parameters: dict[str, Any],
        user_id: int | None = None,
        max_retries: int = 3,
        task_signature: str | None = None,
    ) -> AsyncTask:
        """
        Create a new async task.

        Args:
            task_name: Name of the task function
            parameters: Task input parameters
            user_id: ID of the user creating the task
            max_retries: Maximum number of retry attempts
            task_signature: Optional signature for deduplication

        Returns:
            The created AsyncTask instance
        """
        # Check for existing task with same signature
        if task_signature:
            existing_task = cls.get_by_signature(task_signature)
            if existing_task and existing_task.is_active:
                logger.info(
                    "Task with signature %s already exists and is active, reusing task %s",  # noqa: E501
                    task_signature,
                    existing_task.uuid,
                )
                return existing_task

        # Create new task
        task = AsyncTask(
            task_name=task_name,
            status=TaskStatus.PENDING.value,
            max_retries=max_retries,
            task_signature=task_signature,
            user_id=user_id,
        )
        task.parameters_json = parameters

        db.session.add(task)
        db.session.flush()  # Get the ID/UUID

        return task

    @classmethod
    def get_by_uuid(cls, task_uuid: UUID) -> AsyncTask | None:
        """
        Get a task by its UUID.

        Args:
            task_uuid: The task UUID to search for

        Returns:
            The AsyncTask instance or None if not found
        """
        return (
            db.session.query(AsyncTask)
            .filter(AsyncTask.uuid == task_uuid)
            .one_or_none()
        )

    @classmethod
    def get_by_signature(cls, task_signature: str) -> AsyncTask | None:
        """
        Get a task by its signature (for deduplication).

        Args:
            task_signature: The task signature to search for

        Returns:
            The AsyncTask instance or None if not found
        """
        return (
            db.session.query(AsyncTask)
            .filter(AsyncTask.task_signature == task_signature)
            .one_or_none()
        )

    @classmethod
    def update_status(
        cls,
        task_uuid: UUID,
        status: TaskStatus,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
        progress_info: dict[str, Any] | None = None,
    ) -> bool:
        """
        Update task status and related fields.

        Args:
            task_uuid: UUID of the task to update
            status: New task status
            started_at: Task start timestamp
            completed_at: Task completion timestamp
            result: Task execution result
            error_message: Error details if failed
            progress_info: Progress tracking information

        Returns:
            True if update was successful, False otherwise
        """
        try:
            task = cls.get_by_uuid(task_uuid)
            if not task:
                logger.warning(
                    "Task with UUID %s not found for status update", task_uuid
                )
                return False

            # Update status
            task.status = status.value

            # Update timestamps
            if started_at is not None:
                task.started_at = started_at
            if completed_at is not None:
                task.completed_at = completed_at

            # Update result data
            if result is not None:
                task.result_json = result
            if error_message is not None:
                task.error_message = error_message
            if progress_info is not None:
                task.progress_info_json = progress_info

            db.session.flush()
            return True

        except Exception as ex:
            logger.exception("Failed to update task %s status: %s", task_uuid, ex)
            return False

    @classmethod
    def increment_retry_count(cls, task_uuid: UUID) -> bool:
        """
        Increment the retry count for a task.

        Args:
            task_uuid: UUID of the task to update

        Returns:
            True if update was successful, False otherwise
        """
        try:
            task = cls.get_by_uuid(task_uuid)
            if not task:
                logger.warning(
                    "Task with UUID %s not found for retry increment", task_uuid
                )
                return False

            task.retry_count += 1
            db.session.flush()
            return True

        except Exception as ex:
            logger.exception(
                "Failed to increment retry count for task %s: %s", task_uuid, ex
            )
            return False

    @classmethod
    def list_tasks(
        cls,
        user_id: int | None = None,
        status: TaskStatus | None = None,
        task_name: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AsyncTask]:
        """
        List tasks with optional filtering.

        Args:
            user_id: Filter by user ID
            status: Filter by task status
            task_name: Filter by task name
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of matching AsyncTask instances
        """
        query = db.session.query(AsyncTask)

        # Apply filters
        if user_id is not None:
            query = query.filter(AsyncTask.user_id == user_id)
        if status is not None:
            query = query.filter(AsyncTask.status == status.value)
        if task_name is not None:
            query = query.filter(AsyncTask.task_name == task_name)

        # Apply pagination and ordering
        query = query.order_by(AsyncTask.created_on.desc())
        query = query.offset(offset).limit(limit)

        return query.all()

    @classmethod
    def delete_task(cls, task_uuid: UUID) -> bool:
        """
        Delete a task by UUID.

        Args:
            task_uuid: UUID of the task to delete

        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            task = cls.get_by_uuid(task_uuid)
            if not task:
                logger.warning("Task with UUID %s not found for deletion", task_uuid)
                return False

            db.session.delete(task)
            db.session.flush()
            return True

        except Exception as ex:
            logger.exception("Failed to delete task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def cleanup_completed_tasks(cls, older_than_days: int = 30) -> int:
        """
        Clean up completed tasks older than specified days.

        Args:
            older_than_days: Delete tasks completed more than this many days ago

        Returns:
            Number of tasks deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)

            # Delete completed tasks older than cutoff date
            deleted_count = (
                db.session.query(AsyncTask)
                .filter(
                    AsyncTask.status == TaskStatus.COMPLETED.value,
                    AsyncTask.completed_at < cutoff_date,
                )
                .delete(synchronize_session=False)
            )

            db.session.flush()
            logger.info("Cleaned up %d completed async tasks", deleted_count)
            return deleted_count

        except Exception as ex:
            logger.exception("Failed to cleanup completed tasks: %s", ex)
            return 0

    @classmethod
    def get_task_stats(cls) -> dict[str, Any]:
        """
        Get statistics about async tasks.

        Returns:
            Dictionary containing task statistics
        """
        try:
            stats = {}

            # Count by status
            status_counts = (
                db.session.query(AsyncTask.status, db.func.count(AsyncTask.id))
                .group_by(AsyncTask.status)
                .all()
            )

            stats["by_status"] = dict(status_counts)

            # Total tasks
            stats["total"] = db.session.query(AsyncTask).count()

            # Recent tasks (last 24 hours)
            recent_cutoff = datetime.utcnow() - timedelta(hours=24)
            stats["recent_24h"] = (
                db.session.query(AsyncTask)
                .filter(AsyncTask.created_on >= recent_cutoff)
                .count()
            )

            # Average duration for completed tasks
            avg_duration = (
                db.session.query(
                    db.func.avg(
                        db.func.extract(
                            "epoch", AsyncTask.completed_at - AsyncTask.started_at
                        )
                    )
                )
                .filter(
                    AsyncTask.status == TaskStatus.COMPLETED.value,
                    AsyncTask.started_at.isnot(None),
                    AsyncTask.completed_at.isnot(None),
                )
                .scalar()
            )

            avg_duration_seconds: float | None = (
                float(avg_duration) if avg_duration else None
            )
            stats["avg_duration_seconds"] = avg_duration_seconds

            return stats

        except Exception as ex:
            logger.exception("Failed to get task statistics: %s", ex)
            return {}

    @classmethod
    def get_active_tasks_count(cls) -> int:
        """
        Get count of currently active tasks (pending or running).

        Returns:
            Number of active tasks
        """
        return (
            db.session.query(AsyncTask)
            .filter(
                AsyncTask.status.in_(
                    [TaskStatus.PENDING.value, TaskStatus.RUNNING.value]
                )
            )
            .count()
        )

        @classmethod
        def cancel_task(cls, task_uuid: UUID) -> bool:
            """
            Cancel a task by setting its status to cancelled.

            Args:
                task_uuid: UUID of the task to cancel

            Returns:
                True if cancellation was successful, False otherwise
            """
            return cls.update_status(task_uuid, TaskStatus.CANCELLED)

        @classmethod
        def cleanup_old_tasks(cls, older_than_hours: int) -> int:
            """
            Clean up old completed tasks older than specified hours.

            Args:
                older_than_hours: Delete tasks completed more than this many hours ago

            Returns:
                Number of tasks deleted
            """
            older_than_days = older_than_hours / 24.0
            return cls.cleanup_completed_tasks(int(older_than_days))
