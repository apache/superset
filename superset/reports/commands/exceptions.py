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

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    ForbiddenError,
    ValidationError,
)
from superset.exceptions import SupersetError, SupersetErrorsException
from superset.reports.models import ReportScheduleType


class DatabaseNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for database does not exist
    """

    def __init__(self) -> None:
        super().__init__(_("Database does not exist"), field_name="database")


class DashboardNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for dashboard does not exist
    """

    def __init__(self) -> None:
        super().__init__(_("Dashboard does not exist"), field_name="dashboard")


class ChartNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for chart does not exist
    """

    def __init__(self) -> None:
        super().__init__(_("Chart does not exist"), field_name="chart")


class ReportScheduleAlertRequiredDatabaseValidationError(ValidationError):
    """
    Marshmallow validation error for report schedule alert missing database field
    """

    def __init__(self) -> None:
        super().__init__(_("Database is required for alerts"), field_name="database")


class ReportScheduleRequiredTypeValidationError(ValidationError):
    """
    Marshmallow type validation error for report schedule missing type field
    """

    def __init__(self) -> None:
        super().__init__(_("Type is required"), field_name="type")


class ReportScheduleOnlyChartOrDashboardError(ValidationError):
    """
    Marshmallow validation error for report schedule accept exclusive chart or dashboard
    """

    def __init__(self) -> None:
        super().__init__(_("Choose a chart or dashboard not both"), field_name="chart")


class ReportScheduleEitherChartOrDashboardError(ValidationError):
    """
    Marshmallow validation error for report schedule missing both dashboard and chart id
    """

    def __init__(self) -> None:
        super().__init__(
            _("Must choose either a chart or a dashboard"), field_name="chart"
        )


class ChartNotSavedValidationError(ValidationError):
    """
    Marshmallow validation error for charts that haven't been saved yet
    """

    def __init__(self) -> None:
        super().__init__(
            _("Please save your chart first, then try creating a new email report."),
            field_name="chart",
        )


class DashboardNotSavedValidationError(ValidationError):
    """
    Marshmallow validation error for dashboards that haven't been saved yet
    """

    def __init__(self) -> None:
        super().__init__(
            _(
                "Please save your dashboard first, then try creating a new email report."
            ),
            field_name="dashboard",
        )


class ReportScheduleInvalidError(CommandInvalidError):
    status = 422
    message = _("Report Schedule parameters are invalid.")


class ReportScheduleCreateFailedError(CreateFailedError):
    message = _("Report Schedule could not be created.")


class ReportScheduleUpdateFailedError(CreateFailedError):
    message = _("Report Schedule could not be updated.")


class ReportScheduleNotFoundError(CommandException):
    status = 404
    message = _("Report Schedule not found.")


class ReportScheduleDeleteFailedError(CommandException):
    message = _("Report Schedule delete failed.")


class PruneReportScheduleLogFailedError(CommandException):
    message = _("Report Schedule log prune failed.")


class ReportScheduleScreenshotFailedError(CommandException):
    message = _("Report Schedule execution failed when generating a screenshot.")


class ReportScheduleCsvFailedError(CommandException):
    message = _("Report Schedule execution failed when generating a csv.")


class ReportScheduleDataFrameFailedError(CommandException):
    message = _("Report Schedule execution failed when generating a dataframe.")


class ReportScheduleExecuteUnexpectedError(CommandException):
    message = _("Report Schedule execution got an unexpected error.")


class ReportSchedulePreviousWorkingError(CommandException):
    status = 429
    message = _("Report Schedule is still working, refusing to re-compute.")


class ReportScheduleWorkingTimeoutError(CommandException):
    status = 408
    message = _("Report Schedule reached a working timeout.")


class ReportScheduleNameUniquenessValidationError(ValidationError):
    """
    Marshmallow validation error for Report Schedule name and type already exists
    """

    def __init__(self, report_type: ReportScheduleType, name: str) -> None:
        message = _('A report named "%(name)s" already exists', name=name)
        if report_type == ReportScheduleType.ALERT:
            message = _('An alert named "%(name)s" already exists', name=name)
        super().__init__([message], field_name="name")


class ReportScheduleCreationMethodUniquenessValidationError(CommandException):
    status = 409
    message = _("Resource already has an attached report.")


class AlertQueryMultipleRowsError(CommandException):
    status = 422
    message = _("Alert query returned more than one row.")


class AlertValidatorConfigError(CommandException):
    status = 422
    message = _("Alert validator config error.")


class AlertQueryMultipleColumnsError(CommandException):
    status = 422
    message = _("Alert query returned more than one column.")


class AlertQueryInvalidTypeError(CommandException):
    status = 422
    message = _("Alert query returned a non-number value.")


class AlertQueryError(CommandException):
    """
    SQL query is not valid
    """

    status = 400
    message = _("Alert found an error while executing a query.")


class AlertQueryTimeout(CommandException):
    status = 408
    message = _("A timeout occurred while executing the query.")


class ReportScheduleScreenshotTimeout(CommandException):
    status = 408
    message = _("A timeout occurred while taking a screenshot.")


class ReportScheduleCsvTimeout(CommandException):
    status = 408
    message = _("A timeout occurred while generating a csv.")


class ReportScheduleDataFrameTimeout(CommandException):
    status = 408
    message = _("A timeout occurred while generating a dataframe.")


class ReportScheduleAlertGracePeriodError(CommandException):
    status = 429
    message = _("Alert fired during grace period.")


class ReportScheduleAlertEndGracePeriodError(CommandException):
    status = 429
    message = _("Alert ended grace period.")


class ReportScheduleNotificationError(CommandException):
    status = 429
    message = _("Alert on grace period")


class ReportScheduleStateNotFoundError(CommandException):
    message = _("Report Schedule state not found")


class ReportScheduleSystemErrorsException(CommandException, SupersetErrorsException):
    errors: list[SupersetError] = []
    message = _("Report schedule system error")


class ReportScheduleClientErrorsException(CommandException, SupersetErrorsException):
    status = 400
    errors: list[SupersetError] = []
    message = _("Report schedule client error")


class ReportScheduleUnexpectedError(CommandException):
    message = _("Report schedule unexpected error")


class ReportScheduleForbiddenError(ForbiddenError):
    status = 403
    message = _("Changing this report is forbidden")


class ReportSchedulePruneLogError(CommandException):
    message = _("An error occurred while pruning logs ")
