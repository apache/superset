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

from typing import Any

from superset.commands.canvas.exceptions import (
    DefinitionConflictError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url

# How MCP results, which are snake_case, name the keys of a REST error body.
# The body's ``widgets`` lists changed widgets, while a draft result's
# ``widgets`` holds the saved widgets its placements use.
_RESULT_KEYS = {
    "message": "error",
    "canvasChanged": "canvas_changed",
    "widgets": "changed_widgets",
    "draftRevision": "draft_revision",
    "currentCanvasRevision": "current_canvas_revision",
}


def absolute_url(path: str | None) -> str | None:
    """A canvas page path as a full link, so an agent can hand it to the
    person as something they can click."""
    return f"{get_superset_base_url()}{path}" if path else None


def payload_result(
    ex: DefinitionConflictError | DefinitionInvalidError | DraftConflictError,
) -> dict[str, Any]:
    """The tool result for a command error that has a REST error body."""
    return {_RESULT_KEYS.get(key, key): value for key, value in ex.to_payload().items()}
