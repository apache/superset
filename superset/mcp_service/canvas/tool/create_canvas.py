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

from contextlib import suppress
from typing import Any

from marshmallow import ValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.canvas.schemas import CanvasPostSchema
from superset.commands.canvas.create import CreateCanvasCommand
from superset.commands.canvas.delete import DeleteCanvasCommand
from superset.commands.canvas.draft import (
    CreateCanvasDraftCommand,
    DeleteCanvasDraftCommand,
)
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasInvalidError,
)
from superset.mcp_service.canvas.schemas import CanvasWriteResponse, InitialOpsInput
from superset.mcp_service.canvas.tool.apply_canvas_draft_ops import (
    _apply_canvas_draft_ops_impl,
)
from superset.mcp_service.canvas.tool.canvas_draft_common import draft_url


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
        return {
            "error": "Invalid canvas",
            "error_type": "ValidationError",
            "errors": ex.messages,
        }
    except CanvasInvalidError as ex:
        return {
            "error": "Invalid canvas",
            "error_type": "ValidationError",
            "errors": ex.normalized_messages(),
        }
    result: dict[str, Any] = {
        "id": canvas.id,
        "url": canvas.url,
        "revision": canvas.revision,
    }
    if not ops:
        return result
    # Content goes through a draft like any other edit: the canvas is created
    # empty and the initial operations wait in a draft for the person.
    draft = CreateCanvasDraftCommand(canvas.id).run()
    applied = _apply_canvas_draft_ops_impl(draft.token, draft.revision, ops)
    if "error" in applied:
        # Creation and the initial operations succeed or fail together.
        with suppress(CanvasDraftNotFoundError):
            DeleteCanvasDraftCommand(draft.token).run()
        DeleteCanvasCommand([canvas.id]).run()
        return applied
    return {
        **result,
        "token": draft.token,
        "draft_url": draft_url(draft),
        "draft_revision": applied["draft_revision"],
        "ops": applied["ops"],
    }


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
    ops: InitialOpsInput | None = None,
) -> CanvasWriteResponse:
    """Create an empty canvas, with you as its editor, and return its id, URL
    and revision.

    ``slug`` is the readable URL (``/canvas/<slug>/``); without one the URL
    uses the id. ``ops`` optionally builds content in a draft in the same call,
    with the operations ``apply_canvas_draft_ops`` takes (grid layouts are
    1-based; omit ``col``/``row`` to auto-place). The response then carries the
    draft's ``token``, ``draft_url`` and ``draft_revision``: give the person the
    ``draft_url`` to review it, and keep editing with the draft tools. If any
    operation fails, nothing is created and the error names the operation at
    fault.
    """
    return CanvasWriteResponse.model_validate(
        _create_canvas_impl(title, slug, description, ops)
    )
