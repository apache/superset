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

from superset import security_manager
from superset.commands.async_tasks.exceptions import (
    AsyncTaskCancelFailedError,
    AsyncTaskForbiddenError,
    AsyncTaskNotFoundError,
)
from superset.commands.base import BaseCommand
from superset.daos.async_tasks import AsyncTaskDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.async_tasks import AsyncTask
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CancelAsyncTaskCommand(BaseCommand):
    """Command to cancel an async task."""

    def __init__(self, task_uuid: str):
        self._task_uuid = task_uuid
        self._model: AsyncTask | None = None

    @transaction(on_error=partial(on_error, reraise=AsyncTaskCancelFailedError))
    def run(self) -> AsyncTask:
        """Execute the command."""
        self.validate()
        assert self._model

        # Cancel the task via DAO
        success = AsyncTaskDAO.cancel_task(self._task_uuid)
        if not success:
            raise AsyncTaskCancelFailedError()

        # Refresh and return the updated model
        db.session.refresh(self._model)
        return self._model

    def validate(self) -> None:
        """Validate command parameters."""
        # Validate/populate model exists - this applies base filter
        self._model = AsyncTaskDAO.find_by_id(self._task_uuid)
        if not self._model:
            raise AsyncTaskNotFoundError()

        # Verify ownership via base filter (user can only cancel their own tasks)
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise AsyncTaskForbiddenError() from ex
