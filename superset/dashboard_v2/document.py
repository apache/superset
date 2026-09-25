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
Pure helpers for the persisted Dashboard v2 document.

The whole document — every node with its props inline — lives under
``json_metadata["v2_document"]``. A node with a ``children`` array is a
container; every other node is a leaf widget whose ``type`` names a registered
widget type. A block is addressed by its node id.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from superset.utils import json

V2_DOCUMENT_KEY = "v2_document"
DOCUMENT_VERSION = 1
ROOT_ID = "root"

_NODE_KEYS = ("type", "layout", "children", "props", "style")


class DocumentValidationError(ValueError):
    """The submitted v2 document is malformed."""


@dataclass(frozen=True)
class LeafWidget:
    node_id: str
    widget_type: str
    props: dict[str, Any]


def is_container(node: dict[str, Any]) -> bool:
    return isinstance(node.get("children"), list)


def load_stored_document(json_metadata: Any) -> dict[str, Any] | None:
    """The stored document from a dashboard's ``json_metadata``, or ``None``
    when the dashboard is not a v2 dashboard."""
    if not isinstance(json_metadata, str):
        return None
    try:
        metadata = json.loads(json_metadata or "{}")
    except json.JSONDecodeError:
        return None
    document = metadata.get(V2_DOCUMENT_KEY) if isinstance(metadata, dict) else None
    if not isinstance(document, dict) or not isinstance(document.get("nodes"), dict):
        return None
    return document


def normalize_document(document: Any) -> tuple[dict[str, Any], list[LeafWidget]]:
    """
    Validate a submitted document and return the version to store (unknown
    node keys dropped) plus its leaf widgets, for registry validation.
    """
    if not isinstance(document, dict) or not isinstance(document.get("nodes"), dict):
        raise DocumentValidationError("document.nodes must be an object")
    nodes: dict[str, Any] = document["nodes"]
    root = nodes.get(ROOT_ID)
    if not isinstance(root, dict) or not is_container(root):
        raise DocumentValidationError("document must contain a root container")

    stored: dict[str, dict[str, Any]] = {}
    leaves: list[LeafWidget] = []
    for node_id, node in nodes.items():
        if not isinstance(node, dict) or not isinstance(node.get("type"), str):
            raise DocumentValidationError(
                f"node {node_id!r} must be an object with a string type"
            )
        props = node.get("props")
        if props is not None and not isinstance(props, dict):
            raise DocumentValidationError(f"node {node_id!r} props must be an object")
        if is_container(node):
            if unknown := [child for child in node["children"] if child not in nodes]:
                raise DocumentValidationError(
                    f"node {node_id!r} references unknown children {unknown}"
                )
        else:
            leaves.append(LeafWidget(node_id, node["type"], props or {}))
        stored[node_id] = {key: node[key] for key in _NODE_KEYS if key in node}

    return {"version": DOCUMENT_VERSION, "nodes": stored}, leaves


def write_stored_document(json_metadata: Any, stored: dict[str, Any]) -> str:
    """``json_metadata`` with the v2 document replaced, other keys untouched."""
    try:
        metadata = json.loads(str(json_metadata) if json_metadata else "{}")
    except json.JSONDecodeError:
        metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}
    metadata[V2_DOCUMENT_KEY] = stored
    return json.dumps(metadata)
