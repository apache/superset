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
"""Shared pieces of the canvas draft MCP tools."""

from __future__ import annotations

from typing import Any

from superset.commands.canvas.draft import CanvasDraft, draft_payload
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.mcp_service.canvas.tool.canvas_ops_common import (
    absolute_url,
    payload_result,
)

NOT_FOUND = "Draft not found: it expired, was committed or discarded, or isn't yours"


def draft_url(draft: CanvasDraft) -> str | None:
    """The canvas page with the draft open; the token rides in the fragment,
    which browsers never send to the server."""
    return absolute_url(f"{draft.canvas.url}#draft={draft.token}")


def describe(draft: CanvasDraft, include_definition: bool) -> dict[str, Any]:
    payload = draft_payload(draft, resolved=include_definition)
    result: dict[str, Any] = {
        "canvas_id": payload["canvasId"],
        "base_revision": payload["baseRevision"],
        "revision": payload["revision"],
        "draft_revision": payload["revision"],
        "url": draft_url(draft),
    }
    if include_definition:
        result["definition"] = payload["definition"]
        result["widgets"] = payload["widgets"]
    return result


def error_result(ex: Exception) -> dict[str, Any] | None:
    """The tool result for a draft command error, or None to re-raise."""
    if isinstance(ex, CanvasDraftNotFoundError):
        return {"error": NOT_FOUND, "error_type": "DraftUnavailable"}
    if isinstance(ex, CanvasNotFoundError):
        return {
            "error": "Canvas not found, or no access to it",
            "error_type": "CanvasNotFoundError",
        }
    if isinstance(ex, CanvasForbiddenError):
        return {
            "error": "Only the canvas' editors can draft changes to it",
            "error_type": "CanvasForbiddenError",
        }
    if isinstance(ex, (DraftConflictError, DefinitionInvalidError)):
        return payload_result(ex)
    return None
