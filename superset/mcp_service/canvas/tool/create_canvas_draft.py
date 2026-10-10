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
"""MCP tool: create_canvas_draft"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.canvas.draft import CreateCanvasDraftCommand
from superset.mcp_service.canvas.schemas import CanvasDraftResponse
from superset.mcp_service.canvas.tool.canvas_draft_common import describe, error_result


def _create_canvas_draft_impl(canvas_id: int | str) -> dict[str, Any]:
    try:
        draft = CreateCanvasDraftCommand(canvas_id).run()
    except Exception as ex:  # pylint: disable=broad-except
        if (result := error_result(ex)) is None:
            raise
        return result
    return {"token": draft.token, **describe(draft, include_definition=False)}


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Start a canvas draft",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def create_canvas_draft(canvas_id: int | str) -> CanvasDraftResponse:
    """Start a private draft of a canvas (by id or UUID) and return its token.

    Make changes in the draft with ``apply_canvas_draft_ops``; nobody else sees
    them until ``commit_canvas_draft`` publishes them. Give the person the
    returned ``url`` so they can watch and review the draft in the browser.
    Prefer a draft for anything beyond a one-off fix.
    """
    return CanvasDraftResponse.model_validate(_create_canvas_draft_impl(canvas_id))
