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

from flask_babel import lazy_gettext as _

from superset.commands.async_tasks.exceptions import (
    AsyncTaskInvalidError,
)
from superset.commands.base import BaseCommand
from superset.commands.exceptions import ValidationError
from superset.daos.async_tasks import AsyncTaskDAO

logger = logging.getLogger(__name__)


class BulkCancelAsyncTasksCommand(BaseCommand):
    """Command to cancel multiple async tasks."""

    def __init__(self, task_uuids: list[str]):
        self._task_uuids = task_uuids

    def run(self) -> tuple[int, int]:
        """
        Execute the command.

        :returns: Tuple of (cancelled_count, total_requested)
        """
        self.validate()

        cancelled_count, total_requested = AsyncTaskDAO.bulk_cancel_tasks(
            self._task_uuids,
        )

        logger.info(
            "Bulk cancelled %d out of %d tasks", cancelled_count, total_requested
        )
        return cancelled_count, total_requested

    def validate(self) -> None:
        """Validate command parameters."""
        exceptions: list[ValidationError] = []

        # Validate task_uuids is provided and non-empty
        if not self._task_uuids:
            exceptions.append(
                ValidationError(
                    _("At least one task UUID must be provided"),
                    field_name="task_uuids",
                )
            )

        # Validate all UUIDs are strings
        if not all(isinstance(uuid, str) for uuid in self._task_uuids):
            exceptions.append(
                ValidationError(
                    _("All task UUIDs must be strings"), field_name="task_uuids"
                )
            )

        if exceptions:
            raise AsyncTaskInvalidError(exceptions=exceptions)
