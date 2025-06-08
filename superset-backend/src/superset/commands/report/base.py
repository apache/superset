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
from typing import Any

from croniter import croniter
from flask import current_app
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.report.exceptions import (
    ChartNotFoundValidationError,
    ChartNotSavedValidationError,
    DashboardNotFoundValidationError,
    DashboardNotSavedValidationError,
    ReportScheduleEitherChartOrDashboardError,
    ReportScheduleFrequencyNotAllowed,
    ReportScheduleOnlyChartOrDashboardError,
)
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.reports.models import ReportCreationMethod, ReportScheduleType

logger = logging.getLogger(__name__)


class BaseReportScheduleCommand(BaseCommand):
    _properties: dict[str, Any]

    def run(self) -> Any:
        pass

    def validate(self) -> None:
        pass

    def validate_chart_dashboard(
        self, exceptions: list[ValidationError], update: bool = False
    ) -> None:
        """Validate chart or dashboard relation"""
        chart_id = self._properties.get("chart")
        dashboard_id = self._properties.get("dashboard")
        creation_method = self._properties.get("creation_method")

        if creation_method == ReportCreationMethod.CHARTS and not chart_id:
            # User has not saved chart yet in Explore view
            exceptions.append(ChartNotSavedValidationError())
            return

        if creation_method == ReportCreationMethod.DASHBOARDS and not dashboard_id:
            exceptions.append(DashboardNotSavedValidationError())
            return

        if chart_id and dashboard_id:
            exceptions.append(ReportScheduleOnlyChartOrDashboardError())

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
            exceptions.append(ReportScheduleEitherChartOrDashboardError())

    def validate_report_frequency(
        self,
        cron_schedule: str,
        report_type: str,
    ) -> None:
        """
        Validates if the report scheduled frequency doesn't exceed a limit
        configured in `config.py`.

        :param cron_schedule: The cron schedule configured.
        :param report_type: The report type (Alert/Report).
        """
        config_key = (
            "ALERT_MINIMUM_INTERVAL"
            if report_type == ReportScheduleType.ALERT
            else "REPORT_MINIMUM_INTERVAL"
        )
        minimum_interval = current_app.config.get(config_key, 0)
        if callable(minimum_interval):
            minimum_interval = minimum_interval()

        if not isinstance(minimum_interval, int):
            logger.error(
                "Invalid value for %s: %s", config_key, minimum_interval, exc_info=True
            )
            return

        # Since configuration is in minutes, we only need to validate
        # in case `minimum_interval` is <= 120 (2min)
        if minimum_interval < 120:
            return

        iterations = 60 if minimum_interval <= 3660 else 24
        schedule = croniter(cron_schedule)
        current_exec = next(schedule)

        for _ in range(iterations):
            next_exec = next(schedule)
            diff, current_exec = next_exec - current_exec, next_exec
            if int(diff) < minimum_interval:
                raise ReportScheduleFrequencyNotAllowed(
                    report_type=report_type, minimum_interval=minimum_interval
                )
