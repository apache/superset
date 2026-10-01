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
from typing import Any

import pytest

from superset.canvas.definition.ops import (
    AppliedOperation,
    apply_operations,
    FieldGroup,
    OperationError,
    overlapping,
    Touch,
)
from superset.canvas.definition.registry import LayoutRulesRegistry
from superset.canvas.definition.schemas import empty_definition
from superset.canvas.definition.validation import DefinitionValidationError
from tests.unit_tests.canvas.fixtures import (
    canvas_rules,
    FakeResolver,
    ops,
    sequential_ids,
)


def apply(
    canvas: dict[str, Any], *raw: dict[str, Any]
) -> tuple[dict[str, Any], list[AppliedOperation]]:
    return apply_operations(
        canvas,
        ops(*raw),
        rules=canvas_rules(),
        resolver=FakeResolver(),
        new_id=sequential_ids(),
    )


def build(*raw: dict[str, Any]) -> dict[str, Any]:
    return apply(empty_definition(), *raw)[0]


def add(widget: str, **extra: Any) -> dict[str, Any]:
    return {"op": "add", "widget": widget, **extra}


def test_add_assigns_node_ids_and_reports_them() -> None:
    result, applied = apply(empty_definition(), add("chart-1"), add("group"))

    assert result["root"]["children"] == ["n0", "n1"]
    assert result["nodes"]["n0"] == {"widget": "chart-1", "layout": {}}
    assert result["nodes"]["n1"]["children"] == []
    assert applied[0].op["id"] == "n0"
    assert applied[0].touched == [Touch("n0", FieldGroup.TREE)]


def test_add_into_a_container_added_in_the_same_batch() -> None:
    result = build(
        add("group"),
        add("chart-1", parent="n0"),
        add("chart-2", parent="n0", index=0),
    )

    assert result["nodes"]["n0"]["children"] == ["n2", "n1"]


GROUP_ID = "6f1c2b7e-2d4a-4c1e-9a53-0f3b8d2e7a10"


def test_add_takes_a_caller_id_that_later_ops_can_reference() -> None:
    result, applied = apply(
        empty_definition(),
        add("group", id=GROUP_ID),
        add("chart-1", parent=GROUP_ID),
        {"op": "place", "id": GROUP_ID, "layout": {"colSpan": 12}},
    )

    assert result["root"]["children"] == [GROUP_ID]
    assert result["nodes"][GROUP_ID]["children"] == ["n0"]
    assert result["nodes"][GROUP_ID]["layout"]["colSpan"] == 12
    assert applied[0].op["id"] == GROUP_ID


def test_add_rejects_an_id_already_in_use() -> None:
    doc = build(add("group", id=GROUP_ID))

    with pytest.raises(OperationError, match="already exists"):
        apply(doc, add("chart-1", id=GROUP_ID))


@pytest.mark.parametrize(
    "node_id", ["root", "n0", GROUP_ID.upper(), GROUP_ID.replace("-", "")]
)
def test_add_rejects_ids_that_are_not_canonical_uuids(node_id: str) -> None:
    with pytest.raises(ValueError, match="should match pattern"):
        ops(add("chart-1", id=node_id))


def test_add_into_a_leaf_is_rejected() -> None:
    with pytest.raises(OperationError, match="'n0' cannot hold children"):
        build(add("chart-1"), add("chart-2", parent="n0"))


def changed_rules(widget_type: str, **changes: Any) -> LayoutRulesRegistry:
    """The test rules, with ``widget_type``'s rules changed after saving."""
    rules = canvas_rules()
    base = rules.get(widget_type)
    rules.unregister(widget_type)
    rules.register(type(f"Changed{base.__name__}", (base,), changes))
    return rules


def apply_with(
    rules: LayoutRulesRegistry, doc: dict[str, Any], *raw: dict[str, Any]
) -> dict[str, Any]:
    return apply_operations(
        doc, ops(*raw), rules=rules, resolver=FakeResolver(), new_id=sequential_ids()
    )[0]


def test_a_tightened_size_rule_only_applies_to_touched_nodes() -> None:
    doc = build(add("chart-1", layout={"colSpan": 24}), add("chart-2"))
    rules = changed_rules("chart", max_col_span=12)

    result = apply_with(
        rules, doc, {"op": "place", "id": "n1", "layout": {"colSpan": 6}}
    )

    assert result["nodes"]["n0"]["layout"]["colSpan"] == 24
    with pytest.raises(DefinitionValidationError, match="above the maximum of 12"):
        apply_with(rules, doc, {"op": "place", "id": "n0", "layout": {"colSpan": 24}})


