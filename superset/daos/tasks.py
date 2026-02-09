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
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from superset_core.api.tasks import TaskProperties, TaskScope, TaskStatus

from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAODeleteFailedError
from superset.extensions import db
from superset.models.task_subscribers import TaskSubscriber
from superset.models.tasks import Task
from superset.tasks.constants import ABORTABLE_STATES
from superset.tasks.filters import TaskFilter
from superset.tasks.utils import get_active_dedup_key, json

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
    def get_status(cls, task_uuid: UUID) -> str | None:
        """
        Get only the status of a task by UUID.

        This is a lightweight query that only fetches the status column,
        optimized for polling endpoints where full entity loading is unnecessary.
        Applies the base filter (TaskFilter) to enforce permission checks.

        :param task_uuid: UUID of the task
        :returns: Task status string, or None if task not found or not accessible
        """
        # Start with query on Task model so base filter can be applied
        query = db.session.query(Task)
        query = cls._apply_base_filter(query)
        query = query.filter(Task.uuid == task_uuid)

        # Select only the status column for efficiency
        result = query.with_entities(Task.status).one_or_none()
        return result[0] if result else None

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
    def create_task(
        cls,
        task_type: str,
        task_key: str,
        scope: TaskScope | str = TaskScope.PRIVATE,
        user_id: int | None = None,
        payload: dict[str, Any] | None = None,
        properties: TaskProperties | None = None,
        **kwargs: Any,
    ) -> Task:
        """
        Create a new task record in the database.

        This is a pure data operation - assumes caller holds lock and has
        already checked for existing tasks. Business logic (create vs join)
        is handled by SubmitTaskCommand.

        :param task_type: Type of task to create
        :param task_key: Task identifier (required)
        :param scope: Task scope (private/shared/system), defaults to private
        :param user_id: User ID creating the task
        :param payload: Optional user-defined context data (dict)
        :param properties: Optional framework-managed runtime state (e.g., timeout)
        :param kwargs: Additional task attributes (e.g., task_name)
        :returns: Created Task instance
        """
        # Handle both TaskScope enum and string values
        scope_value = scope.value if isinstance(scope, TaskScope) else scope
        scope_enum = scope if isinstance(scope, TaskScope) else TaskScope(scope)

        # Validate user_id is required for private tasks
        if scope_enum == TaskScope.PRIVATE and user_id is None:
            raise ValueError("user_id is required for private tasks")

        # Build dedup_key for active task
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

        # Note: properties is handled separately via update_properties()
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
            task_data["payload"] = json.dumps(payload)

        if user_id is not None:
            task_data["user_id"] = user_id

        task = cls.create(attributes=task_data)

        # Set properties after creation via update_properties (handles caching)
        if properties:
            task.update_properties(properties)

        # Flush to get the task ID (auto-incremented primary key)
        db.session.flush()

        # Auto-subscribe creator for all tasks
        # This enables consistent subscriber display across all task types
        if user_id:
            cls.add_subscriber(task.id, user_id)
            logger.info(
                "Creator %s auto-subscribed to task: %s (scope: %s)",
                user_id,
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
    def abort_task(cls, task_uuid: UUID, skip_base_filter: bool = False) -> Task | None:
        """
        Abort a task by UUID.

        This is a pure data operation. Business logic (subscriber count checks,
        permission validation) is handled by CancelTaskCommand which holds the lock.

        Abort behavior by status:
        - PENDING: Goes directly to ABORTED (always abortable)
        - IN_PROGRESS with is_abortable=True: Goes to ABORTING
        - IN_PROGRESS with is_abortable=False/None: Raises TaskNotAbortableError
        - ABORTING: Returns task (idempotent)
        - Finished statuses: Returns None

        Note: Caller is responsible for calling TaskManager.publish_abort() AFTER
        the transaction commits if task.status == ABORTING. This prevents race
        conditions where listeners check the DB before the status is visible.

        :param task_uuid: UUID of task to abort
        :param skip_base_filter: If True, skip base filter (for admin abortions)
        :returns: Task if aborted/aborting, None if not found or already finished
        :raises TaskNotAbortableError: If in-progress task has no abort handler
        """
        from superset.commands.tasks.exceptions import TaskNotAbortableError

        task = cls.find_one_or_none(skip_base_filter=skip_base_filter, uuid=task_uuid)
        if not task:
            return None

        # Already aborting - idempotent success
        if task.status == TaskStatus.ABORTING.value:
            logger.info("Task %s is already aborting", task_uuid)
            return task

        # Already finished - cannot abort
        if task.status not in ABORTABLE_STATES:
            return None

        # PENDING: Go directly to ABORTED
        if task.status == TaskStatus.PENDING.value:
            task.set_status(TaskStatus.ABORTED)
            logger.info("Aborted pending task: %s (scope: %s)", task_uuid, task.scope)
            return task

        # IN_PROGRESS: Check if abortable
        if task.status == TaskStatus.IN_PROGRESS.value:
            if task.properties_dict.get("is_abortable") is not True:
                raise TaskNotAbortableError(
                    f"Task {task_uuid} is in progress but has not registered "
                    "an abort handler (is_abortable is not true)"
                )

            # Transition to ABORTING (not ABORTED yet)
            task.status = TaskStatus.ABORTING.value
            db.session.merge(task)
            logger.info("Set task %s to ABORTING (scope: %s)", task_uuid, task.scope)

            # NOTE: publish_abort is NOT called here - caller handles it after commit
            # This prevents race conditions where listeners check DB before commit

            return task

        return None

    # Subscription management methods

    @classmethod
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
    def remove_subscriber(cls, task_id: int, user_id: int) -> Task | None:
        """
        Remove a user's subscription from a task and return the updated task.

        This is a pure data operation. Business logic (whether to abort after
        last subscriber leaves) is handled by CancelTaskCommand which holds
        the lock and decides whether to call abort_task() separately.

        :param task_id: ID of the task
        :param user_id: ID of the user to unsubscribe
        :returns: Updated Task if subscriber was removed, None if not subscribed
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
            return None

        try:
            db.session.delete(subscription)
            db.session.flush()
            logger.info("Removed subscriber %s from task %s", user_id, task_id)

            # Return the updated task
            task = cls.find_by_id(task_id, skip_base_filter=True)
            if task:
                db.session.refresh(task)  # Ensure subscribers list is fresh
            return task

        except DAODeleteFailedError:
            raise
        except Exception as ex:
            raise DAODeleteFailedError(
                f"Failed to remove subscription for task {task_id}, user {user_id}"
            ) from ex

    @classmethod
    def set_properties_and_payload(
        cls,
        task_uuid: UUID,
        properties: TaskProperties | None = None,
        payload: dict[str, Any] | None = None,
    ) -> bool:
        """
        Perform a zero-read SQL UPDATE on properties and/or payload columns.

        This method directly writes the provided values without reading first.
        The caller (TaskContext) is responsible for maintaining the authoritative
        cached state and passing complete values to write.

        This method is designed for internal task updates (progress, is_abortable)
        where the executor owns the state and doesn't need to read before writing.

        IMPORTANT: This method only touches properties and payload columns.
        It does NOT touch the status column, so it's safe to use concurrently
        with operations that modify status (like abort).

        :param task_uuid: UUID of the task to update
        :param properties: Complete properties dict to write (replaces existing)
        :param payload: Complete payload dict to write (replaces existing)
        :returns: True if task was updated, False if not found or nothing to update
        """
        if properties is None and payload is None:
            return False

        # Build update values dict - no reads, just write what caller provides
        update_values: dict[str, Any] = {}

        if properties is not None:
            # Write complete properties (caller manages merging in their cache)
            update_values["properties"] = json.dumps(properties)

        if payload is not None:
            # Write complete payload (payload column name matches attribute name)
            update_values["payload"] = json.dumps(payload)

        if not update_values:
            return False

        # Execute targeted UPDATE - zero read, just write
        rows_updated = (
            db.session.query(Task)
            .filter(Task.uuid == task_uuid)
            .update(update_values, synchronize_session=False)
        )

        return rows_updated > 0

    @classmethod
    def conditional_status_update(
        cls,
        task_uuid: UUID,
        new_status: TaskStatus | str,
        expected_status: TaskStatus | str | list[TaskStatus | str],
        properties: TaskProperties | None = None,
        set_started_at: bool = False,
        set_ended_at: bool = False,
    ) -> bool:
        """
        Atomically update task status only if current status matches expected.

        This provides atomic compare-and-swap semantics for status transitions,
        preventing race conditions between executor status updates and concurrent
        abort operations. Uses a single UPDATE with WHERE clause for atomicity.

        Use cases:
        - Executor transitioning IN_PROGRESS → SUCCESS (only if not ABORTING)
        - Executor transitioning ABORTING → ABORTED/TIMED_OUT (cleanup complete)
        - Initial PENDING → IN_PROGRESS (task pickup)

        :param task_uuid: UUID of the task to update
        :param new_status: Target status to set
        :param expected_status: Current status(es) required for update to succeed.
            Can be a single status or list of statuses.
        :param properties: Optional properties to update atomically with status
        :param set_started_at: If True, also set started_at to current timestamp
        :param set_ended_at: If True, also set ended_at to current timestamp
        :returns: True if status was updated (expected matched), False otherwise
        """
        # Normalize status values
        new_status_val = (
            new_status.value if isinstance(new_status, TaskStatus) else new_status
        )

        # Build list of expected status values
        if isinstance(expected_status, list):
            expected_vals = [
                s.value if isinstance(s, TaskStatus) else s for s in expected_status
            ]
        else:
            expected_vals = [
                expected_status.value
                if isinstance(expected_status, TaskStatus)
                else expected_status
            ]

        # Build update values
        update_values: dict[str, Any] = {"status": new_status_val}

        if properties is not None:
            update_values["properties"] = json.dumps(properties)

        if set_started_at:
            update_values["started_at"] = datetime.now(timezone.utc)

        if set_ended_at:
            update_values["ended_at"] = datetime.now(timezone.utc)

        # Atomic compare-and-swap: only update if status matches expected
        rows_updated = (
            db.session.query(Task)
            .filter(Task.uuid == task_uuid, Task.status.in_(expected_vals))
            .update(update_values, synchronize_session=False)
        )

        if rows_updated > 0:
            logger.debug(
                "Conditional status update succeeded: %s -> %s (expected: %s)",
                task_uuid,
                new_status_val,
                expected_vals,
            )
        else:
            logger.debug(
                "Conditional status update skipped: %s -> %s "
                "(current status not in expected: %s)",
                task_uuid,
                new_status_val,
                expected_vals,
            )

        return rows_updated > 0
