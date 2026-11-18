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
    DashboardRefreshPolicyInvalidError,
)
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.refresh_policy import (
    check_refresh_policy,
    log_refresh_policy_change,
    POLICY_KEY,
)
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CopyDashboardCommand(BaseCommand):
    def __init__(self, original_dash: Dashboard, data: dict[str, Any]) -> None:
        self._original_dash = original_dash
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DashboardCopyError))
    def run(self) -> Dashboard:
        self.validate()
        # Declare the high-level avenue before the copy touches the
        # session. The change-record listener stamps
        # ``version_transaction.action_kind = 'clone'`` so the new
        # dashboard's baseline records read as "Cloned from <source>"
        # in the timeline instead of "Dashboard created".
        # Method-scoped imports — defer the versioning bootstrap path
        # (``Model.metadata`` and Continuum-adjacent setup) out of this
        # command's module-load graph; see ``changes.py`` module
        # docstring for the broader init-order rationale.
        from superset import db
        from superset.versioning.changes import ACTION_KIND_CLONE, ACTION_KIND_KEY

        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_CLONE
        dashboard = DashboardDAO.copy_dashboard(self._original_dash, self._properties)
        if is_feature_enabled("AUTO_REFRESH_POLICY"):
            metadata = dashboard.params_dict
            if POLICY_KEY in metadata and metadata[POLICY_KEY] is None:
                metadata.pop(POLICY_KEY)
                dashboard.json_metadata = json.dumps(metadata)
        log_refresh_policy_change(
            dashboard.id, None, dashboard.params_dict.get(POLICY_KEY), "copy"
        )
        return dashboard

    def validate(self) -> None:
        if not self._properties.get("dashboard_title") or not self._properties.get(
            "json_metadata"
        ):
            raise DashboardInvalidError()
        if not security_manager.is_editor(self._original_dash):
            raise DashboardForbiddenError()

        if is_feature_enabled("AUTO_REFRESH_POLICY"):
            metadata = (
                {}
                if self._properties.get("replace_metadata")
                else self._original_dash.params_dict.copy()
            )
            metadata.update(json.loads(self._properties["json_metadata"]))
            if errors := check_refresh_policy(
                metadata, self._original_dash.params_dict.get(POLICY_KEY)
            ):
                raise DashboardRefreshPolicyInvalidError([], errors)
