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

"""MCP tool: create_canvas"""

from __future__ import annotations

from typing import Any

from marshmallow import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.schemas import CanvasPostSchema
from superset.commands.canvas.create import CreateCanvasCommand
from superset.commands.canvas.delete import DeleteCanvasCommand
from superset.commands.canvas.exceptions import CanvasInvalidError
from superset.mcp_service.canvas.schemas import CanvasWriteResponse
from superset.mcp_service.canvas.tool.apply_canvas_ops import _apply_canvas_ops_impl


def _create_canvas_impl(
    title: str,
    slug: str | None,
    description: str | None,
    ops: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    data = {
        key: value
        for key, value in {
            "title": title,
            "slug": slug,
            "description": description,
        }.items()
        if value is not None
    }
    try:
        canvas = CreateCanvasCommand(CanvasPostSchema().load(data)).run()
    except ValidationError as ex:
        return {"error": "Invalid canvas", "errors": ex.messages}
    except CanvasInvalidError as ex:
        return {"error": "Invalid canvas", "errors": ex.normalized_messages()}
    result: dict[str, Any] = {
        "id": canvas.id,
        "url": canvas.url,
        "revision": canvas.revision,
    }
    if not ops:
        return result
    applied = _apply_canvas_ops_impl(canvas.id, canvas.revision, ops)
    if "error" in applied:
        # Creation and the initial operations succeed or fail together.
        DeleteCanvasCommand([canvas.id]).run()
        return applied
    return {**result, **applied}


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create a canvas",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def create_canvas(
    title: str,
    slug: str | None = None,
    description: str | None = None,
    ops: list[dict[str, Any]] | None = None,
) -> CanvasWriteResponse:
    """Create a canvas, with you as its editor, and return its id, URL and
    revision.

    ``slug`` is the readable URL (``/canvas/<slug>/``); without one the URL
    uses the id. ``ops`` optionally builds the canvas in the same call, with
    the operations ``apply_canvas_ops`` takes: if any fails, nothing is
    created and the error names the operation at fault.
    """
    return CanvasWriteResponse.model_validate(
        _create_canvas_impl(title, slug, description, ops)
    )
