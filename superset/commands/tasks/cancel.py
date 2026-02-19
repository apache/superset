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
"""Unified cancel task command for GTF."""

import logging
from functools import partial
from typing import TYPE_CHECKING
from uuid import UUID

from flask import current_app
from superset_core.api.tasks import TaskScope, TaskStatus

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskNotAbortableError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
)
from superset.extensions import security_manager
from superset.stats_logger import BaseStatsLogger
from superset.tasks.locks import task_lock
from superset.tasks.utils import get_active_dedup_key
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class CancelTaskCommand(BaseCommand):
    """
    Unified command to cancel a task.

    Behavior:
    - For private tasks or single-subscriber tasks: aborts the task
    - For shared tasks with multiple subscribers (non-admin): unsubscribes user
    - For shared tasks with force=True (admin only): aborts for all subscribers

    The term "cancel" is user-facing; internally this may abort or unsubscribe.

    This command acquires a distributed lock before starting a transaction to
    prevent race conditions with concurrent submit/cancel operations.

    Permission checks are deferred to inside the lock to minimize SELECTs:
    we only fetch the task once, then validate permissions on the fetched data.
    """

    def __init__(self, task_uuid: UUID, force: bool = False):
        """
        Initialize the cancel command.

        :param task_uuid: UUID of the task to cancel
        :param force: If True, force abort even with multiple subscribers (admin only)
        """
        self._task_uuid = task_uuid
        self._force = force
        self._action_taken: str = (
            "cancelled"  # Will be set to 'aborted' or 'unsubscribed'
        )
        self._should_publish_abort: bool = False

    def run(self) -> "Task":
        """
        Execute the cancel command with distributed locking.

        The lock is acquired BEFORE starting the transaction to avoid holding
        a DB connection during lock acquisition. Uses dedup_key as lock key
        to ensure Submit and Cancel operations use the same lock.

        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        # Lightweight fetch to compute dedup_key for locking
        # This is needed to use the same lock key as SubmitTaskCommand
        task = TaskDAO.find_one_or_none(
            skip_base_filter=security_manager.is_admin(), uuid=self._task_uuid
        )

        if not task:
            raise TaskNotFoundError()

        # Compute dedup_key using the same logic as SubmitTaskCommand
        dedup_key = get_active_dedup_key(
            scope=task.scope,
            task_type=task.task_type,
            task_key=task.task_key,
            user_id=task.user_id,
        )

        # Acquire lock BEFORE transaction starts
        # Using dedup_key ensures Submit and Cancel use the same lock
        with task_lock(dedup_key):
            result = self._execute_with_transaction()

        # Publish abort notification AFTER transaction commits
        # This prevents race conditions where listeners check DB before commit
        if self._should_publish_abort:
            from superset.tasks.manager import TaskManager

            TaskManager.publish_abort(self._task_uuid)

        return result

    @transaction(on_error=partial(on_error, reraise=TaskAbortFailedError))
    def _execute_with_transaction(self) -> "Task":
        """
        Execute the cancel operation inside a transaction.

        Combines fetch + validation + execution in a single transaction,
        reducing the number of SELECTs from 3 to 1 (plus DAO operations).

        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        # Check admin status (no DB access)
        is_admin = security_manager.is_admin()

        # Force flag requires admin
        if self._force and not is_admin:
            raise TaskPermissionDeniedError(
                "Only administrators can force cancel a task"
            )

        # Single SELECT: fetch task and validate permissions on it
        task = TaskDAO.find_one_or_none(skip_base_filter=is_admin, uuid=self._task_uuid)

        if not task:
            raise TaskNotFoundError()

        # Validate permissions on the fetched task
        self._validate_permissions(task, is_admin)

        # Execute cancel and return updated task
        return self._do_cancel(task, is_admin)

    def _validate_permissions(self, task: "Task", is_admin: bool) -> None:
        """
        Validate permissions on an already-fetched task.

        Permission rules by scope:
        - private: Only creator or admin (already filtered by base_filter)
        - shared: Subscribers or admin
        - system: Only admin

        :param task: The task to validate permissions for
        :param is_admin: Whether current user is admin
        :raises TaskAbortFailedError: If task is not in cancellable state
        :raises TaskPermissionDeniedError: If user lacks permission
        """
        # Check if task is in a cancellable state
        if task.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
            TaskStatus.ABORTING.value,  # Already aborting is OK (idempotent)
        ]:
            raise TaskAbortFailedError()

        # Admin can cancel anything
        if is_admin:
            return

        # Non-admin permission checks by scope
        user_id = get_user_id()

        if task.scope == TaskScope.SYSTEM.value:
            # System tasks are admin-only
            raise TaskPermissionDeniedError(
                "Only administrators can cancel system tasks"
            )

        if task.is_shared:
            # Shared tasks: must be a subscriber
            if not user_id or not task.has_subscriber(user_id):
                raise TaskPermissionDeniedError(
                    "You must be subscribed to cancel this shared task"
                )

        # Private tasks: already filtered by base_filter (only creator can see)
        # If we got here, user has permission

    def _do_cancel(self, task: "Task", is_admin: bool) -> "Task":
        """
        Execute the cancel operation (abort or unsubscribe).

        :param task: The task to cancel
        :param is_admin: Whether current user is admin
        :returns: The updated task model
        """
        user_id = get_user_id()

        # Determine action based on task scope and force flag
        should_abort = (
            # Admin with force flag always aborts
            (is_admin and self._force)
            # Private tasks always abort (only one user)
            or task.is_private
            # System tasks always abort (admin only anyway)
            or task.is_system
            # Single or last subscriber - abort
            or task.subscriber_count <= 1
        )

        if should_abort:
            return self._do_abort(task, is_admin)
        else:
            return self._do_unsubscribe(task, user_id)

    def _do_abort(self, task: "Task", is_admin: bool) -> "Task":
        """
        Execute abort operation.

        :param task: The task to abort
        :param is_admin: Whether current user is admin
        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        try:
            result: Task | None = TaskDAO.abort_task(
                task.uuid, skip_base_filter=is_admin
            )
        except TaskNotAbortableError:
            raise

        if result is None:
            # abort_task returned None - task wasn't aborted
            # This can happen if task is already finished
            raise TaskAbortFailedError()

        self._action_taken = "aborted"

        # Track if we need to publish abort after commit
        if TaskStatus(result.status) == TaskStatus.ABORTING:
            self._should_publish_abort = True

        # Emit stats metric
        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        stats_logger.incr("gtf.task.abort")

        logger.info(
            "Task aborted: %s (scope: %s, force: %s)",
            task.uuid,
            task.scope,
            self._force,
        )

        return result

    def _do_unsubscribe(self, task: "Task", user_id: int | None) -> "Task":
        """
        Execute unsubscribe operation.

        :param task: The task to unsubscribe from
        :param user_id: ID of user to unsubscribe
        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        self._action_taken = "unsubscribed"

        if not user_id or not task.has_subscriber(user_id):
            # User not subscribed - they shouldn't be able to cancel
            raise TaskPermissionDeniedError(
                "You are not subscribed to this shared task"
            )

        result = TaskDAO.remove_subscriber(task.id, user_id)
        if result is None:
            raise TaskPermissionDeniedError(
                "You are not subscribed to this shared task"
            )

        # Emit stats metric
        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        stats_logger.incr("gtf.task.unsubscribe")

        logger.info(
            "User %s unsubscribed from shared task: %s",
            user_id,
            task.uuid,
        )

        return result

    def validate(self) -> None:
        pass

    @property
    def action_taken(self) -> str:
        """
        Get the action that was taken.

        :returns: 'aborted' or 'unsubscribed'
        """
        return self._action_taken
