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
"""R10-02: a second decision on a decided change answered 500.

``RequestAlreadyDecidedError`` was written for exactly this event -- two
reviewers on one queue, or one reviewer with the panel open in a second tab
-- and it declares ``status = 409`` on itself. But ``_act``'s ladder names
the statuses it returns in literal tuples, and this one was never added to
the 409 tuple, so it fell through to the ``ChangeManagementException``
catch-all: ``logger.exception`` and a 500.

The reviewer therefore met a server error on an outcome the workflow had
already anticipated and written a sentence for, and the sentence was
logged as a crash instead of being read out.

The ladder is restated here as a table, so the next refusal that declares a
status cannot be added to :mod:`asset_approval.exceptions` and forgotten
here.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval.api import ChangeRequestRestApi
from asset_approval.exceptions import (
    ApprovalForbiddenError,
    AuthorNoLongerEditorError,
    ChangeManagementException,
    ChangeRequestNotFoundError,
    InvalidTransitionError,
    NoEligibleApproverError,
    NothingToReviewError,
    RequestAlreadyDecidedError,
    RequestLeftReviewError,
    ReviewedVersionStaleError,
    ReviewNoteRequiredError,
    StaleBaselineError,
)

#: Every refusal a lifecycle action can put in front of ``_act``, with the
#: status the caller is owed. Built from the raise sites in
#: :mod:`asset_approval.lifecycle`.
REFUSALS: list[tuple[ChangeManagementException, int]] = [
    (ChangeRequestNotFoundError(1), 404),
    (ApprovalForbiddenError("approve"), 403),
    (ReviewNoteRequiredError(), 422),
    (NoEligibleApproverError("dashboard"), 422),
    (NothingToReviewError("dashboard"), 422),
    (AuthorNoLongerEditorError("Alex Author"), 409),
    (InvalidTransitionError("draft", "approved"), 409),
    (RequestLeftReviewError("Alex Author", "approved"), 409),
    (ReviewedVersionStaleError("approving"), 409),
    (StaleBaselineError(["positions"]), 409),
    (RequestAlreadyDecidedError("approved", "approved", "Rhea Reviewer"), 409),
]


def _declares_its_own_status(refusal: type[ChangeManagementException]) -> bool:
    """Whether this class sets ``status`` itself.

    ``SupersetException`` hands every subclass a default of 500, so merely
    having the attribute says nothing. What matters is a class that went to
    the trouble of naming a different one, because that is a promise the
    ladder in ``_act`` has to keep.
    """
    return "status" in vars(refusal)


def _answered(raised: ChangeManagementException) -> int:
    """The status ``_act`` hands back when ``action()`` raises ``raised``.

    ``self`` is stubbed rather than built: ``_act`` touches nothing on it
    but the two response helpers, and with no ``reload_pk`` it never reaches
    the reload either. That keeps the ladder itself under test instead of
    FAB's response machinery.
    """

    def raise_it() -> None:
        raise raised

    recorder: Any = SimpleNamespace(
        response=lambda status, **_kwargs: status,
        response_404=lambda: 404,
    )
    answer: Any = ChangeRequestRestApi._act(recorder, raise_it, "done")
    return int(answer)


@pytest.mark.parametrize(
    ("raised", "expected"),
    [pytest.param(r, s, id=type(r).__name__) for r, s in REFUSALS],
)
def test_each_refusal_is_answered_with_its_own_status(
    raised: ChangeManagementException, expected: int
) -> None:
    assert _answered(raised) == expected


def test_a_decided_change_is_a_conflict_and_not_a_crash() -> None:
    """R10-02 itself, stated on its own so the row has a home.

    Both buttons that can meet a decided request, because the message is
    phrased for the button pressed and either one used to be a 500.
    """
    for action in ("approved", "sent back"):
        raised = RequestAlreadyDecidedError("approved", action, "Rhea Reviewer")

        assert _answered(raised) == 409
        assert "Rhea Reviewer" in str(raised)


def test_the_status_a_refusal_declares_is_the_status_it_gets() -> None:
    """The structural half, and the reason R10-02 was reachable.

    Each of these classes carries ``status`` already. The ladder restates it
    in a literal tuple, so the two can disagree -- and for
    ``RequestAlreadyDecidedError`` they did. Nothing here stops a future
    exception being left out of the ladder, but this fails the moment one
    that declares a status is answered with a different one.
    """
    declared = [(r, s) for r, s in REFUSALS if _declares_its_own_status(type(r))]

    assert declared, "no refusal declares a status any more; the table is stale"
    for raised, expected in declared:
        says = type(raised).status
        assert says == expected, (
            f"{type(raised).__name__} declares {says}, but the table expects {expected}"
        )
        assert _answered(raised) == expected
