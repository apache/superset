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
from typing import Any

from marshmallow import ValidationError

from superset import security_manager
from superset.commands.async_tasks.exceptions import (
    AsyncTaskForbiddenError,
    AsyncTaskInvalidError,
    AsyncTaskNotFoundError,
    AsyncTaskUpdateFailedError,
)
from superset.commands.base import BaseCommand
from superset.daos.async_tasks import AsyncTaskDAO
from superset.exceptions import SupersetSecurityException
from superset.models.async_tasks import AsyncTask
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateAsyncTaskCommand(BaseCommand):
    """Command to update an async task."""

    def __init__(self, task_uuid: str, data: dict[str, Any]):
        self._task_uuid = task_uuid
        self._properties = data.copy()
        self._model: AsyncTask | None = None

    @transaction(on_error=partial(on_error, reraise=AsyncTaskUpdateFailedError))
    def run(self) -> AsyncTask:
        """Execute the command."""
        self.validate()
        assert self._model

        # Update allowed properties
        for key, value in self._properties.items():
            if key in ["status", "error_message", "started_at", "ended_at"]:
                setattr(self._model, key, value)
            elif key == "payload":
                self._model.set_payload(value)

        return AsyncTaskDAO.update(self._model)

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        # Validate/populate model exists - this applies base filter
        self._model = AsyncTaskDAO.find_by_id(self._task_uuid)
        if not self._model:
            raise AsyncTaskNotFoundError()

        # Verify ownership via base filter (user can only update their own tasks)
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise AsyncTaskForbiddenError() from ex

        if exceptions:
            raise AsyncTaskInvalidError(exceptions=exceptions)
