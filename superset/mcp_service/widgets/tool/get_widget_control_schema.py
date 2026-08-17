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

"""MCP tool: get_widget_control_schema"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.utils import (
    resolve_widget,
    unknown_widget_type_error,
)
from superset.widgets.schema_tools import (
    get_subtrees,
    prune_to_minimal_viable,
    SchemaPathError,
)

logger = logging.getLogger(__name__)


def _get_widget_control_schema_impl(
    widget_type: str,
    paths: List[str] | None = None,
    control_values: Dict[str, Any] | None = None,
    series: List[str] | None = None,
) -> Dict[str, Any]:
    """Pure logic: the minimum-viable root schema, or the requested subtrees."""
    widget = resolve_widget(widget_type)
    if widget is None:
        return unknown_widget_type_error(widget_type)
    schema = widget.get_control_schema(control_values, series)
    if not paths:
        return prune_to_minimal_viable(schema)
    try:
        return {"subtrees": get_subtrees(schema, paths)}
    except SchemaPathError as ex:
        return {
            "error": {
                "error_type": "invalid_path",
                "message": str(ex),
                "suggestions": [
                    "Call this tool without `paths` first, then drill into the "
                    "x-path values of its x-collapsed nodes.",
                ],
            }
        }


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get widget control schema",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
def get_widget_control_schema(
    widget_type: str,
    paths: List[str] | None = None,
    control_values: Dict[str, Any] | None = None,
    series: List[str] | None = None,
) -> Dict[str, Any]:
    """Get the control schema for a Dashboard V2 widget type (progressive
    disclosure).

    Called WITHOUT ``paths``, returns the **minimum viable** root: every
    mandatory field expanded to its leaves (descending into mandatory nested
    objects), plus cheap optional leaves inline. Optional nested branches are
    returned as opaque drill-in markers carrying ``x-collapsed: true`` and an
    ``x-path``; the root is tagged ``x-disclosure: "minimal"``.

    Called WITH ``paths`` (each an ``x-path`` from a marker, e.g.
    ``["a", "a/b"]``), returns ``{"subtrees": {<path>: <schema>}}`` — one
    self-contained JSON Schema per requested path, ``$ref`` inlined. Expand
    several at once to avoid a round trip per branch.

    The root's mandatory fields alone are enough to build a valid widget. Expand
    a collapsed branch ONLY when the user's request calls for that optional
    capability (judge from the marker's ``description``) — do NOT pre-fetch
    speculatively.

    A marker flagged ``x-dynamic: true`` has a shape that depends on the current
    query (e.g. a map keyed by a dimension's distinct values). To get its
    ENRICHED shape you must pass ``control_values`` (the current widget ``props``,
    so the branch's dependency is satisfied) — and any known ``series`` values.
    ``series`` on its own does nothing: without a satisfying ``control_values``
    you get the branch's GENERIC shape instead (e.g. a map of
    ``<value> -> {...}``), which is usually enough to fill it in anyway. Re-fetch
    a dynamic branch after the query changes. A marker WITHOUT ``x-dynamic`` is
    static — expand it once and it won't change.

    Returns a structured error for an unknown ``widget_type`` or an unresolvable
    ``path``.
    """
    return _get_widget_control_schema_impl(widget_type, paths, control_values, series)
