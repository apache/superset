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
from typing import Any, TYPE_CHECKING

from marshmallow import ValidationError

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
    """Command to update an task."""

    def __init__(self, task_uuid: str, data: dict[str, Any]):
        self._task_uuid = task_uuid
        self._properties = data.copy()
        self._model: "Task" | None = None

    @transaction(on_error=partial(on_error, reraise=TaskUpdateFailedError))
    def run(self) -> "Task":
        """Execute the command."""
        self.validate()
        assert self._model

        # Update allowed properties
        for key, value in self._properties.items():
            if key in ["status", "error_message", "started_at", "ended_at"]:
                setattr(self._model, key, value)
            elif key == "payload":
                self._model.set_payload(value)

        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        return TaskDAO.update(self._model)

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        # Validate/populate model exists - this applies base filter
        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        self._model = TaskDAO.find_one_or_none(uuid=self._task_uuid)
        if not self._model:
            raise TaskNotFoundError()

        # Verify ownership via base filter (user can only update their own tasks)
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise TaskForbiddenError() from ex

        if exceptions:
            raise TaskInvalidError(exceptions=exceptions)
