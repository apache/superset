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

"""MCP tool: get_canvas"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.definition.render import render_context
from superset.canvas.definition.scopes import resolve_scopes
from superset.canvas.definition.versions import DefinitionVersionError
from superset.daos.canvas import CanvasDAO
from superset.mcp_service.canvas.schemas import GetCanvasResponse


def _get_canvas_impl(canvas_id: int, include_resolved: bool) -> dict[str, Any]:
    canvas = CanvasDAO.find_by_id(canvas_id)
    if canvas is None:
        return {"error": f"Canvas {canvas_id} not found, or no access to it"}
    try:
        definition = CanvasDAO.load(canvas)
    except DefinitionVersionError as ex:
        return {"error": str(ex)}
    result: dict[str, Any] = {
        "id": canvas.id,
        "title": canvas.title,
        "url": canvas.url,
        "revision": canvas.revision,
        "definition": definition,
    }
    if include_resolved:
        result.update(resolve_scopes(definition))
        result.update(render_context(definition))
    return result


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Get a canvas",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def get_canvas(canvas_id: int, include_resolved: bool = False) -> GetCanvasResponse:
    """Get a canvas: its placements, filter scope overrides, settings and
    revision.

    Placements are keyed by readable ids (``revenue-trend``); use them in
    ``apply_canvas_ops``. A placement holds an inline widget (``widget``,
    ``props``) or a persisted instance (``instance``), plus its ``layout``.
    Pass ``include_resolved=true`` only when you need the server-resolved grid
    positions (``placements``) or which placements each filter drives
    (``filterScopes`` and friends); they're derived from the tree and cost
    context.
    """
    return GetCanvasResponse.model_validate(
        _get_canvas_impl(canvas_id, include_resolved)
    )
