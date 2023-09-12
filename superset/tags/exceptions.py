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

from superset.commands.exceptions import CommandException, UpdateFailedError


class InvalidTagNameError(ValidationError):
    """
    Marshmallow validation error for invalid Tag name
    """

    def __init__(self) -> None:
        super().__init__(
            [_("Tag name is invalid (cannot contain ':')")], field_name="name"
        )


class TagUpdateFailedError(UpdateFailedError):
    message = _("Tag could not be updated.")


class TagNotFoundError(CommandException):
    message = _("Tag could not be found.")
