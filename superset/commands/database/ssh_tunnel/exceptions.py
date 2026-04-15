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
from marshmallow import ValidationError

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    DeleteFailedError,
    UpdateFailedError,
)


class SSHTunnelError(Exception):
    """
    Base class.
    """


class SSHTunnelDeleteFailedError(DeleteFailedError, SSHTunnelError):
    message = _("SSH Tunnel could not be deleted.")


class SSHTunnelNotFoundError(CommandException, SSHTunnelError):
    status = 404
    message = _("SSH Tunnel not found.")


class SSHTunnelInvalidError(CommandInvalidError, SSHTunnelError):
    message = _("SSH Tunnel parameters are invalid.")


class SSHTunnelDatabasePortError(CommandInvalidError, SSHTunnelError):
    message = _("A database port is required when connecting via SSH Tunnel.")


class SSHTunnelUpdateFailedError(UpdateFailedError, SSHTunnelError):
    message = _("SSH Tunnel could not be updated.")


class SSHTunnelCreateFailedError(CommandException, SSHTunnelError):
    message = _("Creating SSH Tunnel failed for an unknown reason")


class SSHTunnelingNotEnabledError(CommandException, SSHTunnelError):
    status = 400
    message = _("SSH Tunneling is not enabled")


class SSHTunnelRequiredFieldValidationError(ValidationError, SSHTunnelError):
    def __init__(self, field_name: str) -> None:
        super().__init__(
            [_("Field is required")],  # type: ignore
            field_name=field_name,
        )


class SSHTunnelMissingCredentials(CommandInvalidError, SSHTunnelError):  # noqa: N818
    message = _("Must provide credentials for the SSH Tunnel")


class SSHTunnelInvalidCredentials(CommandInvalidError, SSHTunnelError):  # noqa: N818
    message = _("Cannot have multiple credentials for the SSH Tunnel")
