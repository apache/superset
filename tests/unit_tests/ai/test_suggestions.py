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
Model-generated opening suggestions.

The client keeps its own locally derived list, so every failure mode here has to
end in an empty list rather than an exception — an empty return is what makes the
fallback take over.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest


def test_parsing_a_plain_json_array() -> None:
    """The shape the instruction asks for."""
    from superset.ai.suggestions import _parse

    assert _parse('["How many orders?", "Revenue by region?"]', 3) == [
        "How many orders?",
        "Revenue by region?",
    ]


def test_parsing_tolerates_a_code_fence_and_preamble() -> None:
    """
    A model that wraps the array has still done the useful part.

    Being strict here would throw away a good answer over presentation.
    """
    from superset.ai.suggestions import _parse

    fenced = 'Here you go:\n```json\n["One?", "Two?"]\n```'
    assert _parse(fenced, 3) == ["One?", "Two?"]


def test_parsing_caps_to_the_requested_count() -> None:
    """A model that ignores the limit does not get to overflow the row."""
    from superset.ai.suggestions import _parse

    assert _parse('["a", "b", "c", "d", "e"]', 2) == ["a", "b"]


def test_parsing_drops_duplicates_case_insensitively() -> None:
    """Variety was asked for; near-duplicates are not variety."""
    from superset.ai.suggestions import _parse

    assert _parse('["Revenue?", "revenue?", "Orders?"]', 3) == [
        "Revenue?",
        "Orders?",
    ]


def test_parsing_drops_non_strings_and_blanks() -> None:
    """A ragged array yields only its usable entries."""
    from superset.ai.suggestions import _parse

    assert _parse('["Good?", "", 5, null, {"a": 1}, "  ", "Also good?"]', 3) == [
        "Good?",
        "Also good?",
    ]


def test_parsing_clips_an_overlong_suggestion() -> None:
    """A chip cannot show an essay, so one is not stored."""
    from superset.ai.suggestions import _parse, MAX_SUGGESTION_CHARS

    [only] = _parse(f'["{"x" * 500}"]', 1)
    assert len(only) == MAX_SUGGESTION_CHARS


def test_parsing_salvages_an_array_wrapped_in_an_object() -> None:
    """
    A model that replies ``{"prompts": [...]}`` has still answered.

    The array is taken from wherever it is, which is the same tolerance that
    handles a code fence: the instruction asks for a bare array, but refusing a
    near-miss would drop a perfectly good answer.
    """
    from superset.ai.suggestions import _parse

    assert _parse('{"prompts": ["How many orders?"]}', 3) == ["How many orders?"]


@pytest.mark.parametrize(
    "reply",
    [
        "",
        "   ",
        "not json at all",
        "[unclosed",
        "[]",
    ],
)
def test_parsing_an_unusable_reply_yields_nothing(reply: str) -> None:
    """Every unusable reply degrades to the client's own list."""
    from superset.ai.suggestions import _parse

    assert _parse(reply, 3) == []


def test_disabled_by_default_costs_no_round_trip() -> None:
    """
    The feature is opt-in, and being off must not reach the provider.

    Asserted by making the provider raise: a call at all is the failure.
    """
    from superset.ai import suggestions

    def explode() -> Any:
        raise AssertionError("the provider must not be consulted when disabled")

    with patch.object(suggestions, "_config", lambda key, default: default):
        with patch("superset.ai.factories.get_provider", explode):
            assert (
                suggestions.suggest_prompts(
                    {"pageType": "dashboard", "dashboardContext": {"title": "Sales"}}
                )
                == []
            )


def test_no_page_context_costs_no_round_trip() -> None:
    """
    With nothing on screen worth describing there is nothing to be specific about.

    A generic model-authored list is no better than the client's own and costs a
    request, so the request is not made.
    """
    from superset.ai import suggestions

    def explode() -> Any:
        raise AssertionError("the provider must not be consulted without context")

    enabled = {"AI_SUGGESTED_PROMPTS_ENABLED": True}
    with patch.object(
        suggestions, "_config", lambda key, default: enabled.get(key, default)
    ):
        with patch("superset.ai.factories.get_provider", explode):
            for empty in (None, {}, {"pageType": "home"}):
                assert suggestions.suggest_prompts(empty) == [], empty


def test_a_provider_failure_is_swallowed() -> None:
    """A suggestion outage costs three chips, not the panel."""
    from superset.ai import suggestions

    def explode() -> Any:
        raise RuntimeError("gateway is down")

    enabled = {"AI_SUGGESTED_PROMPTS_ENABLED": True}
    with patch.object(
        suggestions, "_config", lambda key, default: enabled.get(key, default)
    ):
        with patch("superset.ai.factories.get_provider", explode):
            assert (
                suggestions.suggest_prompts(
                    {"pageType": "dashboard", "dashboardContext": {"title": "Sales"}}
                )
                == []
            )
