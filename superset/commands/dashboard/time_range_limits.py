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
from datetime import datetime
from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardUpdateFailedError,
)
from superset.commands.utils import raise_if_managed_externally
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.time_range_limits.policy import (
    dashboard_limits_payload,
    limits_errors,
    parse_time_range_limits,
    stored_limits,
    stricter_errors,
)
from superset.utils.decorators import on_error, transaction


class UpdateDashboardTimeRangeLimitsCommand(BaseCommand):
    """
    Replace a dashboard's time range limits, or remove them when ``policy`` is
    ``None``, and return the dashboard's limits payload. The payload is built
    before the commit, so a policy that can't be loaded rolls the write back.
    """

    def __init__(self, dashboard: Dashboard, policy: dict[str, Any] | None):
        self._dashboard = dashboard
        self._policy = policy

    @transaction(on_error=partial(on_error, reraise=DashboardUpdateFailedError))
    def run(self) -> dict[str, Any]:
        self.validate()
        DashboardDAO.update_time_range_limits(self._dashboard, self._policy)
        return dashboard_limits_payload(
            self._dashboard, datetime.now(), keep_for_level_editor=False
        )

    def validate(self) -> None:
        try:
            security_manager.raise_for_editorship(self._dashboard)
        except SupersetSecurityException as ex:
            raise DashboardForbiddenError() from ex
        raise_if_managed_externally(self._dashboard, DashboardForbiddenError)

        if errors := stricter_errors(
            parse_time_range_limits(self._policy),
            "dashboard",
            lambda: stored_limits(self._dashboard.json_metadata),
        ):
            raise DashboardInvalidError(
                exceptions=[ValidationError(limits_errors("policy", errors))]
            )
