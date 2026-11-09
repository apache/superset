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
from superset_core.widgets import Widget, WidgetBehavior, WidgetUi

from superset.canvas.definition.render import render_context
from superset.canvas.definition.validation import normalize_definition
from tests.unit_tests.canvas.fixtures import (
    canvas,
    canvas_widget_types,
    FakeResolver,
    node,
    Props,
)


def test_placements_include_auto_placed_nodes_and_grid_containers() -> None:
    rules, resolver = canvas_widget_types(), FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                "k1": node("chart-1", layout={"colSpan": 8}),
                "k2": node("chart-2", layout={"colSpan": 8}),
                "g": node("group", layout={"colSpan": 24}, children=["c"]),
                "c": node("chart-3", layout={"colSpan": 6}),
                "gone": node("missing-1", layout={"colSpan": 4}),
            },
            children=["k1", "k2", "g", "gone"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    assert context["placements"] == {
        "k1": {"col": 1, "row": 1, "colSpan": 8, "rowSpan": 1},
        "k2": {"col": 9, "row": 1, "colSpan": 8, "rowSpan": 1},
        "g": {"col": 1, "row": 2, "colSpan": 24, "rowSpan": 1},
        # A placeholder still takes its place on the grid.
        "gone": {"col": 1, "row": 3, "colSpan": 4, "rowSpan": 1},
        # Children of a grid container are placed on its own 12 columns.
        "c": {"col": 1, "row": 1, "colSpan": 6, "rowSpan": 1},
    }
    assert context["widgetTypes"] == {
        "k1": "chart",
        "k2": "chart",
        "g": "group",
        "c": "chart",
    }
    assert context["gridColumns"] == {"g": 12}


def test_layouts_carry_what_placement_is_resolved_from() -> None:
    """
    The stored layouts, which are not recoverable from ``placements``.

    An auto-placed node has no stored ``col``/``row`` at all, and a node that
    collided has the ``col``/``row`` it settled on written back to its layout.
    A client previewing a drag resolves from these, so it has to be told them:
    resolving from the rectangles instead would make an auto-placed node look
    pinned, and a displaced node look like it was still where the user last
    asked for it.
    """
    rules, resolver = canvas_widget_types(), FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                # Auto-placed: no col/row of its own.
                "auto": node("chart-1", layout={"colSpan": 8}),
                # Explicit, and overlapping `auto` once it lands at row 1.
                "fixed": node("chart-2", layout={"col": 1, "row": 1, "colSpan": 8}),
            },
            children=["auto", "fixed"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    # `fixed` asked for col 1 and `auto` was already there, so it moved aside
    # into the free half of the same row.
    assert context["placements"]["fixed"] == {
        "col": 9,
        "row": 1,
        "colSpan": 8,
        "rowSpan": 1,
    }
    assert context["layouts"] == {
        "auto": {"colSpan": 8},
        # The pushed row, not the row 1 that was asked for.
        "fixed": {"col": 9, "row": 1, "colSpan": 8},
    }


def test_child_order_reports_each_grid_in_reading_order() -> None:
    """
    Reading order per grid, which the ``place`` operation rewrites when a drop
    lands on an earlier sibling. A client previewing a drag resolves against
    it, so a stale order makes the preview disagree with the write.
    """
    rules, resolver = canvas_widget_types(), FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                "k1": node("chart-1", layout={"colSpan": 8}),
                "g": node("group", layout={"colSpan": 24}, children=["c1", "c2"]),
                "c1": node("chart-2", layout={"colSpan": 6}),
                "c2": node("chart-3", layout={"colSpan": 6}),
            },
            children=["k1", "g"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    # The root under its own id, and every grid container under its node id.
    assert context["childOrder"] == {
        "root": ["k1", "g"],
        "g": ["c1", "c2"],
    }


def test_layout_constraints_carry_declared_span_limits() -> None:
    """Only the limits a widget actually declares reach the client."""
    rules, resolver = canvas_widget_types(), FakeResolver()
    rules["sized"] = type(
        "SizedWidget",
        (Widget,),
        {
            "widget_type": "sized",
            "name": "Sized",
            "controls_class": Props,
            "behavior": WidgetBehavior(),
            "ui": WidgetUi(default_size=(6, 4), min_col_span=4, max_row_span=8),
        },
    )
    definition = normalize_definition(
        canvas(
            {
                "tile": node("sized-1", layout={"colSpan": 6}),
                # The same widget, placed inside a grid container.
                "g": node("group", layout={"colSpan": 24}, children=["inner"]),
                "inner": node("sized-2", layout={"colSpan": 6}),
                # A widget that declares nothing is left out entirely.
                "plain": node("chart-1", layout={"colSpan": 4}),
            },
            children=["tile", "g", "plain"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    assert context["layoutConstraints"] == {
        "tile": {"minColSpan": 4, "maxRowSpan": 8},
        "inner": {"minColSpan": 4, "maxRowSpan": 8},
    }


def test_a_container_reports_the_row_minimum_its_content_imposes() -> None:
    """
    Validation grows a container to fit its children and never shrinks it, so
    the rows they occupy are a real minimum even where the widget declares
    none. Without it a client dragging a container's top edge down computes
    the shrink against 1, sends a span the server replaces, and the
    container's bottom edge moves down into whatever sits below.
    """
    rules, resolver = canvas_widget_types(), FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                "g": node("group", layout={"colSpan": 24}, children=["tall"]),
                # Fills six rows of the group's own grid.
                "tall": node("chart-1", layout={"colSpan": 6, "rowSpan": 6}),
            },
            children=["g"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    # Validation already grew the group to fit, so this is also its span.
    assert context["placements"]["g"]["rowSpan"] == 6
    assert context["layoutConstraints"]["g"]["minRowSpan"] == 6
    # The child declares nothing, so it reports nothing.
    assert "tall" not in context["layoutConstraints"]


def test_the_row_minimum_includes_a_container_s_chrome() -> None:
    """
    Validation grows a container to its content *plus* its chrome, so the
    minimum has to carry the chrome too. Measured on a container that has
    some: one with no chrome cannot tell the two apart.
    """
    rules, resolver = canvas_widget_types(), FakeResolver()
    rules["panel"] = type(
        "PanelWidget",
        (Widget,),
        {
            "widget_type": "panel",
            "name": "Panel",
            "controls_class": Props,
            "behavior": WidgetBehavior(
                container=True, grid_columns=12, structural=True
            ),
            # A header of its own, above whatever it holds.
            "ui": WidgetUi(chrome_rows=1),
        },
    )
    definition = normalize_definition(
        canvas(
            {
                "p": node("panel-1", layout={"colSpan": 24}, children=["tall"]),
                "tall": node("chart-1", layout={"colSpan": 6, "rowSpan": 6}),
            },
            children=["p"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    # Six rows of content and one of chrome.
    assert context["placements"]["p"]["rowSpan"] == 7
    assert context["layoutConstraints"]["p"]["minRowSpan"] == 7


def test_the_row_minimum_reaches_through_a_container_that_is_not_a_grid() -> None:
    """
    A container without its own grid takes the tallest of its children's
    content heights, as validation does, and ``_fit`` grows it to that. Left
    at zero it would report no minimum, and dragging its top edge down would
    send a span the server replaces -- moving its bottom edge down into
    whatever sits below instead of resizing it.
    """
    rules, resolver = canvas_widget_types(), FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                # 'tabs' holds no grid of its own; each 'tab' does.
                "t": node("tabs-1", layout={"colSpan": 24}, children=["one"]),
                "one": node("tab-1", layout={}, children=["tall"]),
                "tall": node("chart-1", layout={"colSpan": 6, "rowSpan": 8}),
            },
            children=["t"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    # The height travels up from the chart, through the tab's grid, to 'tabs'.
    # The tab itself reports nothing: it is not on a grid, so it has no
    # placement and nothing can resize it.
    assert "one" not in context["layoutConstraints"]
    assert context["layoutConstraints"]["t"]["minRowSpan"] == 8
    assert context["placements"]["t"]["rowSpan"] == 8


def test_layout_constraints_skip_nodes_that_are_not_on_a_grid() -> None:
    """A child of a container with its own layout model can't be dragged."""
    rules, resolver = canvas_widget_types(), FakeResolver()
    rules["sized"] = type(
        "SizedWidget",
        (Widget,),
        {
            "widget_type": "sized",
            "name": "Sized",
            "controls_class": Props,
            "behavior": WidgetBehavior(),
            "ui": WidgetUi(min_col_span=4),
        },
    )
    definition = normalize_definition(
        canvas(
            {
                "b": node("board", layout={"colSpan": 24}, children=["card"]),
                "card": node("sized-1", layout={"lane": "todo"}),
            },
            children=["b"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    assert "card" not in context["placements"]
    assert "card" not in context["layoutConstraints"]


def test_widget_entities_are_titled_by_name_unless_they_label_themselves() -> None:
    from superset_core.widgets import WidgetUi

    rules = canvas_widget_types()
    rules["filter"] = type(
        "LabeledFilter", (rules["filter"],), {"ui": WidgetUi(show_title=False)}
    )
    resolver = FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                "k": node("chart-1"),
                "f": node("filter-1"),
                "gone": node("missing-1"),
            }
        ),
        rules,
        resolver,
    )

    assert render_context(definition, rules, resolver)["titles"] == {"k": "chart-1"}


def test_chrome_rows_say_what_a_container_keeps_above_its_grid() -> None:
    """
    What validation adds on top of a container's content when it grows it to
    fit (``_fit``).

    A client previewing a drop has to grow the container the same way, or a
    widget dropped past a group's last row is drawn outside the group's box --
    and a container clips, so it is drawn cut in half -- until the write comes
    back and says what the client could already work out. Only containers that
    keep anything are listed; the rest would be a nought nobody reads.
    """
    rules = canvas_widget_types()
    rules["group"] = type(
        "TitledGroup",
        (Widget,),
        {
            "widget_type": "group",
            "name": "Group",
            "controls_class": rules["group"].controls_class,
            "behavior": WidgetBehavior(
                container=True, grid_columns=12, structural=True
            ),
            "ui": WidgetUi(chrome_rows=1),
        },
    )
    resolver = FakeResolver()
    definition = normalize_definition(
        canvas(
            {
                "g": node("group", layout={"colSpan": 24}, children=["c"]),
                "c": node("chart-1", layout={"colSpan": 6}),
                "plain": node("chart-2", layout={"colSpan": 6}),
            },
            children=["g", "plain"],
        ),
        rules,
        resolver,
    )

    context = render_context(definition, rules, resolver)

    assert context["chromeRows"] == {"g": 1}
    # And the group was grown by it: one row of content, one of chrome.
    assert context["placements"]["g"]["rowSpan"] == 2
