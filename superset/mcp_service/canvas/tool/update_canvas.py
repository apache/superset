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
"""MCP tool: update_canvas."""

import logging

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.canvas.patch import apply_ops
from superset.mcp_service.canvas.schemas import (
    CanvasInfo,
    UpdateCanvasRequest,
    UpdateCanvasResponse,
)
from superset.mcp_service.canvas.utils import find_canvas
from superset.mcp_service.canvas.validation import validate_cdl
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Update canvas",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def update_canvas(
    request: UpdateCanvasRequest,
    ctx: Context,  # noqa: ARG001
) -> UpdateCanvasResponse:
    """Edit an existing canvas with targeted patch ops instead of regenerating it.

    Call get_canvas first to read node ids. Ops are applied in order:
      - setStyle  {id, style}          restyle a node (merge by default)
      - setProps  {id, props}          change component props (e.g. a title)
      - setOption {id, option}         change a Viz node's echarts option
      - move      {id, before|after|index, parent?}  reorder / reparent a node
      - insert    {id: <parentId>, node, before|after|index}  add a node
      - replace   {id, node}           swap a node wholesale
      - remove    {id}                 delete a node

    The patched CDL is fully re-validated; on any failure NOTHING is saved and
    validation_errors explains why. Prefer this over generate_canvas for edits —
    regenerating drifts the parts the user did not ask to change.
    """
    try:
        canvas = find_canvas(request.identifier)
        if canvas is None:
            return UpdateCanvasResponse(
                error=f"Canvas {request.identifier!r} not found."
            )

        definition = json.loads(canvas.definition) if canvas.definition else {}
        ops = [op.model_dump(exclude_none=True) for op in request.ops]

        updated, patch_errors = apply_ops(definition, ops)
        if patch_errors:
            return UpdateCanvasResponse(
                error="Patch failed; nothing was saved.",
                validation_errors=patch_errors,
            )

        cdl_errors = validate_cdl(updated)
        if cdl_errors:
            return UpdateCanvasResponse(
                error="Patched canvas is not valid CDL; nothing was saved.",
                validation_errors=cdl_errors,
            )

        with event_logger.log_context(action="mcp.update_canvas.db_write"):
            canvas.definition = json.dumps(updated)
            if request.name:
                canvas.name = request.name
            db.session.add(canvas)
            db.session.commit()  # pylint: disable=consider-using-transaction

        canvas_url = f"{get_superset_base_url()}/canvas/{canvas.id}/"
        logger.info("Updated canvas %s with %s ops", canvas.id, len(ops))
        return UpdateCanvasResponse(
            canvas=CanvasInfo(
                id=canvas.id,
                name=canvas.name,
                url=canvas_url,
                uuid=str(canvas.uuid) if canvas.uuid else None,
            ),
            canvas_url=canvas_url,
            applied_ops=len(ops),
        )
    except (SQLAlchemyError, ValueError, AttributeError) as ex:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning("Rollback failed during error handling", exc_info=True)
        logger.error("Error updating canvas: %s", ex, exc_info=True)
        return UpdateCanvasResponse(
            error="Failed to update canvas due to an internal error."
        )
