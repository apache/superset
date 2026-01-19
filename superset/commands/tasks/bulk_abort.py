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
from typing import TYPE_CHECKING

from flask_babel import lazy_gettext as _

from superset.commands.base import BaseCommand
from superset.commands.exceptions import ValidationError
from superset.commands.tasks.exceptions import (
    TaskInvalidError,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class BulkAbortTasksCommand(BaseCommand):
    """Command to abort multiple tasks with scope-based permissions."""

    def __init__(self, task_uuids: list[str]):
        self._task_uuids = task_uuids

    def run(self) -> tuple[int, int]:
        """
        Execute the command.

        For non-admin users, only aborts tasks they have permission for:
        - Private: their own tasks
        - Shared: tasks they're subscribed to
        - System: none (admin-only)

        For admin users, can abort any task.

        :returns: Tuple of (aborted_count, total_requested)
        """
        from superset import security_manager

        self.validate()

        # Admins can abort any task (skip_base_filter=True)
        is_admin = security_manager.is_admin()

        # Lazy import to avoid circular dependency
        from superset.daos.tasks import TaskDAO

        aborted_count, total_requested = TaskDAO.bulk_abort_tasks(
            self._task_uuids,
            skip_base_filter=is_admin,
        )

        logger.info(
            "Bulk aborted %d out of %d tasks (admin=%s)",
            aborted_count,
            total_requested,
            is_admin,
        )
        return aborted_count, total_requested

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
            raise TaskInvalidError(exceptions=exceptions)
