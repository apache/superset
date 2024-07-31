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
from functools import partial
from typing import Any

from superset import is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import (
    DashboardCopyError,
    DashboardForbiddenError,
    DashboardInvalidError,
)
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CopyDashboardCommand(BaseCommand):
    def __init__(self, original_dash: Dashboard, data: dict[str, Any]) -> None:
        self._original_dash = original_dash
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DashboardCopyError))
    def run(self) -> Dashboard:
        self.validate()
        return DashboardDAO.copy_dashboard(self._original_dash, self._properties)

    def validate(self) -> None:
        if not self._properties.get("dashboard_title") or not self._properties.get(
            "json_metadata"
        ):
            raise DashboardInvalidError()
        if is_feature_enabled("DASHBOARD_RBAC") and not security_manager.is_owner(
            self._original_dash
        ):
            raise DashboardForbiddenError()
