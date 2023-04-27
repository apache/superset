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


def get_dataset_exist_error_msg(full_name: str) -> str:
    return _("Dataset %(name)s already exists", name=full_name)


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


class DatasetExistsValidationError(ValidationError):
    """
    Marshmallow validation error for dataset already exists
    """

    def __init__(self, table_name: str) -> None:
        super().__init__(
            [get_dataset_exist_error_msg(table_name)], field_name="table_name"
        )


class DatasetColumnNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when dataset column for update does not exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more columns do not exist")], field_name="columns")


class DatasetColumnsDuplicateValidationError(ValidationError):
    """
    Marshmallow validation error when dataset columns have a duplicate on the list
    """

    def __init__(self) -> None:
        super().__init__(
            [_("One or more columns are duplicated")], field_name="columns"
        )


class DatasetColumnsExistsValidationError(ValidationError):
    """
    Marshmallow validation error when dataset columns already exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more columns already exist")], field_name="columns")


class DatasetMetricsNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when dataset metric for update does not exist
    """

    def __init__(self) -> None:
        super().__init__([_("One or more metrics do not exist")], field_name="metrics")


class DatasetMetricsDuplicateValidationError(ValidationError):
    """
    Marshmallow validation error when dataset metrics have a duplicate on the list
    """

    def __init__(self) -> None:
        super().__init__(
            [_("One or more metrics are duplicated")], field_name="metrics"
        )


class DatasetMetricsExistsValidationError(ValidationError):
    """
    Marshmallow validation error when dataset metrics already exist
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


class DatasetNotFoundError(CommandException):
    status = 404
    message = _("Dataset does not exist")


class DatasetInvalidError(CommandInvalidError):
    message = _("Dataset parameters are invalid.")


class DatasetCreateFailedError(CreateFailedError):
    message = _("Dataset could not be created.")


class DatasetUpdateFailedError(UpdateFailedError):
    message = _("Dataset could not be updated.")


class DatasetDeleteFailedError(DeleteFailedError):
    message = _("Dataset could not be deleted.")


class DatasetBulkDeleteFailedError(DeleteFailedError):
    message = _("Dataset(s) could not be bulk deleted.")


class DatasetRefreshFailedError(UpdateFailedError):
    message = _("Dataset could not be updated.")


class DatasetSamplesFailedError(CommandInvalidError):
    message = _("Samples for dataset could not be retrieved.")


class DatasetForbiddenError(ForbiddenError):
    message = _("Changing this dataset is forbidden")


class DatasetImportError(ImportFailedError):
    message = _("Import dataset failed for an unknown reason")


class DatasetAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this dataset.")


class DatasetDuplicateFailedError(CreateFailedError):
    message = _("Dataset could not be duplicated.")


class DatasetForbiddenDataURI(ImportFailedError):
    message = _("Data URI is not allowed.")
