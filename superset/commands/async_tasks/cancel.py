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

from superset_core.api.types import TaskStatus

from superset.commands.async_tasks.exceptions import (
    AsyncTaskCancelFailedError,
    AsyncTaskNotFoundError,
)
from superset.commands.base import BaseCommand
from superset.daos.async_tasks import AsyncTaskDAO
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

        # Check if task can be cancelled
        if self._model.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
        ]:
            raise AsyncTaskCancelFailedError()

        self._model.set_status(TaskStatus.CANCELLED.value)

        logger.info("Cancelled task: %s", self._task_uuid)
        return self._model

    def validate(self) -> None:
        """Validate command parameters."""
        self._model = AsyncTaskDAO.find_one_or_none(uuid=self._task_uuid)

        if not self._model:
            raise AsyncTaskNotFoundError()
