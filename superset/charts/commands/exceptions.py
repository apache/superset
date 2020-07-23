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
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    UpdateFailedError,
)


class DatabaseNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for database does not exist
    """

    def __init__(self) -> None:
        super().__init__(_("Database does not exist"), field_names=["database"])


class DashboardsNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for dashboards don't exist
    """

    def __init__(self) -> None:
        super().__init__(_("Dashboards do not exist"), field_names=["dashboards"])


class DatasourceTypeUpdateRequiredValidationError(ValidationError):
    """
    Marshmallow validation error for dashboards don't exist
    """

    def __init__(self) -> None:
        super().__init__(
            _("Datasource type is required when datasource_id is given"),
            field_names=["datasource_type"],
        )


class ChartNotFoundError(CommandException):
    message = "Chart not found."


class ChartInvalidError(CommandInvalidError):
    message = _("Chart parameters are invalid.")


class ChartCreateFailedError(CreateFailedError):
    message = _("Chart could not be created.")


class ChartUpdateFailedError(UpdateFailedError):
    message = _("Chart could not be updated.")


class ChartDeleteFailedError(DeleteFailedError):
    message = _("Chart could not be deleted.")


class ChartForbiddenError(ForbiddenError):
    message = _("Changing this chart is forbidden")


class ChartBulkDeleteFailedError(CreateFailedError):
    message = _("Charts could not be deleted.")
