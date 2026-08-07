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

from flask import g

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard_folder.exceptions import (
    DashboardFolderForbiddenError,
    DashboardFolderInvalidError,
    DashboardFolderNameConflictError,
    DashboardFolderOperationFailedError,
)
from superset.daos.dashboard_folder import DashboardFolderDAO
from superset.models.dashboard_folder import DashboardFolder
from superset.utils.decorators import on_error, transaction


class CreateDashboardFolderCommand(BaseCommand):
    """Create a folder owned by the current user by default."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(
        on_error=partial(on_error, reraise=DashboardFolderOperationFailedError)
    )
    def run(self) -> DashboardFolder:
        self.validate()
        owner_ids = self._properties.pop("owners", [])
        owners = DashboardFolderDAO.get_users(owner_ids) if owner_ids else [g.user]
        return DashboardFolderDAO.create(
            attributes={**self._properties, "owners": owners}
        )

    def validate(self) -> None:
        """Validate parent ownership and explicit owner assignment."""
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

        owner_ids = self._properties.pop("owners", [])
        if owner_ids and not security_manager.is_admin():
            raise DashboardFolderForbiddenError()

        if DashboardFolderDAO.find_name_conflict(name, parent_id):
            raise DashboardFolderNameConflictError()

        self._properties["owners"] = owner_ids
