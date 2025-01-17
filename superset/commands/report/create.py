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
from typing import Any, Optional

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.commands.base import CreateMixin
from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleAlertRequiredDatabaseValidationError,
    ReportScheduleCreateFailedError,
    ReportScheduleCreationMethodUniquenessValidationError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
)
from superset.daos.database import DatabaseDAO
from superset.daos.report import ReportScheduleDAO
from superset.reports.models import (
    ReportCreationMethod,
    ReportSchedule,
    ReportScheduleType,
)
from superset.reports.types import ReportScheduleExtra
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateReportScheduleCommand(CreateMixin, BaseReportScheduleCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=ReportScheduleCreateFailedError))
    def run(self) -> ReportSchedule:
        self.validate()
        return ReportScheduleDAO.create(attributes=self._properties)

    def validate(self) -> None:
        """
        Validates the properties of a report schedule configuration, including uniqueness
        of name and type, relations based on the report type, frequency, etc. Populates
        a list of `ValidationErrors` to be returned in the API response if any.

        Fields were loaded according to the `ReportSchedulePostSchema` schema.
        """  # noqa: E501
        # Required fields
        cron_schedule = self._properties["crontab"]
        name = self._properties["name"]
        report_type = self._properties["type"]

        # Optional fields
        chart_id = self._properties.get("chart")
        creation_method = self._properties.get("creation_method")
        dashboard_id = self._properties.get("dashboard")
        owner_ids: Optional[list[int]] = self._properties.get("owners")

        exceptions: list[ValidationError] = []

        # Validate name type uniqueness
        if not ReportScheduleDAO.validate_update_uniqueness(name, report_type):
            exceptions.append(
                ReportScheduleNameUniquenessValidationError(
                    report_type=report_type, name=name
                )
            )

        # Validate if DB exists (for alerts)
        if report_type == ReportScheduleType.ALERT:
            try:
                database_id = self._properties["database"]
                if database := DatabaseDAO.find_by_id(database_id):
                    self._properties["database"] = database
                else:
                    exceptions.append(DatabaseNotFoundValidationError())
            except KeyError:
                exceptions.append(ReportScheduleAlertRequiredDatabaseValidationError())

        # validate report frequency
        try:
            self.validate_report_frequency(
                cron_schedule,
                report_type,
            )
        except ValidationError as exc:
            exceptions.append(exc)

        # Validate chart or dashboard relations
        self.validate_chart_dashboard(exceptions)
        self._validate_report_extra(exceptions)

        # Validate that each chart or dashboard only has one report with
        # the respective creation method.
        if (
            creation_method != ReportCreationMethod.ALERTS_REPORTS
            and not ReportScheduleDAO.validate_unique_creation_method(
                dashboard_id, chart_id
            )
        ):
            raise ReportScheduleCreationMethodUniquenessValidationError()

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
        invalid_tab_ids = set(active_tabs) - set(position_data.keys())

        if anchor := dashboard_state.get("anchor"):
            try:
                anchor_list: list[str] = json.loads(anchor)
                if _invalid_tab_ids := set(anchor_list) - set(position_data.keys()):
                    invalid_tab_ids.update(_invalid_tab_ids)
            except json.JSONDecodeError:
                if anchor not in position_data:
                    invalid_tab_ids.add(anchor)

        if invalid_tab_ids:
            exceptions.append(
                ValidationError(
                    _("Invalid tab ids: %s(tab_ids)", tab_ids=str(invalid_tab_ids)),
                    "extra",
                )
            )
