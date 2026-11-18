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
from copy import deepcopy
from typing import Any

import pytest
from superset_core.widgets import Widget

from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import empty_definition
from superset.canvas.definition.validation import (
    DefinitionValidationError,
    normalize_definition,
)
from superset.widgets.builtin import Group
from tests.unit_tests.canvas.fixtures import (
    canvas,
    canvas_widget_types,
    FakeResolver,
    inline,
    node,
)


def normalize(raw: dict[str, Any]) -> dict[str, Any]:
    return normalize_definition(raw, canvas_widget_types(), FakeResolver())


def issues(raw: dict[str, Any]) -> list[tuple[str, str]]:
    with pytest.raises(DefinitionValidationError) as excinfo:
        normalize(raw)
    return [(issue.path, issue.message) for issue in excinfo.value.issues]


def test_empty_canvas_is_valid() -> None:
    assert normalize(empty_definition()) == {
        "version": 1,
        "root": {"layout": {"columns": 24, "gap": 16, "rowUnit": 40}, "children": []},
        "nodes": {},
        "interactions": {"filters": {}, "crossFilters": {}, "customizations": {}},
        "settings": {
            "refresh": {"interval": 0, "stagger": 0, "exempt": []},
            "colors": {"labelColors": {}},
            "display": {
                "showTimestamps": False,
                "titleAlign": "left",
                "hiddenTitles": [],
            },
            "crossFilters": {"enabled": True},
        },
    }


def test_a_persisted_instance_placement_holds_no_props() -> None:
    found = issues(canvas({"a": node("chart-1", props={"title": "x"})}))

    assert found[0][0] == "/nodes/a"


def test_stored_props_are_validated_against_the_widget() -> None:
    found = issues(canvas({"a": inline("markdown", {"title": 3})}))

    assert found == [("/nodes/a/props/title", "Input should be a valid string")]


def test_only_structural_widgets_are_stored_on_a_placement() -> None:
    found = issues(canvas({"a": inline("chart")}))

    assert found == [
        (
            "/nodes/a/widgetType",
            "a chart widget is its own entity: place it by widgetId",
        )
    ]


def test_unknown_inline_widget_is_rejected_on_write() -> None:
    found = issues(canvas({"a": inline("nope")}))

    assert found[0][0] == "/nodes/a/widgetType"


def test_props_from_a_newer_widget_stay_as_a_placeholder() -> None:
    raw = canvas(
        {"a": inline("chart", {"future": 1}, schemaVersion=2), "b": node("chart-1")}
    )

    result = normalize_definition(
        raw, canvas_widget_types(), FakeResolver(), strict_nodes=["b"], props_nodes=[]
    )

    assert result["nodes"]["a"]["props"] == {"future": 1}
    assert result["nodes"]["a"]["schemaVersion"] == 2


def test_inline_props_are_migrated_to_the_widget_version() -> None:
    rules = canvas_widget_types()
    markdown = rules["markdown"]
    rules["markdown"] = type(
        "MarkdownV2",
        (markdown,),
        {
            "schema_version": 2,
            "migrators": {1: lambda props: {"title": props["heading"]}},
        },
    )
    raw = canvas({"a": inline("markdown", {"heading": "Sales"})})

    result = normalize_definition(raw, rules, FakeResolver())

    assert result["nodes"]["a"]["schemaVersion"] == 2
    assert result["nodes"]["a"]["props"] == {"title": "Sales"}


def test_reserved_placement_ids_are_rejected() -> None:
    assert "reserved" in issues(canvas({"settings": node("chart-1")}))[0][1]


def test_unknown_version_is_rejected() -> None:
    assert issues({**empty_definition(), "version": 2})[0][0] == "/version"


def test_missing_widgets_stay_as_placeholders() -> None:
    raw = canvas(
        {
            "a": node("missing-1", layout={"colSpan": 6}, children=["b"]),
            "b": node("chart-1", layout={"anything": "kept"}),
        },
        children=["a"],
    )

    result = normalize(raw)

    # The placeholder is still placed like any other node...
    assert result["nodes"]["a"]["layout"] == {"colSpan": 6}
    # ...and its children are kept exactly as stored.
    assert result["nodes"]["a"]["children"] == ["b"]
    assert result["nodes"]["b"]["layout"] == {"anything": "kept"}


def test_a_widget_can_be_placed_more_than_once() -> None:
    raw = canvas({"a": node("chart-1", layout={"colSpan": 8}), "b": node("chart-1")})

    result = normalize(raw)

    assert result["nodes"]["a"]["widgetId"] == result["nodes"]["b"]["widgetId"]
    assert result["nodes"]["a"]["layout"] == {"colSpan": 8}


def test_unknown_child_and_orphan() -> None:
    found = issues(
        canvas({"a": node("chart-1"), "b": node("chart-2")}, children=["a", "ghost"])
    )

    assert ("/root/children/1", "unknown node 'ghost'") in found
    assert ("/nodes/b", "not reachable from the root") in found


def test_node_with_two_parents() -> None:
    raw = canvas(
        {"g": node("group", children=["a"]), "a": node("chart")}, children=["g", "a"]
    )

    assert issues(raw) == [("/nodes/g/children/0", "node 'a' has more than one parent")]


