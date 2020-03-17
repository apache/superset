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
from superset.views.base import get_datasource_exist_error_msg


class DatabaseNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for database does not exist
    """

    def __init__(self):
        super().__init__(_("Database does not exist"), field_names=["database"])


class DatabaseChangeValidationError(ValidationError):
    """
    Marshmallow validation error database changes are not allowed on update
    """

    def __init__(self):
        super().__init__(_("Database not allowed to change"), field_names=["database"])


class DatasetExistsValidationError(ValidationError):
    """
    Marshmallow validation error for dataset already exists
    """

    def __init__(self, table_name: str):
        super().__init__(
            get_datasource_exist_error_msg(table_name), field_names=["table_name"]
        )


class TableNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error when a table does not exist on the database
    """

    def __init__(self, table_name: str):
        super().__init__(
            _(
                f"Table [{table_name}] could not be found, "
                "please double check your "
                "database connection, schema, and "
                f"table name"
            ),
            field_names=["table_name"],
        )


class OwnersNotFoundValidationError(ValidationError):
    def __init__(self):
        super().__init__(_("Owners are invalid"), field_names=["owners"])


class DatasetNotFoundError(CommandException):
    message = "Dataset not found."


class DatasetInvalidError(CommandInvalidError):
    message = _("Dataset parameters are invalid.")


class DatasetCreateFailedError(CreateFailedError):
    message = _("Dataset could not be created.")


class DatasetUpdateFailedError(UpdateFailedError):
    message = _("Dataset could not be updated.")


class DatasetDeleteFailedError(DeleteFailedError):
    message = _("Dataset could not be deleted.")


class DatasetForbiddenError(ForbiddenError):
    message = _("Changing this dataset is forbidden")
