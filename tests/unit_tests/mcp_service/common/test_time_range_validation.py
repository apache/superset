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

"""Unit tests for the shared MCP time_range validator.

These cases mirror the live-testing findings from SC-114824: values that
superset.utils.date_parser.get_since_until() silently resolves to an
unbounded (None, today) range -- rather than raising -- must be rejected
here instead of reaching that function.
"""

from __future__ import annotations

import pytest

from superset.mcp_service.common.time_range_validation import (
    BRACKET_SHORTHAND_TO_TIME_RANGE,
    validate_time_range,
)
from superset.utils.date_parser import get_since_until


class TestValidateTimeRangePassthrough:
    """Values get_since_until() already resolves correctly pass through
    unchanged (aside from whitespace trimming)."""

    def test_none_passes_through(self) -> None:
        assert validate_time_range(None) is None

    def test_empty_string_passes_through(self) -> None:
        assert validate_time_range("") == ""

    def test_whitespace_only_becomes_empty(self) -> None:
        assert validate_time_range("   ") == ""

    def test_no_filter_sentinel_passes_through(self) -> None:
        assert validate_time_range("No filter") == "No filter"

    @pytest.mark.parametrize(
        "value",
        [
            "Last 7 days",
            "Last month",
            "Last year",
            "Last quarter",
            "Last week",
            "Next 5 days",
            "Next month",
            "previous calendar week",
            "previous calendar month",
            "previous calendar quarter",
            "previous calendar year",
            "Current day",
            "Current week",
            "Current month",
            "Current quarter",
            "Current year",
            "first week of this year",
            "first month of this quarter",
            "first week of last month",
        ],
    )
    def test_recognized_bare_prefix_unchanged(self, value: str) -> None:
        assert validate_time_range(value) == value
        # Cross-check against the real parser: every accepted value must
        # actually resolve to a bounded range, not just avoid raising here.
        since, until = get_since_until(time_range=value)
        assert since is not None
        assert until is not None

    @pytest.mark.parametrize(
        "value",
        [
            "2024-01-01 : 2024-12-31",
            "2003-01-01 : 2004-01-01",
            "yesterday : tomorrow",
            "banana : split",  # has a separator; loud parse errors happen downstream
        ],
    )
    def test_separator_containing_value_unchanged(self, value: str) -> None:
        assert validate_time_range(value) == value

    def test_strips_surrounding_whitespace(self) -> None:
        assert validate_time_range("  Last 7 days  ") == "Last 7 days"


class TestValidateTimeRangeBracketShorthand:
    """Bracket shorthands (from apache/superset#42144) still auto-correct."""

    @pytest.mark.parametrize("bracket", sorted(BRACKET_SHORTHAND_TO_TIME_RANGE))
    def test_bracket_shorthand_normalizes(self, bracket: str) -> None:
        result = validate_time_range(bracket)
        assert result == BRACKET_SHORTHAND_TO_TIME_RANGE[bracket]
        since, until = get_since_until(time_range=result)
        assert since is not None
        assert until is not None
        assert since < until

    def test_bracket_shorthand_case_insensitive(self) -> None:
        assert validate_time_range("[YEAR]") == "Last year"

    def test_bracket_shorthand_whitespace_tolerant(self) -> None:
        assert validate_time_range("  [year]  ") == "Last year"

    def test_unrecognized_bracket_shorthand_rejected(self) -> None:
        """'[decade]' is not one of the eight recognized grain tokens."""
        with pytest.raises(ValueError, match="Unrecognized time_range"):
            validate_time_range("[decade]")


class TestValidateTimeRangeRejectsSilentFailures:
    """Regression guard: values that silently produced a full-table match
    (SC-114824) must now raise instead."""

    @pytest.mark.parametrize(
        "value",
        [
            "banana",
            "this week",
            "this month",
            "last week",  # lowercase -- get_since_until requires "Last"
            "yesterday",
            "[decade]",
        ],
    )
    def test_previously_silent_values_now_raise(self, value: str) -> None:
        # Confirm the premise: get_since_until() really does silently
        # discard this value (unbounded start, no exception) before
        # asserting our validator closes the gap.
        since, until = get_since_until(time_range=value)
        assert since is None

        with pytest.raises(ValueError, match="Unrecognized time_range"):
            validate_time_range(value)