def test_cycle_is_unreachable() -> None:
    raw = canvas(
        {
            "g1": node("group-1", children=["g2"]),
            "g2": node("group-2", children=["g1"]),
        },
        children=[],
    )

    found = issues(raw)

    assert ("/nodes/g1", "not reachable from the root") in found
    assert ("/nodes/g2", "not reachable from the root") in found


def test_unregistered_type_with_children_is_kept() -> None:
    # A container whose extension was removed: its type has no rules any more.
    raw = canvas(
        {"a": node("chart-1", children=["b"]), "b": node("chart-2")}, children=["a"]
    )

    assert normalize(raw)["nodes"]["a"]["children"] == ["b"]


def test_size_limits_apply_on_grids() -> None:
    from superset_core.widgets import WidgetUi

    from tests.unit_tests.canvas.fixtures import canvas_widget_types

    rules = canvas_widget_types()
    chart = rules["chart"]
    rules["kpi"] = type(
        "KpiWidget",
        (chart,),
        {"widget_type": "kpi", "ui": WidgetUi(min_col_span=4, max_row_span=6)},
    )
    raw = canvas({"k": node("kpi", layout={"colSpan": 2, "rowSpan": 8})})

    with pytest.raises(DefinitionValidationError) as excinfo:
        normalize_definition(raw, rules, FakeResolver())

    assert [issue.message for issue in excinfo.value.issues] == [
        "colSpan 2 is below the minimum of 4",
        "rowSpan 8 is above the maximum of 6",
    ]


def test_nesting_rules() -> None:
    assert issues(canvas({"t": node("tab")})) == [
        ("/nodes/t", "a tab widget cannot be placed in root")
    ]
    assert issues(
        canvas({"s": node("tabs", children=["m"]), "m": node("markdown")}, ["s"])
    ) == [("/nodes/m", "a markdown widget cannot be placed in tabs")]


def test_containers_own_their_children_layout() -> None:
    raw = canvas(
        {
            "g": node("group", children=["a", "b"]),
            "a": node("chart-1", layout={"colSpan": 16}),
            "b": node("chart-2", layout={"col": 3}),
            "k": node("board", children=["c", "d"]),
            "c": node("chart-3", layout={"lane": "todo"}),
            "d": node("chart-4", layout={"colSpan": 2}),
        },
        children=["g", "k"],
    )

    found = issues(raw)

    # ``group`` is a 12-column grid, ``board`` has its own layout model.
    assert ("/nodes/a/layout", "colSpan 16 exceeds the grid's 12 columns") in found
    assert any(path == "/nodes/b/layout" for path, _ in found)
    assert any(path.startswith("/nodes/d/layout") for path, _ in found)
    assert not any(path.startswith("/nodes/c/") for path, _ in found)


def test_containers_without_a_layout_accept_only_empty_layouts() -> None:
    raw = canvas(
        {
            "s": node("tabs", children=["p"]),
            "p": node("tab", layout={"colSpan": 3}),
        },
        children=["s"],
    )

    assert issues(raw)[0][0].startswith("/nodes/p/layout")


def test_grid_collisions_are_resolved_on_normalize() -> None:
    raw = canvas(
        {
            "a": node(
                "chart-1", layout={"col": 1, "row": 1, "colSpan": 24, "rowSpan": 2}
            ),
            "b": node("chart-2", layout={"col": 1, "row": 1, "colSpan": 12}),
        }
    )

    assert normalize(raw)["nodes"]["b"]["layout"] == {
        "col": 1,
        "row": 3,
        "colSpan": 12,
    }


def test_containers_get_children_and_leaves_do_not() -> None:
    result = normalize(canvas({"g": node("group"), "a": node("chart", children=[])}))

    assert result["nodes"]["g"]["children"] == []
    assert "children" not in result["nodes"]["a"]


def test_refresh_exemptions_must_be_nodes() -> None:
    found = issues(
        {
            **canvas({"a": node("chart")}),
            "settings": {"refresh": {"exempt": ["a", "b"]}},
        }
    )

    assert found == [("/settings/refresh/exempt/1", "unknown node 'b'")]


def test_hidden_titles_must_be_nodes() -> None:
    found = issues(
        {
            **canvas({"a": node("chart")}),
            "settings": {"display": {"hiddenTitles": ["b"]}},
        }
    )

    assert found == [("/settings/display/hiddenTitles/0", "unknown node 'b'")]


def test_settings_are_validated() -> None:
    found = issues(
        {
            **empty_definition(),
            "settings": {"refresh": {"interval": -1}, "colors": {"theme": "dark"}},
        }
    )

    assert {path for path, _ in found} == {
        "/settings/refresh/interval",
        "/settings/colors/theme",
    }


def test_nesting_depth_is_not_capped() -> None:
    nodes = {
        f"g{level}": node(
            f"group-{level}", children=[f"g{level + 1}"] if level < 29 else []
        )
        for level in range(30)
    }

    result = normalize(canvas(nodes, children=["g0"]))

    assert len(result["nodes"]) == 30


