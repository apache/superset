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
from typing import List, Optional

from marshmallow import ValidationError


class CommandException(Exception):
    """ Common base class for Command exceptions. """

    message = ""

    def __init__(self, message: str = "", exception: Optional[Exception] = None):
        if message:
            self.message = message
        self._exception = exception
        super().__init__(self.message)

    @property
    def exception(self):
        return self._exception


class CommandInvalidError(CommandException):
    """ Common base class for Command Invalid errors. """

    def __init__(self, message=""):
        self._invalid_exceptions = list()
        super().__init__(self.message)

    def add(self, exception: ValidationError):
        self._invalid_exceptions.append(exception)

    def add_list(self, exceptions: List[ValidationError]):
        self._invalid_exceptions.extend(exceptions)

    def normalized_messages(self):
        errors = {}
        for exception in self._invalid_exceptions:
            errors.update(exception.normalized_messages())
        return errors


class UpdateFailedError(CommandException):
    message = "Command update failed"


class CreateFailedError(CommandException):
    message = "Command create failed"


class DeleteFailedError(CommandException):
    message = "Command delete failed"


class ForbiddenError(CommandException):
    message = "Action is forbidden"
