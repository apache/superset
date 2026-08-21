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
from uuid import UUID

from flask import current_app
from marshmallow import ValidationError
from superset_core.tasks.types import TaskScope

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskCreateFailedError,
    TaskCyclicDependencyError,
    TaskInvalidError,
)
from superset.daos.exceptions import DAOCreateFailedError
from superset.stats_logger import BaseStatsLogger
from superset.tasks.locks import task_lock
from superset.tasks.utils import get_active_dedup_key
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.daos.tasks import TaskDAO
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
                # Persist dependency edges (with cycle guard) for the new task.
                # Joined/deduplicated tasks keep their original dependencies.
                self._persist_dependencies(task, TaskDAO)
                stats_logger.incr("gtf.task.create")
                return task, True  # is_new=True: created new task
            except DAOCreateFailedError as ex:
                raise TaskCreateFailedError() from ex

    def _persist_dependencies(self, task: "Task", dao: type["TaskDAO"]) -> None:
        """
        Resolve the declared ``depends_on`` UUIDs and write dependency edges.

        Runs inside the submit transaction and lock, after the task row is
        flushed (so ``task.id``/``task.uuid`` are available). Rejects
        self-dependencies, unknown prerequisites, and edges that would introduce
        a cycle in the DAG. Prerequisite UUIDs are de-duplicated, order-preserved.

        :param task: The newly created dependent task
        :param dao: TaskDAO (passed to avoid re-importing)
        :raises TaskInvalidError: if a prerequisite UUID is malformed or unknown
        :raises TaskCyclicDependencyError: if the edges would create a cycle
        """
        raw = self._properties.get("depends_on") or []
        if not raw:
            return

        uuids: list[UUID] = []
        seen: set[UUID] = set()
        for item in raw:
            # Accept a scheduled Task entity, a UUID, or a UUID string, and
            # normalize to a UUID. Task entities are the natural output of
            # .schedule(), so passing them straight through is the common case.
            if isinstance(item, UUID):
                dep_uuid = item
            elif hasattr(item, "uuid"):
                raw_uuid = item.uuid
                dep_uuid = (
                    raw_uuid if isinstance(raw_uuid, UUID) else UUID(str(raw_uuid))
                )
            else:
                try:
                    dep_uuid = UUID(str(item))
                except (ValueError, AttributeError, TypeError) as ex:
                    raise TaskInvalidError(
                        f"Invalid prerequisite task reference: {item!r}"
                    ) from ex
            if dep_uuid == task.uuid:
                raise TaskCyclicDependencyError(
                    f"A task cannot depend on itself ({dep_uuid})."
                )
            if dep_uuid not in seen:
                seen.add(dep_uuid)
                uuids.append(dep_uuid)

        prerequisites = {p.uuid: p for p in dao.find_by_uuids(uuids)}
        missing = [str(u) for u in uuids if u not in prerequisites]
        if missing:
            raise TaskInvalidError(
                f"Unknown prerequisite task(s): {', '.join(missing)}"
            )

        prerequisite_ids = [prerequisites[u].id for u in uuids]
        self._check_no_cycle(task.id, prerequisite_ids, dao)
        for prerequisite_id in prerequisite_ids:
            dao.add_dependency(task.id, prerequisite_id)

    @staticmethod
    def _check_no_cycle(
        task_id: int, prerequisite_ids: list[int], dao: type["TaskDAO"]
    ) -> None:
        """
        Guard against cycles before inserting edges.

        A cycle would exist if the new task is reachable from any prerequisite by
        following existing dependency edges (prerequisite -> its prerequisites).
        Since a freshly created task has no incoming edges this cannot trigger on
        the normal create path, but it defends the dedup-join and any future
        edge-adding path. The submit lock is keyed on this task's dedup_key only
        and does not serialize across prerequisite tasks, so this walk must not
        assume cross-task mutual exclusion.

        :raises TaskCyclicDependencyError: if a cycle is detected
        """
        visited: set[int] = set()
        stack = list(prerequisite_ids)
        while stack:
            current = stack.pop()
            if current == task_id:
                raise TaskCyclicDependencyError(
                    f"Dependencies would create a cycle involving task id={task_id}."
                )
            if current in visited:
                continue
            visited.add(current)
            stack.extend(dao.get_prerequisite_ids(current))

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
