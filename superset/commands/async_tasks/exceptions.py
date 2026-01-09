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


class AsyncTaskNotFoundError(CommandException):
    """Async task not found."""

    status = 404
    message = "Async task not found."


class AsyncTaskInvalidError(CommandInvalidError):
    """Async task parameters are invalid."""

    message = _("Async task parameters are invalid.")


class AsyncTaskCreateFailedError(CreateFailedError):
    """Async task creation failed."""

    message = _("Async task could not be created.")


class AsyncTaskUpdateFailedError(UpdateFailedError):
    """Async task update failed."""

    message = _("Async task could not be updated.")


class AsyncTaskDeleteFailedError(DeleteFailedError):
    """Async task deletion failed."""

    message = _("Async tasks could not be deleted.")


class AsyncTaskAbortFailedError(CommandException):
    """Async task abortion failed."""

    status = 422
    message = _("Async task could not be aborted.")


class AsyncTaskForbiddenError(ForbiddenError):
    """Async task operation forbidden."""

    message = _("Changing this async task is forbidden")
