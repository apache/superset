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

"""MCP tool: update_canvas"""

from __future__ import annotations

from typing import Any

from marshmallow import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.schemas import CanvasPutSchema
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasInvalidError,
    CanvasNotFoundError,
)
from superset.commands.canvas.update import UpdateCanvasCommand
from superset.daos.canvas import CanvasDAO
from superset.mcp_service.canvas.schemas import CanvasWriteResponse


def _update_canvas_impl(
    canvas_id: int | str, changes: dict[str, Any]
) -> dict[str, Any]:
    if not changes:
        return {"error": "Nothing to update"}
    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_id))
    if canvas is None:
        return {"error": f"Canvas {canvas_id} not found, or no access to it"}
    try:
        updated = UpdateCanvasCommand(canvas.id, CanvasPutSchema().load(changes)).run()
    except ValidationError as ex:
        return {"error": "Invalid canvas", "errors": ex.messages}
    except CanvasInvalidError as ex:
        return {"error": "Invalid canvas", "errors": ex.normalized_messages()}
    except CanvasNotFoundError:
        return {"error": f"Canvas {canvas_id} not found, or no access to it"}
    except CanvasForbiddenError:
        return {"error": "Only the canvas' editors can change it"}
    return {"id": updated.id, "url": updated.url, "revision": updated.revision}


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update a canvas' details",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def update_canvas(
    canvas_id: int | str,
    title: str | None = None,
    slug: str | None = None,
    description: str | None = None,
) -> CanvasWriteResponse:
    """Change a canvas' title, slug or description (by id or UUID). Its
    contents change only through ``apply_canvas_ops``.
    """
    changes = {
        key: value
        for key, value in {
            "title": title,
            "slug": slug,
            "description": description,
        }.items()
        if value is not None
    }
    return CanvasWriteResponse.model_validate(_update_canvas_impl(canvas_id, changes))
