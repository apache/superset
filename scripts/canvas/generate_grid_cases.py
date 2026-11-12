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
Regenerate ``gridCases.json``, which stops the client's placement rules
drifting from the server's.

The *inputs* below are written by hand: each one is a case somebody thought
worth pinning, and the name says why. The *answers* are generated from
``superset/canvas/definition/grid.py``, which is the authority -- so this
script never decides anything, it only records what the server does.

    python scripts/canvas/generate_grid_cases.py

CI runs it and fails on a diff, so the fixture cannot go stale unnoticed.
Adding a case means adding its input here and running this.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from superset.canvas.definition.grid import (
    Rect,
    replay_places,
    resolve_grid,
    swap_places,
)

FIXTURE = (
    Path(__file__).parents[2] / "superset-frontend/src/features/canvas/gridCases.json"
)

COMMENT = (
    "Shared cases for the grid placement rules, so the server's resolve_grid "
    "(superset/canvas/definition/grid.py) and the client's resolveGrid cannot "
    "drift. Generated from the server, which is the authority. It lives here "
    "because the frontend's test image carries only superset-frontend, while "
    "the Python tests run on a full checkout and can read up into it."
)

SWAP_COMMENT = (
    "Shared cases for the swap operation (superset/canvas/definition/grid.py), "
    "which exchanges two children's places, each keeping its own size. "
    "Generated from the server, which is the authority; the client mirrors it "
    "in swapPlacements. Without these the mirror could drift, and a drag would "
    "show one result while the write produced another."
)

PREVIEW_COMMENT = (
    "Shared cases for the drop rules: the reorder from insert_index "
    "(superset/canvas/definition/grid.py), applied by the place operation, "
    "followed by resolve_grid. The reorder does not live in resolve_grid, so "
    "the cases above do not reach it. Generated from the server, which is the "
    "authority; the client mirrors it in previewGrid. `order` is reading order "
    "after the drop, asserted separately because two orders can settle on the "
    "same placements while differing for the next drop."
)

#: Children resolved in reading order: the rules in ``resolve_grid``.
CASES: list[dict[str, Any]] = [
    {
        "name": "a single explicit child keeps its place",
        "columns": 24,
        "layouts": [{"col": 1, "row": 1, "colSpan": 6, "rowSpan": 4}],
    },
    {
        "name": "an omitted span fills the grid width, one row tall",
        "columns": 24,
        "layouts": [{}],
    },
    {
        "name": "auto-placed children sit side by side until the row is full",
        "columns": 12,
        "layouts": [{"colSpan": 5}, {"colSpan": 5}, {"colSpan": 5}],
    },
    {
        "name": (
            "an explicit child that overlaps an earlier one slides into "
            "the room beside it"
        ),
        "columns": 24,
        "layouts": [
            {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
            {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
        ],
    },
    {
        "name": "a child with no room beside it goes down, keeping its column",
        "columns": 24,
        "layouts": [
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
        ],
    },
    {
        "name": "a push-down repeats until the child is clear",
        "columns": 24,
        "layouts": [
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 2},
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 2},
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 2},
        ],
    },
    {
        "name": "a span wider than the grid is clamped to it",
        "columns": 12,
        "layouts": [{"col": 1, "row": 1, "colSpan": 40, "rowSpan": 1}],
    },
    {
        "name": "auto placement flows around an explicit child",
        "columns": 24,
        "layouts": [
            {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 2},
            {"colSpan": 12},
            {"colSpan": 12},
        ],
    },
    {
        "name": "the auto cursor only moves forward",
        "columns": 24,
        "layouts": [{"colSpan": 20}, {"colSpan": 8}, {"colSpan": 4}],
    },
    {
        "name": "explicit and auto children interleave in reading order",
        "columns": 12,
        "layouts": [
            {"colSpan": 6},
            {"col": 1, "row": 1, "colSpan": 6, "rowSpan": 3},
            {"colSpan": 6},
        ],
    },
    {"name": "an empty grid resolves to nothing", "columns": 24, "layouts": []},
]

