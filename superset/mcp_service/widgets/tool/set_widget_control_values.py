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

"""MCP tool: set_widget_control_values"""

from __future__ import annotations

import logging
from typing import Any, Dict

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.node_store import nodes
from superset.mcp_service.widgets.utils import (
    resolve_widget,
    unknown_node_error,
    unknown_widget_type_error,
)

logger = logging.getLogger(__name__)


def _set_widget_control_values_impl(
    node_id: str,
    control_values: Dict[str, Any],
) -> Dict[str, Any]:
    """Pure logic: validate-then-commit a widget node's control values.

    Builds a candidate (the node's current ``props`` shallow-merged with
    ``control_values`` -- new keys override, everything else is preserved,
    mirroring how the frontend's ``DashboardProvider.updateProps`` merges)
    without touching the stored node. Validates the candidate through
    ``Widget.validate_control_values`` -- the same commit-time gate the
    ``/type/<widget_type>/validate`` REST endpoint uses. Only on success is
    the node's ``props`` replaced with the candidate, a single dict
    reassignment, so a validation failure leaves the stored node completely
    unchanged: there is nothing to roll back because nothing was mutated in
    place.
    """
    node = nodes.get(node_id)
    if node is None:
        return unknown_node_error(node_id)

    widget = resolve_widget(node.widget_type)
    if widget is None:
        return unknown_widget_type_error(node.widget_type)

    candidate = {**node.props, **control_values}
    if errors := widget.validate_control_values(candidate):
        return {"errors": errors}

    # model_validate succeeded once already inside validate_control_values;
    # this second call is cheap and deterministic on the same input, and is
    # what gets us the normalized (coerced, alias-keyed) values to return and
    # store, rather than the raw candidate validate_control_values discards.
    normalized = widget.controls_class.model_validate(candidate).model_dump(
        by_alias=True
    )
    node.props = normalized
    return {"errors": [], "values": normalized}


@tool(
    tags=["mutate"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Set widget control values",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def set_widget_control_values(
    node_id: str,
    control_values: Dict[str, Any],
) -> Dict[str, Any]:
    """Set control values on a Dashboard V2 widget node (experimental).

    ``control_values`` is shallow-merged onto the node's current values (new
    keys override, everything else is kept) and validated through the same
    strict, commit-time check the human control panel uses before anything is
    written. On success, returns ``{"errors": [], "values": <normalized>}`` --
    the values actually stored, coerced and alias-keyed. On failure, returns
    ``{"errors": [...]}`` (each an actionable ``{"loc", "message"}``) and the
    node's stored values are unchanged.

    Returns a structured error for an unknown ``node_id``.

    This operates on a minimal, MCP-process-local node store -- not Superset's
    real Dashboard V2 document, which lives only in the frontend and has no
    backend-addressable form today. It does not persist across process
    restarts and does not seed defaults for an unset field.
    """
    return _set_widget_control_values_impl(node_id, control_values)
