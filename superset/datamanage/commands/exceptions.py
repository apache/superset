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
    ImportFailedError,
    UpdateFailedError,
)


def get_datamanage_exist_error_msg(full_name: str) -> str:
    return _("Datamanage %(name)s already exists", name=full_name)


class DatabaseNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for database does not exist
    """

    def __init__(self) -> None:
        super().__init__([_("Database does not exist")], field_name="database")


class DatabaseChangeValidationError(ValidationError):
    """
    Marshmallow validation error database changes are not allowed on update
    """

    def __init__(self) -> None:
        super().__init__([_("Database not allowed to change")], field_name="database")


class DatamanageExistsValidationError(ValidationError):
    """
    Marshmallow validation error for datamanage already exists
    """

    def __init__(self, table_name: str) -> None:
        super().__init__(
            [get_datamanage_exist_error_msg(table_name)], field_name="table_name"
        )


class DatamanageColumnNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when datamanage column for update does not exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more columns do not exist")], field_name="columns")


class DatamanageColumnsDuplicateValidationError(ValidationError):
    """
    Marshmallow validation error when datamanage columns have a duplicate on the list
    """

    def __init__(self) -> None:
        super().__init__(
            [_("One or more columns are duplicated")], field_name="columns"
        )


class DatamanageColumnsExistsValidationError(ValidationError):
    """
    Marshmallow validation error when datamanage columns already exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more columns already exist")], field_name="columns")


class DatamanageMetricsNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when datamanage metric for update does not exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more metrics do not exist")], field_name="metrics")


class DatamanageMetricsDuplicateValidationError(ValidationError):
    """
    Marshmallow validation error when datamanage metrics have a duplicate on the list
    """

    def __init__(self) -> None:
        super().__init__(
            [_("One or more metrics are duplicated")], field_name="metrics"
        )


class DatamanageMetricsExistsValidationError(ValidationError):
    """
    Marshmallow validation error when Datamanage metrics already exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more metrics already exist")], field_name="metrics")


class TableNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when a table does not exist on the database
    """

    def __init__(self, table_name: str) -> None:
        super().__init__(
            [
                _(
                    "Table [%(table_name)s] could not be found, "
                    "please double check your "
                    "database connection, schema, and "
                    "table name",
                    table_name=table_name,
                )
            ],
            field_name="table_name",
        )


class OwnersNotFoundValidationError(ValidationError):
    def __init__(self) -> None:
        super().__init__([_("Owners are invalid")], field_name="owners")


class DatamanageNotFoundError(CommandException):
    status = 404
    message = _("Datamanage does not exist")


class DatamanageInvalidError(CommandInvalidError):
    message = _("Datamanage parameters are invalid.")


class DatamanageCreateFailedError(CreateFailedError):
    message = _("Datamanage could not be created.")


class DatamanageUpdateFailedError(UpdateFailedError):
    message = _("Datamanage could not be updated.")


class DatamanageDeleteFailedError(DeleteFailedError):
    message = _("Datamanage could not be deleted.")


class DatamanageBulkDeleteFailedError(DeleteFailedError):
    message = _("Datamanage(s) could not be bulk deleted.")


class DatamanageRefreshFailedError(UpdateFailedError):
    message = _("Datamanage could not be updated.")


class DatamanageSamplesFailedError(CommandInvalidError):
    message = _("Samples for Datamanage could not be retrieved.")


class DatamanageForbiddenError(ForbiddenError):
    message = _("Changing this Datamanage is forbidden")


class DatamanageImportError(ImportFailedError):
    message = _("Import Datamanage failed for an unknown reason")


class DatamanageAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this Datamanage.")


class DatamanageDuplicateFailedError(CreateFailedError):
    message = _("Datamanage could not be duplicated.")
