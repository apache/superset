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
from typing import Any, Dict, List

from flask_babel import lazy_gettext as _
from marshmallow import ValidationError

from superset.exceptions import SupersetException


class CommandException(SupersetException):
    """ Common base class for Command exceptions. """

    def __repr__(self) -> str:
        if self._exception:
            return repr(self._exception)
        return repr(self)


class CommandInvalidError(CommandException):
    """ Common base class for Command Invalid errors. """

    status = 422

    def __init__(self, message: str = "") -> None:
        self._invalid_exceptions: List[ValidationError] = []
        super().__init__(self.message)

    def add(self, exception: ValidationError) -> None:
        self._invalid_exceptions.append(exception)

    def add_list(self, exceptions: List[ValidationError]) -> None:
        self._invalid_exceptions.extend(exceptions)

    def normalized_messages(self) -> Dict[Any, Any]:
        errors: Dict[Any, Any] = {}
        for exception in self._invalid_exceptions:
            errors.update(exception.normalized_messages())  # type: ignore
        return errors


class UpdateFailedError(CommandException):
    status = 500
    message = "Command update failed"


class CreateFailedError(CommandException):
    status = 500
    message = "Command create failed"


class DeleteFailedError(CommandException):
    status = 500
    message = "Command delete failed"


class ForbiddenError(CommandException):
    status = 500
    message = "Action is forbidden"


class OwnersNotFoundValidationError(ValidationError):
    status = 422

    def __init__(self) -> None:
        super().__init__([_("Owners are invalid")], field_name="owners")


class DatasourceNotFoundValidationError(ValidationError):
    status = 404

    def __init__(self) -> None:
        super().__init__([_("Datasource does not exist")], field_name="datasource_id")
