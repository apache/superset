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

from flask import g
from marshmallow import ValidationError

from superset import is_feature_enabled
from superset.commands.base import CreateMixin
from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleAlertRequiredDatabaseValidationError,
    ReportScheduleCreateFailedError,
    ReportScheduleCreationMethodUniquenessValidationError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
    ReportScheduleRunAlertQueryAsNotAllowedError,
    ReportScheduleUserEmailNotFoundError,
)
from superset.commands.utils import populate_subjects
from superset.daos.database import DatabaseDAO
from superset.daos.report import ReportScheduleDAO
from superset.reports.models import (
    ReportCreationMethod,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
)
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

    def _populate_recipients(self, exceptions: list[ValidationError]) -> None:
        """
        Populate recipients based on creation method and current user.

        For reports initiated from charts or dashboards, always use
        the current user's email as the recipient, ignoring any
        client-provided recipient values. Raises validation error if
        user has no email address.
        """
        creation_method = self._properties.get("creation_method")

        # For reports from charts/dashboards, always use current user
        if creation_method in (
            ReportCreationMethod.CHARTS,
            ReportCreationMethod.DASHBOARDS,
        ):
            if hasattr(g, "user") and g.user and g.user.email:
                # Override any provided recipients with current user's email
                self._properties["recipients"] = [
                    {
                        "type": ReportRecipientType.EMAIL,
                        "recipient_config_json": {"target": g.user.email},
                    }
                ]
            else:
                # User doesn't have an email address - can't create report
                exceptions.append(ReportScheduleUserEmailNotFoundError())
        # For creation from alerts_reports view, keep the recipients as provided

    def _populate_subjects(self, exceptions: list[ValidationError]) -> None:
        populate_subjects(
            self._properties,
            exceptions,
            include_viewers=False,
        )

    def _validate_executors(
        self, report_type: str, exceptions: list[ValidationError]
    ) -> None:
        """
        Resolve the "Run As" fields (SIP-209).

        The ids are always removed from the payload; when the dynamic executor
        feature is disabled nothing is stored and the legacy resolution applies.
        When enabled, an omitted ``run_as`` defaults to the current user; an
        admin can explicitly set null to use the legacy application setting.
        An alert's omitted ``run_alert_query_as`` inherits its ``run_as``
        identity at execution.
        """
        has_run_as = "run_as" in self._properties or "run_as_type" in self._properties
        run_as_id = self._properties.pop("run_as", None)
        run_alert_query_as_id = self._properties.pop("run_alert_query_as", None)
        if not is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR"):
            self._properties.pop("run_as_type", None)
            self._properties.pop("run_alert_query_as_type", None)
            return

        self.validate_run_as(
            "run_as", run_as_id, exceptions, default_to_current_user=not has_run_as
        )
        if report_type == ReportScheduleType.REPORT:
            if (
                run_alert_query_as_id is not None
                or self._properties.get("run_alert_query_as_type") is not None
            ):
                exceptions.append(ReportScheduleRunAlertQueryAsNotAllowedError())
            return
        self.validate_run_as(
            "run_alert_query_as",
            run_alert_query_as_id,
            exceptions,
            default_to_current_user=True,
        )

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

        exceptions: list[ValidationError] = []

        # Populate recipients if needed (may add validation errors)
        self._populate_recipients(exceptions)

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
                    if sql := self._properties.get("sql"):
                        self.validate_alert_query(database, sql, exceptions)
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
                dashboard_id, chart_id, creation_method
            )
        ):
            raise ReportScheduleCreationMethodUniquenessValidationError()

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        self._populate_subjects(exceptions)

        self.validate_report_format(
            report_type, self._properties.get("report_format"), exceptions
        )
        self.validate_recipients_policy(exceptions)
        self._validate_executors(report_type, exceptions)

        if exceptions:
            raise ReportScheduleInvalidError(exceptions=exceptions)
