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
"""sc-132028: Request changes was refused for every pending change.

Approving requires the reviewer to quote the version they read, and fails
closed if they do not: an approval is an attestation to a particular
payload, and a caller that will not name one has reviewed nothing.

Sending a change back was given the same guard. It attests to nothing --
nothing is published, none of the author's payload is written, and the work
goes back to the one person who can see what it now says. Neither front end
quotes a version on that call, so the comparison was against ``None`` every
time, and the button failed for every pending change with "This change was
updated after you opened it."

The escape hatch in the guard ("a request with no ``changed_on`` has
nothing to attest to") did not save it. ``ChangeRequest`` extends
``AuditMixinNullable``, where ``changed_on`` is non-nullable with a default
on insert, so every persisted request has a revision and the branch is
unreachable in production. It is reachable in a fixture, though, which is
why every existing test of this path passed: they either quoted a revision
or left ``changed_on`` off the stand-in entirely. Neither is the shape the
UI sends, so nothing here was testing the UI.
"""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from asset_approval.exceptions import (
    RequestLeftReviewError,
    ReviewedVersionStaleError,
)
from asset_approval.types import ChangeStatus
from pytest_mock import MockerFixture

#: What the reviewer's page was showing, and what the row still says.
ON_FILE = "2026-11-05T22:14:03.900000"
#: What an author's save would have left behind.
REWRITTEN = "2026-11-05T22:41:27.010000"

DECIDED_AT = datetime(2026, 11, 5, 22, 45)
AUTHOR = 7
REVIEWER = 9
NOTE = "Use the approved colour scheme."


def _ignore(*_args: Any, **_kwargs: Any) -> None:
    """A no-op stand-in for a model method this test does not exercise."""


@pytest.fixture
def pending(mocker: MockerFixture) -> dict[str, Any]:
    """A pending request carrying a revision, as every stored one does."""
    statuses: list[ChangeStatus] = []
    request = SimpleNamespace(
        id=1,
        author=SimpleNamespace(
            id=AUTHOR, username="alex", first_name="Alex", last_name="Author"
        ),
        author_fk=AUTHOR,
        asset_type="chart",
        asset_id=42,
        status=ChangeStatus.PENDING.value,
        # The point of the fixture. A stand-in without this is a row that
        # cannot exist, and testing against it is what hid sc-132028.
        changed_on=SimpleNamespace(isoformat=lambda: ON_FILE),
        is_open=True,
        base_dict={},
        command_args={},
        note=None,
        review_note=None,
        reviewer_fk=None,
        decided_at=None,
        set_status=statuses.append,
    )
    asset = SimpleNamespace(id=42)

    mocker.patch.object(lifecycle, "_locked", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=REVIEWER)
    mocker.patch.object(lifecycle, "_asset_for", return_value=asset)
    mocker.patch.object(lifecycle, "can_approve", return_value=True)
    mocker.patch.object(lifecycle, "load_asset", return_value=asset)
    mocker.patch.object(lifecycle, "moved_since", return_value=[])
    mocker.patch.object(lifecycle, "is_strict_editor", return_value=True)
    mocker.patch.object(lifecycle, "_now", return_value=DECIDED_AT)
    mocker.patch.object(lifecycle, "_keep_the_revision", _ignore)
    mocker.patch.object(lifecycle, "_announce_approval", _ignore)
    mocker.patch.object(lifecycle.db.session, "add", _ignore)
    mocker.patch.object(lifecycle, "apply_change", return_value="applied")
    commit = mocker.patch.object(lifecycle.db.session, "commit")
    mocker.patch.object(lifecycle.db.session, "rollback")
    return {"request": request, "statuses": statuses, "commit": commit}


# ---- the defect -------------------------------------------------------------


def test_sending_it_back_works_from_a_page_that_quoted_no_version(
    pending: dict[str, Any],
) -> None:
    """The call both front ends actually make: a note, and nothing else.

    `Approvals.tsx` through `frontend/src/api.ts`, and `AssetReview.tsx`
    through `changeManagement/api.ts`, each send only ``review_note``.
    """
    lifecycle.request_changes(1, NOTE)

    assert pending["statuses"] == [ChangeStatus.CHANGES_REQUESTED]
    assert pending["request"].review_note == NOTE
    assert pending["request"].reviewer_fk == REVIEWER
    assert pending["request"].decided_at == DECIDED_AT
    pending["commit"].assert_called_once()


def test_approving_from_such_a_page_is_still_refused(
    pending: dict[str, Any],
) -> None:
    """The half that must not move. Publishing unread is the one outcome
    the feature exists to prevent, so an approval that names no version is
    still refused even though a send-back no longer is."""
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.approve(1)

    assert pending["statuses"] == []


# ---- staleness is still reported, where there is evidence for it ------------


def test_a_send_back_that_quotes_a_stale_version_is_still_refused(
    pending: dict[str, Any],
) -> None:
    """Quoting a version the request no longer has is evidence it moved.

    Only the demand for a quote is lifted, not the check on one that was
    given, so an API caller keeping its own copy is told the same as before.
    """
    with pytest.raises(ReviewedVersionStaleError):
        lifecycle.request_changes(1, NOTE, seen_revision=REWRITTEN)

    assert pending["statuses"] == []


def test_the_refusal_names_sending_it_back_rather_than_approving(
    pending: dict[str, Any],
) -> None:
    """It ended "before approving" on a button that approves nothing."""
    with pytest.raises(ReviewedVersionStaleError) as refusal:
        lifecycle.request_changes(1, NOTE, seen_revision=REWRITTEN)

    assert "before sending it back" in str(refusal.value)
    assert "approving" not in str(refusal.value)


def test_approvals_refusal_is_worded_as_it_always_was(
    pending: dict[str, Any],
) -> None:
    """The other half of that sentence, pinned: two front-end tests assert
    this string literally."""
    with pytest.raises(ReviewedVersionStaleError) as refusal:
        lifecycle.approve(1, seen_revision=REWRITTEN)

    assert str(refusal.value) == (
        "This change was updated after you opened it. Review the new "
        "version before approving."
    )


# ---- a request that left review is still answered the other way ------------


def test_a_request_that_left_review_still_says_where_it_went(
    pending: dict[str, Any],
) -> None:
    """Lifting the demand does not turn this into a silent success: there
    is nothing in review to send back, and the author is named."""
    pending["request"].status = ChangeStatus.DRAFT.value

    with pytest.raises(RequestLeftReviewError) as refusal:
        lifecycle.request_changes(1, NOTE)

    assert "Alex Author" in str(refusal.value)
    assert pending["statuses"] == []
