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
Progressive-disclosure helpers over a control JSON Schema.

Shared by the REST API and the MCP tools so the two never diverge. Pure
functions over the dict a ``WidgetControls.get_control_schema`` returns (which
may carry ``x-dynamic`` enrichment and ``$defs``).

- ``prune_to_minimal_viable`` — the **minimum viable object** an agent can fill
  in one shot: mandatory properties expanded down to their leaves (descending
  into mandatory nested objects), every optional/nested branch replaced by an
  opaque ``x-collapsed`` drill-in marker (carrying an ``x-path``). The root is
  tagged ``x-disclosure: "minimal"`` so the consumer knows this is partial —
  only mandatory nested leaves are present; optional branches must be fetched
  with ``get_subtree``.
- ``get_subtree`` — resolve a ``a/b`` path against the fully-enriched schema and
  return that node re-rooted as a self-contained schema (all ``$ref`` inlined).
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


class SchemaPathError(KeyError):
    """Raised when a drill-in ``path`` cannot be resolved against a schema."""


def _defs(root: dict[str, Any]) -> dict[str, Any]:
    return root.get("$defs", {}) or {}


def _deref(root: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    """Resolve a node's single ``$ref`` (optionally wrapped in a one-element
    ``allOf``) against ``root['$defs']``, merging any sibling keys. Non-ref
    nodes are returned unchanged. Not recursive — resolves one level."""
    ref: str | None = None
    extras: dict[str, Any] = {}
    if "$ref" in node:
        ref = node["$ref"]
        extras = {k: v for k, v in node.items() if k != "$ref"}
    elif (
        isinstance(node.get("allOf"), list)
        and len(node["allOf"]) == 1
        and isinstance(node["allOf"][0], dict)
        and "$ref" in node["allOf"][0]
    ):
        ref = node["allOf"][0]["$ref"]
        extras = {k: v for k, v in node.items() if k != "allOf"}
    if ref is None:
        return node
    target = deepcopy(_defs(root).get(ref.split("/")[-1], {}))
    target.update(extras)
    return target


def _is_object(node: dict[str, Any]) -> bool:
    return (
        node.get("type") == "object"
        or "properties" in node
        or "additionalProperties" in node
    )


def _is_collapsible(root: dict[str, Any], node: dict[str, Any]) -> bool:
    """Whether an optional branch is worth hiding behind a drill-in marker.

    Only nested objects — and arrays of objects — are: their sub-fields can be
    many or large, so inlining them would bloat the first fetch. Cheap leaves
    (scalars, enums, arrays of scalars) are small and have nothing to drill
    into, so they're inlined instead of costing an extra round trip.
    """
    if _is_object(node):
        return True
    if node.get("type") == "array":
        items = node.get("items")
        if isinstance(items, dict):
            return _is_object(_deref(root, items))
    return False


def _inline(root: dict[str, Any], node: Any) -> Any:
    """Recursively resolve every ``$ref`` against ``root['$defs']`` and drop
    ``$defs``, returning a self-contained schema fragment."""
    if isinstance(node, dict):
        if "$ref" in node:
            target = _defs(root).get(node["$ref"].split("/")[-1], {})
            merged = {**target, **{k: v for k, v in node.items() if k != "$ref"}}
            return _inline(root, merged)
        return {k: _inline(root, v) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline(root, item) for item in node]
    return node


def _contains_dynamic(node: Any) -> bool:
    """Whether a schema fragment has any ``x-dynamic`` content anywhere inside.

    ``x-dynamic`` marks a field whose shape/enum is derived from the current
    query or control values (e.g. per-series styling keyed by the discovered
    dimension values). A collapsed branch containing such a field expands
    differently as the query changes; a branch without one is stable.
    """
    if isinstance(node, dict):
        if node.get("x-dynamic"):
            return True
        return any(_contains_dynamic(value) for value in node.values())
    if isinstance(node, list):
        return any(_contains_dynamic(item) for item in node)
    return False


def _collapse(root: dict[str, Any], node: dict[str, Any], path: str) -> dict[str, Any]:
    """An opaque drill-in marker for an optional/nested branch.

    Keeps the field's own (terse) description/title as a human summary, but
    never inlines its child ``properties`` — those are what a consumer must
    fetch on drill-in via ``get_subtree``. Only the summary, type, and
    ``x-path`` are exposed here, so the shape of the sub-fields stays hidden
    until explicitly requested.

    Marks the branch ``x-dynamic: true`` when its subtree's shape depends on the
    current query/values (so the consumer knows to pass ``control_values`` /
    ``series`` when expanding it, and to re-fetch it when the query changes).
    A branch without that flag is static: expand it once and it won't change.
    """
    resolved = _deref(root, node)
    description = (
        node.get("description")
        or resolved.get("description")
        or resolved.get("title")
        or ""
    )
    marker: dict[str, Any] = {
        "type": resolved.get("type", "object"),
        "x-collapsed": True,
        "x-path": path,
    }
    if description:
        marker["description"] = description
    if _contains_dynamic(_inline(root, resolved)):
        marker["x-dynamic"] = True
    return marker


def _prune_object(
    root: dict[str, Any], node: dict[str, Any], prefix: str
) -> dict[str, Any]:
    node = _deref(root, node)
    properties: dict[str, Any] = node.get("properties", {})
    required = set(node.get("required", []))

    out_properties: dict[str, Any] = {}
    collapsed_any = False
    for name, prop in properties.items():
        path = f"{prefix}/{name}" if prefix else name
        if name in required:
            resolved = _deref(root, prop)
            if _is_object(resolved):
                # Mandatory nested object: descend to surface its own mandatory
                # leaves (recursive minimum-viable).
                out_properties[name] = _prune_object(root, resolved, path)
            else:
                # Mandatory leaf (scalar / array / enum): inline it whole.
                out_properties[name] = _inline(root, prop)
        else:
            resolved = _deref(root, prop)
            if _is_collapsible(root, resolved):
                # Optional object / array-of-objects: hide behind a drill-in.
                out_properties[name] = _collapse(root, prop, path)
                collapsed_any = True
            else:
                # Optional cheap leaf: inline it — small, and nothing to drill.
                out_properties[name] = _inline(root, prop)

    result: dict[str, Any] = {"type": "object", "properties": out_properties}
    for key in ("title", "description", "required"):
        if key in node:
            result[key] = node[key]
    # Signal that some optional children were withheld (collapsed) from this
    # object, so the consumer knows it is a partial view.
    if collapsed_any:
        result["x-partial"] = True
    return result


def prune_to_minimal_viable(schema: dict[str, Any]) -> dict[str, Any]:
    """Return the minimum-viable-object view of a control schema (see module
    docstring). The input is not mutated."""
    result = _prune_object(schema, schema, prefix="")
    result["x-disclosure"] = "minimal"
    return result


def _navigate(root: dict[str, Any], path: str) -> dict[str, Any]:
    """Walk a ``a/b`` (or ``a.b``) path through ``properties`` /
    ``additionalProperties``, dereferencing along the way."""
    node: dict[str, Any] = root
    segments = [seg for seg in path.replace(".", "/").split("/") if seg]
    for segment in segments:
        node = _deref(root, node)
        properties = node.get("properties", {})
        if segment in properties:
            node = properties[segment]
        elif isinstance(node.get("additionalProperties"), dict):
            # A dynamic map (e.g. `series`): any key resolves to the item shape.
            node = node["additionalProperties"]
        else:
            raise SchemaPathError(
                f"Path segment {segment!r} not found in schema path {path!r}"
            )
    return node


def get_subtree(schema: dict[str, Any], path: str) -> dict[str, Any]:
    """Resolve ``path`` against ``schema`` and return that node as a
    self-contained schema (``$ref`` inlined). Raises ``SchemaPathError`` for an
    unresolvable path. The input is not mutated."""
    if not path or not path.strip("/. "):
        return _inline(schema, dict(schema))
    node = _navigate(schema, path)
    return _inline(schema, node)


def get_subtrees(schema: dict[str, Any], paths: list[str]) -> dict[str, Any]:
    """Resolve several drill-in ``paths`` in one pass, returning a
    ``{path: subtree}`` map (each subtree self-contained, ``$ref`` inlined).

    Lets a consumer expand multiple collapsed branches in a single round trip
    instead of one call per branch. Raises ``SchemaPathError`` naming the first
    unresolvable path. The input is not mutated."""
    return {path: get_subtree(schema, path) for path in paths}
