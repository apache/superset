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

"""MCP tool: list_widget_types"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.widgets.schemas import ListWidgetTypesResponse
from superset.mcp_service.widgets.utils import registry

logger = logging.getLogger(__name__)


def _canvas_facts(cls: Any) -> Dict[str, Any]:
    """The non-default parts of a widget type's canvas behavior, kept short
    since every type is listed at once."""
    behavior, ui = cls.behavior, cls.ui
    facts: Dict[str, Any] = {
        "container": behavior.container,
        "acceptedChildren": sorted(behavior.accepted_children)
        if behavior.accepted_children is not None
        else None,
        "allowedParents": sorted(behavior.allowed_parents)
        if behavior.allowed_parents is not None
        else None,
        "filter": behavior.filter,
        "filterable": behavior.filterable,
        "emitsFilters": behavior.emits_filters,
        "defaultSize": list(ui.default_size) if ui.default_size else None,
    }
    return {key: value for key, value in facts.items() if value}


def _list_widget_types_impl() -> List[Dict[str, Any]]:
    """Pure logic: the registered schema-driven widget types."""
    return [
        {
            "id": cls.widget_type,
            "name": cls.name,
            "description": cls.description,
            "canvas": _canvas_facts(cls) or None,
        }
        for cls in registry.values()
    ]


@tool(
    tags=["discovery"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="List dashboard widget types",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
def list_widget_types() -> ListWidgetTypesResponse:
    """List the Dashboard V2 widget types that have a schema-driven control
    panel.

    This is the entry point for progressive disclosure: pick a type's ``id``,
    then call ``get_widget_control_schema`` for its minimum-viable control schema
    (call it again with ``paths`` to drill into optional/nested branches).
    Returns each type's id, human name, description and, under ``canvas``,
    how it nests and filters: containers list ``acceptedChildren``, a type
    that must sit inside another lists ``allowedParents``, filters are
    ``filter``, widgets that filters narrow are ``filterable``, and
    ``defaultSize`` is ``[columns, rows]`` on the 24-column grid.
    """
    return ListWidgetTypesResponse.model_validate(
        {"widget_types": _list_widget_types_impl()}
    )
