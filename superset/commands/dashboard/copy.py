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

from superset import security_manager
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
        return DashboardDAO.copy_dashboard(self._original_dash, self._properties)

    def validate(self) -> None:
        if not self._properties.get("dashboard_title") or not self._properties.get(
            "json_metadata"
        ):
            raise DashboardInvalidError()
        if not security_manager.is_editor(self._original_dash):
            raise DashboardForbiddenError()
