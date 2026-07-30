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
"""MCP tool: get_canvas."""

import logging

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.canvas.schemas import (
    CanvasInfo,
    GetCanvasRequest,
    GetCanvasResponse,
)
from superset.mcp_service.canvas.utils import find_canvas
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


@tool(
    tags=["read"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Get canvas",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_canvas(
    request: GetCanvasRequest,
    ctx: Context,  # noqa: ARG001
) -> GetCanvasResponse:
    """Read a canvas and its CDL definition by id or uuid.

    Call this before update_canvas so you can read the node ids you want to
    target with patch operations.
    """
    try:
        canvas = find_canvas(request.identifier)
        if canvas is None:
            return GetCanvasResponse(error=f"Canvas {request.identifier!r} not found.")
        definition = json.loads(canvas.definition) if canvas.definition else None
        return GetCanvasResponse(
            canvas=CanvasInfo(
                id=canvas.id,
                name=canvas.name,
                url=f"{get_superset_base_url()}/canvas/{canvas.id}/",
                uuid=str(canvas.uuid) if canvas.uuid else None,
            ),
            definition=definition,
        )
    except (SQLAlchemyError, ValueError) as ex:
        logger.error("Error reading canvas: %s", ex, exc_info=True)
        return GetCanvasResponse(
            error="Failed to read canvas due to an internal error."
        )
