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
from datetime import datetime, timezone
from typing import Any

from superset_core.api.tasks import TaskProperties, TaskScope, TaskStatus

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
            user_id=user_id,
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
        payload: dict[str, Any] | None = None,
        properties: TaskProperties | None = None,
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
        :param payload: Optional user-defined context data (dict)
        :param properties: Optional framework-managed runtime state (e.g., timeout)
        :param kwargs: Additional task attributes
        :returns: Created or existing Task instance
        :raises DAOCreateFailedError: If duplicate private task exists
        """
        from superset_core.api.tasks import TaskScope

        from superset.tasks.utils import get_active_dedup_key

        # Generate task_key if not provided
        if task_key is None:
            task_key = str(uuid.uuid4())

        # Determine user_id early: use provided value or fall back to current user
        effective_user_id = user_id if user_id is not None else get_user_id()

        # Build dedup_key for active task
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=effective_user_id,
        )

        # Check for existing active task using dedup_key
        # Use effective_user_id consistently for both lookup and subscription
        if existing := cls.find_by_task_key(
            task_type, task_key, scope, effective_user_id
        ):
            # For shared tasks, subscribe user to existing task
            if (
                scope == TaskScope.SHARED
                and effective_user_id
                and not existing.has_subscriber(effective_user_id)
            ):
                cls.add_subscriber(existing.id, effective_user_id)
                logger.info(
                    "User %s subscribed to existing shared task: %s",
                    effective_user_id,
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

        # Note: properties is handled separately via update_properties()
        # because it's a hybrid property with only a getter
        task_data = {
            "task_type": task_type,
            "task_key": task_key,
            "scope": scope_value,
            "status": TaskStatus.PENDING.value,
            "dedup_key": dedup_key,
            **kwargs,
        }

        # Handle payload - serialize to JSON if dict provided
        if payload:
            from superset.utils import json

            task_data["payload"] = json.dumps(payload)

        if effective_user_id is not None:
            task_data["user_id"] = effective_user_id

        task = cls.create(attributes=task_data)

        # Set properties after creation (hybrid property with getter only)
        if properties:
            task.update_properties(properties)

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
            if task.properties.get("is_abortable") is not True:
                raise TaskNotAbortableError(
                    f"Task {task_uuid} is in progress but has not registered "
                    "an abort handler (is_abortable is not true)"
                )

            # Transition to ABORTING (not ABORTED yet)
            task.status = TaskStatus.ABORTING.value
            db.session.merge(task)
            logger.info("Set task %s to ABORTING (scope: %s)", task_uuid, task.scope)

            # Publish abort notification via TaskManager
            from superset.tasks.manager import TaskManager

            TaskManager.publish_abort(task_uuid)

            return True

        return False

    # Subscription management methods

    @classmethod
    @transaction()
    def add_subscriber(cls, task_id: int, user_id: int) -> bool:
        """
        Add a user as a subscriber to a task.

        :param task_id: ID of the task
        :param user_id: ID of the user to subscribe
        :returns: True if subscriber was added, False if already exists
        """
        # Check first to avoid IntegrityError which invalidates the session
        # in nested transaction contexts (IntegrityError can't be recovered from)
        existing = (
            db.session.query(TaskSubscriber)
            .filter_by(task_id=task_id, user_id=user_id)
            .first()
        )
        if existing:
            logger.debug(
                "Subscriber %s already subscribed to task %s", user_id, task_id
            )
            return False

        subscription = TaskSubscriber(
            task_id=task_id,
            user_id=user_id,
            subscribed_at=datetime.now(timezone.utc),
        )
        db.session.add(subscription)
        db.session.flush()
        logger.info("Added subscriber %s to task %s", user_id, task_id)
        return True

    @classmethod
    @transaction()
    def remove_subscriber(cls, task_id: int, user_id: int) -> bool:  # noqa: C901
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
            db.session.flush()

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
                        # Use abort_task to properly handle the abort flow:
                        # - PENDING tasks go directly to ABORTED
                        # - IN_PROGRESS tasks go to ABORTING and get notified
                        from superset.commands.tasks.exceptions import (
                            TaskNotAbortableError,
                        )

                        try:
                            # PENDING: Go directly to ABORTED
                            if task.status == TaskStatus.PENDING.value:
                                task.set_status(TaskStatus.ABORTED)
                                logger.info(
                                    "Auto-aborted pending shared task %s "
                                    "(last subscriber removed)",
                                    task.uuid,
                                )
                            # IN_PROGRESS: Check if abortable, go to ABORTING
                            elif task.status == TaskStatus.IN_PROGRESS.value:
                                if task.properties.get("is_abortable") is True:
                                    task.status = TaskStatus.ABORTING.value
                                    db.session.merge(task)
                                    logger.info(
                                        "Set shared task %s to ABORTING "
                                        "(last subscriber removed)",
                                        task.uuid,
                                    )

                                    # Publish abort notification
                                    from superset.tasks.manager import TaskManager

                                    TaskManager.publish_abort(task.uuid)
                                else:
                                    logger.warning(
                                        "Cannot auto-abort shared task %s - "
                                        "task is in progress but not abortable",
                                        task.uuid,
                                    )
                        except TaskNotAbortableError as ex:
                            logger.warning(
                                "Cannot auto-abort shared task %s: %s",
                                task.uuid,
                                str(ex),
                            )

            logger.info("Removed subscriber %s from task %s", user_id, task_id)
            return True

        except DAODeleteFailedError:
            raise
        except Exception as ex:
            raise DAODeleteFailedError(
                f"Failed to remove subscription for task {task_id}, user {user_id}"
            ) from ex
