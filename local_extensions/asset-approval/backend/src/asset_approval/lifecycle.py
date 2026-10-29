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
"""The review lifecycle: submit, approve, request changes, withdraw, discard.

Each operation authorizes, checks the transition is legal, and commits. The
transitions themselves are deliberately few: Visa keeps no rejection history
(Visa Q7), so "request changes" returns the *same* record to the author
rather than closing it and opening another. Drafts never expire (Visa Q8).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from flask_appbuilder.models.sqla import Model

from superset import db
from asset_approval.eligibility import (
    can_approve,
    eligible_approvers,
    is_strict_editor,
)
from asset_approval.exceptions import (
    AuthorNoLongerEditorError,
    ApprovalForbiddenError,
    ChangeRequestNotFoundError,
    InvalidTransitionError,
    NoEligibleApproverError,
    ReviewedVersionStaleError,
    ReviewNoteRequiredError,
    StaleBaselineError,
)
from asset_approval.changes import moved_since
from asset_approval.models import ChangeRequest
from asset_approval.replay import apply_change, load_asset
from asset_approval.types import AssetType, ChangeStatus
from superset.utils.core import get_user_id
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def revision_of(change_request: ChangeRequest) -> str | None:
    """A token for "the version of this request", for approvers to quote back.

    ``changed_on`` is it: the gate sets it on every fold of a further edit
    into an open request, which is exactly the event that makes an open
    review stale.
    """
    return (
        change_request.changed_on.isoformat() if change_request.changed_on else None
    )


def _locked(change_request_id: int) -> ChangeRequest:
    """The request, held against concurrent deciders until this commit.

    Without the lock, two approvals read PENDING before either writes, both
    pass the status check and both replay -- which is how three concurrent
    Approves all returned 200 and the change applied more than once
    (129071). On a backend without row locks this degrades to ``find``,
    which is the behaviour we already had.
    """
    found = (
        db.session.query(ChangeRequest)
        .filter_by(id=change_request_id)
        .with_for_update()
        .one_or_none()
    )
    if found is None:
        raise ChangeRequestNotFoundError(change_request_id)
    return found


def find(change_request_id: int) -> ChangeRequest:
    change_request = db.session.query(ChangeRequest).get(change_request_id)
    if change_request is None:
        raise ChangeRequestNotFoundError(change_request_id)
    return change_request


def _asset_for(change_request: ChangeRequest) -> Any:
    asset = load_asset(
        AssetType(change_request.asset_type), change_request.asset_id
    )
    if asset is None:
        # The asset was deleted out from under an open request. Nothing can
        # be approved onto it, so the request is dead; surfaced as not-found
        # rather than a confusing approval error.
        raise ChangeRequestNotFoundError(change_request.id)
    return asset


@transaction()
def submit(
    change_request_id: int,
    note: str | None = None,
    requested_approver_id: int | None = None,
) -> ChangeRequest:
    """Send a draft for review, locking it.

    Locking on submit is Decision 5: an approval has to cover exactly what
    was reviewed, so the content cannot move underneath the reviewer. If the
    author wants to keep editing they withdraw first.
    """
    change_request = find(change_request_id)
    user_id = get_user_id()
    if change_request.author_fk != user_id:
        raise ApprovalForbiddenError("review")
    if ChangeStatus(change_request.status) not in {
        ChangeStatus.DRAFT,
        ChangeStatus.CHANGES_REQUESTED,
    }:
        raise InvalidTransitionError(change_request.status, "submitted")

    asset = _asset_for(change_request)
    # SOW 5.4: never auto-approve. If there is nobody else who could say
    # yes, refuse the submission and tell the author how to fix it, rather
    # than letting the change sit unapprovable or quietly letting it through.
    if not eligible_approvers(asset, exclude_user_id=user_id):
        raise NoEligibleApproverError(change_request.asset_type)

    change_request.set_status(ChangeStatus.PENDING)
    change_request.submitted_at = _now()
    if note is not None:
        change_request.note = note
    change_request.requested_approver_fk = requested_approver_id
    db.session.add(change_request)
    return change_request


def _author_name(change_request: ChangeRequest) -> str | None:
    """The author's display name, for the refusal message."""
    author = getattr(change_request, "author", None)
    if author is None:
        return None
    first = getattr(author, "first_name", "") or ""
    last = getattr(author, "last_name", "") or ""
    full = f"{first} {last}".strip()
    return full or getattr(author, "username", None)


