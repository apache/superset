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

from superset.commands.utils import populate_owners
from superset.dao.exceptions import DAOUpdateFailedError
from superset.databases.dao import DatabaseDAO
from superset.exceptions import SupersetSecurityException
from superset.models.reports import ReportSchedule, ReportScheduleType, ReportState
from superset.reports.commands.base import BaseReportScheduleCommand
from superset.reports.commands.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleForbiddenError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
    ReportScheduleNotFoundError,
    ReportScheduleUpdateFailedError,
)
from superset.reports.dao import ReportScheduleDAO
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class UpdateReportScheduleCommand(BaseReportScheduleCommand):
    def __init__(self, user: User, model_id: int, data: Dict[str, Any]):
        self._actor = user
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[ReportSchedule] = None

    def run(self) -> Model:
        self.validate()
        try:
            report_schedule = ReportScheduleDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise ReportScheduleUpdateFailedError()
        return report_schedule

    def validate(self) -> None:
        exceptions: List[ValidationError] = list()
        owner_ids: Optional[List[int]] = self._properties.get("owners")
        report_type = self._properties.get("type", ReportScheduleType.ALERT)

        name = self._properties.get("name", "")
        self._model = ReportScheduleDAO.find_by_id(self._model_id)

        # Does the report exist?
        if not self._model:
            raise ReportScheduleNotFoundError()

        # Change the state to not triggered when the user deactivates
        # A report that is currently in a working state. This prevents
        # an alert/report from being kept in a working state if activated back
        if (
            self._model.last_state == ReportState.WORKING
            and "active" in self._properties
            and not self._properties["active"]
        ):
            self._properties["last_state"] = ReportState.NOOP

        # validate relation by report type
        if not report_type:
            report_type = self._model.type

        # Validate name type uniqueness
        if not ReportScheduleDAO.validate_update_uniqueness(
            name, report_type, report_schedule_id=self._model_id
        ):
            exceptions.append(ReportScheduleNameUniquenessValidationError())

        if report_type == ReportScheduleType.ALERT:
            database_id = self._properties.get("database")
            # If database_id was sent let's validate it exists
            if database_id:
                database = DatabaseDAO.find_by_id(database_id)
                if not database:
                    exceptions.append(DatabaseNotFoundValidationError())
                self._properties["database"] = database

        # Validate chart or dashboard relations
        self.validate_chart_dashboard(exceptions, update=True)

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        # Check ownership
        try:
            check_ownership(self._model)
        except SupersetSecurityException:
            raise ReportScheduleForbiddenError()

        # Validate/Populate owner
        if owner_ids is None:
            owner_ids = [owner.id for owner in self._model.owners]
        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ReportScheduleInvalidError()
            exception.add_list(exceptions)
            raise exception
