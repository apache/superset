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

    @transaction(on_error=partial(on_error, reraise=TaskAbortFailedError))
    def run(self) -> "Task":
        """Execute the command."""
        self.validate()
        assert self._model

        # Check if task can be aborted
        if self._model.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
        ]:
            raise TaskAbortFailedError()

        # For shared tasks, use remove_subscriber logic which auto-aborts
        # if last subscriber
        if self._model.is_shared:
            user_id = get_user_id()
            if user_id and self._model.has_subscriber(user_id):
                # Remove user's subscription; task aborts if last subscriber
                # Lazy import to avoid circular dependency
                from superset.daos.tasks import TaskDAO

                TaskDAO.remove_subscriber(self._model.id, user_id)
                logger.info(
                    "Unsubscribed user %s from shared task: %s (auto-abort if last)",
                    user_id,
                    self._task_uuid,
                )
            else:
                # Admin force-abort (skip_base_filter was True)
                self._model.set_status(TaskStatus.ABORTED.value)
                logger.info("Admin force-aborted shared task: %s", self._task_uuid)
        else:
            # Private or system tasks - direct abort
            self._model.set_status(TaskStatus.ABORTED.value)
            logger.info(
                "Aborted task: %s (scope: %s)", self._task_uuid, self._model.scope
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
        is_admin = security_manager.is_admin()

        # Find task (skip_base_filter for admin to see all tasks)
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        self._model = TaskDAO.find_one_or_none(
            skip_base_filter=is_admin, uuid=self._task_uuid
        )

        if not self._model:
            raise TaskNotFoundError()

        # Admin can abort anything
        if is_admin:
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
