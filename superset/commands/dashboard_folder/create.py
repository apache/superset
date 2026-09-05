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
"""Create a dashboard folder."""

from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNameConflictError,
    DashboardFolderOperationFailedError,
)
from superset.commands.utils import populate_subjects
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.models.dashboard_folder import DashboardFolder
from superset.utils.decorators import on_error, transaction


class CreateDashboardFolderCommand(BaseCommand):
    """Create a folder with Subject-based editor and viewer access."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(
        on_error=partial(on_error, reraise=DashboardFolderOperationFailedError)
    )
    def run(self) -> DashboardFolder:
        self.validate()
        return DashboardFolderDAO.create(attributes=self._properties)

    def validate(self) -> None:
        """Validate parent access, names, and Subject relationships."""
        name = self._properties["name"].strip()
        if not name:
            raise DashboardFolderInvalidError()
        self._properties["name"] = name
        parent_id = self._properties.get("parent_id")
        if parent_id:
            parent = DashboardFolderDAO.get_by_id(parent_id)
            if parent is None:
                raise DashboardFolderInvalidError()
            if not DashboardFolderDAO.can_write(parent):
                raise DashboardFolderForbiddenError()
            if parent.name.strip().lower() == name.lower():
                raise DashboardFolderNameConflictError()

        if DashboardFolderDAO.find_name_conflict(name, parent_id):
            raise DashboardFolderNameConflictError()

        exceptions: list[ValidationError] = []
        populate_subjects(self._properties, exceptions)
        if exceptions:
            raise DashboardFolderInvalidError(exceptions=exceptions)
