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
"""Internal task update commands for GTF internal use only.

These commands perform zero-read updates using targeted SQL UPDATE statements.
They're designed for use by TaskContext and executor code where the framework
owns the authoritative state and doesn't need to read before writing.

Unlike UpdateTaskCommand, these commands:
- Do NOT fetch the task entity before updating
- Do NOT check permissions (internal use only)
- Use targeted SQL UPDATE for efficiency
"""

from __future__ import annotations

import logging
from functools import partial
from typing import Any
from uuid import UUID

from superset_core.api.tasks import TaskProperties, TaskStatus

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import TaskUpdateFailedError
from superset.daos.tasks import TaskDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class InternalUpdateTaskCommand(BaseCommand):
    """
    Zero-read task update command for properties/payload.

    This command directly writes properties and/or payload to the database
    without reading the current values first. The caller (TaskContext)
    maintains the authoritative cached state and passes complete merged
    values to write.

    This is an optimization for task execution where:
    1. The executor owns the properties/payload state
    2. No permission checks are needed (internal framework code)
    3. Status column should not be touched (use InternalStatusTransitionCommand)

    WARNING: This command should ONLY be used by TaskContext and similar
    internal framework code. External callers should use UpdateTaskCommand.
    """

    def __init__(
        self,
        task_uuid: UUID,
        properties: TaskProperties | None = None,
        payload: dict[str, Any] | None = None,
    ):
        """
        Initialize internal update command.

        :param task_uuid: UUID of the task to update
        :param properties: Complete properties dict to write (replaces existing)
        :param payload: Complete payload dict to write (replaces existing)
        """
        self._task_uuid = task_uuid
        self._properties = properties
        self._payload = payload

    def validate(self) -> None:
        """No validation needed for internal command."""
        pass

    @transaction(on_error=partial(on_error, reraise=TaskUpdateFailedError))
    def run(self) -> bool:
        """
        Execute zero-read update.

        :returns: True if task was updated, False if not found or nothing to update
        """
        if self._properties is None and self._payload is None:
            return False

        updated = TaskDAO.set_properties_and_payload(
            task_uuid=self._task_uuid,
            properties=self._properties,
            payload=self._payload,
        )

        if updated:
            logger.debug(
                "Internal update for task %s: properties=%s, payload=%s",
                self._task_uuid,
                self._properties is not None,
                self._payload is not None,
            )

        return updated


class InternalStatusTransitionCommand(BaseCommand):
    """
    Atomic conditional status transition command for executor use.

    This command provides race-safe status transitions by using atomic
    compare-and-swap semantics. The status is only updated if the current
    status matches the expected value(s).

    Use cases:
    - PENDING → IN_PROGRESS: Task pickup (executor starting)
    - IN_PROGRESS → SUCCESS: Normal completion (only if not ABORTING)
    - IN_PROGRESS → FAILURE: Task exception (only if not ABORTING)
    - ABORTING → ABORTED: Abort handlers completed successfully
    - ABORTING → TIMED_OUT: Timeout handlers completed successfully
    - ABORTING → FAILURE: Abort/cleanup handlers failed

    The atomic nature prevents race conditions where:
    - Executor tries to set SUCCESS but task was concurrently aborted
    - Multiple executors try to pick up the same task

    WARNING: This command should ONLY be used by executor code (decorators.py,
    scheduler.py). External callers should use UpdateTaskCommand.
    """

    def __init__(
        self,
        task_uuid: UUID,
        new_status: TaskStatus | str,
        expected_status: TaskStatus | str | list[TaskStatus | str],
        properties: TaskProperties | None = None,
        set_started_at: bool = False,
        set_ended_at: bool = False,
    ):
        """
        Initialize status transition command.

        :param task_uuid: UUID of the task to update
        :param new_status: Target status to set
        :param expected_status: Current status(es) required for update to succeed.
            Can be a single status or list of acceptable current statuses.
        :param properties: Optional properties to update atomically with status
            (e.g., error_message on FAILURE)
        :param set_started_at: If True, also set started_at to current timestamp.
            Should be True for PENDING → IN_PROGRESS transitions.
        :param set_ended_at: If True, also set ended_at to current timestamp.
            Should be True for terminal status transitions.
        """
        self._task_uuid = task_uuid
        self._new_status = new_status
        self._expected_status = expected_status
        self._properties = properties
        self._set_started_at = set_started_at
        self._set_ended_at = set_ended_at

    def validate(self) -> None:
        """No validation needed for internal command."""
        pass

    @transaction(on_error=partial(on_error, reraise=TaskUpdateFailedError))
    def run(self) -> bool:
        """
        Execute atomic conditional status update.

        :returns: True if status was updated (expected matched), False otherwise
        """
        return TaskDAO.conditional_status_update(
            task_uuid=self._task_uuid,
            new_status=self._new_status,
            expected_status=self._expected_status,
            properties=self._properties,
            set_started_at=self._set_started_at,
            set_ended_at=self._set_ended_at,
        )
