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

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import UpdateMixin
from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleForbiddenError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
    ReportScheduleNotFoundError,
    ReportScheduleUpdateFailedError,
)
from superset.daos.database import DatabaseDAO
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.reports.models import ReportSchedule, ReportScheduleType, ReportState
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateReportScheduleCommand(UpdateMixin, BaseReportScheduleCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[ReportSchedule] = None

    @transaction(on_error=partial(on_error, reraise=ReportScheduleUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        return ReportScheduleDAO.update(self._model, self._properties)

    def validate(self) -> None:  # noqa: C901
        """
        Validates the properties of a report schedule configuration, including uniqueness
        of name and type, relations based on the report type, frequency, etc. Populates
        a list of `ValidationErrors` to be returned in the API response if any.

        Fields were loaded according to the `ReportSchedulePutSchema` schema.
        """  # noqa: E501
        # Load existing report schedule config
        self._model = ReportScheduleDAO.find_by_id(self._model_id)
        if not self._model:
            raise ReportScheduleNotFoundError()

        # Required fields for validation
        cron_schedule = self._properties.get("crontab", self._model.crontab)
        name = self._properties.get("name", self._model.name)
        report_type = self._properties.get("type", self._model.type)

        # Optional fields
        database_id = self._properties.get("database")
        owner_ids: Optional[list[int]] = self._properties.get("owners")

        exceptions: list[ValidationError] = []

        # Change the state to not triggered when the user deactivates
        # A report that is currently in a working state. This prevents
        # an alert/report from being kept in a working state if activated back
        if (
            self._model.last_state == ReportState.WORKING
            and "active" in self._properties
            and not self._properties["active"]
        ):
            self._properties["last_state"] = ReportState.NOOP

        # Validate name/type uniqueness if either is changing
        if name != self._model.name or report_type != self._model.type:
            if not ReportScheduleDAO.validate_update_uniqueness(
                name, report_type, expect_id=self._model_id
            ):
                exceptions.append(
                    ReportScheduleNameUniquenessValidationError(
                        report_type=report_type, name=name
                    )
                )

        # Validate if DB exists (for alerts)
        if report_type == ReportScheduleType.ALERT and database_id:
            if not (database := DatabaseDAO.find_by_id(database_id)):
                exceptions.append(DatabaseNotFoundValidationError())
            self._properties["database"] = database

        # validate report frequency
        try:
            self.validate_report_frequency(
                cron_schedule,
                report_type,
            )
        except ValidationError as exc:
            exceptions.append(exc)

        # Validate chart or dashboard relations
        self.validate_chart_dashboard(exceptions, update=True)

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        # Check ownership
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise ReportScheduleForbiddenError() from ex

        # Validate/Populate owner
        try:
            owners = self.compute_owners(
                self._model.owners,
                owner_ids,
            )
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise ReportScheduleInvalidError(exceptions=exceptions)
