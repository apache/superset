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
"""Delete a dashboard folder."""

from functools import partial
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderForbiddenError,
    DashboardFolderNotFoundError,
    DashboardFolderOperationFailedError,
)
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.models.dashboard_folder import DashboardFolder
from superset.utils.decorators import on_error, transaction


class DeleteDashboardFolderCommand(BaseCommand):
    """Delete a folder tree without deleting its dashboards."""

    def __init__(self, folder_id: UUID) -> None:
        self._folder_id = folder_id
        self._folder: DashboardFolder | None = None

    @transaction(
        on_error=partial(on_error, reraise=DashboardFolderOperationFailedError)
    )
    def run(self) -> None:
        self.validate()
        assert self._folder is not None
        DashboardFolderDAO.uncategorize_dashboards(self._folder)
        DashboardFolderDAO.delete([self._folder])

    def validate(self) -> None:
        """Validate ownership across the folder subtree."""
        self._folder = DashboardFolderDAO.get_by_id(self._folder_id)
        if self._folder is None:
            raise DashboardFolderNotFoundError()
        if not DashboardFolderDAO.can_write(self._folder):
            raise DashboardFolderForbiddenError()
        if not security_manager.is_admin() and not self._owns_descendants(self._folder):
            raise DashboardFolderForbiddenError()

    @staticmethod
    def _owns_descendants(folder: DashboardFolder) -> bool:
        """Prevent cascading deletion of folders owned by another user."""
        pending = list(folder.children)
        while pending:
            child = pending.pop()
            if not DashboardFolderDAO.can_write(child):
                return False
            pending.extend(child.children)
        return True
