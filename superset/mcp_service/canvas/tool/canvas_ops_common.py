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

"""Shared error mapping for the canvas MCP tools."""

from __future__ import annotations

import logging
from typing import Any

from superset import security_manager
from superset.canvas.query_errors import canvas_query_error
from superset.commands.canvas.exceptions import (
    DefinitionConflictError,
    DefinitionInvalidError,
    DraftCommitRefusedError,
    DraftConflictError,
)
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message_from_url,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)

# How MCP results, which are snake_case, name the keys of a REST error body.
# The body's ``widgets`` lists changed widgets, while a draft result's
# ``widgets`` holds the saved widgets its placements use.
_RESULT_KEYS = {
    "message": "error",
    "canvasChanged": "canvas_changed",
    "widgets": "changed_widgets",
    "draftRevision": "draft_revision",
    "currentCanvasRevision": "current_canvas_revision",
    "refusalCode": "refusal_code",
}


def absolute_url(path: str | None) -> str | None:
    """A canvas page path as a full link, so an agent can hand it to the
    person as something they can click."""
    return f"{get_superset_base_url()}{path}" if path else None


def payload_result(
    ex: DefinitionConflictError
    | DefinitionInvalidError
    | DraftConflictError
    | DraftCommitRefusedError,
) -> dict[str, Any]:
    """The tool result for a command error that has a REST error body."""
    return {_RESULT_KEYS.get(key, key): value for key, value in ex.to_payload().items()}


UNREAD_REASON = (
    "This widget's type builds no query for it here, so it has no data to "
    "run; read its props for how it gets its data."
)


def keeps_own_data(widget_type: str | None) -> bool:
    """
    Whether ``widget_type`` may get its data some way other than a
    ``dataBinding``. Built-in types without one have no data to read; an
    extension's type may still have some.
    """
    return widget_type is not None and widget_type.startswith("extensions.")


def can_view_query() -> bool:
    """Whether the caller may see a widget's query; classic charts gate "View
    query" on the same permission."""
    return security_manager.can_access("can_view_query", "Dashboard")


def query_error(ex: Exception) -> dict[str, str]:
    """
    The tool result for a widget query that failed, with the details logged.

    A refusal gets a fixed message: the exception's own names the datasource,
    and a missing dataset must read the same as one the caller cannot see.
    Known query diagnostics use the shared principal-sensitive sanitizer and
    require permission to see the query. Unexpected failures remain generic.
    """
    error = canvas_query_error(ex)
    if error.status >= 500:
        logger.warning("Canvas widget query failed", exc_info=True)
    if (
        error.error_type == "DatasetNotAccessible"
        or error.reason == "missing_datasource"
    ):
        logger.info("Canvas widget query refused: %s", ex)
        return {
            "error": "The widget's dataset does not exist, or you have no "
            "access to it.",
            "error_type": "DatasetNotAccessible",
        }
    if error.reason == "security_refusal":
        logger.info("Canvas widget query refused: %s", ex)
        return {
            "error": f"The widget's query was refused ({error.security_error_type}).",
            "error_type": error.error_type,
        }
    if error.oauth_redirect_url is not None:
        message = build_oauth2_redirect_message_from_url(error.oauth_redirect_url)
    elif can_view_query():
        message = f"The widget's query failed: {error.message}"
    else:
        message = "The widget's query failed."
    return {"error": message, "error_type": error.error_type}
