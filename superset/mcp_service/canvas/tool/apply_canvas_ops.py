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

"""MCP tool: apply_canvas_ops"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.definition.schemas import ApplyOperationsRequest
from superset.canvas.definition.validation import request_pointer
from superset.canvas.definition.versions import DefinitionVersionError
from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionConflictError,
    DefinitionInvalidError,
)
from superset.mcp_service.canvas.schemas import ApplyCanvasOpsResponse


def _apply_canvas_ops_impl(
    canvas_id: int | str, base_revision: int, ops: list[dict[str, Any]]
) -> dict[str, Any]:
    try:
        request = ApplyOperationsRequest.model_validate(
            {"base_revision": base_revision, "ops": ops}
        )
    except ValidationError as ex:
        return {
            "error": "Invalid operations",
            "errors": [
                {"path": request_pointer(error["loc"]), "message": error["msg"]}
                for error in ex.errors()
            ],
        }
    try:
        result = ApplyCanvasOperationsCommand(
            canvas_id, request.base_revision, request.ops
        ).run()
    except CanvasNotFoundError:
        return {"error": f"Canvas {canvas_id} not found, or no access to it"}
    except CanvasForbiddenError:
        return {"error": "Only the canvas' editors can change it"}
    except DefinitionVersionError as ex:
        return {"error": str(ex)}
    except (DefinitionConflictError, DefinitionInvalidError) as ex:
        payload = ex.to_payload()
        return {"error": payload.pop("message"), **payload}
    return {"revision": result.revision, "ops": result.ops}


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Change a canvas",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def apply_canvas_ops(
    canvas_id: int | str, base_revision: int, ops: list[dict[str, Any]]
) -> ApplyCanvasOpsResponse:
    """Apply operations to a canvas (by id or UUID), in order and atomically:
    on any error nothing changes and the error names the operation and the
    path at fault.

    Operations (placement ids are readable slugs; ``parent`` defaults to
    ``"root"``):

    - ``{"op": "add", "widgetType": "<widget type>", "props": {...},
      "layout": {...}, "parent": "<id>", "index": n, "id": "<optional id>"}``
      adds an inline widget; get its props schema with
      ``get_widget_control_schema``. Use ``"widgetId": "<uuid>"`` instead of
      ``widgetType``/``props`` to place a saved widget.
    - ``{"op": "set_props", "id": "<id>", "props": {...}}`` replaces an inline
      widget's props.
    - ``{"op": "place", "id": "<id>", "layout": {"col", "row", "colSpan",
      "rowSpan"}}`` moves or resizes within the parent's grid.

    Grid layouts are 1-based: ``col`` runs from 1 to the grid's columns (24
    on the root) and ``row`` starts at 1. Leave ``col``/``row`` out to
    auto-place, and leave spans out to use the widget's default size.
    - ``{"op": "move", "id": "<id>", "parent": "<id>", "index": n}``
      reparents or reorders.
    - ``{"op": "remove", "id": "<id>"}`` removes a placement and its children.
    - ``{"op": "set_scope", "kind": "filter" | "crossFilter" |
      "customization", "id": "<id>", "scope": {"mode": "auto" | "global" |
      "custom", "targets": [...], "exclude": [...]}}``; ``scope: null``
      restores auto (the filter's nearest scoping container).
    - ``{"op": "set_settings", "key": "refresh" | "colors" | "display" |
      "crossFilters", "value": {...}}``.

    ``base_revision`` is the revision you last read; edits by others since
    then are merged unless they touched the same placement and aspect.
    """
    return ApplyCanvasOpsResponse(
        **_apply_canvas_ops_impl(canvas_id, base_revision, ops)
    )
