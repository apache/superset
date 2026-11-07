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
"""QA-93: the refusal a reviewer gets is the wrong one.

The author saves again while a review is open. That folds into the open
request, rewrites the captured payload and takes the request back out of
review -- ``pending`` to ``draft``, ``submitted_at`` cleared. The reviewer,
still holding the page, presses Approve and was answered
``409 "A change request that is draft cannot be approved."``: this module's
own status vocabulary, nobody named, nothing to do.

The message written for exactly that event was never reached.
``ReviewedVersionStaleError`` -- "This change was updated after you opened
it. Review the new version before approving." -- sits behind the status
guard, and the status guard fires first.

The fix is not simply to swap the two, because two different things put an
open request back in its author's hands and only one of them writes
anything. A withdrawal writes nothing: the payload the reviewer read is
still the payload on file, so sending them to "review the new version"
sends them to re-read what they just read. So staleness is claimed on
evidence -- a revision the reviewer quoted that the request no longer has --
and a request that merely left review says where the change went instead.

Which makes the revision token load-bearing in a way it was not before, and
it was not telling the truth: ``changed_on``'s ``onupdate`` moved it on a
withdrawal too, so the evidence said "rewritten" when nothing had been. The
second half of this file is that token.
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import (
    RequestAlreadyDecidedError,
    InvalidTransitionError,
    RequestLeftReviewError,
    ReviewedVersionStaleError,
)
from asset_approval.models import ChangeRequest
from asset_approval.types import ChangeStatus
from pytest_mock import MockerFixture

#: What the reviewer's page was showing.
READ = "2026-11-04T21:04:11.100000"
#: What the author's save left behind.
REWRITTEN = "2026-11-04T21:19:58.520000"

AUTHOR = 7
REVIEWER = 9


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method this test does not exercise."""


@pytest.fixture
def review(mocker: MockerFixture) -> SimpleNamespace:
    """A request the reviewer may decide, with every other check satisfied.

    Only the request's own status and revision are left to answer, which is
    the pair this file is about.
    """
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(
            id=AUTHOR, username="alex", first_name="Alex", last_name="Author"
        ),
        author_fk=AUTHOR,
        asset_type="dashboard",
        asset_id=7,
        status=ChangeStatus.PENDING.value,
        changed_on=SimpleNamespace(isoformat=lambda: READ),
        is_open=True,
        base_dict={},
        command_args={},
        note=None,
        review_note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=_ignore,
    )
    asset = SimpleNamespace(id=7)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=REVIEWER)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=None)
    mocker.patch.object(lifecycle, "_announce_approval", _ignore)
    mocker.patch.object(lifecycle, "_keep_the_revision", _ignore)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    return request


def _saved_over(request: SimpleNamespace) -> None:
    """What the gate's fold leaves behind: a new payload, out of review."""
    request.status = ChangeStatus.DRAFT.value
    request.changed_on = SimpleNamespace(isoformat=lambda: REWRITTEN)


def _withdrawn(request: SimpleNamespace) -> None:
    """What ``withdraw`` leaves behind: the same payload, out of review."""
    request.status = ChangeStatus.DRAFT.value


# ---- the author saved over the version the reviewer read ---------------------


