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

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import CreateMixin
from superset.dao.exceptions import DAOCreateFailedError
from superset.databases.dao import DatabaseDAO
from superset.models.reports import ReportCreationMethodType, ReportScheduleType
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

logger = logging.getLogger(__name__)


class CreateReportScheduleCommand(CreateMixin, BaseReportScheduleCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
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
        user_id = self._actor.id

        # Validate type is required
        if not report_type:
            exceptions.append(ReportScheduleRequiredTypeValidationError())

        # Validate name type uniqueness
        if report_type and not ReportScheduleDAO.validate_update_uniqueness(
            name, report_type
        ):
            exceptions.append(ReportScheduleNameUniquenessValidationError())

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

        # Validate that each chart or dashboard only has one report with
        # the respective creation method.
        if (
            creation_method != ReportCreationMethodType.ALERTS_REPORTS
            and not ReportScheduleDAO.validate_unique_creation_method(
                user_id, dashboard_id, chart_id
            )
        ):
            raise ReportScheduleCreationMethodUniquenessValidationError()

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        try:
            owners = self.populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ReportScheduleInvalidError()
            exception.add_list(exceptions)
            raise exception
