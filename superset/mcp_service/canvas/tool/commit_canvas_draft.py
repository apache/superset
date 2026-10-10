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
"""MCP tool: commit_canvas_draft"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.canvas.draft import CommitCanvasDraftCommand, load_draft
from superset.mcp_service.canvas.schemas import CanvasDraftResponse
from superset.mcp_service.canvas.tool.canvas_draft_common import error_result


def _commit_canvas_draft_impl(token: str, revision: int) -> dict[str, Any]:
    try:
        draft = load_draft(token)
        result = CommitCanvasDraftCommand(token, revision).run()
    except Exception as ex:  # pylint: disable=broad-except
        if (error := error_result(ex)) is None:
            raise
        return error
    return {
        "canvas_id": draft.canvas_id,
        "canvas_revision": result.revision if result else draft.base_revision,
    }


@tool(
    tags=["mutate"],
    class_permission_name="Canvas",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Publish a canvas draft",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def commit_canvas_draft(token: str, revision: int) -> CanvasDraftResponse:
    """Publish a canvas draft: its changes land on the canvas as one revision
    and the draft is deleted. Rejected (``canvas_changed``) if the canvas
    changed since the draft started; start a new draft then. Only commit
    when the person asks you to publish.
    """
    return CanvasDraftResponse.model_validate(
        _commit_canvas_draft_impl(token, revision)
    )
