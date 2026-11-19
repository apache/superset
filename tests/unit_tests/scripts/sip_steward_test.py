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
"""Tests for ``scripts/sip_steward.py``.

The script is not installed as a package, so it is loaded via importlib from
its filesystem path. These cover the decisions that must never go wrong:
title parsing and numbering, subject classification, vote outcomes, and
matching mailing list threads to the right SIP issue.
"""

import importlib.util
import sys
from pathlib import Path
from typing import Any, Optional

import pytest

_SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "sip_steward.py"
_spec = importlib.util.spec_from_file_location("sip_steward", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
sip_steward = importlib.util.module_from_spec(_spec)
# Dataclasses look their module up in sys.modules while being created.
sys.modules["sip_steward"] = sip_steward
_spec.loader.exec_module(sip_steward)

Issue = sip_steward.Issue
Email = sip_steward.Email


def make_issue(
    number: int, title: str, state: str = "open", body: str = ""
) -> Any:  # sip_steward.Issue, loaded at runtime
    return Issue(
        number=number,
        title=title,
        state=state,
        labels={"sip"},
        body=body,
        created_at="2026-01-01T00:00:00Z",
        html_url=f"https://github.com/apache/superset/issues/{number}",
    )


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("[SIP-180] Implement a check", (True, "180")),
        ("[SIP-116v2] Calendar picker, revisited", (True, "116v2")),
        ("[sip 42] lower case", (True, "42")),
        ("[SIP] Proposal for something", (True, None)),
        ("[SIP-XXX] Placeholder number", (True, None)),
        ("Not a SIP at all", (False, None)),
        ("[SIPS] Lookalike", (False, None)),
    ],
)
def test_parse_title(title: str, expected: tuple[bool, Optional[str]]) -> None:
    assert sip_steward.parse_title(title) == expected


def test_numbered_title_replaces_the_prefix() -> None:
    assert (
        sip_steward.numbered_title("[SIP] Proposal for X", 244)
        == "[SIP-244] Proposal for X"
    )


def test_max_sip_number_ignores_unnumbered_and_suffixes() -> None:
    titles = ["[SIP-240] A", "[SIP-116v2] B", "[SIP] C", "Unrelated 999"]
    assert sip_steward.max_sip_number(titles) == 240


def test_duplicate_numbers_need_an_open_issue() -> None:
    issues = [
        make_issue(1, "[SIP-10] A"),
        make_issue(2, "[SIP-10] B", state="closed"),
        make_issue(3, "[SIP-11] C", state="closed"),
        make_issue(4, "[SIP-11] D", state="closed"),
    ]
    assert sip_steward.duplicate_numbers(issues) == {"10": [1, 2]}


@pytest.mark.parametrize(
    ("subject", "kind", "is_reply", "key"),
    [
        ("[DISCUSS] SIP-180: Optional warnings", "DISCUSS", False, "180"),
        ("[VOTE][SIP-228] SQL Lab LeftBar", "VOTE", False, "228"),
        ("[RESULT][VOTE][SIP-228] SQL Lab LeftBar", "RESULT", False, "228"),
        ("[RESULT] SIP-182 Semantic Layer", "RESULT", False, "182"),
        ("Re: [VOTE] SIP-230: Download reason", "VOTE", True, "230"),
        ("[DISCUSS] SIP-116v2, revisiting", "DISCUSS", False, "116v2"),
        ("Should the picker go in the filter?", None, False, None),
    ],
)
def test_classify_subject(
    subject: str, kind: Optional[str], is_reply: bool, key: Optional[str]
) -> None:
    got = sip_steward.classify_subject(subject)
    assert got[:3] == (kind, is_reply, key)


def test_classify_subject_core_title() -> None:
    _, _, _, core = sip_steward.classify_subject(
        "[DISCUSS] SIP-236: Proposal for dynamically selecting max values"
    )
    assert core == "dynamically selecting max values"


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("The vote PASSES with four binding +1s.", "passed"),
        ("The vote has PASSED with 3 binding +1.", "passed"),
        ("SIP-216 is officially accepted.", "passed"),
        ("The vote fails with 2 binding +1s.", "failed"),
        ("> The vote PASSED\nquoted text only", None),
        ("Thanks everyone for voting.", None),
    ],
)
def test_result_regex(body: str, expected: Optional[str]) -> None:
    assert sip_steward.result_regex(body) == expected


