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
Whole-canvas validation and normalization.

Checks the envelope, tree integrity, each widget's nesting rules, each
child's layout under its parent and inline props, and resolves grid
collisions.

A placement whose widget doesn't resolve (see ``placements``) is kept as an
unresolved placeholder: it and its children stay as stored, so the rest of the
canvas can still be edited. Whether a persisted instance may be placed is
checked by the caller.

Widgets' behavior (nesting, sizes, child layouts, filter roles) can change
after a canvas is saved. With ``strict_nodes`` given, only those placements
are checked against it; the others keep their stored placement, so a
tightened rule never blocks edits elsewhere. Inline props are validated where
they were written (``props_nodes``), so a write can't introduce an error but
never fails over props it didn't touch. Tree integrity is always checked.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError
from superset_core.canvas import GridPlacement, InstanceResolver
from superset_core.widgets import Widget

from superset.canvas.definition.grid import resolve_grid, span_errors
from superset.canvas.definition.placements import (
    placement_widgets,
    upgrade_inline_props,
)
from superset.canvas.definition.registry import (
    get_instance_resolver,
    get_widgets,
    WidgetRegistry,
)
from superset.canvas.definition.schemas import (
    CanvasDefinition,
    ROOT_ID,
    SCOPE_FIELDS,
)

# The behavior a placement needs to own each kind of scope override.
SCOPE_ROLES = {
    "filter": ("filter", "a filter"),
    "crossFilter": ("emits_filters", "a cross-filter source"),
    "customization": ("customization", "a customization"),
}


@dataclass(frozen=True)
class Issue:
    path: str
    message: str


class DefinitionValidationError(ValueError):
    def __init__(self, issues: list[Issue]) -> None:
        self.issues = issues
        super().__init__("; ".join(f"{i.path}: {i.message}" for i in issues))


def pointer(*parts: object) -> str:
    return "/" + "/".join(
        str(part).replace("~", "~0").replace("/", "~1") for part in parts
    )


def request_pointer(loc: tuple[int | str, ...]) -> str:
    """
    A request validation error's location as a JSON pointer into the body.

    Pydantic puts the matched op tag after an op's index (``ops/0/add/layout``);
    the body has no such level.
    """
    parts = list(loc)
    if len(parts) > 2 and parts[0] == "ops" and isinstance(parts[1], int):
        del parts[2]
    return pointer(*parts)


def _pydantic_issues(prefix: tuple[object, ...], ex: ValidationError) -> list[Issue]:
    return [
        Issue(pointer(*prefix, *error["loc"]), error["msg"]) for error in ex.errors()
    ]


class _EmptyLayout(BaseModel):
    model_config = {"extra": "forbid"}


