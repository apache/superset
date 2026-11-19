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
"""Resolving the canvas an MCP tool call acted on, for the audit log.

A leaf module on purpose: ``middleware.py`` must not import
``canvas.tool.__init__``, which would pull every canvas tool into the
middleware's import graph. The names are therefore repeated here and held in
step by a test rather than by an import.
"""

from __future__ import annotations

from typing import Any

# The tools whose *response* describes a canvas.
#
# Deliberately not the same as "the tools permissioned on Canvas": the widget
# tools (``list_widget_types``, ``get_widget_control_schema``,
# ``get_widget_info``, ``list_widgets``) carry ``class_permission_name="Canvas"``
# but answer about widgets, and their responses can hold a bare ``id`` that is a
# widget's. Reading that as a canvas id would attribute a call to a canvas that
# does not exist.
CANVAS_TOOL_NAMES: frozenset[str] = frozenset(
    {
        "apply_canvas_draft_ops",
        "commit_canvas_draft",
        "create_canvas",
        "create_canvas_draft",
        "delete_canvas_draft",
        "get_canvas",
        "get_canvas_data",
        "get_canvas_draft",
        "list_canvases",
        "preview_widget",
        "update_canvas",
    }
)


def _as_int(value: Any) -> int | None:
    """An id only when it already is one.

    A canvas is addressable by id, uuid or slug, and the tools type it
    ``int | str``. Resolving a uuid or slug would mean a database round trip on
    the event loop for every call, so a non-integer reference is left to the
    response, which always carries the integer id.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def is_canvas_tool(tool_name: str | None) -> bool:
    """Whether a tool's response may be read for a canvas id."""
    return tool_name in CANVAS_TOOL_NAMES


def canvas_id_from_params(params: Any) -> int | None:
    """The canvas a tool was asked to act on, when it was named as an id."""
    if not isinstance(params, dict):
        return None
    return _as_int(params.get("canvas_id"))


def canvas_id_from_result(data: Any) -> int | None:
    """The canvas a tool acted on, read from its response.

    This is the only source for the draft tools. ``apply_canvas_draft_ops``,
    ``commit_canvas_draft``, ``get_canvas_draft`` and ``delete_canvas_draft``
    take nothing but an opaque draft token -- which is redacted before it is
    logged, as it should be -- so without the response their calls cannot be
    attributed at all. ``create_canvas`` needs it for the usual reason: the id
    does not exist until the call succeeds.

    Only the integer id is read. A draft response's ``url`` ends in
    ``#draft=<token>``, so reading any more of the body would move a live token
    into the ``logs`` table.
    """
    if not isinstance(data, dict):
        return None
    return _as_int(data.get("canvas_id")) or _as_int(data.get("id"))
