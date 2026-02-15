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
"""Submit task command for GTF."""

import logging
import uuid
from functools import partial
from typing import Any, TYPE_CHECKING

from flask import current_app
from marshmallow import ValidationError
from superset_core.api.tasks import TaskScope

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskCreateFailedError,
    TaskInvalidError,
)
from superset.daos.exceptions import DAOCreateFailedError
from superset.stats_logger import BaseStatsLogger
from superset.tasks.locks import task_lock
from superset.tasks.utils import get_active_dedup_key
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class SubmitTaskCommand(BaseCommand):
    """
    Command to submit a task (create new or join existing).

    This command owns locking and create-vs-join business logic.
    It acquires a distributed lock and then decides whether to:
    - Create a new task (if no existing task with same dedup_key)
    - Join an existing task by adding the user as subscriber
    """

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=TaskCreateFailedError))
    def run(self) -> "Task":
        """
        Execute the command with distributed locking.

        Acquires lock based on dedup_key, then checks for existing task
        and either creates new or joins existing (adding subscriber).

        :returns: Task model (either newly created or existing)
        """
        task, _ = self.run_with_info()
        return task

    @transaction(on_error=partial(on_error, reraise=TaskCreateFailedError))
    def run_with_info(self) -> tuple["Task", bool]:
        """
        Execute the command and return (task, is_new) tuple.

        This variant allows callers to distinguish between creating a new task
        and joining an existing one. Useful for sync execution where the caller
        needs to wait for an existing task to complete rather than executing again.

        :returns: Tuple of (Task, is_new) where is_new is True if task was created
        """
        from superset.daos.tasks import TaskDAO

        self.validate()

        # Extract and normalize parameters
        task_type = self._properties["task_type"]
        task_key = self._properties.get("task_key") or str(uuid.uuid4())
        scope = self._properties.get("scope", TaskScope.PRIVATE.value)
        user_id = get_user_id()

        # Build dedup_key for lock
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

        # Acquire lock to prevent race conditions during create/join
        with task_lock(dedup_key):
            # Check for existing task (safe under lock)
            existing = TaskDAO.find_by_task_key(task_type, task_key, scope, user_id)

            # Get stats logger
            stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]

            if existing:
                # Join existing task - add subscriber if not already subscribed
                if user_id and not existing.has_subscriber(user_id):
                    TaskDAO.add_subscriber(existing.id, user_id)
                    stats_logger.incr("gtf.task.subscribe")
                    logger.info(
                        "User %s joined existing task: %s",
                        user_id,
                        task_key,
                    )
                else:
                    # Same user submitted the same task - deduplication hit
                    stats_logger.incr("gtf.task.dedupe")
                    logger.debug(
                        "Deduplication hit for task: %s (user_id=%s)",
                        task_key,
                        user_id,
                    )
                return existing, False  # is_new=False: joined existing task

            # Create new task (DAO is now a pure data operation)
            try:
                task = TaskDAO.create_task(
                    task_type=task_type,
                    task_key=task_key,
                    scope=scope,
                    task_name=self._properties.get("task_name"),
                    user_id=user_id,
                    payload=self._properties.get("payload", {}),
                    properties=self._properties.get("properties", {}),
                )
                stats_logger.incr("gtf.task.create")
                return task, True  # is_new=True: created new task
            except DAOCreateFailedError as ex:
                raise TaskCreateFailedError() from ex

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        # Require task_type
        if not self._properties.get("task_type"):
            exceptions.append(
                ValidationError("task_type is required", field_name="task_type")
            )

        scope = self._properties.get("scope", TaskScope.PRIVATE.value)
        scope_value = scope.value if isinstance(scope, TaskScope) else scope
        valid_scopes = [s.value for s in TaskScope]
        if scope_value not in valid_scopes:
            exceptions.append(
                ValidationError(
                    f"scope must be one of {valid_scopes}",
                    field_name="scope",
                )
            )
        # Store normalized value for use in run()
        self._properties["scope"] = scope_value

        if exceptions:
            raise TaskInvalidError(exceptions=exceptions)
