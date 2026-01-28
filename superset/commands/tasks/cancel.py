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

from superset_core.api.tasks import TaskScope, TaskStatus

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskNotAbortableError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
)
from superset.extensions import security_manager
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
    """

    def __init__(self, task_uuid: str, force: bool = False):
        """
        Initialize the cancel command.

        :param task_uuid: UUID of the task to cancel
        :param force: If True, force abort even with multiple subscribers (admin only)
        """
        self._task_uuid = task_uuid
        self._force = force
        self._model: "Task" | None = None
        self._is_admin: bool = False
        self._action_taken: str = (
            "cancelled"  # Will be set to 'aborted' or 'unsubscribed'
        )

    @transaction(on_error=partial(on_error, reraise=TaskAbortFailedError))
    def run(self) -> "Task":
        """
        Execute the cancel command.

        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        self.validate()
        assert self._model

        user_id = get_user_id()

        # Determine action based on task scope and force flag
        should_abort_directly = (
            # Admin with force flag always aborts
            (self._is_admin and self._force)
            # Private tasks always abort (only one user)
            or self._model.is_private
            # System tasks always abort (admin only anyway)
            or self._model.is_system
            # Single or last subscriber - abort
            or self._model.subscriber_count <= 1
        )

        if should_abort_directly:
            # Direct abort
            try:
                aborted = TaskDAO.abort_task(
                    self._task_uuid, skip_base_filter=self._is_admin
                )
            except TaskNotAbortableError:
                raise

            if not aborted:
                # abort_task returned False - task wasn't aborted
                # This can happen if task is already finished or has
                # remaining subscribers
                raise TaskAbortFailedError()

            self._action_taken = "aborted"
            logger.info(
                "Task aborted: %s (scope: %s, force: %s)",
                self._task_uuid,
                self._model.scope,
                self._force,
            )
        else:
            # Shared task with multiple subscribers - unsubscribe user
            self._action_taken = "unsubscribed"
            if user_id and self._model.has_subscriber(user_id):
                TaskDAO.remove_subscriber(self._model.id, user_id)
                logger.info(
                    "User %s unsubscribed from shared task: %s",
                    user_id,
                    self._task_uuid,
                )
            else:
                # User not subscribed - they shouldn't be able to cancel
                raise TaskPermissionDeniedError(
                    "You are not subscribed to this shared task"
                )

        # Refresh model to get updated status
        refreshed = TaskDAO.find_one_or_none(
            skip_base_filter=True, uuid=self._task_uuid
        )
        if not refreshed:
            raise TaskNotFoundError()
        self._model = refreshed

        return self._model

    @property
    def action_taken(self) -> str:
        """
        Get the action that was taken.

        :returns: 'aborted' or 'unsubscribed'
        """
        return self._action_taken

    def validate(self) -> None:
        """
        Validate command parameters and permissions.

        Permission rules by scope:
        - private: Only creator or admin
        - shared: Subscribers or admin
        - system: Only admin

        Force flag:
        - Only admins can use force=True
        - Force is only meaningful for shared tasks with multiple subscribers
        """
        from superset.daos.tasks import TaskDAO

        # Check if admin first
        self._is_admin = security_manager.is_admin()

        # Force flag requires admin
        if self._force and not self._is_admin:
            raise TaskPermissionDeniedError(
                "Only administrators can force cancel a task"
            )

        # Find task (skip_base_filter for admin to see all tasks)
        self._model = TaskDAO.find_one_or_none(
            skip_base_filter=self._is_admin, uuid=self._task_uuid
        )

        if not self._model:
            raise TaskNotFoundError()

        # Check if task is in a cancellable state
        if self._model.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
            TaskStatus.ABORTING.value,  # Already aborting is OK (idempotent)
        ]:
            raise TaskAbortFailedError()

        # Admin can cancel anything
        if self._is_admin:
            return

        # Non-admin permission checks by scope
        user_id = get_user_id()

        if self._model.scope == TaskScope.SYSTEM.value:
            # System tasks are admin-only
            raise TaskPermissionDeniedError(
                "Only administrators can cancel system tasks"
            )

        if self._model.is_shared:
            # Shared tasks: must be a subscriber
            if not user_id or not self._model.has_subscriber(user_id):
                raise TaskPermissionDeniedError(
                    "You must be subscribed to cancel this shared task"
                )

        # Private tasks: already filtered by base_filter (only creator can see)
        # If we got here, user has permission
