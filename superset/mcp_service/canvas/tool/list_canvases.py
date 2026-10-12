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

"""MCP tool: list_canvases"""

from __future__ import annotations

from typing import Any

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.daos.canvas import CanvasDAO
from superset.mcp_service.canvas.schemas import ListCanvasesResponse


def _list_canvases_impl(
    search: str | None, page: int, page_size: int
) -> dict[str, Any]:
    canvases, count = CanvasDAO.list(
        search=search or None,
        search_columns=["title", "slug", "description"],
        order_column="changed_on",
        order_direction="desc",
        page=max(page - 1, 0),
        page_size=min(max(page_size, 1), 100),
    )
    return {
        "count": count,
        "canvases": [
            {
                "id": canvas.id,
                "title": canvas.title,
                "slug": canvas.slug,
                "url": canvas.url,
                "revision": canvas.revision,
                "description": canvas.description,
                "changed_on": canvas.changed_on.isoformat()
                if canvas.changed_on
                else None,
            }
            for canvas in canvases
        ],
    }


@tool(
    tags=["discovery"],
    class_permission_name="Canvas",
    annotations=ToolAnnotations(
        title="List canvases",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def list_canvases(
    search: str | None = None, page: int = 1, page_size: int = 25
) -> ListCanvasesResponse:
    """List the canvases you can view, most recently changed first.

    ``search`` matches the title, slug or description. ``page`` is 1-based.
    Read one with ``get_canvas``; its ``revision`` is the ``base_revision``
    for ``apply_canvas_ops``.
    """
    return ListCanvasesResponse.model_validate(
        _list_canvases_impl(search, page, page_size)
    )