def test_a_tightened_nesting_rule_only_applies_to_touched_nodes() -> None:
    doc = build(add("group"), add("chart-1", parent="n0"))
    rules = changed_rules("group", accepted_children=frozenset({"filter"}))

    result = apply_with(rules, doc, add("chart-2", id=GROUP_ID))

    assert result["nodes"]["n0"]["children"] == ["n1"]
    with pytest.raises(DefinitionValidationError, match="cannot be placed in group"):
        apply_with(rules, doc, {"op": "move", "id": "n1", "parent": "n0", "index": 0})


def test_a_layout_from_a_replaced_child_model_is_kept_as_stored() -> None:
    doc = build(add("board"), add("chart-1", parent="n0", layout={"lane": "todo"}))
    rules = changed_rules("board", child_layout_model=None, grid_columns=12)

    result = apply_with(rules, doc, add("chart-2", id=GROUP_ID))

    assert result["nodes"]["n1"]["layout"] == {"lane": "todo"}


def test_unresolved_container_keeps_its_children_but_takes_no_new_ones() -> None:
    doc = build(add("group"), add("chart-1", parent="n0"), add("chart-2"))
    # The group's widget type is no longer registered.
    unregistered, _ = apply_operations(
        doc,
        ops({"op": "place", "id": "n2", "layout": {"colSpan": 6}}),
        rules=LayoutRulesRegistry(),
        resolver=FakeResolver(),
    )

    assert unregistered["nodes"]["n0"]["children"] == ["n1"]
    with pytest.raises(OperationError, match="cannot hold children"):
        apply_operations(
            unregistered,
            ops({"op": "move", "id": "n2", "parent": "n0"}),
            rules=LayoutRulesRegistry(),
            resolver=FakeResolver(),
        )


def test_remove_drops_the_subtree() -> None:
    doc = build(add("group"), add("chart-1", parent="n0"), add("chart-2"))

    result, applied = apply(doc, {"op": "remove", "id": "n0"})

    assert set(result["nodes"]) == {"n2"}
    assert result["root"]["children"] == ["n2"]
    assert set(applied[0].touched) == {
        Touch("n0", FieldGroup.TREE),
        Touch("n1", FieldGroup.TREE),
    }


def test_move_reparents_and_resets_layout() -> None:
    doc = build(add("chart-1", layout={"col": 1, "row": 1, "colSpan": 6}), add("group"))

    result, _ = apply(doc, {"op": "move", "id": "n0", "parent": "n1"})

    assert result["root"]["children"] == ["n1"]
    assert result["nodes"]["n1"]["children"] == ["n0"]
    assert result["nodes"]["n0"]["layout"] == {}


def test_move_into_own_descendant_fails() -> None:
    doc = build(add("group-1"), add("group-2", parent="n0"))

    with pytest.raises(OperationError, match="into itself or its descendants"):
        apply(doc, {"op": "move", "id": "n0", "parent": "n1"})


def test_place_updates_layout_and_resolves_collisions() -> None:
    doc = build(
        add("chart-1", layout={"col": 1, "row": 1, "colSpan": 12, "rowSpan": 2}),
        add("chart-2", layout={"col": 13, "row": 1, "colSpan": 12}),
    )

    result, applied = apply(
        doc, {"op": "place", "id": "n1", "layout": {"col": 1, "row": 1, "colSpan": 24}}
    )

    assert result["nodes"]["n1"]["layout"] == {"col": 1, "row": 3, "colSpan": 24}
    assert applied[0].touched == [Touch("n1", FieldGroup.LAYOUT)]


def test_all_operations_apply_or_none_do() -> None:
    doc = build(add("chart-1", id=GROUP_ID))

    with pytest.raises(DefinitionValidationError):
        apply(doc, add("chart-2"), add("tab"))
    assert list(doc["nodes"]) == [GROUP_ID]


def test_unknown_node() -> None:
    with pytest.raises(OperationError, match="unknown node 'nope'"):
        build({"op": "place", "id": "nope", "layout": {}})


@pytest.mark.parametrize(
    "earlier,later,expected",
    [
        # Drags of different nodes never collide.
        ([Touch("a", FieldGroup.LAYOUT)], [Touch("b", FieldGroup.LAYOUT)], set()),
        # Two drags of the same node do.
        ([Touch("a", FieldGroup.LAYOUT)], [Touch("a", FieldGroup.LAYOUT)], {"a"}),
        # Removing or moving a node collides with any edit to it.
        ([Touch("a", FieldGroup.TREE)], [Touch("a", FieldGroup.LAYOUT)], {"a"}),
        ([Touch("a", FieldGroup.LAYOUT)], [Touch("a", FieldGroup.TREE)], {"a"}),
    ],
)
def test_overlapping(
    earlier: list[Touch], later: list[Touch], expected: set[str]
) -> None:
    assert overlapping(earlier, later) == expected
