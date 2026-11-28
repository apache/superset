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
    DeleteFailedError,
    ForbiddenError,
)


class RLSRuleNotFoundError(CommandException):
    status = 404
    message = _("RLS Rule not found.")


class RLSDatasourceForbiddenError(ForbiddenError):
    message = _("You don't have access to one or more of the referenced datasources.")


class RuleDeleteFailedError(DeleteFailedError):
    message = _("RLS rules could not be deleted.")


class PasswordRecoveryUserNotFoundError(CommandException):
    status = 404
    message = _("User not found.")


class PasswordRecoveryIneligibleError(CommandException):
    """The account cannot receive a reset link; the message names the reason."""

    status = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)


class PasswordRecoveryThrottledError(CommandException):
    status = 429
    message = _(
        "A password reset link was sent recently. "
        "Please wait a bit before sending another."
    )


class PasswordRecoveryDisabledError(CommandException):
    status = 404
    message = _("Not found")


class PasswordRecoveryInvalidTokenError(CommandException):
    status = 400
    message = _("This password reset link is invalid or has expired.")


class PasswordRecoveryFailedError(CommandException):
    status = 500
    message = _("The password could not be reset. Please try again.")
