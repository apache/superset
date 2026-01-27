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
from __future__ import annotations

import logging
from datetime import datetime
from functools import partial
from typing import Any, TYPE_CHECKING

from marshmallow import ValidationError
from superset_core.api.tasks import TaskProperties

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskForbiddenError,
    TaskInvalidError,
    TaskNotFoundError,
    TaskUpdateFailedError,
)
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class UpdateTaskCommand(BaseCommand):
    """
    Command to update a task.

    Uses explicit typed parameters to avoid confusion between
    payload (task output) and properties (runtime state/config).
    """

    def __init__(
        self,
        task_uuid: str,
        *,
        status: str | None = None,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
        payload: dict[str, Any] | None = None,
        properties: TaskProperties | None = None,
        skip_security_check: bool = False,
    ):
        """
        Initialize UpdateTaskCommand.

        :param task_uuid: UUID of the task to update
        :param status: New status value (column field)
        :param started_at: Started timestamp (column field)
        :param ended_at: Ended timestamp (column field)
        :param payload: Task output data to merge (stored in payload column)
        :param properties: Runtime state/config updates as dict. Keys must be
            valid TaskProperties field names (is_abortable, progress_percent, etc.)
        :param skip_security_check: If True, skip ownership validation.
            Use this for internal task updates (e.g., task executor updating
            its own task's progress). Default is False for API-driven updates.
        """
        self._task_uuid = task_uuid
        self._status = status
        self._started_at = started_at
        self._ended_at = ended_at
        self._payload = payload
        self._properties = properties
        self._model: Task | None = None
        self._skip_security_check = skip_security_check

    @transaction(on_error=partial(on_error, reraise=TaskUpdateFailedError))
    def run(self) -> Task:
        """Execute the command."""
        self.validate()
        assert self._model

        # Update status via set_status() for proper timestamp handling
        if self._status is not None:
            self._model.set_status(self._status)
        if self._started_at is not None:
            self._model.started_at = self._started_at
        if self._ended_at is not None:
            self._model.ended_at = self._ended_at

        # Update payload (merges with existing)
        if self._payload is not None:
            self._model.set_payload(self._payload)

        # Update properties (dict passed through to model)
        if self._properties:
            self._model.update_properties(self._properties)

        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        return TaskDAO.update(self._model)

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        # Validate/populate model exists
        # When skip_security_check=True, also skip base filter to find any task
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        self._model = TaskDAO.find_one_or_none(
            skip_base_filter=self._skip_security_check,
            uuid=self._task_uuid,
        )
        if not self._model:
            raise TaskNotFoundError()

        # Verify ownership via base filter (user can only update their own tasks)
        # Skip this check for internal updates (e.g., task executor updating progress)
        if not self._skip_security_check:
            try:
                security_manager.raise_for_ownership(self._model)
            except SupersetSecurityException as ex:
                raise TaskForbiddenError() from ex

        if exceptions:
            raise TaskInvalidError(exceptions=exceptions)
