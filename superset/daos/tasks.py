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
"""Task DAO for Global Task Framework (GTF)"""

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from superset_core.api.tasks import TaskScope, TaskStatus

from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAOCreateFailedError, DAODeleteFailedError
from superset.extensions import db
from superset.models.task_subscribers import TaskSubscriber
from superset.models.tasks import Task
from superset.tasks.filters import TaskFilter
from superset.tasks.utils import get_active_dedup_key
from superset.utils.core import get_user_id
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class TaskDAO(BaseDAO[Task]):
    """
    Concrete TaskDAO for the Global Task Framework (GTF).

    Provides database access operations for async tasks including
    creation, status management, filtering, and subscription management
    for shared tasks.
    """

    base_filter = TaskFilter

    @classmethod
    def find_by_task_key(
        cls,
        task_type: str,
        task_key: str,
        scope: TaskScope | str = TaskScope.PRIVATE,
        user_id: int | None = None,
    ) -> Task | None:
        """
        Find active task by type, key, scope, and user.

        Uses dedup_key internally for efficient querying with a unique index.
        Only returns tasks that are active (pending or in progress).

        Uniqueness logic by scope:
        - private: scope + task_type + task_key + user_id
        - shared/system: scope + task_type + task_key (user-agnostic)

        :param task_type: Task type to filter by
        :param task_key: Task identifier for deduplication
        :param scope: Task scope (private/shared/system)
        :param user_id: User ID (required for private tasks)
        :returns: Task instance or None if not found or not active
        """
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
        )

        # Simple single-column query with unique index
        return db.session.query(Task).filter(Task.dedup_key == dedup_key).one_or_none()

    @classmethod
    @transaction()
    def create_task(
        cls,
        task_type: str,
        task_key: str | None = None,
        scope: TaskScope | str = TaskScope.PRIVATE,
        user_id: int | None = None,
        **kwargs: Any,
    ) -> Task:
        """
        Create a new async task with scope-aware deduplication.

        For shared tasks, if a task with the same parameters already exists,
        the current user is subscribed to it instead of creating a duplicate.

        :param task_type: Type of task to create
        :param task_key: Optional task identifier for deduplication
        :param scope: Task scope (private/shared/system), defaults to private
        :param user_id: User ID creating the task (required for subscription)
        :param kwargs: Additional task attributes
        :returns: Created or existing Task instance
        :raises DAOCreateFailedError: If duplicate private task exists
        """
        from superset_core.api.tasks import TaskScope

        from superset.tasks.utils import get_active_dedup_key

        # Generate task_key if not provided
        if task_key is None:
            task_key = str(uuid.uuid4())

        # Build dedup_key for active task
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
        )

        # Check for existing active task using dedup_key
        if existing := cls.find_by_task_key(task_type, task_key, scope, user_id):
            # For shared tasks, subscribe user to existing task
            if (
                scope == TaskScope.SHARED
                and user_id
                and not existing.has_subscriber(user_id)
            ):
                cls.add_subscriber(existing.id, user_id)
                logger.info(
                    "User %s subscribed to existing shared task: %s",
                    user_id,
                    task_key,
                )
                return existing

            # For private/system tasks or already subscribed, raise error
            raise DAOCreateFailedError(
                f"Task with key '{task_key}' already exists "
                f"and is active (status: {existing.status})"
            )

        # Create new task with dedup_key
        # Handle both TaskScope enum and string values
        scope_value = scope.value if isinstance(scope, TaskScope) else scope

        task_data = {
            "task_type": task_type,
            "task_key": task_key,
            "scope": scope_value,
            "status": TaskStatus.PENDING.value,
            "dedup_key": dedup_key,
            **kwargs,
        }

        # Determine user_id: use provided value or fall back to current user
        effective_user_id = user_id if user_id is not None else get_user_id()
        if effective_user_id is not None:
            task_data["user_id"] = effective_user_id

        task = cls.create(attributes=task_data)

        # Flush to get the task ID (auto-incremented primary key)
        db.session.flush()

        # Auto-subscribe creator for all tasks (not just shared)
        # This enables consistent subscriber display across all task types
        if effective_user_id:
            cls.add_subscriber(task.id, effective_user_id)
            logger.info(
                "Creator %s auto-subscribed to task: %s (scope: %s)",
                effective_user_id,
                task_key,
                scope_value,
            )

        logger.info(
            "Created new async task: %s (type: %s, scope: %s)",
            task_key,
            task_type,
            scope_value,
        )
        return task

    @classmethod
    @transaction()
    def abort_task(cls, task_uuid: str, skip_base_filter: bool = False) -> bool:
        """
        Abort a task by UUID.

        Abort behavior by status:
        - PENDING: Goes directly to ABORTED (always abortable)
        - IN_PROGRESS with is_abortable=True: Goes to ABORTING
        - IN_PROGRESS with is_abortable=False/None: Raises TaskNotAbortableError
        - ABORTING: Returns True (idempotent)
        - Finished statuses: Returns False

        For shared tasks, only aborts if:
        - Admin is aborting (skip_base_filter=True), OR
        - This is the last subscriber unsubscribing

        :param task_uuid: UUID of task to abort
        :param skip_base_filter: If True, skip base filter (for admin abortions)
        :returns: True if task was aborted/aborting, False if not found or finished
        :raises TaskNotAbortableError: If in-progress task has no abort handler
        """
        from superset.commands.tasks.exceptions import TaskNotAbortableError

        task = cls.find_one_or_none(skip_base_filter=skip_base_filter, uuid=task_uuid)
        if not task:
            return False

        # Already aborting - idempotent success
        if task.status == TaskStatus.ABORTING.value:
            logger.info("Task %s is already aborting", task_uuid)
            return True

        # Already finished - cannot abort
        if task.status not in [TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]:
            return False

        # For shared tasks, check subscriber count
        if task.is_shared and not skip_base_filter:
            # Don't abort if there are still other subscribers
            if task.subscriber_count > 0:
                logger.info(
                    "Not aborting shared task %s - %d subscriber(s) remain",
                    task_uuid,
                    task.subscriber_count,
                )
                return False

        # PENDING: Go directly to ABORTED
        if task.status == TaskStatus.PENDING.value:
            task.set_status(TaskStatus.ABORTED)
            logger.info("Aborted pending task: %s (scope: %s)", task_uuid, task.scope)
            return True

        # IN_PROGRESS: Check if abortable
        if task.status == TaskStatus.IN_PROGRESS.value:
            if task.is_abortable is not True:
                raise TaskNotAbortableError(
                    f"Task {task_uuid} is in progress but has not registered "
                    "an abort handler (is_abortable is not true)"
                )

            # Transition to ABORTING (not ABORTED yet)
            task.status = TaskStatus.ABORTING.value
            db.session.merge(task)
            logger.info("Set task %s to ABORTING (scope: %s)", task_uuid, task.scope)
            return True

        return False

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
            if task.status
            in [
                TaskStatus.PENDING.value,
                TaskStatus.IN_PROGRESS.value,
                TaskStatus.ABORTING.value,
            ]
        ]

        aborted_count = 0
        for task in abortable_tasks:
            try:
                # Already aborting - count as success (idempotent)
                if task.status == TaskStatus.ABORTING.value:
                    aborted_count += 1
                    continue

                # PENDING: Go directly to ABORTED
                if task.status == TaskStatus.PENDING.value:
                    task.set_status(TaskStatus.ABORTED)
                    db.session.commit()
                    aborted_count += 1
                    continue

                # IN_PROGRESS: Check if abortable, transition to ABORTING
                if task.status == TaskStatus.IN_PROGRESS.value:
                    if task.is_abortable is True:
                        task.status = TaskStatus.ABORTING.value
                        db.session.merge(task)
                        db.session.commit()
                        aborted_count += 1
                    else:
                        logger.warning(
                            "Task %s is not abortable (no abort handler registered)",
                            task.uuid,
                        )
                    continue

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
                db.session.query(Task)
                .filter(
                    Task.ended_at < older_than,
                    Task.status.in_(
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

    # Subscription management methods

    @classmethod
    def add_subscriber(cls, task_id: int, user_id: int) -> bool:
        """
        Add a user as a subscriber to a task.

        :param task_id: ID of the task
        :param user_id: ID of the user to subscribe
        :returns: True if subscriber was added, False if already exists
        """
        try:
            subscription = TaskSubscriber(
                task_id=task_id,
                user_id=user_id,
                subscribed_at=datetime.utcnow(),
            )
            db.session.add(subscription)
            db.session.commit()
            logger.info("Added subscriber %s to task %s", user_id, task_id)
            return True
        except IntegrityError:
            # Subscription already exists
            db.session.rollback()
            logger.debug(
                "Subscriber %s already subscribed to task %s", user_id, task_id
            )
            return False

    @classmethod
    @transaction()
    def remove_subscriber(cls, task_id: int, user_id: int) -> bool:
        """
        Remove a user's subscription from a task.

        If this was the last subscriber for a shared task, the task is aborted.

        :param task_id: ID of the task
        :param user_id: ID of the user to unsubscribe
        :returns: True if subscriber was removed, False if not subscribed
        :raises DAODeleteFailedError: If subscription removal fails
        """
        subscription = (
            db.session.query(TaskSubscriber)
            .filter(
                TaskSubscriber.task_id == task_id,
                TaskSubscriber.user_id == user_id,
            )
            .one_or_none()
        )

        if not subscription:
            return False

        try:
            db.session.delete(subscription)

            # Check if this was the last subscriber for a shared task
            remaining_count = (
                db.session.query(TaskSubscriber)
                .filter(TaskSubscriber.task_id == task_id)
                .count()
            )

            if remaining_count == 0:
                # Get task to check if it's shared and needs abortion
                task = db.session.query(Task).get(task_id)
                if task and task.is_shared:
                    if task.status in [
                        TaskStatus.PENDING.value,
                        TaskStatus.IN_PROGRESS.value,
                    ]:
                        task.set_status(TaskStatus.ABORTED.value)
                        logger.info(
                            "Auto-aborted shared task %s (last subscriber removed)",
                            task.uuid,
                        )

            logger.info("Removed subscriber %s from task %s", user_id, task_id)
            return True

        except Exception as ex:
            raise DAODeleteFailedError(
                f"Failed to remove subscription for task {task_id}, user {user_id}"
            ) from ex
