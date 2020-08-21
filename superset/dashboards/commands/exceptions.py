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


class DashboardSlugExistsValidationError(ValidationError):
    """
    Marshmallow validation error for dashboard slug already exists
    """

    def __init__(self) -> None:
        super().__init__([_("Must be unique")], field_name="slug")


class DashboardInvalidError(CommandInvalidError):
    message = _("Dashboard parameters are invalid.")


class DashboardNotFoundError(CommandException):
    message = _("Dashboard not found.")


class DashboardCreateFailedError(CreateFailedError):
    message = _("Dashboard could not be created.")


class DashboardBulkDeleteFailedError(CreateFailedError):
    message = _("Dashboards could not be deleted.")


class DashboardUpdateFailedError(UpdateFailedError):
    message = _("Dashboard could not be updated.")


class DashboardDeleteFailedError(DeleteFailedError):
    message = _("Dashboard could not be deleted.")


class DashboardForbiddenError(ForbiddenError):
    message = _("Changing this Dashboard is forbidden")
