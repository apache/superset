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
from __future__ import annotations

from typing import Any

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandException,
    CreateFailedError,
    ForbiddenError,
    ObjectNotFoundError,
)


class DashboardV2NotFoundError(ObjectNotFoundError):
    def __init__(self, identifier: str | None = None) -> None:
        super().__init__("Dashboard v2", identifier)


class DashboardV2ForbiddenError(ForbiddenError):
    message = _("You don't have access to this dashboard.")


class DashboardV2InvalidError(CommandException):
    status = 422

    def __init__(self, message: str, errors: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.errors = errors or {}


class DashboardV2SaveFailedError(CreateFailedError):
    message = _("Dashboard v2 could not be saved.")
