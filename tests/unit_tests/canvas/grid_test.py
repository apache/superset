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

from superset.canvas.definition.grid import Rect, resolve_grid, span_errors


def test_auto_placement_fills_rows_in_reading_order() -> None:
    rects, stored = resolve_grid(
        [{"colSpan": 8}, {"colSpan": 8}, {"colSpan": 8}, {"colSpan": 24}], 24
    )

    assert rects == [
        Rect(1, 1, 8, 1),
        Rect(9, 1, 8, 1),
        Rect(17, 1, 8, 1),
        Rect(1, 2, 24, 1),
    ]
    assert stored == [{"colSpan": 8}, {"colSpan": 8}, {"colSpan": 8}, {"colSpan": 24}]


def test_missing_spans_default_to_full_width_and_one_row() -> None:
    rects, _ = resolve_grid([{}, {}], 12)

    assert rects == [Rect(1, 1, 12, 1), Rect(1, 2, 12, 1)]


def test_explicit_collision_is_pushed_down_and_stored() -> None:
    rects, stored = resolve_grid(
        [
            {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 3},
            {"col": 7, "row": 2, "colSpan": 12, "rowSpan": 2},
        ],
        24,
    )

    assert rects[1] == Rect(7, 4, 12, 2)
    assert stored[1] == {"col": 7, "row": 4, "colSpan": 12, "rowSpan": 2}


def test_auto_placement_skips_explicitly_occupied_cells() -> None:
    rects, _ = resolve_grid(
        [{"col": 1, "row": 1, "colSpan": 12, "rowSpan": 2}, {"colSpan": 12}], 24
    )

    assert rects[1] == Rect(13, 1, 12, 1)


def test_auto_placement_cursor_never_moves_backwards() -> None:
    rects, _ = resolve_grid([{"colSpan": 20}, {"colSpan": 20}, {"colSpan": 4}], 24)

    # The 4-wide child would fit beside the first one, but the cursor has
    # already moved past it.
    assert rects[2] == Rect(21, 2, 4, 1)


def test_span_errors() -> None:
    assert span_errors({"colSpan": 30}, 24) == [
        "colSpan 30 exceeds the grid's 24 columns"
    ]
    assert span_errors({"col": 20, "row": 1, "colSpan": 8}, 24) == [
        "col 20 with colSpan 8 overflows 24 columns"
    ]
    assert span_errors({"col": 17, "row": 1, "colSpan": 8}, 24) == []


def _shared_fixture() -> dict[str, Any]:
    """
    The cases the frontend's ``resolveGrid.test.ts`` reads as well, so the
    client's copy of these rules cannot drift from this one. Changing a rule
    here fails these tests until the fixture is regenerated, and fails the
    frontend until it is ported.
    """
    from pathlib import Path

    from superset.utils import json

    # In the frontend tree: its test image carries only `superset-frontend`,
    # while these tests run on a full checkout and can read up into it.
    path = (
        Path(__file__).parents[3]
        / "superset-frontend/src/features/canvas/gridCases.json"
    )
    return json.loads(path.read_text())


def _dump(rect: Rect) -> dict[str, int]:
    return {
        "col": rect.col,
        "row": rect.row,
        "colSpan": rect.col_span,
        "rowSpan": rect.row_span,
    }


def test_shared_cases_match_this_implementation() -> None:
    cases = _shared_fixture()["cases"]
    assert len(cases) > 5, "the fixture must not be empty or this passes vacuously"

    for case in cases:
        rects, stored = resolve_grid(
            [dict(layout) for layout in case["layouts"]], case["columns"]
        )
        assert [_dump(r) for r in rects] == case["expected"], case["name"]
        assert stored == case["stored"], case["name"]


def test_shared_preview_cases_match_this_implementation() -> None:
    """
    The drop rules, which are a reorder followed by a resolve.

    The reorder lives in the ``place`` operation rather than in
    ``resolve_grid``, so the cases above do not reach it; without these a
    client mirroring it could drift freely.
    """
    from superset.canvas.definition.grid import insert_index

    cases = _shared_fixture()["previewCases"]
    assert len(cases) > 5, "the fixture must not be empty or this passes vacuously"

    for case in cases:
        columns = case["columns"]
        layouts, target = case["layouts"], case["target"]
        others = [node for node in case["childIds"] if node != case["moving"]]
        rects, _ = resolve_grid([dict(layouts[node]) for node in others], columns)
        index = insert_index(
            rects,
            Rect(
                target["col"],
                target["row"],
                min(target.get("colSpan") or columns, columns),
                target.get("rowSpan") or 1,
            ),
        )
        order = others[:index] + [case["moving"]] + others[index:]
        resolved, _ = resolve_grid(
            [
                dict(target) if node == case["moving"] else dict(layouts[node])
                for node in order
            ],
            columns,
        )

        placements = {
            node: _dump(rect) for node, rect in zip(order, resolved, strict=True)
        }

        assert order == case["order"], case["name"]
        assert placements == case["expected"], case["name"]
