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
"""Targeted edits to a CDL tree, addressed by stable node id.

This is why nodes carry ids: an agent can restyle, move, replace or remove a
single node instead of regenerating the whole canvas (which silently drifts the
parts nobody asked to change).
"""

from __future__ import annotations

import copy
from collections.abc import Iterator
from typing import Any

Node = dict[str, Any]


def _walk(node: Node, parent: Node | None = None) -> Iterator[tuple[Node, Node | None]]:
    """Yield (node, parent) for the tree, depth-first."""
    yield node, parent
    for child in node.get("children") or []:
        yield from _walk(child, node)


def find_node(tree: Node, node_id: str) -> tuple[Node | None, Node | None]:
    """Return (node, parent) for `node_id`; (None, None) when absent."""
    for node, parent in _walk(tree):
        if node.get("id") == node_id:
            return node, parent
    return None, None


def _detach(tree: Node, node_id: str) -> Node | None:
    node, parent = find_node(tree, node_id)
    if node is None or parent is None:
        return None
    parent["children"] = [c for c in parent.get("children") or [] if c is not node]
    return node


def _insert_into(
    parent: Node,
    node: Node,
    before: str | None,
    after: str | None,
    index: int | None,
) -> None:
    children = parent.setdefault("children", [])
    position = len(children)
    if index is not None:
        position = max(0, min(index, len(children)))
    elif before is not None:
        position = next(
            (i for i, c in enumerate(children) if c.get("id") == before), len(children)
        )
    elif after is not None:
        position = next(
            (i + 1 for i, c in enumerate(children) if c.get("id") == after),
            len(children),
        )
    children.insert(position, node)


def apply_ops(  # noqa: C901
    definition: Node, ops: list[dict[str, Any]]
) -> tuple[Node, list[str]]:
    """Apply patch ops to a CDL definition.

    Returns (new_definition, errors). The input is never mutated; on any error
    the caller should discard the result rather than persist a partial edit.
    """
    updated = copy.deepcopy(definition)
    tree = updated.get("tree")
    errors: list[str] = []
    if not isinstance(tree, dict):
        return updated, ["definition.tree is missing or not an object"]

    for i, op in enumerate(ops):
        path = f"ops[{i}]"
        kind = op.get("op")
        node_id = op.get("id")
        if not kind:
            errors.append(f"{path}: 'op' is required")
            continue
        if not node_id:
            errors.append(f"{path}: 'id' is required")
            continue

        target, parent = find_node(tree, node_id)

        # `insert` addresses the PARENT, so it is the one op that tolerates a
        # target that is not itself being edited.
        if kind == "insert":
            new_node = op.get("node")
            if not isinstance(new_node, dict):
                errors.append(f"{path}: 'node' object is required for insert")
            elif target is None:
                errors.append(f"{path}: no parent node with id {node_id!r}")
            else:
                _insert_into(
                    target,
                    new_node,
                    op.get("before"),
                    op.get("after"),
                    op.get("index"),
                )
            continue

        if target is None:
            errors.append(f"{path}: no node with id {node_id!r}")
            continue

        if kind == "setStyle":
            style = op.get("style") or {}
            if op.get("merge", True):
                target["style"] = {**(target.get("style") or {}), **style}
            else:
                target["style"] = dict(style)
        elif kind == "setProps":
            props = op.get("props") or {}
            if op.get("merge", True):
                target["props"] = {**(target.get("props") or {}), **props}
            else:
                target["props"] = dict(props)
        elif kind == "setOption":
            option = op.get("option") or {}
            if op.get("merge", True):
                target["option"] = {**(target.get("option") or {}), **option}
            else:
                target["option"] = dict(option)
        elif kind == "remove":
            if parent is None:
                errors.append(f"{path}: cannot remove the root node")
                continue
            _detach(tree, node_id)
        elif kind == "replace":
            node = op.get("node")
            if not isinstance(node, dict):
                errors.append(f"{path}: 'node' object is required for replace")
                continue
            if parent is None:
                updated["tree"] = node
                tree = node
                continue
            children = parent.get("children") or []
            parent["children"] = [node if c is target else c for c in children]
        elif kind == "move":
            if parent is None:
                errors.append(f"{path}: cannot move the root node")
                continue
            new_parent_id = op.get("parent")
            before, after, index = op.get("before"), op.get("after"), op.get("index")
            if new_parent_id:
                new_parent, _ = find_node(tree, new_parent_id)
                if new_parent is None:
                    errors.append(f"{path}: no parent node with id {new_parent_id!r}")
                    continue
            else:
                # Default to reordering within the current parent.
                new_parent = parent
            if before is None and after is None and index is None:
                errors.append(f"{path}: move needs one of 'before', 'after', 'index'")
                continue
            detached = _detach(tree, node_id)
            if detached is None:
                errors.append(f"{path}: could not detach {node_id!r}")
                continue
            _insert_into(new_parent, detached, before, after, index)
        else:
            errors.append(f"{path}: unknown op {kind!r}")

    return updated, errors