#: A drop: the reorder from ``insert_index`` and then a resolve, which is what
#: the ``place`` operation does and what a client previewing a drag mirrors.
PREVIEW_CASES: list[dict[str, Any]] = [
    {
        "name": "a drop onto an earlier sibling takes the spot and pushes it down",
        "columns": 24,
        "childIds": ["a", "b", "c"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
            "c": {"col": 1, "row": 9, "colSpan": 24, "rowSpan": 4},
        },
        "moving": "c",
        "target": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
    },
    {
        "name": "a drop between two siblings lands between them",
        "columns": 24,
        "childIds": ["a", "b", "c"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
            "c": {"col": 1, "row": 9, "colSpan": 24, "rowSpan": 4},
        },
        "moving": "c",
        "target": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
    },
    {
        "name": "a drop past every sibling goes last and pushes nobody",
        "columns": 24,
        "childIds": ["a", "b", "c"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
            "c": {"col": 1, "row": 9, "colSpan": 24, "rowSpan": 4},
        },
        "moving": "a",
        "target": {"col": 1, "row": 13, "colSpan": 24, "rowSpan": 4},
    },
    {
        "name": "a drop onto an earlier sibling in the same row wins by column",
        "columns": 24,
        "childIds": ["left", "right"],
        "layouts": {
            "left": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
            "right": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 4},
        },
        "moving": "right",
        "target": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
    },
    {
        "name": "a drop that stays put changes no order",
        "columns": 24,
        "childIds": ["a", "b", "c"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
            "c": {"col": 1, "row": 9, "colSpan": 24, "rowSpan": 4},
        },
        "moving": "b",
        "target": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
    },
    {
        "name": "a drop onto an auto-placed sibling moves it aside, not down",
        "columns": 24,
        "childIds": ["auto", "fixed"],
        "layouts": {
            "auto": {"colSpan": 12, "rowSpan": 2},
            "fixed": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 2},
        },
        "moving": "fixed",
        "target": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 2},
    },
    {
        "name": "an auto-placed sibling reflows around a drop that frees its slot",
        "columns": 24,
        "childIds": ["auto", "fixed"],
        "layouts": {
            "auto": {"colSpan": 12, "rowSpan": 2},
            "fixed": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 2},
        },
        "moving": "fixed",
        "target": {"col": 1, "row": 5, "colSpan": 12, "rowSpan": 2},
    },
    {
        "name": "a drop part-way down a taller sibling still goes ahead of it",
        "columns": 24,
        "childIds": ["tall", "short"],
        "layouts": {
            "tall": {"col": 1, "row": 1, "colSpan": 8, "rowSpan": 6},
            "short": {"col": 9, "row": 1, "colSpan": 8, "rowSpan": 2},
        },
        "moving": "short",
        "target": {"col": 1, "row": 3, "colSpan": 8, "rowSpan": 2},
    },
    {
        "name": "a drop past a taller sibling's middle comes after it in reading order",
        "columns": 24,
        "childIds": ["tall", "short"],
        "layouts": {
            "tall": {"col": 1, "row": 1, "colSpan": 8, "rowSpan": 6},
            "short": {"col": 9, "row": 1, "colSpan": 8, "rowSpan": 2},
        },
        "moving": "short",
        "target": {"col": 1, "row": 5, "colSpan": 8, "rowSpan": 2},
    },
    {
        "name": "a narrow grid clamps the dropped span",
        "columns": 12,
        "childIds": ["left", "right"],
        "layouts": {
            "left": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
            "right": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 4},
        },
        "moving": "right",
        "target": {"col": 1, "row": 1, "colSpan": 30, "rowSpan": 4},
    },
    {
        "name": "a drop below everything on a narrow grid stays last",
        "columns": 24,
        "childIds": ["a", "b"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4},
        },
        "moving": "a",
        "target": {"col": 1, "row": 20, "colSpan": 24, "rowSpan": 4},
    },
    {
        "name": "a drop beside a sibling in the same row stays after it",
        "columns": 24,
        "childIds": ["anchor", "mover"],
        "layouts": {
            "anchor": {"col": 1, "row": 1, "colSpan": 8, "rowSpan": 2},
            "mover": {"col": 1, "row": 5, "colSpan": 8, "rowSpan": 2},
        },
        "moving": "mover",
        "target": {"col": 13, "row": 1, "colSpan": 8, "rowSpan": 2},
    },
]


