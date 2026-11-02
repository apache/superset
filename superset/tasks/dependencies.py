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
"""Shared GTF task-dependency (DAG) gate.

Both the async (Celery) and the sync (inline) execution paths gate a dependent on
its prerequisites with identical ``all_success`` semantics. The *decision*
(:func:`unmet_prerequisite`) and the *fail action*
(:func:`fail_dependent_on_unmet_prerequisite`) are pure and shared here so there is
a single source of truth; only the *wait* action differs between paths (the Celery
path defers by re-enqueuing the message, the inline path blocks on the coordination
signal), which is inherent to each path rather than duplicated gate logic.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from superset_core.tasks.types import TaskStatus

from superset.daos.tasks import TaskDAO
from superset.tasks.constants import TERMINAL_STATES

if TYPE_CHECKING:
    from superset.models.tasks import Task as TaskModel

logger = logging.getLogger(__name__)

# Sentinel: at least one prerequisite is not yet terminal (the caller waits/defers
# and re-checks).
DAG_WAITING = object()


def unmet_prerequisite(task: "TaskModel") -> "TaskModel | object | None":
    """Non-blocking ``all_success`` DAG gate for ``task``.

    Returns ``None`` when the task has no prerequisites or all ended in
    ``SUCCESS`` (ready to run); ``DAG_WAITING`` when at least one prerequisite is
    not yet terminal (the caller waits/defers and re-checks); or the first
    prerequisite that reached a terminal non-``SUCCESS`` state (the caller fails
    the dependent, which cascades to its own dependents).

    ``task.depends_on`` is ``selectin``-loaded with the task, so a prerequisite
    already terminal in that snapshot is trusted with no extra read (a terminal
    status never changes). A prerequisite that is *not* terminal in the snapshot
    is re-read fresh, since the snapshot may lag its completion.

    :param task: the dependent task about to run (with ``depends_on`` loaded)
    :returns: ``None`` (ready), ``DAG_WAITING`` (wait), or a failed prerequisite
    """
    prerequisites = list(task.depends_on)
    if not prerequisites:
        return None

    for prerequisite in prerequisites:
        current = prerequisite
        if current.status not in TERMINAL_STATES:
            current = TaskDAO.find_one_or_none(
                uuid=prerequisite.uuid, skip_base_filter=True
            )
            if current is None:
                # Prerequisite no longer exists (e.g. pruned) — treat as failed.
                return prerequisite
        if current.status not in TERMINAL_STATES:
            return DAG_WAITING
        if current.status != TaskStatus.SUCCESS.value:
            return current

    return None


def fail_dependent_on_unmet_prerequisite(native_uuid: UUID, unmet: "TaskModel") -> str:
    """Fail a dependent whose prerequisite ended non-success; return committed status.

    ``all_success`` semantics: a prerequisite that ended in a terminal non-success
    state fails the dependent without running its body, which then cascades to the
    dependent's own dependents. Publishes a completion for waiters when the FAILURE
    transition wins; if the dependent moved to a terminal state concurrently (e.g.
    aborted while waiting), the transition is a no-op and the committed status is
    reported instead of publishing a contradictory FAILURE completion.

    :param native_uuid: the dependent task's UUID
    :param unmet: the prerequisite that ended in a terminal non-success state
    :returns: the dependent's committed status string
    """
    from superset.commands.tasks.internal_update import InternalStatusTransitionCommand
    from superset.tasks.manager import TaskManager

    logger.info(
        "Task %s failing: prerequisite %s did not succeed (status=%s)",
        native_uuid,
        unmet.uuid,
        unmet.status,
    )
    failed_transition = InternalStatusTransitionCommand(
        task_uuid=native_uuid,
        new_status=TaskStatus.FAILURE,
        expected_status=[TaskStatus.PENDING, TaskStatus.ABORTING],
        set_ended_at=True,
        properties={
            "error_message": (
                f"Prerequisite task {unmet.uuid} did not "
                f"succeed (status={unmet.status})"
            )
        },
    ).run()
    if failed_transition:
        TaskManager.publish_completion(native_uuid, TaskStatus.FAILURE.value)
        return TaskStatus.FAILURE.value
    refreshed = TaskDAO.find_one_or_none(uuid=native_uuid, skip_base_filter=True)
    return refreshed.status if refreshed else "unknown"
