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

import pytest

from superset.mcp_service.dashboard.layout_placement import (
    _EMOJI_RE,
    _normalize_tab_text,
)


def test_emoji_ranges_match_only_documented_code_points() -> None:
    """Check every Unicode code point, including gaps and U+FFFD."""
    ranges = (
        (0x1F300, 0x1F5FF),
        (0x1F600, 0x1F64F),
        (0x1F680, 0x1F6FF),
        (0x1F900, 0x1F9FF),
        (0x1FA70, 0x1FAFF),
        (0x2600, 0x26FF),
        (0x2700, 0x27BF),
        (0xFE00, 0xFE0F),
    )
    expected = {0x200D}
    for start, end in ranges:
        block = set(range(start, end + 1))
        assert expected.isdisjoint(block)
        expected.update(block)

    actual = {
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
