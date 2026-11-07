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
from dataclasses import replace
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
    NothingToReviewError,
    RequestAlreadyDecidedError,
    RequestLeftReviewError,
    ReviewedVersionStaleError,
    ReviewNoteRequiredError,
    StaleBaselineError,
)
from asset_approval.changes import moved_since
from asset_approval.gate import (
    mark_published,
    proposes_nothing,
    snapshot_draft_for_review,
)
from asset_approval.models import ChangeRequest
from asset_approval.replay import apply_change, is_restore, load_asset
from asset_approval.types import AssetType, ChangeStatus
from superset.utils.core import get_user, get_user_id
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
    changed_on = getattr(change_request, "changed_on", None)
    return changed_on.isoformat() if changed_on else None


def _keep_the_revision(change_request: ChangeRequest) -> None:
    """Hold ``changed_on`` still across a transition that writes no content.

    ``changed_on`` is not only an audit column here: :func:`revision_of`
    makes it *the* token for "the version of this request", the one an
    approver quotes back, and the refusal a reviewer gets now turns on
    whether it moved (see :func:`_refuse_a_request_that_moved`). For that to
    mean anything it has to move when the content moves and only then --
    which is what ``revision_of`` already claims: "the gate sets it on every
    fold of a further edit into an open request".

    A withdrawal and a request for changes write no content. Left to the
    column's ``onupdate`` they moved the token anyway, so a reviewer still
    holding the page was told their version was stale and sent to re-read a
    payload byte-for-byte identical to the one they had just read.

    ``flag_modified`` is what puts the column into the UPDATE at the value it
    already has; a plain re-assignment of an equal value is "unchanged" to
    the unit of work, so the column would be left out and ``onupdate`` would
    fire after all.

    It needs a mapped instance carrying a loaded value, and it refuses
    anything else. There is nothing to hold still in that case either -- a
    row with no revision has none to lose, and ``_refuse_a_request_that_moved``
    never claims staleness without one -- so it is not worth failing a
    withdrawal over.
    """
    from sqlalchemy.exc import (  # pylint: disable=import-outside-toplevel
        InvalidRequestError,
    )
    from sqlalchemy.orm.attributes import (  # pylint: disable=import-outside-toplevel
        flag_modified,
    )

    try:
        flag_modified(change_request, "changed_on")
    except (AttributeError, InvalidRequestError):
        logger.debug(
            "asset-approval: no revision to hold on change request %s",
            getattr(change_request, "id", None),
        )


