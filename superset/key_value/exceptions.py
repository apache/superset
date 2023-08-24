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
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    UpdateFailedError,
)
from superset.exceptions import SupersetException


class KeyValueParseKeyError(SupersetException):
    message = _("An error occurred while parsing the key.")


class KeyValueCreateFailedError(CreateFailedError):
    message = _("An error occurred while creating the value.")


class KeyValueGetFailedError(CommandException):
    message = _("An error occurred while accessing the value.")


class KeyValueDeleteFailedError(DeleteFailedError):
    message = _("An error occurred while deleting the value.")


class KeyValueUpdateFailedError(UpdateFailedError):
    message = _("An error occurred while updating the value.")


class KeyValueUpsertFailedError(UpdateFailedError):
    message = _("An error occurred while upserting the value.")


class KeyValueAccessDeniedError(ForbiddenError):
    message = _("You don't have permission to modify the value.")


class KeyValueCodecException(SupersetException):
    pass


class KeyValueCodecEncodeException(KeyValueCodecException):
    message = _("Unable to encode value")


class KeyValueCodecDecodeException(KeyValueCodecException):
    message = _("Unable to decode value")
