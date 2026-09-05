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
"""Move a dashboard into a folder."""

from functools import partial
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderDashboardNotFoundError,
    DashboardFolderForbiddenError,
    DashboardFolderNotFoundError,
    DashboardFolderOperationFailedError,
)
from superset.daos.dashboard import DashboardDAO
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.utils.decorators import on_error, transaction


class MoveDashboardToFolderCommand(BaseCommand):
    """Move a dashboard after checking both protected resources."""

    def __init__(self, dashboard_id: int, folder_id: UUID | None) -> None:
        self._dashboard_id = dashboard_id
        self._folder_id = folder_id
        self._dashboard: Dashboard | None = None

    @transaction(
        on_error=partial(on_error, reraise=DashboardFolderOperationFailedError)
    )
    def run(self) -> Dashboard:
        self.validate()
        assert self._dashboard is not None
        return DashboardDAO.update(self._dashboard, {"folder_id": self._folder_id})

    def validate(self) -> None:
        """Validate dashboard editorship and target folder ownership."""
        self._dashboard = DashboardDAO.find_by_id(self._dashboard_id)
        if self._dashboard is None:
            raise DashboardFolderDashboardNotFoundError()
        try:
            security_manager.raise_for_editorship(self._dashboard)
        except SupersetSecurityException as ex:
            raise DashboardFolderForbiddenError() from ex

        if self._folder_id is not None:
            folder = DashboardFolderDAO.get_by_id(self._folder_id)
            if folder is None:
                raise DashboardFolderNotFoundError()
            if not DashboardFolderDAO.can_write(folder):
                raise DashboardFolderForbiddenError()
