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
from superset.daos.canvas import CanvasDAO

NOT_FOUND = "Draft not found: it expired, was committed or discarded, or isn't yours"


def draft_url(draft: CanvasDraft) -> str | None:
    """The canvas page with the draft open; the token rides in the fragment,
    which browsers never send to the server."""
    canvas = CanvasDAO.find_by_id(draft.canvas_id)
    return f"{canvas.url}#draft={draft.token}" if canvas else None


def describe(draft: CanvasDraft, include_definition: bool) -> dict[str, Any]:
    payload = draft_payload(draft, resolved=include_definition)
    result: dict[str, Any] = {
        "canvas_id": payload["canvasId"],
        "base_revision": payload["baseRevision"],
        "revision": payload["revision"],
        "url": draft_url(draft),
    }
    if include_definition:
        result["definition"] = payload["definition"]
    return result


def error_result(ex: Exception) -> dict[str, Any] | None:
    """The tool result for a draft command error, or None to re-raise."""
    if isinstance(ex, CanvasDraftNotFoundError):
        return {"error": NOT_FOUND}
    if isinstance(ex, CanvasNotFoundError):
        return {"error": "Canvas not found, or no access to it"}
    if isinstance(ex, CanvasForbiddenError):
        return {"error": "Only the canvas' editors can draft changes to it"}
    if isinstance(ex, DraftConflictError):
        payload = ex.to_payload()
        return {
            "error": payload["message"],
            "revision": payload["revision"],
            "canvas_changed": payload["canvasChanged"],
        }
    if isinstance(ex, DefinitionInvalidError):
        payload = ex.to_payload()
        return {"error": payload.pop("message"), **payload}
    return None