@transaction()
def approve(
    change_request_id: int,
    note: str | None = None,
    seen_revision: str | None = None,
) -> Model:
    """Approve and publish, by replaying the author's original command.

    The replay runs inside this transaction, so a command that fails leaves
    the request pending rather than marking it approved over a change that
    never landed.

    :param seen_revision: the request's ``changed_on`` as it stood on the
        page the approver pressed the button on. The author can save again
        while a review is open, which replaces the captured payload, so
        without this an Approve can publish content the approver never read
        (129070). Absent means the caller cannot tell us, and the check is
        skipped rather than guessed at.
    """
    change_request = _locked(change_request_id)
    user_id = get_user_id()
    # Authorize before saying anything about the request's state, so that
    # someone with no say over it cannot probe its status by the refusal.
    asset = _asset_for(change_request)
    if not can_approve(change_request, asset, user_id):
        raise ApprovalForbiddenError()
    if ChangeStatus(change_request.status) is not ChangeStatus.PENDING:
        raise InvalidTransitionError(change_request.status, "approved")
    if seen_revision and revision_of(change_request) != seen_revision:
        raise ReviewedVersionStaleError()

    # The reviewer read the right version of the *request*; this asks
    # whether the request still fits the *asset*. Approving replays the
    # author's body over whatever is live now, so an asset that moved while
    # the request waited would have the older content published back over
    # it without a word (QA-24).
    if moved := moved_since(
        load_asset(
            AssetType(change_request.asset_type), change_request.asset_id
        ),
        change_request.base_dict,
    ):
        raise StaleBaselineError(moved)

    # The approver's editorship is re-checked above; the author's never was.
    # The replay runs as the author, so the host re-checks them anyway -- but
    # it answers with the command's own permission error, addressed to the
    # approver, and it waves administrators through. Asking here, on the
    # merits, names the real reason and closes the admin-author path (QA-07).
    if not is_strict_editor(asset, change_request.author_fk):
        raise AuthorNoLongerEditorError(_author_name(change_request))

    applied = apply_change(change_request)

    change_request.set_status(ChangeStatus.APPROVED)
    change_request.reviewer_fk = user_id
    change_request.decided_at = _now()
    if note:
        # The approver may add to the author's note, not replace it
        # (SOW 5.3): both halves are the record of why this went live.
        change_request.note = (
            f"{change_request.note}\n\n{note}" if change_request.note else note
        )
    db.session.add(change_request)
    return applied


@transaction()
def request_changes(change_request_id: int, review_note: str) -> ChangeRequest:
    """Send the change back to its author with a reason.

    Not a rejection: the record stays open and the author keeps working on
    it (Decision 3, Visa Q7).
    """
    change_request = find(change_request_id)
    user_id = get_user_id()
    # Authorize first; see ``approve``. Before the note is validated, too:
    # telling someone their note is too short, and only then that they were
    # never allowed to send the change back, answers in the wrong order and
    # reads as though a better note would have worked (QA-10).
    asset = _asset_for(change_request)
    if not can_approve(change_request, asset, user_id):
        raise ApprovalForbiddenError("review")
    if not review_note or not review_note.strip():
        raise ReviewNoteRequiredError()
    if ChangeStatus(change_request.status) is not ChangeStatus.PENDING:
        raise InvalidTransitionError(change_request.status, "sent back")

    change_request.set_status(ChangeStatus.CHANGES_REQUESTED)
    change_request.reviewer_fk = user_id
    change_request.review_note = review_note.strip()
    change_request.decided_at = _now()
    db.session.add(change_request)
    return change_request


@transaction()
def withdraw(change_request_id: int) -> ChangeRequest:
    """Take a pending request back, so the author can keep editing."""
    change_request = find(change_request_id)
    if change_request.author_fk != get_user_id():
        raise ApprovalForbiddenError("withdraw")
    if ChangeStatus(change_request.status) is not ChangeStatus.PENDING:
        raise InvalidTransitionError(change_request.status, "withdrawn")

    change_request.set_status(ChangeStatus.DRAFT)
    change_request.submitted_at = None
    db.session.add(change_request)
    return change_request


@transaction()
def discard(change_request_id: int) -> ChangeRequest:
    """Throw the change away and free the asset.

    SOW 5.3 lets any editor discard, including someone else's work, so that
    one abandoned draft cannot block an asset indefinitely. It is destructive
    and uncommon elsewhere (Decision 6), so the confirmation names the author
    and the draft's age -- that part is the UI's job; this records the act.
    """
    change_request = find(change_request_id)
    user_id = get_user_id()

    # Authorize first; see ``approve``.
    asset = _asset_for(change_request)
    if change_request.author_fk != user_id and not (
        user_id is not None and is_strict_editor(asset, user_id)
    ):
        raise ApprovalForbiddenError("discard")
    if not change_request.is_open:
        raise InvalidTransitionError(change_request.status, "discarded")

    change_request.set_status(ChangeStatus.DISCARDED)
    change_request.reviewer_fk = user_id
    change_request.decided_at = _now()
    db.session.add(change_request)
    return change_request
