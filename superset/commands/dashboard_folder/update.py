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
"""Update a dashboard folder."""

from functools import partial
from typing import Any
from uuid import UUID

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNameConflictError,
    DashboardFolderNotFoundError,
    DashboardFolderOperationFailedError,
)
from superset.commands.utils import compute_subjects
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.models.dashboard_folder import DashboardFolder
from superset.utils.decorators import on_error, transaction


class UpdateDashboardFolderCommand(BaseCommand):
    """Update a folder after validating editorship and hierarchy."""

    def __init__(self, folder_id: UUID, data: dict[str, Any]) -> None:
        self._folder_id = folder_id
        self._properties = data.copy()
        self._folder: DashboardFolder | None = None

    @transaction(
        on_error=partial(on_error, reraise=DashboardFolderOperationFailedError)
    )
    def run(self) -> DashboardFolder:
        self.validate()
        assert self._folder is not None
        return DashboardFolderDAO.update(self._folder, self._properties)

    def validate(self) -> None:
        """Validate editorship, Subject changes, and target ancestry."""
        self._folder = DashboardFolderDAO.get_by_id(self._folder_id)
        if self._folder is None:
            raise DashboardFolderNotFoundError()
        if not DashboardFolderDAO.can_write(self._folder):
            raise DashboardFolderForbiddenError()

        if (
            "editors" in self._properties
            or "viewers" in self._properties
            or hasattr(self._folder, "editors")
        ):
            exceptions: list[ValidationError] = []
            compute_subjects(self._folder, self._properties, exceptions)
            if exceptions:
                raise DashboardFolderInvalidError(exceptions=exceptions)

        if "parent_id" in self._properties:
            self._validate_parent(self._properties["parent_id"])

        self._validate_name()

    def _validate_name(self) -> None:
        """Normalize the name and reject parent or sibling conflicts."""
        assert self._folder is not None

        name = self._properties.get("name", self._folder.name).strip()
        if not name:
            raise DashboardFolderInvalidError()
        self._properties["name"] = name
        parent_id = self._properties.get("parent_id", self._folder.parent_id)
        if parent_id is not None:
            parent = DashboardFolderDAO.get_by_id(parent_id)
            if parent is None:
                raise DashboardFolderInvalidError()
            if parent.name.strip().lower() == name.lower():
                raise DashboardFolderNameConflictError()
        if DashboardFolderDAO.find_name_conflict(
            name,
            parent_id,
            excluded_folder_id=self._folder_id,
        ):
            raise DashboardFolderNameConflictError()

    def _validate_parent(self, parent_id: UUID | None) -> None:
        """Validate target ownership and reject cyclic ancestry."""
        visited = {self._folder_id}
        while parent_id is not None:
            if parent_id in visited:
                raise DashboardFolderInvalidError()
            visited.add(parent_id)
            parent = DashboardFolderDAO.get_by_id(parent_id)
            if parent is None:
                raise DashboardFolderInvalidError()
            if not DashboardFolderDAO.can_write(parent):
                raise DashboardFolderForbiddenError()
            parent_id = parent.parent_id
