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
from datetime import datetime
from functools import partial

from marshmallow import ValidationError

from superset.commands.async_tasks.exceptions import (
    AsyncTaskDeleteFailedError,
    AsyncTaskInvalidError,
)
from superset.commands.base import BaseCommand
from superset.daos.async_tasks import AsyncTaskDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteOldAsyncTasksCommand(BaseCommand):
    """
    Command to delete old completed async tasks (bulk cleanup).

    This command does NOT apply base filter as it's intended for
    administrative cleanup of old tasks across all users.
    """

    def __init__(self, older_than: datetime, batch_size: int = 1000):
        self._older_than = older_than
        self._batch_size = batch_size

    @transaction(on_error=partial(on_error, reraise=AsyncTaskDeleteFailedError))
    def run(self) -> int:
        """Execute the command and return count of deleted tasks."""
        self.validate()

        # Delete old completed tasks without base filter
        deleted_count = AsyncTaskDAO.delete_old_completed_tasks(
            older_than=self._older_than,
            batch_size=self._batch_size,
        )

        logger.info(
            "Deleted %d old async tasks older than %s",
            deleted_count,
            self._older_than,
        )

        return deleted_count

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        if not isinstance(self._older_than, datetime):
            exceptions.append(
                ValidationError(
                    "older_than must be a datetime object", field_name="older_than"
                )
            )

        if self._batch_size < 1:
            exceptions.append(
                ValidationError(
                    "batch_size must be greater than 0", field_name="batch_size"
                )
            )

        if exceptions:
            raise AsyncTaskInvalidError(exceptions=exceptions)
