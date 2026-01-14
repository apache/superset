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
    UpdateFailedError,
)


class TaskNotFoundError(CommandException):
    """Task not found."""

    status = 404
    message = "Task not found."


class TaskInvalidError(CommandInvalidError):
    """Task parameters are invalid."""

    message = _("Task parameters are invalid.")


class TaskCreateFailedError(CreateFailedError):
    """Task creation failed."""

    message = _("Task could not be created.")


class TaskUpdateFailedError(UpdateFailedError):
    """Task update failed."""

    message = _("Task could not be updated.")


class TaskDeleteFailedError(DeleteFailedError):
    """Task deletion failed."""

    message = _("Tasks could not be deleted.")


class TaskAbortFailedError(CommandException):
    """Task abortion failed."""

    status = 422
    message = _("Task could not be aborted.")


class TaskForbiddenError(ForbiddenError):
    """Task operation forbidden."""

    message = _("Changing this task is forbidden")


class TaskPermissionDeniedError(ForbiddenError):
    """Task operation not permitted for current user."""

    def __init__(self, message: str | None = None):
        super().__init__()
        if message:
            self.message = message
        else:
            self.message = _("You do not have permission to perform this operation")
