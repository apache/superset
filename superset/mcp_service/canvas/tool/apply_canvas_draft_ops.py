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

from superset.canvas.definition.schemas import DraftOperationsRequest
from superset.canvas.definition.validation import request_pointer
from superset.commands.canvas.draft import ApplyCanvasDraftOperationsCommand
from superset.mcp_service.canvas.schemas import CanvasDraftResponse
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
            "errors": [
                {"path": request_pointer(error["loc"]), "message": error["msg"]}
                for error in ex.errors()
            ],
        }
    try:
        draft, applied = ApplyCanvasDraftOperationsCommand(
            token, request.revision, request.ops
        ).run()
    except Exception as ex:  # pylint: disable=broad-except
        if (result := error_result(ex)) is None:
            raise
        return result
    return {**describe(draft, include_definition=False), "ops": applied}


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
    token: str, revision: int, ops: list[dict[str, Any]]
) -> CanvasDraftResponse:
    """Apply operations to a canvas draft, atomically: the same operations
    ``apply_canvas_ops`` takes, validated the same way, but only the draft
    changes. ``revision`` is the draft revision you last saw; the response
    carries the next one.
    """
    return CanvasDraftResponse.model_validate(
        _apply_canvas_draft_ops_impl(token, revision, ops)
    )
