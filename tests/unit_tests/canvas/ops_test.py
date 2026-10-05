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
import dataclasses
from typing import Any

import pytest
from superset_core.widgets import Widget, WidgetUi

from superset.canvas.definition.ops import (
    AppliedOperation,
    apply_operations,
    FieldGroup,
    named_touches,
    OperationError,
    overlapping,
    SETTINGS_ID,
    Touch,
)
from superset.canvas.definition.schemas import empty_definition
from superset.canvas.definition.validation import DefinitionValidationError
from tests.unit_tests.canvas.fixtures import (
    canvas_widgets,
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
        widgets=canvas_widgets(),
        resolver=FakeResolver(),
        new_id=sequential_ids(),
    )


def build(*raw: dict[str, Any]) -> dict[str, Any]:
    return apply(empty_definition(), *raw)[0]


def add(widget: str, **extra: Any) -> dict[str, Any]:
    return {"op": "add", "instance": widget, **extra}


def test_add_assigns_node_ids_and_reports_them() -> None:
    result, applied = apply(empty_definition(), add("chart-1"), add("group"))

    assert result["root"]["children"] == ["n0", "n1"]
    assert result["nodes"]["n0"] == {"instance": "chart-1", "layout": {}}
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


GROUP_ID = "kpi-row"


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
    "node_id", ["Kpi-Row", "kpi_row", "kpi row", "-kpi", "kpi-", "kpi--row", "x" * 65]
)
def test_add_rejects_ids_that_are_not_slugs(node_id: str) -> None:
    with pytest.raises(ValueError, match="should match pattern|at most 64"):
        ops(add("chart-1", id=node_id))


@pytest.mark.parametrize("node_id", ["root", "settings"])
def test_add_rejects_reserved_ids(node_id: str) -> None:
    with pytest.raises(ValueError, match="reserved"):
        ops(add("chart-1", id=node_id))


def test_add_derives_readable_ids_from_titles_and_widget_names() -> None:
    result, applied = apply_operations(
        empty_definition(),
        ops(
            {"op": "add", "widget": "chart", "props": {"title": "Revenue trend"}},
            {"op": "add", "widget": "chart", "props": {"title": "Revenue trend"}},
            {"op": "add", "widget": "chart"},
            add("group-1"),
        ),
        widgets=canvas_widgets(),
        resolver=FakeResolver(),
    )

    assert [a.op["id"] for a in applied] == [
        "revenue-trend",
        "revenue-trend-2",
        "chart",
        "group",
    ]
    assert result["root"]["children"] == [a.op["id"] for a in applied]


def test_add_inline_stores_props_at_the_widget_schema_version() -> None:
    result, applied = apply(
        empty_definition(), {"op": "add", "widget": "chart", "props": {"metric": "sum"}}
    )

    assert result["nodes"]["n0"] == {
        "widget": "chart",
        "schemaVersion": 1,
        "props": {"metric": "sum"},
        "layout": {},
    }
    assert set(applied[0].touched) == {
        Touch("n0", FieldGroup.TREE),
        Touch("n0", FieldGroup.PROPS),
    }


def test_add_inline_rejects_unknown_widgets_and_invalid_props() -> None:
    with pytest.raises(OperationError, match="unknown widget 'nope'"):
        apply(empty_definition(), {"op": "add", "widget": "nope"})
    with pytest.raises(DefinitionValidationError) as excinfo:
        apply(empty_definition(), {"op": "add", "widget": "chart", "props": {"x": 1}})
    assert excinfo.value.issues[0].path == "/nodes/n0/props/x"


@pytest.mark.parametrize(
    "raw",
    [
        {"op": "add"},
        {"op": "add", "instance": "chart-1", "widget": "chart"},
        {"op": "add", "instance": "chart-1", "props": {}},
    ],
)
def test_add_takes_exactly_one_kind_of_instance(raw: dict[str, Any]) -> None:
    with pytest.raises(ValueError, match="either instance or widget|props are only"):
        ops(raw)


def test_add_uses_the_widget_default_size_on_grids() -> None:
    widgets = changed_rules("chart", default_size=(30, 4))
    widgets["group"] = changed_rules("group")["group"]

    result, _ = apply_operations(
        empty_definition(),
        ops(
            {"op": "add", "id": "a", "widget": "chart"},
            {"op": "add", "id": "b", "widget": "chart", "layout": {"rowSpan": 2}},
            {"op": "add", "id": "g", "widget": "group"},
            {"op": "add", "id": "c", "widget": "chart", "parent": "g"},
        ),
        widgets=widgets,
        resolver=FakeResolver(),
    )

    # Clamped to the grid's width; explicit values win.
    assert result["nodes"]["a"]["layout"] == {"colSpan": 24, "rowSpan": 4}
    assert result["nodes"]["b"]["layout"] == {"colSpan": 24, "rowSpan": 2}
    assert result["nodes"]["c"]["layout"] == {"colSpan": 12, "rowSpan": 4}


def test_set_props_replaces_inline_props() -> None:
    doc = build({"op": "add", "widget": "chart", "props": {"title": "A"}})

    result, applied = apply(
        doc, {"op": "set_props", "id": "n0", "props": {"metric": "avg"}}
    )

    assert result["nodes"]["n0"]["props"] == {"metric": "avg"}
    assert applied[0].touched == [Touch("n0", FieldGroup.PROPS)]


