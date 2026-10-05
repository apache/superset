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
The widget behind each placement, inline props upgrades and placement ids.

A placement resolves when its widget is registered and, for an inline
instance, its props are at the widget's schema version. Anything else (a
deleted instance, an uninstalled extension, props saved by a newer widget or
whose migration fails) is an unresolved placeholder, kept exactly as stored.
"""

from __future__ import annotations

import re
from collections.abc import Container
from typing import Any

from superset_core.canvas import InstanceResolver
from superset_core.widgets import PropsVersionError, Widget

from superset.canvas.definition.registry import WidgetRegistry
from superset.canvas.definition.schemas import NODE_ID_MAX_LENGTH, RESERVED_IDS


def placement_widgets(
    nodes: dict[str, Any],
    widgets: WidgetRegistry,
    resolver: InstanceResolver,
) -> dict[str, type[Widget]]:
    """``{placement id: widget}`` for every placement that resolves."""
    instance_types = resolver.widget_types(
        {node["instance"] for node in nodes.values() if node.get("instance")}
    )
    resolved: dict[str, type[Widget]] = {}
    for node_id, node in nodes.items():
        if node.get("instance"):
            widget = widgets.get(instance_types.get(node["instance"], ""))
        else:
            widget = widgets.get(node.get("widget") or "")
            if widget is not None and node.get("schemaVersion") != (
                widget.schema_version
            ):
                widget = None
        if widget is not None:
            resolved[node_id] = widget
    return resolved


def upgrade_inline_props(
    definition: dict[str, Any], widgets: WidgetRegistry
) -> dict[str, Any]:
    """
    Bring inline props to their widget's schema version, in place.

    Props a widget can't upgrade are left as stored, so the placement stays
    an unresolved placeholder until the widget can read them.
    """
    for node in definition.get("nodes", {}).values():
        widget = widgets.get(node.get("widget") or "")
        version = node.get("schemaVersion")
        if widget is None or not isinstance(version, int):
            continue
        if version == widget.schema_version:
            continue
        try:
            node["props"] = widget.upgrade_props(node.get("props") or {}, version)
        except PropsVersionError:
            continue
        node["schemaVersion"] = widget.schema_version
    return definition


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:NODE_ID_MAX_LENGTH].rstrip("-") or "widget"


def new_placement_id(base: str, taken: Container[str]) -> str:
    """A readable id from ``base``, e.g. ``revenue-trend`` or ``revenue-trend-2``."""
    slug = slugify(base)
    if slug not in taken and slug not in RESERVED_IDS:
        return slug
    counter = 2
    while True:
        suffix = f"-{counter}"
        candidate = slug[: NODE_ID_MAX_LENGTH - len(suffix)].rstrip("-") + suffix
        if candidate not in taken:
            return candidate
        counter += 1
