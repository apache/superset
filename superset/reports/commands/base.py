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
from typing import Any, Dict, List

from marshmallow import ValidationError

from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand
from superset.dashboards.dao import DashboardDAO
from superset.reports.commands.exceptions import (
    ChartNotFoundValidationError,
    DashboardNotFoundValidationError,
    ReportScheduleChartOrDashboardValidationError,
)

logger = logging.getLogger(__name__)


class BaseReportScheduleCommand(BaseCommand):

    _properties: Dict[str, Any]

    def run(self) -> Any:
        pass

    def validate(self) -> None:
        pass

    def validate_chart_dashboard(
        self, exceptions: List[ValidationError], update: bool = False
    ) -> None:
        """ Validate chart or dashboard relation """
        chart_id = self._properties.get("chart")
        dashboard_id = self._properties.get("dashboard")
        if chart_id and dashboard_id:
            exceptions.append(ReportScheduleChartOrDashboardValidationError())
        if chart_id:
            chart = ChartDAO.find_by_id(chart_id)
            if not chart:
                exceptions.append(ChartNotFoundValidationError())
            self._properties["chart"] = chart
        elif dashboard_id:
            dashboard = DashboardDAO.find_by_id(dashboard_id)
            if not dashboard:
                exceptions.append(DashboardNotFoundValidationError())
            self._properties["dashboard"] = dashboard
        elif not update:
            exceptions.append(ReportScheduleChartOrDashboardValidationError())
