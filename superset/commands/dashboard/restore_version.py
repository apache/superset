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
"""Command that restores a dashboard to a previous version."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RestoreDashboardVersionCommand(BaseCommand):
    """Revert a dashboard (including its chart associations) to a previous
    version.

    See :class:`superset.commands.chart.restore_version.RestoreChartVersionCommand`
    for the general contract.
    """

    def __init__(self, dashboard_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = dashboard_uuid
        self._version_uuid = version_uuid
        self._dashboard: Dashboard | None = None

    @transaction(on_error=partial(on_error, reraise=DashboardUpdateFailedError))
    def run(self) -> Dashboard:
        self.validate()
        version_number = VersionDAO.resolve_version_uuid(
            Dashboard, self._uuid, self._version_uuid
        )
        if version_number is None:
            raise DashboardNotFoundError()
        dashboard = VersionDAO.restore_version(Dashboard, self._uuid, version_number)
        if dashboard is None:
            raise DashboardNotFoundError()
        return dashboard

    def validate(self) -> None:
        dashboard = VersionDAO._find_active_entity_by_uuid(  # pylint: disable=protected-access
            Dashboard, self._uuid
        )
        if dashboard is None:
            raise DashboardNotFoundError()
        try:
            security_manager.raise_for_ownership(dashboard)
        except SupersetSecurityException as ex:
            raise DashboardForbiddenError() from ex
        self._dashboard = dashboard
