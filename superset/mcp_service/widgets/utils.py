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

"""
Shared helpers for the Dashboard V2 widget-control MCP tools.

Kept separate from the decorated tool modules so the pure logic is importable
and unit-testable without going through the MCP layer (mirrors the
``get_chart_type_schema`` ``_impl`` pattern).
"""

from __future__ import annotations

from typing import Any

from superset_core.widgets import Widget

from superset.widgets.registry import registry


def valid_widget_types() -> list[str]:
    return sorted(cls.widget_type for cls in registry.values())


def unknown_widget_type_error(widget_type: str) -> dict[str, Any]:
    """Structured error for an unknown widget type (mirrors the chart tools)."""
    return {
        "error": {
            "error_type": "invalid_widget_type",
            "message": f"Unknown widget type: {widget_type!r}",
            "suggestions": [
                "Call list_widget_types to see the available types.",
            ],
        },
        "valid_widget_types": valid_widget_types(),
    }


def resolve_widget(widget_type: str) -> type[Widget] | None:
    return registry.get(widget_type)


def unknown_node_error(node_id: str) -> dict[str, Any]:
    """Structured error for a node id absent from the widget-node store
    (mirrors ``unknown_widget_type_error``)."""
    return {
        "error": {
            "error_type": "unknown_node",
            "message": f"Unknown widget node: {node_id!r}",
            "suggestions": [
                "The node id must already exist in the widget-node store; "
                "this tool does not create nodes.",
            ],
        }
    }
