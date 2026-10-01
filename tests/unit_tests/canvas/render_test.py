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
from superset.canvas.definition.render import render_context
from superset.canvas.definition.validation import normalize_definition
from tests.unit_tests.canvas.fixtures import canvas, canvas_rules, FakeResolver, node


def test_placements_include_auto_placed_nodes_and_grid_containers() -> None:
    rules, resolver = canvas_rules(), FakeResolver()
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
