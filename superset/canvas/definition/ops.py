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
import dataclasses
from collections.abc import Callable, Container, Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from uuid import uuid4

from superset_core.canvas import StoredWidget, WidgetResolver
from superset_core.widgets import PropsVersionError, Widget

from superset.canvas.definition.grid import Rect, resolve_grid
from superset.canvas.definition.pending import PendingWidgetResolver
from superset.canvas.definition.placements import new_placement_id, placement_types
from superset.canvas.definition.registry import (
    get_widget_resolver,
    get_widget_types,
    WidgetTypes,
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
from superset.canvas.definition.validation import (
    DefinitionValidationError,
    normalize_definition,
)


class FieldGroup(str, Enum):
    # Existence and position in the tree; overlaps with every other group.
    TREE = "tree"
    LAYOUT = "layout"
    # A structural widget's props, or those of the widget a placement holds.
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
    # The operation as logged; ``add`` always carries the new node's id, and
    # the UUID of a widget it created.
    op: dict[str, Any]
    touched: list[Touch] = field(default_factory=list)
    # Whether replaying ``op`` changes the canvas. A widget's props are saved
    # with the widget instead, so an operation that only changed them is not
    # logged or replayed.
    replay: bool = True


class OperationError(ValueError):
    def __init__(self, index: int, message: str) -> None:
        self.index = index
        self.message = message
        super().__init__(f"operation {index}: {message}")


def current_props(
    widget: type[Widget], props: dict[str, Any], version: int | None
) -> dict[str, Any]:
    """``props`` written at ``version`` (default current), at the current one."""
    try:
        return widget.upgrade_props(props, version or widget.schema_version)
    except PropsVersionError as ex:
        raise ValueError(str(ex)) from ex


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
        widget_types: WidgetTypes,
        resolver: WidgetResolver,
        pending: dict[str, StoredWidget],
        new_widget_id: Callable[[], str],
    ) -> None:
        self.canvas = copy.deepcopy(canvas)
        self.new_id = new_id
        self.widget_types = widget_types
        self.pending = copy.deepcopy(pending)
        self.resolver = PendingWidgetResolver(resolver, self.pending)
        self.new_widget_id = new_widget_id

    def is_container(self, node_id: str) -> bool:
        # Placements that no longer resolve keep their stored children but
        # accept no new ones.
        resolved = placement_types(
            {node_id: self.nodes[node_id]}, self.widget_types, self.resolver
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
            self._forget_unplaced()
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
        self.bring_forward(op.id, op.layout)
        return AppliedOperation(logged, [Touch(op.id, FieldGroup.LAYOUT)])

    def set_props(self, op: SetPropsOp, logged: dict[str, Any]) -> AppliedOperation:
        node = self.node(op.id)
        if node.get("widgetId"):
            return self.set_widget_props(op, logged)
        widget = self.widget_types.get(node.get("widgetType") or "")
        if widget is None:
            raise ValueError(f"{op.id!r} does not hold a registered widget")
        node["props"] = current_props(widget, op.props, op.schema_version)
        node["schemaVersion"] = widget.schema_version
        return AppliedOperation(logged, [Touch(op.id, FieldGroup.PROPS)])

    def set_widget_props(
        self, op: SetPropsOp, logged: dict[str, Any]
    ) -> AppliedOperation:
        """Change the widget a placement holds, everywhere it is placed."""
        widget_id, stored = self.widget_of(op.id)
        widget = self.widget_types.get(stored.widget_type)
        if widget is None:
            raise ValueError(f"{op.id!r} does not hold a registered widget")
        if widget_id not in self.resolver.editable({widget_id}):
            raise ValueError(
                f"you may not change widget {widget_id!r}, which {op.id!r} holds"
            )
        self.pending[widget_id] = dataclasses.replace(
            stored,
            props=current_props(widget, op.props, op.schema_version),
            schema_version=widget.schema_version,
        )
        return AppliedOperation(
            {**logged, "widgetId": widget_id},
            [Touch(op.id, FieldGroup.PROPS)],
            replay=False,
        )

    def bring_forward(self, node_id: str, layout: dict[str, Any]) -> None:
        """
        Reorder ``node_id`` so a widget dropped onto others wins the spot.

        Overlaps push the later child down, so without this a widget dropped
        onto earlier siblings would be pushed under them. It goes before the
        first sibling it overlaps or that starts after it in reading order.
        """
        parent_id = self.parent_of(node_id)
        columns = self.grid_columns(parent_id)
        if columns is None or layout.get("col") is None:
            return
        siblings = self._siblings(parent_id)
        others = [child for child in siblings if child != node_id]
        rects, _ = resolve_grid(
            [self.nodes[child].get("layout") or {} for child in others], columns
        )
        col_span = min(layout.get("colSpan") or columns, columns)
        target = Rect(
            layout["col"], layout["row"], col_span, layout.get("rowSpan") or 1
        )
        index = next(
            (
                i
                for i, rect in enumerate(rects)
                if rect.cells() & target.cells()
                or (rect.row, rect.col) >= (target.row, target.col)
            ),
            len(others),
        )
        others.insert(index, node_id)
        siblings[:] = others

    def grid_columns(self, parent_id: str) -> int | None:
        """Columns of ``parent_id``'s grid, or ``None`` if it isn't a grid."""
        if parent_id == ROOT_ID:
            return self.canvas["root"].get("layout", {}).get("columns", 24)
        resolved = placement_types(
            {parent_id: self.node(parent_id)}, self.widget_types, self.resolver
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
        if op.widget_type is not None:
            widget = self.widget_types.get(op.widget_type)
            if widget is None:
                raise ValueError(f"unknown widget {op.widget_type!r}")
            props = current_props(widget, op.props or {}, op.schema_version)
            title = props.get("title")
            name = title if isinstance(title, str) and title.strip() else widget.name
            node: dict[str, Any]
            if widget.behavior.structural:
                if op.name is not None:
                    raise ValueError("only a widget entity has a name")
                node = {
                    "widgetType": op.widget_type,
                    "schemaVersion": widget.schema_version,
                    "props": props,
                }
            else:
                # Not part of the canvas: a new widget, saved with the canvas.
                widget_id = self.new_widget_id()
                self.pending[widget_id] = StoredWidget(
                    widget_type=op.widget_type,
                    schema_version=widget.schema_version,
                    name=op.name or name,
                    props=props,
                )
                node = {"widgetId": widget_id}
                logged = {
                    key: value
                    for key, value in logged.items()
                    if key not in {"widgetType", "props", "schemaVersion", "name"}
                }
                logged["widgetId"] = widget_id
        else:
            assert op.widget_id is not None  # noqa: S101
            widget_type = self.resolver.widget_types({op.widget_id}).get(op.widget_id)
            widget = self.widget_types.get(widget_type or "")
            name = widget.name if widget is not None else "widget"
            node = {"widgetId": op.widget_id}
        node_id = op.id or self.new_id(name, self.nodes)
        if node_id in self.nodes:
            raise ValueError(f"node {node_id!r} already exists")
        self.insert(self.children(op.parent), node_id, op.index)
        layout = self.default_layout(widget, op.parent, op.layout)
        self.nodes[node_id] = {**node, "layout": layout}
        touched = [Touch(node_id, FieldGroup.TREE)]
        if op.widget_type is not None:
            touched.append(Touch(node_id, FieldGroup.PROPS))
        return AppliedOperation({**logged, "id": node_id}, touched)

    def widget_of(self, node_id: str) -> tuple[str, StoredWidget]:
        widget_id = self.node(node_id)["widgetId"]
        stored = self.resolver.widgets({widget_id}).get(widget_id)
        if stored is None:
            raise ValueError(f"{node_id!r} holds a widget that no longer exists")
        return widget_id, stored

    def _forget_unplaced(self) -> None:
        """Drop widgets created here that no placement holds any more."""
        placed = {node.get("widgetId") for node in self.nodes.values()}
        for widget_id in [
            widget_id
            for widget_id, widget in self.pending.items()
            if widget.revision is None and widget_id not in placed
        ]:
            del self.pending[widget_id]

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
    widget_types: WidgetTypes | None = None,
    resolver: WidgetResolver | None = None,
    new_id: Callable[[str, Container[str]], str] = new_placement_id,
    pending: dict[str, StoredWidget] | None = None,
    new_widget_id: Callable[[], str] = lambda: str(uuid4()),
) -> tuple[dict[str, Any], list[AppliedOperation]]:
    """
    Apply ``ops`` in order to a copy of ``canvas``.

    All operations apply or none do: a bad operation raises ``OperationError``
    and an invalid result raises ``DefinitionValidationError``. Returns the
    normalized canvas and what each operation touched.

    Widgets the operations create or change are kept in ``pending``, keyed by
    UUID, which is updated only if every operation applies; the caller saves
    them with the canvas. ``pending`` may already hold a draft's widgets.
    """
    widget_types = get_widget_types() if widget_types is None else widget_types
    resolver = resolver or get_widget_resolver()
    pending = {} if pending is None else pending
    applier = _Applier(canvas, new_id, widget_types, resolver, pending, new_widget_id)
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
    try:
        definition = normalize_definition(
            applier.canvas,
            widget_types,
            applier.resolver,
            strict_nodes={touch.node_id for touch in touches},
            props_nodes={t.node_id for t in touches if t.group == FieldGroup.PROPS},
        )
    except DefinitionValidationError as ex:
        ex.operation = _culprit(ex, applied)
        raise
    pending.clear()
    pending.update(applier.pending)
    return definition, applied


def _culprit(
    error: DefinitionValidationError, applied: list[AppliedOperation]
) -> int | None:
    """The last operation that touched the node of the first issue."""
    parts = error.issues[0].path.split("/") if error.issues else []
    if len(parts) < 3 or parts[1] != "nodes":
        return None
    node_id = parts[2].replace("~1", "/").replace("~0", "~")
    for index in reversed(range(len(applied))):
        if any(touch.node_id == node_id for touch in applied[index].touched):
            return index
    return None
