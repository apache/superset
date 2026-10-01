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

Checks the envelope, tree integrity, that every widget is placed only once, the
nesting rules of widget types, each child's layout under its parent, and
resolves grid collisions.

A node whose widget no longer exists, or whose container type is no longer
registered (e.g. its extension was removed), is kept as an unresolved
placeholder: it and its children stay as stored, so the rest of the canvas can
still be edited. Whether a new widget may be placed is checked by the caller.

Widget types' rules (nesting, sizes, child layouts, filter roles) can change
after a canvas is saved. With ``strict_nodes`` given, only those nodes are
checked against the rules; the others keep their stored placement, so a
tightened rule never blocks edits elsewhere. Tree integrity is always checked.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError
from superset_core.canvas import CanvasLayoutRules, GridPlacement, WidgetResolver

from superset.canvas.definition.grid import resolve_grid, span_errors
from superset.canvas.definition.registry import (
    get_widget_resolver,
    layout_rules,
    LayoutRulesRegistry,
)
from superset.canvas.definition.schemas import (
    CanvasDefinition,
    ROOT_ID,
    SCOPE_FIELDS,
)

# The layout rule a node needs to own each kind of scope override.
SCOPE_ROLES = {
    "filter": ("is_filter", "a filter"),
    "crossFilter": ("is_cross_filter_source", "a cross-filter source"),
    "customization": ("is_customization", "a customization"),
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
        rules: LayoutRulesRegistry,
        resolver: WidgetResolver,
        strict_nodes: Iterable[str] | None,
    ) -> None:
        self.raw = raw
        self.rules = rules
        self.resolver = resolver
        self.strict = None if strict_nodes is None else set(strict_nodes)
        self.issues: list[Issue] = []
        self.parents: dict[str, str] = {}
        self.node_rules: dict[str, type[CanvasLayoutRules]] = {}
        self.node_types: dict[str, str] = {}
        self.unresolved: set[str] = set()

    def fail(self, path: str, message: str) -> None:
        self.issues.append(Issue(path, message))

    def is_strict(self, node_id: str) -> bool:
        return self.strict is None or node_id in self.strict

    def run(self) -> dict[str, Any]:
        try:
            canvas = CanvasDefinition.model_validate(self.raw)
        except ValidationError as ex:
            raise DefinitionValidationError(_pydantic_issues((), ex)) from ex
        doc = canvas.model_dump(mode="json", by_alias=True, exclude_none=True)

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
        types = self.resolver.widget_types({node["widget"] for node in nodes.values()})
        placed: dict[str, str] = {}
        for node_id, node in nodes.items():
            widget_id = node["widget"]
            path = pointer("nodes", node_id, "widget")
            if widget_id in placed:
                self.fail(path, f"widget {widget_id!r} is already placed")
                continue
            placed[widget_id] = node_id
            widget_type = types.get(widget_id)
            if widget_type is None:
                self.unresolved.add(node_id)
                continue
            rules = self.rules.get(widget_type)
            if not rules.is_container and node.get("children"):
                self.unresolved.add(node_id)
                continue
            self.node_rules[node_id] = rules
            self.node_types[node_id] = widget_type
            if rules.is_container:
                node.setdefault("children", [])
            else:
                node.pop("children", None)

    def _check_nesting(self) -> None:
        for node_id, parent_id in self.parents.items():
            rules = self.node_rules.get(node_id)
            if rules is None or not self.is_strict(node_id):
                continue
            accepted: frozenset[str] | None = None
            if parent_id == ROOT_ID:
                parent_type = ROOT_ID
            elif parent_id in self.node_rules:
                parent_type = self.node_types[parent_id]
                accepted = self.node_rules[parent_id].accepted_children
            else:
                continue
            widget_type = self.node_types[node_id]
            allowed = (accepted is None or widget_type in accepted) and (
                rules.allowed_parents is None or parent_type in rules.allowed_parents
            )
            if not allowed:
                self.fail(
                    pointer("nodes", node_id, "widget"),
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
                rules = self.node_rules.get(owner_id)
                if strict and rules is not None and not getattr(rules, role):
                    self.fail(pointer(*path), f"node {owner_id!r} is not {noun}")
                for field in ("targets", "exclude"):
                    for index, target in enumerate(scope[field]):
                        target_rules = self.node_rules.get(target)
                        if target not in nodes:
                            self.fail(
                                pointer(*path, field, index),
                                f"unknown node {target!r}",
                            )
                        elif (
                            strict
                            and target_rules is not None
                            and not target_rules.is_filterable
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
        for node_id, rules in self.node_rules.items():
            if rules.is_container:
                self._resolve_children(
                    doc,
                    node_id,
                    rules.grid_columns,
                    rules.child_layout_model or _EmptyLayout,
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
        rules = self.node_rules.get(node_id)
        if rules is None:
            return []
        errors = []
        spans = {
            "colSpan": (
                layout.get("colSpan") or columns,
                rules.min_col_span,
                rules.max_col_span,
            ),
            "rowSpan": (
                layout.get("rowSpan") or 1,
                rules.min_row_span,
                rules.max_row_span,
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
    rules: LayoutRulesRegistry | None = None,
    resolver: WidgetResolver | None = None,
    strict_nodes: Iterable[str] | None = None,
) -> dict[str, Any]:
    """
    Validate ``raw`` and return the normalized canvas to store.

    ``strict_nodes`` limits the widget rule checks to those nodes; ``None``
    checks every node. Raises ``DefinitionValidationError`` listing every
    problem found, each with a JSON-pointer path into the canvas.
    """
    return _Validator(
        raw, rules or layout_rules, resolver or get_widget_resolver(), strict_nodes
    ).run()
