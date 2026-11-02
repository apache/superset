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

"""Regression tests for emoji-insensitive dashboard tab matching."""

import sys
from typing import Any

import pytest

from superset.mcp_service.dashboard.layout_placement import (
    _EMOJI_RE,
    _normalize_tab_text,
    collect_available_tab_names,
    find_tab_insert_target,
)


def test_emoji_ranges_match_only_documented_code_points() -> None:
    """Check every Unicode code point, including gaps and U+FFFD."""
    ranges: tuple[tuple[int, int], ...] = (
        (0x1F300, 0x1F5FF),
        (0x1F600, 0x1F64F),
        (0x1F680, 0x1F6FF),
        (0x1F900, 0x1F9FF),
        (0x1FA70, 0x1FAFF),
        (0x2600, 0x26FF),
        (0x2700, 0x27BF),
        (0xFE00, 0xFE0F),
    )
    expected: set[int] = {0x200D}
    for start, end in ranges:
        block: set[int] = set(range(start, end + 1))
        assert expected.isdisjoint(block)
        expected.update(block)

    actual: set[int] = {
        code_point
        for code_point in range(sys.maxunicode + 1)
        if _EMOJI_RE.fullmatch(chr(code_point))
    }
    assert actual == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("  📊 Sales 🚀  ", "sales"),
        ("😀 🤖 🪐 ☀ ✂ Revenue", "revenue"),
        ("👩\u200d💻 Forecast ☀\ufe0f", "forecast"),
        ("  Sales [A-Z] ^_` \\  ", "sales [a-z] ^_` \\"),
        ("Sales \ufffd", "sales \ufffd"),
        ("Équipe 東京", "équipe 東京"),
        (None, ""),
        ("", ""),
    ],
)
def test_normalize_tab_text(text: str | None, expected: str) -> None:
    """Strip intended emoji while preserving ordinary labels and punctuation."""
    assert _normalize_tab_text(text) == expected


@pytest.mark.parametrize("parent_type", ["TAB", "COLUMN"])
def test_nested_tab_matching_at_any_depth(parent_type: str) -> None:
    """Find nested tabs without changing default or top-level match priority."""
    layout: dict[str, Any] = {
        "ROOT_ID": {"children": ["GRID_ID"]},
        "GRID_ID": {"children": ["container", "TABS-top"]},
        "container": {"type": parent_type, "children": ["TABS-nested"]},
        "TABS-top": {"type": "TABS", "children": ["TAB-top"]},
        "TAB-top": {"type": "TAB", "meta": {"text": "Shared"}},
        "TABS-nested": {"type": "TABS", "children": ["TAB-nested", "TAB-shared"]},
        "TAB-nested": {"type": "TAB", "meta": {"text": "📊 Nested"}},
        "TAB-shared": {"type": "TAB", "meta": {"text": "Shared"}},
    }
    assert find_tab_insert_target(layout) == "TAB-top"
    assert find_tab_insert_target(layout, "Shared") == "TAB-top"
    assert find_tab_insert_target(layout, "nested") == "TAB-nested"
    assert find_tab_insert_target(layout, "TAB-nested") == "TAB-nested"
    assert collect_available_tab_names(layout) == [
        "Shared (TAB-top)",
        "📊 Nested (TAB-nested)",
        "Shared (TAB-shared)",
    ]
    layout["GRID_ID"]["children"].remove("TABS-top")
    assert find_tab_insert_target(layout) is None
    assert find_tab_insert_target(layout, "nested") == "TAB-nested"
