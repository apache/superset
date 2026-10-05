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
Applying operations to a canvas.

Operations are the only way a stored canvas changes. Each applied operation
reports what it touched as ``(node id, field group)`` pairs; the command layer
logs them per revision and rejects a write whose touches overlap a change made
since the revision the caller last saw (see ``overlapping``).
"""

from __future__ import annotations

import copy
from collections.abc import Callable, Container, Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from superset_core.canvas import InstanceResolver
from superset_core.widgets import Widget

from superset.canvas.definition.placements import new_placement_id, placement_widgets
from superset.canvas.definition.registry import (
    get_instance_resolver,
    get_widgets,
    WidgetRegistry,
)
from superset.canvas.definition.schemas import (
    AddOp,
    MoveOp,
    Operation,
    PlaceOp,
    RemoveOp,
    ROOT_ID,
    SCOPE_FIELDS,
    SetPropsOp,
    SetScopeOp,
    SetSettingsOp,
    SETTINGS_ID,
)
from superset.canvas.definition.validation import normalize_definition


class FieldGroup(str, Enum):
    # Existence and position in the tree; overlaps with every other group.
    TREE = "tree"
    LAYOUT = "layout"
    # An inline instance's props.
    PROPS = "props"
    # A node's scope override, per kind.
    FILTER_SCOPE = "filterScope"
    CROSS_FILTER_SCOPE = "crossFilterScope"
    CUSTOMIZATION_SCOPE = "customizationScope"
    # Sections of the canvas settings, touched on ``SETTINGS_ID``.
    REFRESH = "refresh"
    COLORS = "colors"
    DISPLAY = "display"
    CROSS_FILTERS = "crossFilters"


SCOPE_GROUPS = {
    "filter": FieldGroup.FILTER_SCOPE,
    "crossFilter": FieldGroup.CROSS_FILTER_SCOPE,
    "customization": FieldGroup.CUSTOMIZATION_SCOPE,
}


@dataclass(frozen=True)
class Touch:
    node_id: str
    group: FieldGroup


@dataclass
class AppliedOperation:
    # The operation as logged; ``add`` always carries the new node's id.
    op: dict[str, Any]
    touched: list[Touch] = field(default_factory=list)


class OperationError(ValueError):
    def __init__(self, index: int, message: str) -> None:
        self.index = index
        self.message = message
        super().__init__(f"operation {index}: {message}")


def overlapping(earlier: Iterable[Touch], later: Iterable[Touch]) -> set[str]:
    """Node ids where ``later`` touches collide with ``earlier`` ones."""
    groups: dict[str, set[FieldGroup]] = {}
    for touch in earlier:
        groups.setdefault(touch.node_id, set()).add(touch.group)
    conflicts: set[str] = set()
    for touch in later:
        seen = groups.get(touch.node_id)
        if seen and (
            touch.group in seen
            or touch.group == FieldGroup.TREE
            or FieldGroup.TREE in seen
        ):
            conflicts.add(touch.node_id)
    return conflicts


def named_touches(ops: Iterable[Operation]) -> list[Touch]:
    """
    What ``ops`` touch on nodes that already exist, known before applying them.

    Lets a stale write be checked for overlap even when an operation could no
    longer apply, e.g. because another writer removed its node.
    """
    touches: list[Touch] = []
    for op in ops:
        if isinstance(op, RemoveOp):
            touches.append(Touch(op.id, FieldGroup.TREE))
        elif isinstance(op, MoveOp):
            touches += [Touch(op.id, FieldGroup.TREE), Touch(op.id, FieldGroup.LAYOUT)]
        elif isinstance(op, PlaceOp):
            touches.append(Touch(op.id, FieldGroup.LAYOUT))
        elif isinstance(op, SetPropsOp):
            touches.append(Touch(op.id, FieldGroup.PROPS))
        elif isinstance(op, SetScopeOp):
            touches.append(Touch(op.id, SCOPE_GROUPS[op.kind]))
        elif isinstance(op, SetSettingsOp):
            touches.append(Touch(SETTINGS_ID, FieldGroup(op.key)))
    return touches


class _Applier:
    def __init__(
        self,
        canvas: dict[str, Any],
        new_id: Callable[[str, Container[str]], str],
        widgets: WidgetRegistry,
        resolver: InstanceResolver,
    ) -> None:
        self.canvas = copy.deepcopy(canvas)
        self.new_id = new_id
        self.widgets = widgets
        self.resolver = resolver

    def is_container(self, node_id: str) -> bool:
        # Placements that no longer resolve keep their stored children but
        # accept no new ones.
        resolved = placement_widgets(
            {node_id: self.nodes[node_id]}, self.widgets, self.resolver
        )
        return node_id in resolved and resolved[node_id].behavior.container

    @property
    def nodes(self) -> dict[str, Any]:
        return self.canvas["nodes"]

    def node(self, node_id: str) -> dict[str, Any]:
        if node_id not in self.nodes:
            raise ValueError(f"unknown node {node_id!r}")
        return self.nodes[node_id]

    def children(self, parent_id: str) -> list[str]:
        if parent_id == ROOT_ID:
            return self.canvas["root"]["children"]
        parent = self.node(parent_id)
        if not self.is_container(parent_id):
            raise ValueError(f"{parent_id!r} cannot hold children")
        return parent.setdefault("children", [])

    def _siblings(self, parent_id: str) -> list[str]:
        """A parent's existing children, which may be taken from any parent."""
        if parent_id == ROOT_ID:
            return self.canvas["root"]["children"]
        return self.node(parent_id)["children"]

    def parent_of(self, node_id: str) -> str:
        if node_id in self.canvas["root"]["children"]:
            return ROOT_ID
        for parent_id, node in self.nodes.items():
            if node_id in (node.get("children") or []):
                return parent_id
        raise ValueError(f"node {node_id!r} has no parent")

    def subtree(self, node_id: str) -> list[str]:
        ids, stack = [], [node_id]
        while stack:
            current = stack.pop()
            ids.append(current)
            stack.extend(self.nodes[current].get("children") or [])
        return ids

    @staticmethod
    def insert(children: list[str], node_id: str, index: int | None) -> None:
        if index is None:
            children.append(node_id)
        elif index > len(children):
            raise ValueError(f"index {index} is past the end of {len(children)}")
        else:
            children.insert(index, node_id)

    def apply(self, op: Operation) -> AppliedOperation:
        logged = op.model_dump(mode="json", by_alias=True, exclude_none=True)
        if isinstance(op, AddOp):
            return self.add(op, logged)
        if isinstance(op, SetPropsOp):
            return self.set_props(op, logged)
        if isinstance(op, RemoveOp):
            self.node(op.id)
            self._siblings(self.parent_of(op.id)).remove(op.id)
            removed = self.subtree(op.id)
            for node_id in removed:
                del self.nodes[node_id]
            touched = [Touch(node_id, FieldGroup.TREE) for node_id in removed]
            return AppliedOperation(
                logged,
                touched
                + self._prune_scopes(set(removed))
                + self._prune_settings(set(removed)),
            )
        if isinstance(op, MoveOp):
            return self.move(op, logged)
        if isinstance(op, SetScopeOp):
            self.node(op.id)
            overrides = self.scopes(op.kind)
            if op.scope is None:
                overrides.pop(op.id, None)
            else:
                overrides[op.id] = op.scope.model_dump(
                    mode="json", by_alias=True, exclude_none=True
                )
            return AppliedOperation(logged, [Touch(op.id, SCOPE_GROUPS[op.kind])])
        if isinstance(op, SetSettingsOp):
            settings = self.canvas.setdefault("settings", {})
            if op.value is None:
                settings.pop(op.key, None)
            else:
                settings[op.key] = op.value
            return AppliedOperation(logged, [Touch(SETTINGS_ID, FieldGroup(op.key))])
        assert isinstance(op, PlaceOp)  # noqa: S101
        self.node(op.id)["layout"] = op.layout
        return AppliedOperation(logged, [Touch(op.id, FieldGroup.LAYOUT)])

    def set_props(self, op: SetPropsOp, logged: dict[str, Any]) -> AppliedOperation:
        node = self.node(op.id)
        widget = self.widgets.get(node.get("widget") or "")
        if widget is None:
            raise ValueError(
                f"{op.id!r} is not an inline instance of a registered widget"
            )
        node["props"] = op.props
        node["schemaVersion"] = widget.schema_version
        return AppliedOperation(logged, [Touch(op.id, FieldGroup.PROPS)])

    def grid_columns(self, parent_id: str) -> int | None:
        """Columns of ``parent_id``'s grid, or ``None`` if it isn't a grid."""
        if parent_id == ROOT_ID:
            return self.canvas["root"].get("layout", {}).get("columns", 24)
        resolved = placement_widgets(
            {parent_id: self.node(parent_id)}, self.widgets, self.resolver
        )
        widget = resolved.get(parent_id)
        return widget.behavior.grid_columns if widget is not None else None

    def default_layout(
        self, widget: type[Widget] | None, parent_id: str, layout: dict[str, Any]
    ) -> dict[str, Any]:
        """``layout`` with the widget's default size on a grid, where unset."""
        columns = self.grid_columns(parent_id)
        if widget is None or widget.ui.default_size is None or columns is None:
            return layout
        col_span, row_span = widget.ui.default_size
        return {
            "colSpan": min(col_span, columns),
            "rowSpan": row_span,
            **layout,
        }

    def add(self, op: AddOp, logged: dict[str, Any]) -> AppliedOperation:
        widget: type[Widget] | None
        if op.widget is not None:
            widget = self.widgets.get(op.widget)
            if widget is None:
                raise ValueError(f"unknown widget {op.widget!r}")
            props = op.props or {}
            title = props.get("title")
            name = title if isinstance(title, str) and title.strip() else widget.name
            node: dict[str, Any] = {
                "widget": op.widget,
                "schemaVersion": widget.schema_version,
                "props": props,
            }
        else:
            assert op.instance is not None  # noqa: S101
            widget_type = self.resolver.widget_types({op.instance}).get(op.instance)
            widget = self.widgets.get(widget_type or "")
            name = widget.name if widget is not None else "widget"
            node = {"instance": op.instance}
        node_id = op.id or self.new_id(name, self.nodes)
        if node_id in self.nodes:
            raise ValueError(f"node {node_id!r} already exists")
        self.insert(self.children(op.parent), node_id, op.index)
        layout = self.default_layout(widget, op.parent, op.layout)
        self.nodes[node_id] = {**node, "layout": layout}
        touched = [Touch(node_id, FieldGroup.TREE)]
        if op.widget is not None:
            touched.append(Touch(node_id, FieldGroup.PROPS))
        return AppliedOperation({**logged, "id": node_id}, touched)

    def scopes(self, kind: str) -> dict[str, Any]:
        interactions = self.canvas.setdefault("interactions", {})
        return interactions.setdefault(SCOPE_FIELDS[kind], {})

    def _prune_scopes(self, removed: set[str]) -> list[Touch]:
        """Drop removed nodes from every kind of scope override."""
        touched = []
        for kind, group in SCOPE_GROUPS.items():
            overrides = self.scopes(kind)
            for owner_id in list(overrides):
                if owner_id in removed:
                    del overrides[owner_id]
                    continue
                scope = overrides[owner_id]
                for field_name in ("targets", "exclude"):
                    listed = scope.get(field_name, [])
                    kept = [n for n in listed if n not in removed]
                    if len(kept) != len(listed):
                        scope[field_name] = kept
                        touched.append(Touch(owner_id, group))
        return touched

    def _prune_settings(self, removed: set[str]) -> list[Touch]:
        """Drop removed nodes from the refresh exemptions."""
        refresh = self.canvas.get("settings", {}).get("refresh", {})
        exempt = refresh.get("exempt", [])
        kept = [node_id for node_id in exempt if node_id not in removed]
        if len(kept) == len(exempt):
            return []
        refresh["exempt"] = kept
        return [Touch(SETTINGS_ID, FieldGroup.REFRESH)]

    def move(self, op: MoveOp, logged: dict[str, Any]) -> AppliedOperation:
        node = self.node(op.id)
        if op.parent != ROOT_ID and op.parent in self.subtree(op.id):
            raise ValueError("cannot move a node into itself or its descendants")
        old_parent = self.parent_of(op.id)
        new_children = self.children(op.parent)
        self._siblings(old_parent).remove(op.id)
        self.insert(new_children, op.id, op.index)
        if op.layout is not None:
            node["layout"] = op.layout
        elif op.parent != old_parent:
            # Placement is relative to the parent; re-flow in the new one.
            node["layout"] = {}
        return AppliedOperation(
            logged, [Touch(op.id, FieldGroup.TREE), Touch(op.id, FieldGroup.LAYOUT)]
        )


