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
    UpdateFailedError,
)
from superset.security.analytics_db_safety import DBSecurityException


class DatabaseInvalidError(CommandInvalidError):
    message = _("Dashboard parameters are invalid.")


class DatabaseExistsValidationError(ValidationError):
    """
    Marshmallow validation error for dataset already exists
    """

    def __init__(self) -> None:
        super().__init__(
            _("A database with the same name already exists"),
            field_name="database_name",
        )


class DatabaseRequiredFieldValidationError(ValidationError):
    def __init__(self, field_name: str) -> None:
        super().__init__(
            [_("Field is required")], field_name=field_name,
        )


class DatabaseExtraJSONValidationError(ValidationError):
    """
    Marshmallow validation error for database encrypted extra must be a valid JSON
    """

    def __init__(self, json_error: str = "") -> None:
        super().__init__(
            [
                _(
                    "Field cannot be decoded by JSON.  %{json_error}s",
                    json_error=json_error,
                )
            ],
            field_name="extra",
        )


class DatabaseExtraValidationError(ValidationError):
    """
    Marshmallow validation error for database encrypted extra must be a valid JSON
    """

    def __init__(self, key: str = "") -> None:
        super().__init__(
            [
                _(
                    "The metadata_params in Extra field "
                    "is not configured correctly. The key "
                    "%{key}s is invalid.",
                    key=key,
                )
            ],
            field_name="extra",
        )


class DatabaseNotFoundError(CommandException):
    message = _("Database not found.")


class DatabaseCreateFailedError(CreateFailedError):
    message = _("Database could not be created.")


class DatabaseUpdateFailedError(UpdateFailedError):
    message = _("Database could not be updated.")


class DatabaseConnectionFailedError(  # pylint: disable=too-many-ancestors
    DatabaseCreateFailedError, DatabaseUpdateFailedError,
):
    message = _("Could not connect to database.")


class DatabaseDeleteDatasetsExistFailedError(DeleteFailedError):
    message = _("Cannot delete a database that has tables attached")


class DatabaseDeleteFailedError(DeleteFailedError):
    message = _("Database could not be deleted.")


class DatabaseSecurityUnsafeError(DBSecurityException):
    message = _("Stopped an unsafe database connection")