def real_group_types() -> dict[str, type[Widget]]:
    """The test widgets, with the builtin ``Group`` (one chrome row for its
    title) standing in for the simplified, chrome-less test group."""
    return {**canvas_widget_types(), "group": Group}


def normalize_with_real_group(raw: dict[str, Any]) -> dict[str, Any]:
    return normalize_definition(deepcopy(raw), real_group_types(), FakeResolver())


def group(title: str, children: list[str], layout: dict[str, Any]) -> dict[str, Any]:
    return inline("group", {"title": title}, children=children, layout=layout)


def test_the_builtin_group_reserves_a_title_row() -> None:
    assert Group.ui.chrome_rows == 1


@pytest.mark.parametrize("title", ["Revenue KPIs", ""])
def test_a_group_grows_by_its_title_row_and_pushes_its_sibling_down(
    title: str,
) -> None:
    raw = canvas(
        {
            "g": group(title, ["a"], {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 6}),
            "a": node(
                "chart-1", layout={"col": 1, "row": 1, "colSpan": 12, "rowSpan": 6}
            ),
            "below": node(
                "chart-2", layout={"col": 1, "row": 7, "colSpan": 24, "rowSpan": 4}
            ),
        },
        children=["g", "below"],
    )

    result = normalize_with_real_group(raw)

    # Six child rows plus the title row: the group's last row is 7, so the
    # full-width sibling stored at row 7 moves to row 8 instead of being
    # drawn over the group's last row.
    assert result["nodes"]["g"]["layout"]["rowSpan"] == 7
    assert result["nodes"]["a"]["layout"]["row"] == 1
    assert result["nodes"]["below"]["layout"]["row"] == 8

    context = render_context(result, real_group_types(), FakeResolver())
    assert context["chromeRows"] == {"g": 1}
    assert context["layoutConstraints"]["g"]["minRowSpan"] == 7
    assert context["placements"]["below"]["row"] == 8


def test_an_auto_placed_sibling_lands_below_the_grown_group() -> None:
    raw = canvas(
        {
            "g": group(
                "Revenue KPIs",
                ["a"],
                {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 6},
            ),
            "a": node(
                "chart-1", layout={"col": 1, "row": 1, "colSpan": 12, "rowSpan": 6}
            ),
            "below": node("chart-2", layout={"colSpan": 24, "rowSpan": 4}),
        },
        children=["g", "below"],
    )

    result = normalize_with_real_group(raw)

    assert result["nodes"]["g"]["layout"]["rowSpan"] == 7
    # Automatic placement leaves the stored row absent; only the resolved
    # placement says where the sibling is drawn.
    assert "row" not in result["nodes"]["below"]["layout"]
    placements = render_context(result, real_group_types(), FakeResolver())[
        "placements"
    ]
    assert placements["g"] == {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 7}
    assert placements["below"] == {"col": 1, "row": 8, "colSpan": 24, "rowSpan": 4}


NESTED_GROUPS = canvas(
    {
        "outer": group(
            "Outer", ["inner"], {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 6}
        ),
        "inner": group(
            "Inner", ["a"], {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 6}
        ),
        "a": node("chart-1", layout={"col": 1, "row": 1, "colSpan": 12, "rowSpan": 6}),
        "below": node("chart-2", layout={"colSpan": 24, "rowSpan": 4}),
    },
    children=["outer", "below"],
)


def test_nested_groups_each_add_their_title_row() -> None:
    result = normalize_with_real_group(NESTED_GROUPS)

    # Six child rows -> seven inner rows -> eight outer rows.
    assert result["nodes"]["inner"]["layout"]["rowSpan"] == 7
    assert result["nodes"]["outer"]["layout"]["rowSpan"] == 8

    context = render_context(result, real_group_types(), FakeResolver())
    assert context["chromeRows"] == {"outer": 1, "inner": 1}
    assert context["layoutConstraints"]["inner"]["minRowSpan"] == 7
    assert context["layoutConstraints"]["outer"]["minRowSpan"] == 8
    assert context["placements"]["below"]["row"] == 9


def test_a_group_taller_than_its_content_keeps_its_height() -> None:
    raw = canvas(
        {
            "g": group(
                "Revenue KPIs",
                ["a"],
                {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 10},
            ),
            "a": node(
                "chart-1", layout={"col": 1, "row": 1, "colSpan": 12, "rowSpan": 6}
            ),
            "below": node(
                "chart-2", layout={"col": 1, "row": 11, "colSpan": 24, "rowSpan": 4}
            ),
        },
        children=["g", "below"],
    )

    result = normalize_with_real_group(raw)

    # Growing never shrinks: an explicitly larger group keeps its rows, and
    # the sibling already clear of it is not moved.
    assert result["nodes"]["g"]["layout"]["rowSpan"] == 10
    assert result["nodes"]["below"]["layout"]["row"] == 11


def test_group_sizing_normalization_is_idempotent() -> None:
    once = normalize_with_real_group(NESTED_GROUPS)
    twice = normalize_with_real_group(once)

    assert twice == once
    assert twice["nodes"]["outer"]["layout"]["rowSpan"] == 8
