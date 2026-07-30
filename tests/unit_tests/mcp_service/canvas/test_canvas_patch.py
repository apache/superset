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
"""Unit tests for targeted CDL patch operations."""

from copy import deepcopy
from typing import Any

from superset.mcp_service.canvas.patch import apply_ops, find_node
from superset.mcp_service.canvas.validation import validate_cdl


def _definition() -> dict[str, Any]:
    return {
        "cdlVersion": 2,
        "variables": {},
        "tree": {
            "id": "root",
            "type": "Column",
            "children": [
                {
                    "id": "a",
                    "type": "Markdown",
                    "props": {"text": "A"},
                    "style": {"color": "#fff"},
                },
                {"id": "b", "type": "Markdown", "props": {"text": "B"}},
                {"id": "c", "type": "Markdown", "props": {"text": "C"}},
            ],
        },
    }


def _order(definition: dict[str, Any]) -> list[str]:
    return [child["id"] for child in definition["tree"]["children"]]


def test_set_style_merges_by_default() -> None:
    updated, errors = apply_ops(
        _definition(),
        [{"op": "setStyle", "id": "a", "style": {"background": "@colorBgContainer"}}],
    )
    assert errors == []
    node, _ = find_node(updated["tree"], "a")
    assert node is not None
    assert node["style"] == {"color": "#fff", "background": "@colorBgContainer"}


def test_set_style_replaces_when_merge_false() -> None:
    updated, errors = apply_ops(
        _definition(),
        [
            {
                "op": "setStyle",
                "id": "a",
                "style": {"padding": "8px"},
                "merge": False,
            }
        ],
    )
    assert errors == []
    node, _ = find_node(updated["tree"], "a")
    assert node is not None
    assert node["style"] == {"padding": "8px"}


def test_move_reorders_within_parent() -> None:
    updated, errors = apply_ops(
        _definition(), [{"op": "move", "id": "c", "before": "a"}]
    )
    assert errors == []
    assert _order(updated) == ["c", "a", "b"]


def test_remove_and_insert() -> None:
    updated, errors = apply_ops(
        _definition(),
        [
            {"op": "remove", "id": "b"},
            {
                "op": "insert",
                "id": "root",
                "node": {"id": "z", "type": "Divider"},
                "after": "a",
            },
        ],
    )
    assert errors == []
    assert _order(updated) == ["a", "z", "c"]


def test_replace_swaps_a_node() -> None:
    updated, errors = apply_ops(
        _definition(),
        [
            {
                "op": "replace",
                "id": "b",
                "node": {"id": "b", "type": "Markdown", "props": {"text": "new"}},
            }
        ],
    )
    assert errors == []
    node, _ = find_node(updated["tree"], "b")
    assert node is not None
    assert node["props"]["text"] == "new"


def test_input_definition_is_never_mutated() -> None:
    definition = _definition()
    snapshot = deepcopy(definition)
    apply_ops(definition, [{"op": "move", "id": "c", "before": "a"}])
    assert definition == snapshot


def test_errors_for_unknown_id_and_op() -> None:
    _, errors = apply_ops(
        _definition(), [{"op": "setStyle", "id": "nope", "style": {}}]
    )
    assert any("no node with id" in e for e in errors)

    _, errors = apply_ops(_definition(), [{"op": "bogus", "id": "a"}])
    assert any("unknown op" in e for e in errors)


def test_move_requires_a_target_position() -> None:
    _, errors = apply_ops(_definition(), [{"op": "move", "id": "a"}])
    assert any("needs one of" in e for e in errors)


def test_root_cannot_be_removed() -> None:
    _, errors = apply_ops(_definition(), [{"op": "remove", "id": "root"}])
    assert any("cannot remove the root" in e for e in errors)


def test_patched_tree_still_validates() -> None:
    updated, _ = apply_ops(_definition(), [{"op": "move", "id": "c", "before": "a"}])
    assert validate_cdl(updated) == []