def apply_operations(
    canvas: dict[str, Any],
    ops: list[Operation],
    *,
    widgets: WidgetRegistry | None = None,
    resolver: InstanceResolver | None = None,
    new_id: Callable[[str, Container[str]], str] = new_placement_id,
) -> tuple[dict[str, Any], list[AppliedOperation]]:
    """
    Apply ``ops`` in order to a copy of ``canvas``.

    All operations apply or none do: a bad operation raises ``OperationError``
    and an invalid result raises ``DefinitionValidationError``. Returns the
    normalized canvas and what each operation touched.
    """
    widgets = get_widgets() if widgets is None else widgets
    resolver = resolver or get_instance_resolver()
    applier = _Applier(canvas, new_id, widgets, resolver)
    applied: list[AppliedOperation] = []
    for index, op in enumerate(ops):
        try:
            applied.append(applier.apply(op))
        except ValueError as ex:
            raise OperationError(index, str(ex)) from ex
    # Widget behavior is enforced on what these operations touched, and props
    # validated where they were written; the rest of the canvas keeps its
    # stored form even if a widget changed since.
    touches = [touch for op in applied for touch in op.touched]
    return (
        normalize_definition(
            applier.canvas,
            widgets,
            resolver,
            strict_nodes={touch.node_id for touch in touches},
            props_nodes={t.node_id for t in touches if t.group == FieldGroup.PROPS},
        ),
        applied,
    )
