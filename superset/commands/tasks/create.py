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
from superset_core.api.tasks import TaskScope

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskCreateFailedError,
    TaskInvalidError,
)
from superset.daos.exceptions import DAOCreateFailedError
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class CreateTaskCommand(BaseCommand):
    """Command to create a new async task."""

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=TaskCreateFailedError))
    def run(self) -> "Task":
        """Execute the command."""
        self.validate()
        try:
            # Lazy import to avoid circular dependency
            from superset.daos.tasks import TaskDAO

            return TaskDAO.create_task(
                task_type=self._properties["task_type"],
                task_key=self._properties.get("task_key"),
                scope=self._properties.get("scope", TaskScope.PRIVATE.value),
                task_name=self._properties.get("task_name"),
                user_id=self._properties.get("user_id"),
                payload=self._properties.get("payload", "{}"),
            )
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

        # Validate scope if provided
        scope = self._properties.get("scope", TaskScope.PRIVATE.value)
        valid_scopes = [s.value for s in TaskScope]
        if scope not in valid_scopes:
            exceptions.append(
                ValidationError(
                    f"scope must be one of {valid_scopes}",
                    field_name="scope",
                )
            )

        if exceptions:
            raise TaskInvalidError(exceptions=exceptions)
