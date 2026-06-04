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

from superset.commands.exceptions import CommandInvalidError, UpdateFailedError


class ExtensionSettingsInvalidError(CommandInvalidError):
    message = _("Extension settings parameters are invalid.")


class ExtensionSettingsUpdateFailedError(UpdateFailedError):
    message = _("Extension settings could not be updated.")


class ActiveChatbotIdValidationError(ValidationError):
    """Marshmallow validation error wrapping an invalid active_chatbot_id."""

    def __init__(self, max_length: int) -> None:
        super().__init__(
            [
                _(
                    "active_chatbot_id must be null or a string of at most "
                    "%(max)d characters.",
                    max=max_length,
                )
            ],
            field_name="active_chatbot_id",
        )


class EnabledKeyValidationError(ValidationError):
    """Marshmallow validation error wrapping an invalid enabled-map key."""

    def __init__(self, max_length: int) -> None:
        super().__init__(
            [
                _(
                    "enabled keys must be non-empty strings of at most "
                    "%(max)d characters.",
                    max=max_length,
                )
            ],
            field_name="enabled",
        )
