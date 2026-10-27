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
"""MCP tool: get_canvas_draft"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.canvas.draft import draft_payload, load_draft
from superset.mcp_service.canvas.schemas import CanvasDraftResponse
from superset.mcp_service.canvas.tool.canvas_draft_common import describe, error_result


def _get_canvas_draft_impl(token: str, include_resolved: bool) -> dict[str, Any]:
    try:
        draft = load_draft(token)
    except Exception as ex:  # pylint: disable=broad-except
        if (result := error_result(ex)) is None:
            raise
        return result
    result = describe(draft, include_definition=True)
    if include_resolved:
        payload = draft_payload(draft)
        result.update(
            {
                "filterScopes": payload.get("filterScopes"),
                "placements": payload.get("placements"),
                "widgetTypes": payload.get("widgetTypes"),
            }
        )
    return result


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Get a canvas draft",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def get_canvas_draft(token: str, include_resolved: bool = False) -> CanvasDraftResponse:
    """Read a canvas draft: its definition, its revision and the canvas
    revision it started from. ``include_resolved`` adds resolved grid
    positions and filter scopes, as on ``get_canvas``.
    """
    return CanvasDraftResponse.model_validate(
        _get_canvas_draft_impl(token, include_resolved)
    )