def test_the_reviewer_is_told_their_version_was_rewritten(
    review: SimpleNamespace,
) -> None:
    """The defect. This used to raise ``InvalidTransitionError``."""
    _saved_over(review)

    with pytest.raises(ReviewedVersionStaleError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    assert "updated after you opened it" in str(refusal.value)
    assert "Review the new version" in str(refusal.value)


def test_the_refusal_is_not_the_status_vocabulary(
    review: SimpleNamespace,
) -> None:
    """What the reviewer actually read on screen: the word "draft"."""
    _saved_over(review)

    with pytest.raises(Exception) as refusal:  # noqa: PT011
        lifecycle.approve(1, seen_revision=READ)

    assert not isinstance(refusal.value, InvalidTransitionError)
    assert "draft" not in str(refusal.value)


def test_sending_it_back_answers_the_same_way(review: SimpleNamespace) -> None:
    """``request_changes`` had the identical ordering (and no revision at all).

    It takes one now, for the refusal only -- nothing is published either
    way -- so a reviewer who presses the other button is told the same thing.
    """
    _saved_over(review)

    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.request_changes(1, "Needs a clearer title.", seen_revision=READ)


# ---- the author withdrew it, and wrote nothing ------------------------------


def test_a_withdrawn_request_is_not_called_stale(review: SimpleNamespace) -> None:
    """The distinction. There is no new version to go and read."""
    _withdrawn(review)

    with pytest.raises(RequestLeftReviewError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    assert "no longer in review" in str(refusal.value)
    assert "updated after you opened it" not in str(refusal.value)


def test_it_names_the_author_and_what_happens_next(
    review: SimpleNamespace,
) -> None:
    _withdrawn(review)

    with pytest.raises(RequestLeftReviewError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    assert "Alex Author" in str(refusal.value)
    assert "cannot be approved" in str(refusal.value)
    assert "request review" in str(refusal.value)


def test_the_other_button_is_phrased_for_itself(review: SimpleNamespace) -> None:
    _withdrawn(review)

    with pytest.raises(RequestLeftReviewError) as refusal:
        lifecycle.request_changes(1, "Needs a clearer title.", seen_revision=READ)

    assert "nothing to send back" in str(refusal.value)
    assert "cannot be approved" not in str(refusal.value)


def test_a_caller_that_quotes_no_version_is_told_where_the_change_is(
    review: SimpleNamespace,
) -> None:
    """Staleness is only ever claimed on evidence.

    With nothing quoted there is nothing to compare, so the answer falls to
    the fact that holds either way -- which is also the honest one, since a
    save and a withdrawal both leave the change with its author.
    """
    _saved_over(review)

    with pytest.raises(RequestLeftReviewError):
        lifecycle.approve(1)


# ---- what did not change ----------------------------------------------------


def test_a_request_in_review_still_approves_on_its_own_revision(
    review: SimpleNamespace,
) -> None:
    assert lifecycle.approve(1, seen_revision=READ) == "applied"


def test_a_request_in_review_that_moved_is_still_refused(
    review: SimpleNamespace,
) -> None:
    """129070, which this reordering must not undo."""
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.approve(1, seen_revision="2026-11-04T20:00:00.000000")


def test_naming_no_version_at_all_is_still_refused(
    review: SimpleNamespace,
) -> None:
    """Also 129070: an omitted field is not a waiver while it is pending."""
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.approve(1)


@pytest.mark.parametrize(
    "status", [ChangeStatus.APPROVED, ChangeStatus.DISCARDED]
)
def test_a_decided_request_names_who_decided_it(
    review: SimpleNamespace, status: ChangeStatus
) -> None:
    """It is over -- not stale, and not back with the author -- and the
    refusal has to say so in words the reviewer recognises.

    This asserted ``InvalidTransitionError`` and nothing else: the exception
    *type*, and the one type the rest of this file treats as the defect. So
    "A change request that is approved cannot be approved." passed here
    while the sibling case two screens up is held to naming somebody and
    offering an action.

    It is also the commonest way to meet a decided request -- two reviewers
    on one queue, or one reviewer with the panel open in a second tab -- and
    there the page behind the refusal still reads "Awaiting review", so a
    reviewer who cannot tell whether their own press is what landed has no
    way to find out.
    """
    review.status = status.value
    review.is_open = False
    review.reviewer = SimpleNamespace(
        first_name="Priya", last_name="Shah", username="priya"
    )

    with pytest.raises(RequestAlreadyDecidedError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    message = str(refusal.value)
    # Named, from the row's own record of the decision.
    assert "Priya Shah" in message
    # Said as what happened, not as a status.
    assert "A change request that is" not in message
    assert ("approved this change" if status is ChangeStatus.APPROVED
            else "discarded this change") in message
    # And something to do.
    assert "Reload" in message


def test_and_an_approved_one_says_it_is_live(
    review: SimpleNamespace,
) -> None:
    """The fact the reviewer most needs: it is not merely decided, it is in
    front of viewers."""
    review.status = ChangeStatus.APPROVED.value
    review.is_open = False
    review.reviewer = SimpleNamespace(
        first_name="Priya", last_name="Shah", username="priya"
    )

    with pytest.raises(RequestAlreadyDecidedError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    assert "live for viewers" in str(refusal.value)


def test_a_decided_request_with_no_recorded_decider_still_says_what_happened(
    review: SimpleNamespace,
) -> None:
    """Rows written before the reviewer was recorded, and discards closed by
    the gate itself. The sentence degrades to "Somebody else"; it does not
    degrade back to the status vocabulary."""
    review.status = ChangeStatus.APPROVED.value
    review.is_open = False
    review.reviewer = None

    with pytest.raises(RequestAlreadyDecidedError) as refusal:
        lifecycle.approve(1, seen_revision=READ)

    message = str(refusal.value)
    assert message.startswith("Somebody else")
    assert "A change request that is" not in message


def test_sending_back_a_decided_request_is_phrased_for_that_button(
    review: SimpleNamespace,
) -> None:
    """As its siblings are. "nothing left to approve" is the wrong ending
    for a reviewer who pressed Request changes."""
    review.status = ChangeStatus.APPROVED.value
    review.is_open = False
    review.reviewer = SimpleNamespace(
        first_name="Priya", last_name="Shah", username="priya"
    )

    with pytest.raises(RequestAlreadyDecidedError) as refusal:
        lifecycle.request_changes(1, "please change this", seen_revision=READ)

    assert "nothing left to send back" in str(refusal.value)


# ---- the revision token itself ----------------------------------------------
#
# ``revision_of`` says ``changed_on`` moves when the gate folds an edit into
# an open request, "which is exactly the event that makes an open review
# stale". The column's ``onupdate`` did not read the docstring: every ORM
# write to the row moved it, so a withdrawal looked like a rewrite and the
# evidence above would have convicted the wrong event.

SUBMITTED = datetime(2026, 11, 4, 21, 4, 11, 100000)


@pytest.fixture
def stored(mocker: MockerFixture, session: Any, app_context: None) -> ChangeRequest:
    """One pending request, committed, with ``superset.db.session`` behind it."""
    ChangeRequest.__table__.create(session.get_bind())
    request = ChangeRequest(
        id=1,
        asset_type="dashboard",
        asset_id=7,
        operation="update",
        status=ChangeStatus.PENDING.value,
        active_slot=1,
        author_fk=AUTHOR,
        payload=ChangeRequest.serialize_payload({"dashboard_title": "Quarterly"}),
        submitted_at=SUBMITTED,
        changed_on=SUBMITTED,
    )
    session.add(request)
    session.commit()
    mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR)
    return request


def test_a_withdrawal_leaves_the_revision_where_it_was(
    stored: ChangeRequest,
) -> None:
    """The author took their request back; they did not write to it."""
    before = lifecycle.revision_of(stored)

    lifecycle.withdraw(1)

    assert stored.status == ChangeStatus.DRAFT.value
    assert stored.submitted_at is None
    assert lifecycle.revision_of(stored) == before


def test_sending_it_back_leaves_the_revision_where_it_was(
    stored: ChangeRequest, mocker: MockerFixture
) -> None:
    """Nor does another reviewer's "request changes" rewrite the payload.

    A second reviewer still holding the page is holding the current version
    of it, and must be told where the change went rather than to re-read it.
    """
    mocker.patch.object(lifecycle, "get_user_id", return_value=REVIEWER)
    mocker.patch.object(lifecycle, "_asset_for", return_value=SimpleNamespace(id=7))
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    before = lifecycle.revision_of(stored)

    lifecycle.request_changes(1, "Needs a clearer title.", seen_revision=before)

    assert stored.status == ChangeStatus.CHANGES_REQUESTED.value
    assert stored.review_note == "Needs a clearer title."
    assert lifecycle.revision_of(stored) == before
