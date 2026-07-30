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
"""MCP tool: get_canvas_schema."""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.canvas.schemas import (
    GetCanvasSchemaRequest,
    GetCanvasSchemaResponse,
)
from superset.mcp_service.canvas.validation import build_cdl_schema

logger = logging.getLogger(__name__)


@tool(
    tags=["read"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="Get canvas schema",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_canvas_schema(
    request: GetCanvasSchemaRequest,  # noqa: ARG001
    ctx: Context,  # noqa: ARG001
) -> GetCanvasSchemaResponse:
    """Return the CDL contract to author an AI-native canvas (v2 dashboard).

    Call this BEFORE composing a canvas so you emit a valid definition. It
    lists node types, the action vocabulary, formatter kinds, hard rules
    (no code, declarative formatters), and a worked example.

    Workflow: get_canvas_schema -> list_datasets -> get_dataset_info (columns
    and metrics) -> compose CDL -> generate_canvas.
    """
    return GetCanvasSchemaResponse(cdl_schema=build_cdl_schema())
