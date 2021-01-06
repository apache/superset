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
    DeleteFailedError,
    ForbiddenError,
    ValidationError,
)


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


class ReportScheduleChartOrDashboardValidationError(ValidationError):
    """
    Marshmallow validation error for report schedule accept exlusive chart or dashboard
    """

    def __init__(self) -> None:
        super().__init__(_("Choose a chart or dashboard not both"), field_name="chart")


class ReportScheduleInvalidError(CommandInvalidError):
    message = _("Report Schedule parameters are invalid.")


class ReportScheduleBulkDeleteFailedError(DeleteFailedError):
    message = _("Report Schedule could not be deleted.")


class ReportScheduleCreateFailedError(CreateFailedError):
    message = _("Report Schedule could not be created.")


class ReportScheduleUpdateFailedError(CreateFailedError):
    message = _("Report Schedule could not be updated.")


class ReportScheduleNotFoundError(CommandException):
    message = _("Report Schedule not found.")


class ReportScheduleDeleteFailedError(CommandException):
    message = _("Report Schedule delete failed.")


class PruneReportScheduleLogFailedError(CommandException):
    message = _("Report Schedule log prune failed.")


class ReportScheduleScreenshotFailedError(CommandException):
    message = _("Report Schedule execution failed when generating a screenshot.")


class ReportScheduleExecuteUnexpectedError(CommandException):
    message = _("Report Schedule execution got an unexpected error.")


class ReportSchedulePreviousWorkingError(CommandException):
    message = _("Report Schedule is still working, refusing to re-compute.")


class ReportScheduleWorkingTimeoutError(CommandException):
    message = _("Report Schedule reached a working timeout.")


class ReportScheduleNameUniquenessValidationError(ValidationError):
    """
    Marshmallow validation error for Report Schedule name and type already exists
    """

    def __init__(self) -> None:
        super().__init__([_("Name must be unique")], field_name="name")


class AlertQueryMultipleRowsError(CommandException):

    message = _("Alert query returned more then one row.")


class AlertValidatorConfigError(CommandException):

    message = _("Alert validator config error.")


class AlertQueryMultipleColumnsError(CommandException):
    message = _("Alert query returned more then one column.")


class AlertQueryInvalidTypeError(CommandException):
    message = _("Alert query returned a non-number value.")


class AlertQueryError(CommandException):
    message = _("Alert found an error while executing a query.")


class ReportScheduleAlertGracePeriodError(CommandException):
    message = _("Alert fired during grace period.")


class ReportScheduleAlertEndGracePeriodError(CommandException):
    message = _("Alert ended grace period.")


class ReportScheduleNotificationError(CommandException):
    message = _("Alert on grace period")


class ReportScheduleSelleniumUserNotFoundError(CommandException):
    message = _("Report Schedule sellenium user not found")


class ReportScheduleStateNotFoundError(CommandException):
    message = _("Report Schedule state not found")


class ReportScheduleUnexpectedError(CommandException):
    message = _("Report schedule unexpected error")


class ReportScheduleForbiddenError(ForbiddenError):
    message = _("Changing this report is forbidden")