def test_props_written_at_an_older_version_are_migrated() -> None:
    widgets = canvas_widgets()
    chart = widgets["chart"]
    widgets["chart"] = type(
        "ChartV2",
        (chart,),
        {"schema_version": 2, "migrators": {1: lambda p: {"metric": p["measure"]}}},
    )

    def run(*raw: dict[str, Any]) -> dict[str, Any]:
        return apply_operations(
            empty_definition(), ops(*raw), widgets=widgets, resolver=FakeResolver()
        )[0]

    added = run(
        {
            "op": "add",
            "id": "a",
            "widget": "chart",
            "props": {"measure": "sum"},
            "schemaVersion": 1,
        },
        {"op": "set_props", "id": "a", "props": {"measure": "avg"}, "schemaVersion": 1},
    )
    assert added["nodes"]["a"]["props"] == {"metric": "avg"}
    assert added["nodes"]["a"]["schemaVersion"] == 2
    with pytest.raises(OperationError, match="supports up to 2"):
        run({"op": "add", "widget": "chart", "props": {}, "schemaVersion": 3})


def test_set_props_needs_an_inline_instance() -> None:
    doc = build(add("chart-1"))

    with pytest.raises(OperationError, match="not an inline instance"):
        apply(doc, {"op": "set_props", "id": "n0", "props": {}})


def test_props_are_only_validated_where_written() -> None:
    doc = build(
        {"op": "add", "widget": "chart", "props": {"title": "A"}},
        add("chart-1"),
    )
    # Stored props a newer widget no longer accepts don't block other edits.
    doc["nodes"]["n0"]["props"] = {"retired": True}

    result, _ = apply(doc, {"op": "place", "id": "n1", "layout": {"colSpan": 6}})

    assert result["nodes"]["n0"]["props"] == {"retired": True}
    with pytest.raises(DefinitionValidationError, match="retired"):
        apply(doc, {"op": "set_props", "id": "n0", "props": {"retired": True}})


def test_add_into_a_leaf_is_rejected() -> None:
    with pytest.raises(OperationError, match="'n0' cannot hold children"):
        build(add("chart-1"), add("chart-2", parent="n0"))


def changed_rules(widget_type: str, **changes: Any) -> dict[str, type[Widget]]:
    """The test widgets, with ``widget_type``'s behavior or UI changed after saving."""
    widgets = canvas_widgets()
    base = widgets[widget_type]
    ui_fields = {f.name for f in dataclasses.fields(WidgetUi)}
    ui = {k: v for k, v in changes.items() if k in ui_fields}
    behavior = {k: v for k, v in changes.items() if k not in ui_fields}
    widgets[widget_type] = type(
        f"Changed{base.__name__}",
        (base,),
        {
            "behavior": dataclasses.replace(base.behavior, **behavior),
            "ui": dataclasses.replace(base.ui, **ui),
        },
    )
    return widgets


def apply_with(
    rules: dict[str, type[Widget]], doc: dict[str, Any], *raw: dict[str, Any]
) -> dict[str, Any]:
    return apply_operations(
        doc, ops(*raw), widgets=rules, resolver=FakeResolver(), new_id=sequential_ids()
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
        widgets={},
        resolver=FakeResolver(),
    )

    assert unregistered["nodes"]["n0"]["children"] == ["n1"]
    with pytest.raises(OperationError, match="cannot hold children"):
        apply_operations(
            unregistered,
            ops({"op": "move", "id": "n2", "parent": "n0"}),
            widgets={},
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


def test_set_settings_replaces_one_section_and_null_resets_it() -> None:
    doc = build(
        add("chart-1"),
        {"op": "set_settings", "key": "refresh", "value": {"interval": 300}},
        {"op": "set_settings", "key": "colors", "value": {"scheme": "supersetColors"}},
    )

    assert doc["settings"]["refresh"] == {"interval": 300, "stagger": 0, "exempt": []}
    assert doc["settings"]["colors"]["scheme"] == "supersetColors"

    reset, applied = apply(doc, {"op": "set_settings", "key": "refresh", "value": None})

    assert reset["settings"]["refresh"]["interval"] == 0
    assert reset["settings"]["colors"]["scheme"] == "supersetColors"
    assert applied[0].touched == [Touch(SETTINGS_ID, FieldGroup.REFRESH)]


def test_settings_sections_do_not_overlap_each_other() -> None:
    refresh = named_touches(
        ops({"op": "set_settings", "key": "refresh", "value": {"interval": 60}})
    )
    colors = named_touches(ops({"op": "set_settings", "key": "colors", "value": {}}))

    assert overlapping(refresh, colors) == set()
    assert overlapping(refresh, refresh) == {SETTINGS_ID}


def test_removing_a_node_drops_its_refresh_exemption() -> None:
    doc = build(
        add("chart-1"),
        add("chart-2"),
        {"op": "set_settings", "key": "refresh", "value": {"exempt": ["n0", "n1"]}},
    )

    result, applied = apply(doc, {"op": "remove", "id": "n0"})

    assert result["settings"]["refresh"]["exempt"] == ["n1"]
    assert Touch(SETTINGS_ID, FieldGroup.REFRESH) in applied[0].touched
