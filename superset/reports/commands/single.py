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
import json
import logging
from typing import Any, Optional

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.commands.base import CreateMixin
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.reports.commands.base import BaseReportScheduleCommand
from superset.reports.commands.exceptions import (
    ReportScheduleInvalidError,
    ReportScheduleRequiredTypeValidationError,
)
from superset.reports.commands.execute import SingleReportExecutor
from superset.reports.types import ReportScheduleExtra

logger = logging.getLogger(__name__)


class SingleReportCommand(CreateMixin, BaseReportScheduleCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> None:
        self.validate()
        try:
            SingleReportExecutor(**self._properties).send()
        except Exception as ex:
            logger.exception(ex.exception)
            # raise ReportScheduleCreateFailedError() from ex

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        owner_ids: Optional[list[int]] = self._properties.get("owners")
        report_type = self._properties.get("type")

        # Validate type is required
        if not report_type:
            exceptions.append(ReportScheduleRequiredTypeValidationError())

        # Validate chart or dashboard relations
        self.validate_chart_dashboard(exceptions)
        self._validate_report_extra(exceptions)

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise ReportScheduleInvalidError(exceptions=exceptions)

    def _validate_report_extra(self, exceptions: list[ValidationError]) -> None:
        extra: Optional[ReportScheduleExtra] = self._properties.get("extra")
        dashboard = self._properties.get("dashboard")

        if extra is None or dashboard is None:
            return

        dashboard_state = extra.get("dashboard")
        if not dashboard_state:
            return

        position_data = json.loads(dashboard.position_json or "{}")
        active_tabs = dashboard_state.get("activeTabs") or []
        anchor = dashboard_state.get("anchor")
        invalid_tab_ids = set(active_tabs) - set(position_data.keys())
        if anchor and anchor not in position_data:
            invalid_tab_ids.add(anchor)
        if invalid_tab_ids:
            exceptions.append(
                ValidationError(
                    _("Invalid tab ids: %s(tab_ids)", tab_ids=str(invalid_tab_ids)),
                    "extra",
                )
            )