def test_evidence_must_be_a_real_quote() -> None:
    source = "Please discuss the gauge chart\n  max values proposal here."
    assert sip_steward.evidence_ok("the gauge chart max values", source)
    assert not sip_steward.evidence_ok("the spreadsheet chart", source)
    assert not sip_steward.evidence_ok("gauge", source)  # too short to mean much
    assert not sip_steward.evidence_ok(None, source)


def test_current_stage_takes_the_furthest_label() -> None:
    assert sip_steward.current_stage({"sip"}) == -1
    assert sip_steward.current_stage({"sip:in-discussion", "sip:voting"}) == 1


def test_parse_and_render_comments() -> None:
    text = (
        "<!-- header, ignored -->\n"
        "<!-- STAGE voting -->\n"
        "See the [VOTE thread]({vote_url}) for SIP-{number}.\n"
        "<!-- STAGE approved -->\n"
        "It [passed]({result_url}).\n"
    )
    comments = sip_steward.parse_comments(text)
    assert set(comments) == {"voting", "approved"}
    assert (
        sip_steward.render_comment(
            comments["voting"], {"vote_url": "https://x/v", "number": "7"}
        )
        == "See the [VOTE thread](https://x/v) for SIP-7."
    )
    # An unknown link target becomes plain text rather than a broken link.
    assert sip_steward.render_comment(comments["approved"], {}) == "It passed."


ISSUES = {
    45717: make_issue(45717, "[SIP-240] Dynamically selecting max values for gauges"),
    45265: make_issue(45265, "[SIP-236] Spreadsheet chart built on Univer"),
    34384: make_issue(34384, "[SIP-180] Cost Estimation Pre-Query Check"),
}


def test_match_by_issue_link() -> None:
    email = Email(
        "a" * 32,
        "[DISCUSS] SIP-180: Optional query estimate warnings",
        0,
        "SIP: https://github.com/apache/superset/issues/34384",
    )
    match = sip_steward.match_email(email, ISSUES, None)
    assert (match.issue, match.how) == (34384, "issue link")


def test_link_that_disagrees_with_a_strong_subject_match_is_not_trusted() -> None:
    email = Email(
        "d" * 32,
        "[VOTE] SIP-236: Spreadsheet chart on Univer, max values for gauges",
        0,
        "See https://github.com/apache/superset/issues/45717",
    )
    match = sip_steward.match_email(email, ISSUES, None)
    assert match.issue is None
    assert {45717, 45265} <= set(match.candidates)


def test_numbered_title_is_capped_at_githubs_limit() -> None:
    assert len(sip_steward.numbered_title("x" * 256, 123)) == 256


def test_match_by_number_and_title() -> None:
    email = Email("b" * 32, "[VOTE] SIP-236: Spreadsheet chart on Univer", 0, "")
    assert sip_steward.match_email(email, ISSUES, None).issue == 45265


def test_reused_number_with_a_different_title_is_not_matched_without_model() -> None:
    # The thread went out as SIP-236 before the gauge SIP was renumbered to
    # SIP-240; SIP-236 now belongs to an unrelated proposal.
    email = Email(
        "c" * 32,
        "[DISCUSS] SIP-236: Proposal for dynamically selecting max values for gauges",
        0,
        "",
    )
    match = sip_steward.match_email(email, ISSUES, None)
    assert match.issue is None
    assert 45717 in match.candidates


def test_model_answer_is_used_only_if_it_picks_a_candidate() -> None:
    email = Email(
        "d" * 32,
        "[DISCUSS] SIP-236: Proposal for dynamically selecting max values for gauges",
        0,
        "",
    )
    assert sip_steward.match_email(email, ISSUES, lambda e, c: 45717).issue == 45717
    assert sip_steward.match_email(email, ISSUES, lambda e, c: 99999).issue is None
    assert sip_steward.match_email(email, ISSUES, lambda e, c: None).issue is None


def test_unrelated_email_matches_nothing() -> None:
    email = Email("e" * 32, "[DISCUSS] Release 7.0 planning", 0, "")
    match = sip_steward.match_email(email, ISSUES, lambda e, c: 34384)
    assert match.issue is None
    assert match.candidates == []