#: Two children changing places: the ``swap`` operation.
SWAP_CASES: list[dict[str, Any]] = [
    {
        "name": "an exchange of equal widths leaves both where the other was",
        "columns": 24,
        "childIds": ["a", "b"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            "b": {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 2},
        },
        "nodeId": "a",
        "partnerId": "b",
    },
    {
        "name": "a wider widget is pulled back far enough to fit",
        "columns": 24,
        "childIds": ["wide", "narrow"],
        "layouts": {
            "wide": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 2},
            "narrow": {"col": 19, "row": 1, "colSpan": 6, "rowSpan": 2},
        },
        "nodeId": "wide",
        "partnerId": "narrow",
    },
    {
        "name": "an auto-placed widget exchanges where it actually sits",
        "columns": 24,
        "childIds": ["a", "b"],
        "layouts": {"a": {"colSpan": 12}, "b": {"colSpan": 12}},
        "nodeId": "a",
        "partnerId": "b",
    },
    {
        "name": "an exchange settles the whole grid, not just the two",
        "columns": 24,
        "childIds": ["a", "b", "bystander"],
        "layouts": {
            "a": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 2},
            "b": {"col": 1, "row": 3, "colSpan": 24, "rowSpan": 2},
            "bystander": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 2},
        },
        "nodeId": "a",
        "partnerId": "b",
    },
    {
        "name": "exchanging with a taller widget keeps both heights",
        "columns": 12,
        "childIds": ["short", "tall"],
        "layouts": {
            "short": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 1},
            "tall": {"col": 1, "row": 2, "colSpan": 12, "rowSpan": 6},
        },
        "nodeId": "short",
        "partnerId": "tall",
    },
    {
        "name": "an exchange of neighbours in one row keeps the row",
        "columns": 24,
        "childIds": ["left", "right"],
        "layouts": {
            "left": {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 4},
            "right": {"col": 13, "row": 1, "colSpan": 12, "rowSpan": 4},
        },
        "nodeId": "left",
        "partnerId": "right",
    },
]


def _dump(rect: Rect) -> dict[str, int]:
    return {
        "col": rect.col,
        "row": rect.row,
        "colSpan": rect.col_span,
        "rowSpan": rect.row_span,
    }


def build() -> dict[str, Any]:
    """The fixture, with every answer taken from the server's own rules."""
    resolved = []
    for case in CASES:
        rects, stored = resolve_grid(
            [dict(layout) for layout in case["layouts"]], case["columns"]
        )
        resolved.append(
            {**case, "expected": [_dump(r) for r in rects], "stored": stored}
        )

    previews = []
    for case in PREVIEW_CASES:
        order, rects = replay_places(
            case["childIds"],
            {node: dict(layout) for node, layout in case["layouts"].items()},
            [(case["moving"], dict(case["target"]))],
            case["columns"],
        )
        previews.append(
            {
                **case,
                "order": order,
                "expected": {
                    node: _dump(rect) for node, rect in zip(order, rects, strict=True)
                },
            }
        )

    swaps = []
    for case in SWAP_CASES:
        exchanged, order, rects = swap_places(
            case["childIds"],
            {node: dict(layout) for node, layout in case["layouts"].items()},
            case["columns"],
            case["nodeId"],
            case["partnerId"],
        )
        swaps.append(
            {
                **case,
                "exchanged": exchanged,
                "order": order,
                "expected": {
                    node: _dump(rect) for node, rect in zip(order, rects, strict=True)
                },
            }
        )

    return {
        "comment": COMMENT,
        "cases": resolved,
        "previewComment": PREVIEW_COMMENT,
        "previewCases": previews,
        "swapComment": SWAP_COMMENT,
        "swapCases": swaps,
    }


def main() -> None:
    FIXTURE.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    # The fixture lives under ``superset-frontend``, so oxfmt owns its
    # formatting (see .pre-commit-config.yaml). Hand it over rather than
    # guessing at the house style, or every run would fight the hook and the
    # CI diff below would never be clean.
    formatter = Path(__file__).parents[2] / "scripts/oxfmt.sh"
    if formatter.exists():
        subprocess.run(  # noqa: S603
            [str(formatter), "superset-frontend", str(FIXTURE)],
            check=True,
            cwd=formatter.parents[1],
        )
    print(f"wrote {FIXTURE}")


if __name__ == "__main__":
    main()
