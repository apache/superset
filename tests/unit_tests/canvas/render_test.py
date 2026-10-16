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
