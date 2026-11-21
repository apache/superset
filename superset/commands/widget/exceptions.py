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
    ObjectNotFoundError,
    UpdateFailedError,
)


class WidgetInvalidError(CommandInvalidError):
    message = _("Widget parameters are invalid.")


class WidgetCreateFailedError(CreateFailedError):
    message = _("Widget could not be created.")


class WidgetUpdateFailedError(UpdateFailedError):
    message = _("Widget could not be updated.")


class WidgetDeleteFailedError(DeleteFailedError):
    message = _("Widget could not be deleted.")


class WidgetForbiddenError(ForbiddenError):
    message = _("Changing this widget is forbidden.")


class WidgetNotFoundError(ObjectNotFoundError):
    def __init__(self, widget_uuid: str | None = None) -> None:
        super().__init__("Widget", widget_uuid)


class WidgetRevisionConflictError(CommandException):
    """The write was based on a revision that is no longer current."""

    status = 409

    def __init__(self, current_revision: int) -> None:
        self.current_revision = current_revision
        super().__init__(
            _(
                "The widget was changed by someone else. Reload it and apply your "
                "change to revision %(revision)s.",
                revision=current_revision,
            )
        )
