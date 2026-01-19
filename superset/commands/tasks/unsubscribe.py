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

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskNotFoundError,
    TaskPermissionDeniedError,
    TaskUpdateFailedError,
)
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class UnsubscribeFromTaskCommand(BaseCommand):
    """Command to unsubscribe a user from a shared task."""

    def __init__(self, task_uuid: str):
        self._task_uuid = task_uuid
        self._model: "Task" | None = None

    @transaction(on_error=partial(on_error, reraise=TaskUpdateFailedError))
    def run(self) -> "Task":
        """
        Execute the command.

        Removes the current user's subscription from the task.
        If this is the last subscriber, the task will be auto-aborted by the DAO.

        :returns: The task model
        """
        self.validate()
        assert self._model

        user_id = get_user_id()
        if not user_id:
            raise TaskPermissionDeniedError("User ID not found")

        # Remove subscription (DAO handles auto-abort if last subscriber)
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        was_removed = TaskDAO.remove_subscriber(self._model.id, user_id)

        if was_removed:
            logger.info(
                "User %s unsubscribed from task %s (auto-abort if last subscriber)",
                user_id,
                self._task_uuid,
            )
        else:
            logger.warning(
                "User %s was not subscribed to task %s", user_id, self._task_uuid
            )

        return self._model

    def validate(self) -> None:
        """
        Validate command parameters and permissions.

        Only shared tasks can be unsubscribed from.
        User must be subscribed to the task.
        """
        from superset import security_manager

        # Admins can unsubscribe from any task
        is_admin = security_manager.is_admin()

        # Find task (skip_base_filter for admin to see all tasks)
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        self._model = TaskDAO.find_one_or_none(
            skip_base_filter=is_admin, uuid=self._task_uuid
        )

        if not self._model:
            raise TaskNotFoundError()

        # Can only unsubscribe from shared tasks
        if not self._model.is_shared:
            raise TaskPermissionDeniedError(
                f"Cannot unsubscribe from {self._model.scope} tasks. "
                "Only shared tasks support subscriptions."
            )

        # Verify user is actually subscribed
        user_id = get_user_id()
        if not user_id:
            raise TaskPermissionDeniedError("User ID not found")

        if not is_admin and not self._model.has_subscriber(user_id):
            raise TaskPermissionDeniedError("You are not subscribed to this task")
