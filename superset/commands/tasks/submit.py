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

from flask import current_app, g
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
from superset.tasks.guest import get_current_guest_subscriber_key
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

    def run(self) -> "Task":
        """
        Execute the command with distributed locking.

        Acquires lock based on dedup_key, then checks for existing task
        and either creates new or joins existing (adding subscriber).

        :returns: Task model (either newly created or existing)
        """
        task, _ = self.run_with_info()
        return task

    def run_with_info(self) -> tuple["Task", bool]:
        """
        Execute the command and return (task, is_new) tuple.

        This variant allows callers to distinguish between creating a new task
        and joining an existing one. Useful for sync execution where the caller
        needs to wait for an existing task to complete rather than executing again.

        The task lock is held across the **entire** create-or-join transaction —
        including the commit performed by ``_create_or_join``'s ``@transaction`` —
        so a concurrent submitter for the same ``dedup_key`` always observes the
        winner's committed row and joins it. Releasing the lock before the commit
        would let a waiter read-before-commit and insert a duplicate ``dedup_key``,
        surfacing as a unique-constraint 500 instead of a clean join.

        NOTE: ``SubmitTaskCommand`` must own its transaction for this guarantee to
        hold. It must not be called within an outer ``@transaction`` — the
        reentrancy guard would defer the real commit until after the lock is
        released (see ``superset.utils.decorators.transaction``).

        :returns: Tuple of (Task, is_new) where is_new is True if task was created
        """
        # Enforce the "must own its transaction" contract (see docstring). If a
        # caller has already opened a transaction, ``_create_or_join``'s
        # ``@transaction`` would be reentrant and defer its commit past the lock
        # release (``transaction`` keys reentrancy off ``g.in_transaction``),
        # silently reopening the dedup race. Fail loudly so the caller is forced
        # to submit outside its transaction rather than reintroduce the bug.
        if getattr(g, "in_transaction", False):
            raise RuntimeError(
                "SubmitTaskCommand must own its transaction: the task lock is "
                "held across commit to serialize concurrent dedup submits, which "
                "requires the commit to happen before the lock is released. It "
                "cannot run inside an outer @transaction. Submit outside the "
                "surrounding transaction instead."
            )

        self.validate()

        # Extract and normalize parameters (no DB access — validate() has run and
        # normalized ``scope``). Done before acquiring the lock so invalid input
        # fails fast without taking a lock.
        task_type = self._properties["task_type"]
        task_key = self._properties.get("task_key") or str(uuid.uuid4())
        self._properties["task_key"] = task_key  # reuse the generated key downstream
        scope = self._properties["scope"]
        user_id = get_user_id()
        # Embedded guests have no ab_user id; they subscribe by a token-derived
        # key so TaskFilter can grant them visibility of their own tasks.
        guest_key = None if user_id else get_current_guest_subscriber_key()

        # Build dedup_key for lock
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

        # Acquire the lock around the whole transaction (see docstring): it is
        # released only after _create_or_join commits.
        with task_lock(dedup_key):
            return self._create_or_join(task_type, task_key, scope, user_id, guest_key)

    @transaction(on_error=partial(on_error, reraise=TaskCreateFailedError))
    def _create_or_join(
        self,
        task_type: str,
        task_key: str,
        scope: str,
        user_id: int | None,
        guest_key: str | None,
    ) -> tuple["Task", bool]:
        """Find an existing task for ``dedup_key`` and join it, or create a new one.

        Runs as a single transaction (committed by ``@transaction`` on return)
        while the caller holds the task lock, so the create-vs-join decision and
        its commit are atomic with respect to other submitters.
        """
        from superset.daos.tasks import TaskDAO

        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]

        # Check for an existing task under the lock; join it if present.
        if existing := TaskDAO.find_by_task_key(task_type, task_key, scope, user_id):
            # Finding an existing task is itself a dedupe (work reused, not
            # re-created), whether the caller becomes a new subscriber or
            # resubmits as an existing one. Count it on the task's properties.
            existing.update_properties(
                {"dedupe_count": existing.properties_dict.get("dedupe_count", 0) + 1}
            )
            # Join existing task - add subscriber if not already subscribed
            if user_id and not existing.has_subscriber(user_id):
                TaskDAO.add_subscriber(existing.id, user_id)
                stats_logger.incr("gtf.task.subscribe")
                logger.info(
                    "User %s joined existing task: %s",
                    user_id,
                    task_key,
                )
            elif guest_key and not existing.has_guest_subscriber(guest_key):
                # Embedded guest joining a SHARED task an equivalent guest
                # created; subscribe so this guest can also poll it.
                TaskDAO.add_guest_subscriber(existing.id, guest_key)
                stats_logger.incr("gtf.task.subscribe")
            else:
                # Same subscriber resubmitted the same task - deduplication hit
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
                guest_key=guest_key,
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
        Resolve the declared ``depends_on`` references and write dependency edges.

        Runs inside the submit transaction and lock, after the task row is
        flushed (so ``task.id``/``task.uuid`` are available), and only for a
        freshly *created* task (never on a dedup join). Rejects self-dependencies
        and unknown prerequisites. Prerequisite references are de-duplicated and
        order-preserved.

        No transitive cycle check is needed here: a brand-new task has no
        incoming edges, so its new ``task -> prerequisite`` edges cannot close a
        cycle (nothing points back to it). The only cycle a create can express is
        a direct self-dependency, rejected in-memory below. A future API that
        adds edges to *existing* tasks would need a transitive check.

        This resolves all prerequisites in one query and inserts all edges in one
        flush — 2 round-trips regardless of the number of dependencies.

        :param task: The newly created dependent task
        :param dao: TaskDAO (passed to avoid re-importing)
        :raises TaskInvalidError: if a prerequisite reference is malformed/unknown
        :raises TaskCyclicDependencyError: on a direct self-dependency
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

        dao.add_dependencies(task.id, [prerequisites[u].id for u in uuids])

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