class _Validator:
    def __init__(
        self,
        raw: dict[str, Any],
        widgets: WidgetRegistry,
        resolver: InstanceResolver,
        strict_nodes: Iterable[str] | None,
        props_nodes: Iterable[str] | None,
    ) -> None:
        self.raw = raw
        self.widgets = widgets
        self.resolver = resolver
        self.strict = None if strict_nodes is None else set(strict_nodes)
        self.props_nodes = None if props_nodes is None else set(props_nodes)
        self.issues: list[Issue] = []
        self.parents: dict[str, str] = {}
        self.node_widgets: dict[str, type[Widget]] = {}
        self.unresolved: set[str] = set()

    def fail(self, path: str, message: str) -> None:
        self.issues.append(Issue(path, message))

    def is_strict(self, node_id: str) -> bool:
        return self.strict is None or node_id in self.strict

    def wrote_props(self, node_id: str) -> bool:
        return self.props_nodes is None or node_id in self.props_nodes

    def widget_id(self, node_id: str) -> str:
        return self.node_widgets[node_id].widget_type

    def run(self) -> dict[str, Any]:
        try:
            canvas = CanvasDefinition.model_validate(self.raw)
        except ValidationError as ex:
            raise DefinitionValidationError(_pydantic_issues((), ex)) from ex
        doc = canvas.model_dump(mode="json", by_alias=True, exclude_none=True)
        upgrade_inline_props(doc, self.widgets)

        self._check_tree(doc)
        self._check_widgets(doc)
        self._check_nesting()
        self._check_interactions(doc)
        self._check_settings(doc)
        if not self.issues:
            self._resolve_layouts(doc)
        if self.issues:
            raise DefinitionValidationError(self.issues)
        return doc

    def _children_of(self, doc: dict[str, Any], parent_id: str) -> list[str]:
        if parent_id == ROOT_ID:
            return doc["root"]["children"]
        return doc["nodes"][parent_id].get("children") or []

    def _check_tree(self, doc: dict[str, Any]) -> None:
        nodes = doc["nodes"]
        containers = [ROOT_ID, *(i for i, n in nodes.items() if "children" in n)]
        for parent_id in containers:
            for index, child_id in enumerate(self._children_of(doc, parent_id)):
                path = (
                    pointer("root", "children", index)
                    if parent_id == ROOT_ID
                    else pointer("nodes", parent_id, "children", index)
                )
                if child_id not in nodes:
                    self.fail(path, f"unknown node {child_id!r}")
                elif child_id in self.parents:
                    self.fail(path, f"node {child_id!r} has more than one parent")
                else:
                    self.parents[child_id] = parent_id

        # Every node has one parent, so any node the root cannot reach sits on
        # a cycle or is an orphan.
        reachable: set[str] = set()
        stack = list(doc["root"]["children"])
        while stack:
            node_id = stack.pop()
            if node_id in reachable or node_id not in nodes:
                continue
            reachable.add(node_id)
            stack.extend(nodes[node_id].get("children") or [])
        for node_id in nodes:
            if node_id not in reachable:
                self.fail(pointer("nodes", node_id), "not reachable from the root")

    def _check_widgets(self, doc: dict[str, Any]) -> None:
        nodes = doc["nodes"]
        resolved = placement_widgets(nodes, self.widgets, self.resolver)
        # An instance may be placed more than once; everything the canvas
        # tracks (placement, scopes, values) is keyed by placement.
        for node_id, node in nodes.items():
            widget = resolved.get(node_id)
            if widget is not None and (
                widget.behavior.container or not node.get("children")
            ):
                self.node_widgets[node_id] = widget
                if widget.behavior.container:
                    node.setdefault("children", [])
                else:
                    node.pop("children", None)
                if "widget" in node and self.wrote_props(node_id):
                    self._check_props(node_id, widget, node["props"])
                continue
            self.unresolved.add(node_id)
            if "widget" in node and self.wrote_props(node_id):
                self.fail(
                    pointer("nodes", node_id, "widget"),
                    f"unknown widget {node['widget']!r}, or props at a schema "
                    "version it doesn't support",
                )

    def _check_props(
        self, node_id: str, widget: type[Widget], props: dict[str, Any]
    ) -> None:
        for error in widget.validate_control_values(props):
            self.fail(
                pointer("nodes", node_id, "props", *error["loc"]), error["message"]
            )

    def _check_nesting(self) -> None:
        for node_id, parent_id in self.parents.items():
            widget = self.node_widgets.get(node_id)
            if widget is None or not self.is_strict(node_id):
                continue
            accepted: frozenset[str] | None = None
            if parent_id == ROOT_ID:
                parent_type = ROOT_ID
            elif parent_id in self.node_widgets:
                parent_type = self.widget_id(parent_id)
                accepted = self.node_widgets[parent_id].behavior.accepted_children
            else:
                continue
            widget_type = widget.widget_type
            allowed_parents = widget.behavior.allowed_parents
            allowed = (accepted is None or widget_type in accepted) and (
                allowed_parents is None or parent_type in allowed_parents
            )
            if not allowed:
                self.fail(
                    pointer("nodes", node_id),
                    f"a {widget_type} widget cannot be placed in {parent_type}",
                )

    def _check_interactions(self, doc: dict[str, Any]) -> None:
        nodes = doc["nodes"]
        for kind, field_name in SCOPE_FIELDS.items():
            role, noun = SCOPE_ROLES[kind]
            for owner_id, scope in doc["interactions"][field_name].items():
                path = ("interactions", field_name, owner_id)
                if owner_id not in nodes:
                    self.fail(pointer(*path), f"unknown node {owner_id!r}")
                    continue
                strict = self.is_strict(owner_id)
                owner = self.node_widgets.get(owner_id)
                if strict and owner is not None and not getattr(owner.behavior, role):
                    self.fail(pointer(*path), f"node {owner_id!r} is not {noun}")
                for field in ("targets", "exclude"):
                    for index, target in enumerate(scope[field]):
                        target_widget = self.node_widgets.get(target)
                        if target not in nodes:
                            self.fail(
                                pointer(*path, field, index),
                                f"unknown node {target!r}",
                            )
                        elif (
                            strict
                            and target_widget is not None
                            and not target_widget.behavior.filterable
                        ):
                            self.fail(
                                pointer(*path, field, index),
                                f"node {target!r} cannot be filtered",
                            )

    def _check_settings(self, doc: dict[str, Any]) -> None:
        exempt = doc["settings"]["refresh"]["exempt"]
        for index, node_id in enumerate(exempt):
            if node_id not in doc["nodes"]:
                self.fail(
                    pointer("settings", "refresh", "exempt", index),
                    f"unknown node {node_id!r}",
                )

    def _resolve_layouts(self, doc: dict[str, Any]) -> None:
        self._resolve_children(doc, ROOT_ID, doc["root"]["layout"]["columns"], None)
        for node_id, widget in self.node_widgets.items():
            if widget.behavior.container:
                self._resolve_children(
                    doc,
                    node_id,
                    widget.behavior.grid_columns,
                    widget.behavior.child_layout_model or _EmptyLayout,
                )

    def _resolve_children(
        self,
        doc: dict[str, Any],
        parent_id: str,
        columns: int | None,
        child_model: type[BaseModel] | None,
    ) -> None:
        children = self._children_of(doc, parent_id)
        model = GridPlacement if columns is not None else child_model
        assert model is not None  # noqa: S101
        layouts: list[dict[str, Any]] = []
        # Children whose stored layout no longer fits a changed rule, kept as
        # stored and auto-placed when resolving the grid.
        kept: set[str] = set()
        for child_id in children:
            layout_path = ("nodes", child_id, "layout")
            strict = self.is_strict(child_id)
            try:
                layout = model.model_validate(
                    doc["nodes"][child_id]["layout"]
                ).model_dump(mode="json", by_alias=True, exclude_none=True)
            except ValidationError as ex:
                if strict:
                    self.issues.extend(_pydantic_issues(layout_path, ex))
                    continue
                kept.add(child_id)
                layouts.append({})
                continue
            if columns is not None and strict:
                for message in [
                    *span_errors(layout, columns),
                    *self._size_errors(child_id, layout, columns),
                ]:
                    self.fail(pointer(*layout_path), message)
            layouts.append(layout)
            doc["nodes"][child_id]["layout"] = layout

        if columns is not None and len(layouts) == len(children):
            _, stored = resolve_grid(layouts, columns)
            for child_id, layout in zip(children, stored, strict=True):
                if child_id not in kept:
                    doc["nodes"][child_id]["layout"] = layout

    def _size_errors(
        self, node_id: str, layout: dict[str, Any], columns: int
    ) -> list[str]:
        widget = self.node_widgets.get(node_id)
        if widget is None:
            return []
        ui = widget.ui
        errors = []
        spans = {
            "colSpan": (
                layout.get("colSpan") or columns,
                ui.min_col_span,
                ui.max_col_span,
            ),
            "rowSpan": (
                layout.get("rowSpan") or 1,
                ui.min_row_span,
                ui.max_row_span,
            ),
        }
        for name, (span, minimum, maximum) in spans.items():
            if minimum is not None and span < minimum:
                errors.append(f"{name} {span} is below the minimum of {minimum}")
            if maximum is not None and span > maximum:
                errors.append(f"{name} {span} is above the maximum of {maximum}")
        return errors


def normalize_definition(
    raw: dict[str, Any],
    widgets: WidgetRegistry | None = None,
    resolver: InstanceResolver | None = None,
    strict_nodes: Iterable[str] | None = None,
    props_nodes: Iterable[str] | None = None,
) -> dict[str, Any]:
    """
    Validate ``raw`` and return the normalized canvas to store.

    ``strict_nodes`` limits the widget behavior checks to those placements, and
    ``props_nodes`` the inline props checks; ``None`` checks every placement.
    Raises ``DefinitionValidationError`` listing every problem found, each
    with a JSON-pointer path into the canvas.
    """
    return _Validator(
        raw,
        get_widgets() if widgets is None else widgets,
        resolver or get_instance_resolver(),
        strict_nodes,
        props_nodes,
    ).run()
