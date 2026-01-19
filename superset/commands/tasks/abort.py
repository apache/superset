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
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class AbortTaskCommand(BaseCommand):
    """Command to abort an task with scope-based permissions."""

    def __init__(self, task_uuid: str):
        self._task_uuid = task_uuid
        self._model: "Task" | None = None
        self._is_admin: bool = False

    @transaction(on_error=partial(on_error, reraise=TaskAbortFailedError))
    def run(self) -> "Task":
        """Execute the command."""
        self.validate()
        assert self._model

        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        # For shared tasks, use remove_subscriber logic which auto-aborts
        # if last subscriber (unless admin force-abort)
        if self._model.is_shared and not self._is_admin:
            user_id = get_user_id()
            if user_id and self._model.has_subscriber(user_id):
                # Remove user's subscription; task aborts if last subscriber
                TaskDAO.remove_subscriber(self._model.id, user_id)
                logger.info(
                    "Unsubscribed user %s from shared task: %s (auto-abort if last)",
                    user_id,
                    self._task_uuid,
                )
                # Refresh model to get updated status
                refreshed = TaskDAO.find_one_or_none(
                    skip_base_filter=True, uuid=self._task_uuid
                )
                if not refreshed:
                    raise TaskNotFoundError()
                self._model = refreshed
                return self._model
            # If user is not a subscriber, fall through to direct abort

        # Use DAO's abort_task which handles two-phase abort logic:
        # - PENDING → ABORTED (direct)
        # - IN_PROGRESS with is_abortable=True → ABORTING
        # - IN_PROGRESS with is_abortable=False/None → raises TaskNotAbortableError
        # - ABORTING → returns True (idempotent)
        try:
            TaskDAO.abort_task(self._task_uuid, skip_base_filter=self._is_admin)
        except TaskNotAbortableError:
            # Re-raise as-is (will be handled by API)
            raise

        # Refresh model to get updated status
        refreshed = TaskDAO.find_one_or_none(
            skip_base_filter=True, uuid=self._task_uuid
        )
        if not refreshed:
            raise TaskNotFoundError()
        self._model = refreshed
        logger.info(
            "Abort requested for task: %s (scope: %s, new_status: %s)",
            self._task_uuid,
            self._model.scope,
            self._model.status,
        )

        return self._model

    def validate(self) -> None:
        """
        Validate command parameters and permissions.

        Permission rules by scope:
        - private: Only creator or admin
        - shared: Subscribers or admin
        - system: Only admin
        """
        from superset import security_manager

        # Check if admin first
        self._is_admin = security_manager.is_admin()

        # Find task (skip_base_filter for admin to see all tasks)
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        self._model = TaskDAO.find_one_or_none(
            skip_base_filter=self._is_admin, uuid=self._task_uuid
        )

        if not self._model:
            raise TaskNotFoundError()

        # Check if task can be aborted based on status
        # ABORTING is allowed (idempotent) - will just refresh and return
        if self._model.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
            TaskStatus.ABORTING.value,  # Already aborting is OK (idempotent)
        ]:
            raise TaskAbortFailedError()

        # Admin can abort anything
        if self._is_admin:
            return

        # Non-admin permission checks by scope
        user_id = get_user_id()

        if self._model.scope == TaskScope.SYSTEM.value:
            # System tasks are admin-only
            raise TaskPermissionDeniedError(
                "Only administrators can abort system tasks"
            )

        if self._model.is_shared:
            # Shared tasks: must be a subscriber
            if not user_id or not self._model.has_subscriber(user_id):
                raise TaskPermissionDeniedError(
                    "You must be subscribed to abort this shared task"
                )

        # Private tasks: already filtered by base_filter (only creator can see)
        # If we got here, user has permission
