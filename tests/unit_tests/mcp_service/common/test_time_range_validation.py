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
from freezegun import freeze_time

from superset.commands.chart.exceptions import TimeRangeParseFailError
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


class TestValidateTimeRangeSubDayLast:
    """Sub-day ``Last ...`` values are rewritten to an explicit DATEADD range.

    get_since_until() pairs a sub-day since-expression (resolved against
    ``now``) with a default until of ``today`` (midnight), so since lands
    after until and it raises "From date cannot be larger than to date".
    Anchoring both ends on ``now`` fixes that.
    """

    @pytest.mark.parametrize(
        "value,expected",
        [
            ("Last second", "DATEADD(DATETIME('now'), -1, SECOND) : DATETIME('now')"),
            ("Last minute", "DATEADD(DATETIME('now'), -1, MINUTE) : DATETIME('now')"),
            ("Last hour", "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"),
            (
                "Last 30 seconds",
                "DATEADD(DATETIME('now'), -30, SECOND) : DATETIME('now')",
            ),
            (
                "Last 5 minutes",
                "DATEADD(DATETIME('now'), -5, MINUTE) : DATETIME('now')",
            ),
            ("Last 2 hours", "DATEADD(DATETIME('now'), -2, HOUR) : DATETIME('now')"),
            ("Last 1 hour", "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"),
            # Unit casing is ignored -- the downstream parser is
            # case-insensitive about it, so "Last Hour" fails identically.
            ("Last Hour", "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"),
        ],
    )
    @freeze_time("2026-08-05 12:00:00")
    def test_sub_day_last_normalizes(self, value: str, expected: str) -> None:
        # Freeze away from midnight so the raw parser's since > today premise
        # remains deterministic for every sub-day case.
        with pytest.raises(ValueError, match="From date cannot be larger"):
            get_since_until(time_range=value)

        result = validate_time_range(value)
        assert result == expected
        since, until = get_since_until(time_range=result)
        assert since is not None
        assert until is not None
        assert since < until

    @pytest.mark.parametrize(
        "value",
        [
            "Last day",
            "Last week",
            "Last 7 days",
            "Last month",
            "Last quarter",
            "Last year",
            # Freeform tails get_since_until() resolves via its own parser --
            # a unit whitelist would wrongly reject these.
            "Last Monday",
            "Last January",
            "Last year to date",
            "Last 3 days ago",
        ],
    )
    def test_day_and_coarser_last_values_untouched(self, value: str) -> None:
        assert validate_time_range(value) == value
        since, until = get_since_until(time_range=value)
        assert since is not None
        assert until is not None
        assert since < until

    def test_lowercase_last_sub_day_not_normalized(self) -> None:
        """The "Last" prefix stays case-sensitive, mirroring
        get_since_until()'s own check -- "last hour" doesn't match its
        rewrite either, so it's an unrecognized bare value, not a
        normalization target."""
        with pytest.raises(ValueError, match="Unrecognized time_range"):
            validate_time_range("last hour")

    def test_next_sub_day_passes_through_unchanged(self) -> None:
        """ "Next <sub-day unit>" doesn't hit the since/until mismatch --
        get_since_until() pairs it with a "today" (midnight) since, which
        is always <= the "now"-based until -- so it needs no normalization."""
        assert validate_time_range("Next hour") == "Next hour"
        since, until = get_since_until(time_range="Next hour")
        assert since is not None
        assert until is not None
        assert since < until


class TestValidateTimeRangeBracketShorthand:
    """Bracket shorthands (from apache/superset#42144) still auto-correct."""

    @pytest.mark.parametrize("bracket", sorted(BRACKET_SHORTHAND_TO_TIME_RANGE))
    def test_bracket_shorthand_normalizes(self, bracket: str) -> None:
        result = validate_time_range(bracket)
        # Sub-day shorthands route through the DATEADD rewrite; the rest
        # resolve as the plain "Last <unit>" they map to.
        assert result == validate_time_range(BRACKET_SHORTHAND_TO_TIME_RANGE[bracket])
        since, until = get_since_until(time_range=result)
        assert since is not None
        assert until is not None
        assert since < until

    def test_bracket_shorthand_case_insensitive(self) -> None:
        assert validate_time_range("[YEAR]") == "Last year"

    def test_sub_day_bracket_shorthand_matches_bare_form(self) -> None:
        """'[hour]' and 'Last hour' converge on the same canonical range."""
        assert validate_time_range("[hour]") == validate_time_range("Last hour")

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


class TestValidateTimeRangeRejectsMalformedPrefixes:
    """A recognized prefix is not enough -- the value has to actually parse.

    These start with "Last"/"Next" but blow up inside get_since_until(),
    so they'd otherwise surface as a low-level parse error deep in the
    query path instead of a field-level ValidationError the caller can act
    on.
    """

    @pytest.mark.parametrize(
        "value",
        [
            "Last nonsense",
            "Next nonsense",
            "Last",
            "Next",
            "Lastly",
            "Lastminute",
            "Last decade",
            "Last fortnight",
        ],
    )
    def test_unparseable_prefixed_values_rejected(self, value: str) -> None:
        # Confirm the premise: the raw value doesn't survive the parser.
        with pytest.raises(TimeRangeParseFailError):
            get_since_until(time_range=value)

        with pytest.raises(ValueError, match="Unrecognized time_range"):
            validate_time_range(value)

    def test_prefix_lookalike_that_silently_matches_is_rejected(self) -> None:
        """'Lasagna' starts with neither prefix but shares 'Las' -- it takes
        the silent unbounded path, not the raising one."""
        since, _ = get_since_until(time_range="Lasagna")
        assert since is None

        with pytest.raises(ValueError, match="Unrecognized time_range"):
            validate_time_range("Lasagna")
