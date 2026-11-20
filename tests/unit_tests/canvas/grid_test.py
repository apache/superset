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

from superset.canvas.definition.grid import (
    Rect,
    replay_places,
    resolve_grid,
    span_errors,
    swap_places,
)


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


def test_an_explicit_collision_slides_along_the_row_and_is_stored() -> None:
    """
    Aside, not down, while the row has room for it.

    Pushing it down would send it to a row of its own and leave the space
    beside it empty, so dropping one widget beside another took a drop and
    then a drag back.
    """
    rects, stored = resolve_grid(
        [
            {"col": 1, "row": 1, "colSpan": 12, "rowSpan": 3},
            {"col": 7, "row": 2, "colSpan": 12, "rowSpan": 2},
        ],
        24,
    )

    assert rects[1] == Rect(13, 2, 12, 2)
    assert stored[1] == {"col": 13, "row": 2, "colSpan": 12, "rowSpan": 2}


def test_an_explicit_collision_goes_down_once_the_row_is_full() -> None:
    """And back to the column it asked for, since that row is clear."""
    rects, stored = resolve_grid(
        [
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
            {"col": 1, "row": 1, "colSpan": 24, "rowSpan": 4},
        ],
        24,
    )

    assert rects[1] == Rect(1, 5, 24, 4)
    assert stored[1] == {"col": 1, "row": 5, "colSpan": 24, "rowSpan": 4}


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


def test_the_shared_fixture_is_what_the_generator_would_write() -> None:
    """
    The fixture is generated from these rules, so a change to them that nobody
    regenerated leaves a file claiming the server does something it no longer
    does -- and the client would be held to the stale answer.

    Only the answers are compared: the inputs are hand-written in the script
    and are the one part a person is meant to edit.
    """
    import sys
    from pathlib import Path

    root = Path(__file__).parents[3]
    sys.path.insert(0, str(root))
    from scripts.canvas.generate_grid_cases import build  # noqa: PLC0415

    fresh, checked_in = build(), _shared_fixture()

    for key, by in (
        ("cases", "stored"),
        ("previewCases", "order"),
        ("swapCases", "exchanged"),
    ):
        assert [case["name"] for case in fresh[key]] == [
            case["name"] for case in checked_in[key]
        ], f"{key}: regenerate with scripts/canvas/generate_grid_cases.py"
        for generated, stored in zip(fresh[key], checked_in[key], strict=True):
            assert generated["expected"] == stored["expected"], generated["name"]
            assert generated[by] == stored[by], generated["name"]


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

    Driven through ``replay_places``, which is what ``bring_forward`` reorders
    with. Spelling the rule out a second time here would let this pass while
    the implementation that actually runs drifted -- which is the one thing
    these cases exist to prevent.
    """
    cases = _shared_fixture()["previewCases"]
    assert len(cases) > 5, "the fixture must not be empty or this passes vacuously"

    for case in cases:
        order, rects = replay_places(
            case["childIds"],
            {node: dict(layout) for node, layout in case["layouts"].items()},
            [(case["moving"], dict(case["target"]))],
            case["columns"],
        )

        placements = {
            node: _dump(rect) for node, rect in zip(order, rects, strict=True)
        }

        assert order == case["order"], case["name"]
        assert placements == case["expected"], case["name"]


def test_shared_swap_cases_match_this_implementation() -> None:
    """
    Two children changing places, which the client mirrors in
    ``swapPlacements`` so a drag can show the exchange before it is written.

    The whole grid settles around them, not just the two: the case with a
    bystander is the one that catches a mirror which moves only the pair, as
    the first attempt at this did.
    """
    cases = _shared_fixture()["swapCases"]
    assert len(cases) > 5, "the fixture must not be empty or this passes vacuously"

    for case in cases:
        exchanged, order, rects = swap_places(
            case["childIds"],
            {node: dict(layout) for node, layout in case["layouts"].items()},
            case["columns"],
            case["nodeId"],
            case["partnerId"],
        )

        placements = {
            node: _dump(rect) for node, rect in zip(order, rects, strict=True)
        }

        assert exchanged == case["exchanged"], case["name"]
        assert order == case["order"], case["name"]
        assert placements == case["expected"], case["name"]
