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
"""What a refusal says, for every button that can be refused.

Three rows live here, because they are one subject: the words a person is
given when the answer is no.

**QA-10.** Every refusal used to say "You cannot approve this change",
whatever had been pressed. A viewer who pressed Discard, and an author who
pressed Withdraw on a change that had moved on, were both told something
about approving — a button neither of them had touched. *Why* the answer is
no stays undisclosed on purpose (Visa Q1): telling someone who has just
been told they have no say exactly who does is worse. *What* was refused is
not a secret.

**QA-20.** An author with no second editor must be told so plainly and
offered the fix. SOW 5.4 is explicit that this must never auto-approve, and
silence here is what an auto-approval would feel like from the outside.

**The lock.** "another editor already has changes open" named a colleague
the code had not identified. The commonest way to reach that message is one
author whose Save fired twice, so the colleague frequently did not exist.
Where there is a name it is used; where there is not, the asset is
described instead of a person being invented.
"""

from __future__ import annotations

import pytest
from asset_approval.exceptions import (
    ApprovalForbiddenError,
    AssetLockedError,
    NoEligibleApproverError,
)


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        ("approve", "You cannot approve this change."),
        ("review", "You cannot review this change."),
        ("withdraw", "Only the author can withdraw this change."),
        ("discard", "You cannot discard this change."),
    ],
)
def test_each_button_is_refused_in_its_own_words(
    action: str, expected: str
) -> None:
    assert str(ApprovalForbiddenError(action)) == expected


def test_the_four_refusals_are_four_different_sentences() -> None:
    """The structural half. Four lookups into one dict all return a string
    whatever it holds, so assert they are distinct rather than trusting the
    table above to have been filled in."""
    said = {str(ApprovalForbiddenError(a)) for a in ApprovalForbiddenError.MESSAGES}
    assert len(said) == len(ApprovalForbiddenError.MESSAGES)


def test_an_unknown_action_still_refuses() -> None:
    """Fail closed on the wording too: an action nobody has mapped is
    refused in the safest terms rather than raising inside the refusal."""
    assert "cannot" in str(ApprovalForbiddenError("something-new"))


def test_a_refusal_never_says_who_could_have_said_yes() -> None:
    """Visa Q1. The refusal names the action, never the people."""
    for action in ApprovalForbiddenError.MESSAGES:
        message = str(ApprovalForbiddenError(action))
        assert "editor" not in message.lower()
        assert "admin" not in message.lower()


@pytest.mark.parametrize("asset_type", ["dashboard", "chart", "dataset"])
def test_no_approver_says_so_and_says_what_to_do(asset_type: str) -> None:
    message = str(NoEligibleApproverError(asset_type))

    assert f"No one else can approve this {asset_type}." in message
    assert "Add another editor" in message


def test_a_held_asset_names_the_holder_when_it_knows_them() -> None:
    message = str(AssetLockedError("chart", 1, "Alex Rivera"))

    assert message.startswith("Alex Rivera already has changes open on this chart.")
    assert "Only one set of changes can be open at a time." in message


def test_a_held_asset_invents_nobody_when_it_does_not() -> None:
    """The defect: this read "another editor already has changes open" on a
    path that had not identified any editor, and most often reached it when
    one author pressed Save twice."""
    message = str(AssetLockedError("chart", 1))

    assert "another editor" not in message
    assert message.startswith("This chart already has changes open.")
    assert "Only one set of changes can be open at a time." in message


def test_a_caller_supplied_message_still_wins() -> None:
    """Folding across command kinds explains itself in its own words."""
    message = str(
        AssetLockedError("dashboard", 2, message="You already have other changes.")
    )

    assert message == "You already have other changes."