def _locked(change_request_id: int) -> ChangeRequest:
    """The request, held against every other transition until this commit.

    Each guard below asks whether the status it just read permits the move.
    Unlocked, two transitions both read the old status, both pass their own
    guard, and both write -- so the guards are advisory and the row ends up
    holding half of each.

    129071 was the approve case: three concurrent Approves all returned 200
    and the change replayed more than once. The lock answered it, but only
    ``approve`` was given the lock, so the class of bug survived everywhere
    else. Racing ``submit`` against ``discard`` then produced a row that read
    ``pending`` while carrying a decision, reviewer and a freed
    ``active_slot``: the author was told "Changes discarded.", the request
    stayed in the approver's queue, and approving it published content the
    author believed was gone.

    So this is not an approve helper. Every transition takes it, and a racing
    caller loses on its own guard with ``InvalidTransitionError`` rather than
    a false 200. On a backend without row locks this degrades to ``find``,
    which is the behaviour we already had.
    """
    found = (
        db.session.query(ChangeRequest)
        .filter_by(id=change_request_id)
        .with_for_update()
        # Without this, a row already in the identity map comes back with its
        # attributes as they were loaded, so the guard below would read a
        # stale ``status`` while holding the lock -- a lock that proves
        # nothing. ``populate_existing`` makes the read the committed state.
        .populate_existing()
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
        AssetType(change_request.asset_type),
        change_request.asset_id,
        # A restore's asset is soft-deleted by definition, so the ordinary
        # lookup cannot see it and every call here answered 404 -- the
        # request could not even be discarded (R3-01).
        include_deleted=is_restore(change_request),
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
    change_request = _locked(change_request_id)
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

    # Nothing to put in front of a reviewer. Asked after the approver check so
    # an author with nobody to ask is still told to add an editor first, and
    # before the snapshot so a refusal leaves the request exactly as it was.
    if proposes_nothing(change_request, asset):
        raise NothingToReviewError(change_request.asset_type)

    # What the reviewer is about to be shown of a draft that is being
    # published for the first time, so approving can tell if it moved (R7-03).
    snapshot_draft_for_review(change_request, asset)
    change_request.set_status(ChangeStatus.PENDING)
    change_request.submitted_at = _now()
    if note is not None:
        change_request.note = note
    change_request.requested_approver_fk = requested_approver_id
    db.session.add(change_request)
    return change_request


def _reviewer_name(change_request: ChangeRequest) -> str | None:
    """Who decided this request, for the refusal message.

    Set for a discard as well as an approval -- ``_discard_request`` records
    the person who closed it in ``reviewer_fk`` -- so both branches of
    ``RequestAlreadyDecidedError`` can name somebody.
    """
    reviewer = getattr(change_request, "reviewer", None)
    if reviewer is None:
        return None
    first = getattr(reviewer, "first_name", "") or ""
    last = getattr(reviewer, "last_name", "") or ""
    full = f"{first} {last}".strip()
    return full or getattr(reviewer, "username", None)


def _author_name(change_request: ChangeRequest) -> str | None:
    """The author's display name, for the refusal message."""
    author = getattr(change_request, "author", None)
    if author is None:
        return None
    first = getattr(author, "first_name", "") or ""
    last = getattr(author, "last_name", "") or ""
    full = f"{first} {last}".strip()
    return full or getattr(author, "username", None)


#: How :class:`ReviewedVersionStaleError` ends its sentence, keyed by the
#: past-tense word :class:`RequestLeftReviewError` uses for the same action.
_STALE_VERB = {"approved": "approving", "sent back": "sending it back"}


def _refuse_a_request_that_moved(
    change_request: ChangeRequest,
    seen_revision: str | None,
    action: str,
    *,
    attesting: bool,
) -> None:
    """What the reviewer is told when the request moved under their page.

    A reviewer's page is a page of one version of one request that is in
    review. Both halves can stop being true while they read it, and the two
    events are different:

    * the author saved again, which folds into the open request, rewrites
      the captured payload and takes it back out of review. The version the
      reviewer read is gone, which is what
      :class:`ReviewedVersionStaleError` says;
    * the request merely left review -- the author withdrew it, or another
      reviewer sent it back -- and nothing was written. There is no new
      version to read, so :class:`RequestLeftReviewError` says where the
      change went instead.

    Both used to be answered by the status guard, which ran first and gave
    the same ``InvalidTransitionError`` to each: "A change request that is
    draft cannot be approved." Internal vocabulary, no author, nothing to
    do, and the message written for the first case was unreachable (QA-93).

    Staleness is only ever claimed on evidence: a revision the reviewer
    quoted that the request no longer has. Without a quote there is nothing
    to compare, so the answer falls to where the change is -- which is true
    whichever event moved it.
    """
    current_revision = revision_of(change_request)
    status = ChangeStatus(change_request.status)

    if status is ChangeStatus.PENDING:
        if attesting:
            # Fail closed. This used to read ``if seen_revision and ...``,
            # so a caller that simply left the field out skipped the check
            # and published unread -- the one outcome the feature exists to
            # prevent. Approving is an attestation to a particular version,
            # and a caller that will not name the version it reviewed has
            # not reviewed anything.
            #
            # The requirement is the server's own state, not the caller's
            # choice: it applies exactly when there is a revision to quote.
            # A request with no ``changed_on`` has nothing to attest to and
            # is left alone -- which, since ``changed_on`` is non-nullable
            # with a default on insert, is no live request at all.
            if current_revision is not None and seen_revision != current_revision:
                raise ReviewedVersionStaleError(_STALE_VERB[action])
            return
        # Sending a change back attests to nothing: it publishes nothing,
        # writes none of the author's payload, and hands the work back to
        # the one person who can see what it now says. Demanding the
        # version here refused every send-back sent from a page that did
        # not quote one, which was both of ours, so the button failed for
        # every pending change (sc-132028).
        #
        # Staleness is still reported where there is evidence for it, which
        # is this module's rule everywhere else: a revision the caller
        # quoted that the request no longer has.
        if (
            seen_revision
            and current_revision is not None
            and seen_revision != current_revision
        ):
            raise ReviewedVersionStaleError(_STALE_VERB[action])
        return

    if change_request.is_open:
        if (
            seen_revision
            and current_revision is not None
            and seen_revision != current_revision
        ):
            raise ReviewedVersionStaleError(_STALE_VERB[action])
        raise RequestLeftReviewError(_author_name(change_request), action)

    # Decided already: approved or discarded. Nothing is coming back to this
    # reviewer -- but "A change request that is approved cannot be approved"
    # is this module's own status vocabulary, names nobody and offers
    # nothing, which is the complaint ``RequestLeftReviewError`` was written
    # to answer for the case above. The row records who decided it, so say
    # so and send them to look.
    raise RequestAlreadyDecidedError(
        change_request.status, action, _reviewer_name(change_request)
    )


def _announce_approval(
    change_request: ChangeRequest, note: str | None
) -> None:
    """Carry the approval into the asset's own version history.

    The replay runs as the author, so the history entry is the author's
    save, which is right -- they wrote it. What the entry cannot say by
    itself is that somebody else approved it, because nothing on the
    versioning side knows this request exists and there is no key joining
    the two (QA-16).

    The host already has a convention for a fact a field diff cannot
    express: the ``__meta__`` headline record, which is how a restore
    says which version it restored. The approval rides the same record
    under its own key, so an approved restore keeps its headline and
    gains the approval beside it rather than losing one of the two.

    Written after the replay and before the commit: the listener pops the
    key on ``before_commit``, and a replayed restore sets its own
    headline on the way past.

    Best effort on purpose. ``change_requests`` is the audit record and
    it is already written by the caller; this is a convenience surface,
    and version history prunes on a retention window while the request
    row does not. A failure here must not fail an approval.
    """
    try:
        from superset.versioning.changes import (
            ACTION_META_KEY,
            build_action_headline,
        )

        reviewer = get_user()
        approval = {
            "change_request_id": change_request.id,
            "by": None
            if reviewer is None
            else {
                "id": getattr(reviewer, "id", None),
                "first_name": getattr(reviewer, "first_name", None),
                "last_name": getattr(reviewer, "last_name", None),
            },
            "note": note,
        }

        existing = db.session.info.get(ACTION_META_KEY)
        if existing is not None:
            record = existing["record"]
            existing["record"] = replace(
                record, to_value={**(record.to_value or {}), "approval": approval}
            )
            return

        db.session.info[ACTION_META_KEY] = build_action_headline(
            AssetType(change_request.asset_type).value,
            change_request.asset_id,
            {"approval": approval},
        )
    except Exception:  # noqa: BLE001
        logger.warning(
            "Could not annotate version history with the approval of "
            "change request %s",
            getattr(change_request, "id", None),
            exc_info=True,
        )


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
    # The status and the revision are one question asked of one page, and
    # asking them in this order is the whole of QA-93: the status guard used
    # to run first and answer the author's save with its own vocabulary.
    _refuse_a_request_that_moved(
        change_request, seen_revision, "approved", attesting=True
    )

    # The reviewer read the right version of the *request*; this asks
    # whether the request still fits the *asset*. Approving replays the
    # author's body over whatever is live now, so an asset that moved while
    # the request waited would have the older content published back over
    # it without a word (QA-24).
    if moved := moved_since(
        load_asset(
            AssetType(change_request.asset_type),
            change_request.asset_id,
            include_deleted=is_restore(change_request),
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

    if AssetType(change_request.asset_type) is AssetType.DASHBOARD:
        # The gate's own hook is suspended while a replay runs, so the
        # approval that publishes a dashboard is the one write that would
        # otherwise never be recorded -- and it is the write that matters
        # most, because it is the moment a viewer can first reach it
        # (QA-18). Read the live asset rather than the payload: any
        # approved change that leaves the dashboard published counts, not
        # only one that names the flag.
        #
        # The mark commits on its own connection, so a later rollback
        # leaves it behind without the publish. That errs towards gated,
        # which is the safe direction for a mark that can never be removed.
        published_now = load_asset(
            AssetType.DASHBOARD,
            change_request.asset_id,
            include_deleted=is_restore(change_request),
        )
        if bool(getattr(published_now, "published", False)):
            mark_published(AssetType.DASHBOARD, change_request.asset_id)

    _announce_approval(change_request, note)

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
def request_changes(
    change_request_id: int,
    review_note: str,
    seen_revision: str | None = None,
) -> ChangeRequest:
    """Send the change back to its author with a reason.

    Not a rejection: the record stays open and the author keeps working on
    it (Decision 3, Visa Q7).

    :param seen_revision: the request's revision as it stood on the page the
        reviewer pressed the button on, as ``approve`` takes it. Optional
        here, because nothing is published either way: it only lets the
        refusal tell a reviewer whose version was written over from one
        whose request simply left review (QA-93).
    """
    change_request = _locked(change_request_id)
    user_id = get_user_id()
    # Authorize first; see ``approve``. Before the note is validated, too:
    # telling someone their note is too short, and only then that they were
    # never allowed to send the change back, answers in the wrong order and
    # reads as though a better note would have worked (QA-10).
    asset = _asset_for(change_request)
    if not can_approve(change_request, asset, user_id):
        raise ApprovalForbiddenError("review")
    # ``isinstance`` as well as falsiness: this is also called directly, and
    # a non-string reached ``.strip()`` and raised rather than being answered
    # "Say what needs to change." A thing that is not text is not a note.
    if not isinstance(review_note, str) or not review_note.strip():
        raise ReviewNoteRequiredError()
    _refuse_a_request_that_moved(
        change_request, seen_revision, "sent back", attesting=False
    )

    change_request.set_status(ChangeStatus.CHANGES_REQUESTED)
    change_request.reviewer_fk = user_id
    change_request.review_note = review_note.strip()
    change_request.decided_at = _now()
    # The author's payload is untouched, so a second reviewer who still has
    # the request open is looking at the current version of it.
    _keep_the_revision(change_request)
    db.session.add(change_request)
    return change_request


@transaction()
def withdraw(change_request_id: int) -> ChangeRequest:
    """Take a pending request back, so the author can keep editing.

    Taking it back is not writing to it. Nothing the author has withdrawn
    has changed yet, so a reviewer who still holds the page is holding the
    current version of the request and must not be told otherwise.
    """
    change_request = _locked(change_request_id)
    if change_request.author_fk != get_user_id():
        raise ApprovalForbiddenError("withdraw")
    if ChangeStatus(change_request.status) is not ChangeStatus.PENDING:
        raise InvalidTransitionError(change_request.status, "withdrawn")

    change_request.set_status(ChangeStatus.DRAFT)
    change_request.submitted_at = None
    _keep_the_revision(change_request)
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
    change_request = _locked(change_request_id)
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
