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
"""Shared helpers for the embeddable-widget data MCP tools."""

from __future__ import annotations

import logging
from typing import Any

from superset.commands.exceptions import (
    CommandException,
    ForbiddenError,
    ObjectNotFoundError,
)
from superset.commands.widget.exceptions import WidgetInvalidError
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.widgets.schemas import WidgetToolError
from superset.utils import json

logger = logging.getLogger(__name__)


def widget_tool_error(ex: Exception) -> WidgetToolError:
    """Map a widget command failure onto the tool's structured error."""
    if isinstance(ex, ObjectNotFoundError):
        return WidgetToolError.create(str(ex.message), "NotFound")
    if isinstance(ex, (ForbiddenError, SupersetSecurityException)):
        return WidgetToolError.create(
            "You don't have access to this widget's data.", "Forbidden"
        )
    if isinstance(ex, WidgetInvalidError):
        return WidgetToolError.create(str(ex.message), "ValidationError", ex.errors)
    if isinstance(ex, CommandException):
        return WidgetToolError.create(str(ex.message), "CommandError")
    logger.exception("Unexpected error in widget data tool")
    return WidgetToolError.create(
        "Unexpected error while fetching widget data.", "UnexpectedError"
    )


def jsonable(value: Any) -> Any:
    """Query results can hold datetimes, decimals or numpy values."""
    return json.loads(json.dumps(value))
