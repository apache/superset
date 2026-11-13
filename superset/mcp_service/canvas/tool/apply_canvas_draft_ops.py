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
"""MCP tool: apply_canvas_draft_ops"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import DraftOperationsRequest
from superset.canvas.definition.validation import request_pointer
from superset.commands.canvas.draft import (
    ApplyCanvasDraftOperationsCommand,
    BY_AI,
    load_draft,
)
from superset.mcp_service.canvas.schemas import CanvasDraftResponse, DraftOpsInput
from superset.mcp_service.canvas.tool.canvas_draft_common import describe, error_result


def _apply_canvas_draft_ops_impl(
    token: str, revision: int, ops: list[dict[str, Any]]
) -> dict[str, Any]:
    try:
        request = DraftOperationsRequest.model_validate(
            {"revision": revision, "ops": ops}
        )
    except ValidationError as ex:
        return {
            "error": "Invalid operations",
            "error_type": "ValidationError",
            "errors": [
                {"path": request_pointer(error["loc"]), "message": error["msg"]}
                for error in ex.errors()
            ],
        }
    try:
        start = load_draft(token)
        before = render_context(start.definition, resolver=start.resolver())[
            "placements"
        ]
        draft, applied = ApplyCanvasDraftOperationsCommand(
            # The agent's own door into a draft, so what it changes is
            # attributed to it in the banner's list rather than to the person
            # whose rights it is acting with.
            token,
            request.revision,
            request.ops,
            by=BY_AI,
        ).run()
    except Exception as ex:  # pylint: disable=broad-except
        if (result := error_result(ex)) is None:
            raise
        return result
    context = render_context(draft.definition, resolver=draft.resolver())
    after = context["placements"]
    targeted = {op.get("id") for op in applied}
    return {
        **describe(draft, include_definition=False),
        # The agent sent the props; echo what the server filled in (ids).
        "ops": [{k: v for k, v in op.items() if k != "props"} for op in applied],
        "placements": after,
        "grid_columns": context["gridColumns"],
        "displaced": sorted(
            node_id
            for node_id, placement in after.items()
            if node_id not in targeted
            and node_id in before
            and before[node_id] != placement
        ),
    }


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Change a canvas draft",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def apply_canvas_draft_ops(
    token: str, revision: int, ops: DraftOpsInput
) -> CanvasDraftResponse:
    """Apply operations to a canvas draft, in order and atomically. Only the
    draft changes; ``commit_canvas_draft`` publishes it. Send the last
    ``draft_revision`` as ``revision``; the response carries the next one. On
    ``DraftRevisionConflict``, reload the draft before writing again.

    On any error nothing changes, and the error names the operation and the
    path at fault. ``ValidationError`` leaves the draft unchanged.

    The ``ops`` schema defines each operation; it does not express these
    rules:

    - ``add`` takes either ``widgetType`` with ``props`` for a new widget
      (get its props schema with ``get_widget_control_schema``) or
      ``widgetId`` to place an existing one, never both. A new chart, table
      or filter becomes a saved widget when the draft is published.
    - ``set_props`` replaces all props, on every canvas that places the
      widget after commit. Read its effective props from
      ``get_canvas_draft``'s ``widgets`` map and send the complete
      replacement to preserve unrelated fields.
    - A saved widget's ``name`` is the title shown above it. Name new widgets
      on ``add``; ``rename`` changes it, on every canvas that places it.
    - ``scope: null`` on ``set_scope`` restores auto (the filter's nearest
      scoping container) and ``value: null`` on ``set_settings`` resets that
      section. Both are required, so omitting one is an error, not a reset.

    A ``layout`` is ``{"col", "row", "colSpan", "rowSpan"}`` on a 1-based
    grid: ``col`` runs from 1 to the grid's columns (24 on the root;
    ``grid_columns`` has each container's) and ``row`` starts at 1. Leave
    ``col``/``row`` out to auto-place, and spans out for the widget's default
    size. ``place`` takes the whole layout.

    Overlaps push the later placement (in ``children`` order) down; a
    ``place`` first moves its node ahead of whatever it lands on, so it wins
    the spot. Nothing moves back up, so close gaps with ``place``.
    Containers grow to fit. The response has every resolved ``placements``
    and ``displaced``, what got pushed without being named.
    """
    return CanvasDraftResponse.model_validate(
        _apply_canvas_draft_ops_impl(token, revision, ops)
    )
