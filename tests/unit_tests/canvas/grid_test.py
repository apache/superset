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
