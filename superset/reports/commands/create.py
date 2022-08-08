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
from typing import Any, Dict, List, Optional

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.commands.base import CreateMixin
from superset.dao.exceptions import DAOCreateFailedError
from superset.databases.dao import DatabaseDAO
from superset.reports.commands.base import BaseReportScheduleCommand
from superset.reports.commands.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleAlertRequiredDatabaseValidationError,
    ReportScheduleCreateFailedError,
    ReportScheduleCreationMethodUniquenessValidationError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
    ReportScheduleRequiredTypeValidationError,
)
from superset.reports.dao import ReportScheduleDAO
from superset.reports.models import (
    ReportCreationMethod,
    ReportSchedule,
    ReportScheduleType,
)
from superset.reports.types import ReportScheduleExtra

logger = logging.getLogger(__name__)


class CreateReportScheduleCommand(CreateMixin, BaseReportScheduleCommand):
    def __init__(self, data: Dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> ReportSchedule:
        self.validate()
        try:
            report_schedule = ReportScheduleDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise ReportScheduleCreateFailedError() from ex
        return report_schedule

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
        owner_ids: Optional[List[int]] = self._properties.get("owners")
        name = self._properties.get("name", "")
        report_type = self._properties.get("type")
        creation_method = self._properties.get("creation_method")
        chart_id = self._properties.get("chart")
        dashboard_id = self._properties.get("dashboard")

        # Validate type is required
        if not report_type:
            exceptions.append(ReportScheduleRequiredTypeValidationError())

        # Validate name type uniqueness
        if report_type and not ReportScheduleDAO.validate_update_uniqueness(
            name, report_type
        ):
            exceptions.append(
                ReportScheduleNameUniquenessValidationError(
                    report_type=report_type, name=name
                )
            )

        # validate relation by report type
        if report_type == ReportScheduleType.ALERT:
            database_id = self._properties.get("database")
            if not database_id:
                exceptions.append(ReportScheduleAlertRequiredDatabaseValidationError())
            else:
                database = DatabaseDAO.find_by_id(database_id)
                if not database:
                    exceptions.append(DatabaseNotFoundValidationError())
                self._properties["database"] = database

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
            exception = ReportScheduleInvalidError()
            exception.add_list(exceptions)
            raise exception

    def _validate_report_extra(self, exceptions: List[ValidationError]) -> None:
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
