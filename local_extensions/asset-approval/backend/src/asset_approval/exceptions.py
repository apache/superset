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
from __future__ import annotations

from superset.exceptions import SupersetException


class ChangeManagementException(SupersetException):
    """Base for review-workflow signals and errors."""


class ChangeRequestCreated(ChangeManagementException):
    """The author's write was captured for review instead of applied.

    Raised from inside the asset command *after* its own authorization
    checks and *before* any mutation. It is a control-flow signal, not a
    failure: the request payload has already been committed on its own
    connection by the time this is raised, and raising is what guarantees
    the asset write is rolled back rather than merely skipped.

    It deliberately subclasses ``Exception`` rather than ``BaseException``.
    ``superset.utils.decorators.transaction`` catches ``Exception`` and
    rolls the session back, then hands the exception to ``on_error``, whose
    default ``catches`` is ``(SQLAlchemyError,)`` -- so a non-SQLAlchemy
    exception is re-raised unchanged. Subclassing ``BaseException`` would
    skip that rollback and leave whatever the command's ``validate`` put in
    the session pending.

    Any command gated this way must therefore keep ``on_error``'s
    ``catches`` narrow enough not to swallow this type.
    """

    def __init__(
        self,
        change_request_id: int,
        asset_type: str,
        asset_id: int,
        count: int = 1,
        change_request_ids: list[int] | None = None,
        operation: str = "update",
    ):
        self.change_request_id = change_request_id
        self.asset_type = asset_type
        self.asset_id = asset_id
        #: A bulk delete or an import captures several assets at once; each
        #: is reviewed separately, so the caller is told how many were made.
        self.count = count
        self.change_request_ids = change_request_ids or [change_request_id]
        #: "update" or "delete". The response copy differs: telling someone
        #: their delete was "saved" misdescribes what is now waiting.
        self.operation = operation
        super().__init__(
            f"Changes to {count} {asset_type}(s) were submitted for review."
            if count > 1
            else f"Changes to {asset_type} {asset_id} were submitted for review "
            f"as change request {change_request_id}."
        )


class AssetLockedError(ChangeManagementException):
    """Another editor already has an open change on this asset (SOW 5.3).

    Also raised, with its own ``message``, when the author's *own* open
    change on the asset is of a different kind than the write being made
    (a dashboard properties draft versus a native filter edit, say). The
    two cannot be folded into one replayable request, and replacing one
    with the other would silently drop work the author believes is saved.
    """

    status = 409

    def __init__(
        self,
        asset_type: str,
        asset_id: int,
        author: str | None = None,
        message: str | None = None,
    ):
        self.asset_type = asset_type
        self.asset_id = asset_id
        self.author = author
        who = author or "another editor"
        super().__init__(
            message
            or f"{who} already has changes open on this {asset_type}. "
            "Only one set of changes can be open at a time."
        )


class UnattributableWriteRefusedError(ChangeManagementException):
    """A governed write arrived with nobody to attribute it to.

    The gate fails closed on every write path (SOW 3, 5.7), and a change
    with no author is one nobody can be asked to approve. Its own type
    because the alternative was to report it as a lock, which describes a
    different situation and tells the caller to wait for someone else to
    finish rather than to sign in.
    """

    status = 403

    def __init__(self, asset_type: str, asset_id: int | None = None):
        self.asset_type = asset_type
        self.asset_id = asset_id
        super().__init__(
            f"Changes to a {asset_type} need review, and a review needs an "
            "author. Sign in and try again."
        )


class ChangeRequestNotFoundError(ChangeManagementException):
    """No such change request."""

    def __init__(self, change_request_id: int | None = None):
        super().__init__(
            f"Change request {change_request_id} was not found."
            if change_request_id is not None
            else "Change request not found."
        )


class ApprovalForbiddenError(ChangeManagementException):
    """This user may not approve this change.

    Covers all three refusals the SOW names, deliberately with one message:
    not an editor, the submitter themselves, or an administrator who is not
    an editor (Visa Q1 ruled out admin bypass in V1). Distinguishing them in
    the response would disclose who is and is not an editor of an asset to
    someone who has just been told they have no say over it.
    """

    def __init__(self) -> None:
        super().__init__("You cannot approve this change.")


class NoEligibleApproverError(ChangeManagementException):
    """Nobody else can approve, so the change cannot be submitted.

    SOW 5.4 is explicit that this must never auto-approve. The author is
    told plainly and offered the fix: add another editor.
    """

    def __init__(self, asset_type: str):
        self.asset_type = asset_type
        super().__init__(
            f"No one else can approve this {asset_type}. "
            "Add another editor to request a review."
        )


class InvalidTransitionError(ChangeManagementException):
    """The request is not in a state where this action makes sense."""

    def __init__(self, current: str, action: str):
        self.current = current
        self.action = action
        super().__init__(
            f"A change request that is {current} cannot be {action}."
        )


class ReviewNoteRequiredError(ChangeManagementException):
    """Requesting changes without saying what needs to change.

    Decision 3: the reviewer's second button is "Request changes", and the
    work goes back to the author. Sending it back with no explanation is the
    one thing that makes that useless, so the note is mandatory.
    """

    def __init__(self) -> None:
        super().__init__("Say what needs to change.")


class ImportOverwriteRefusedError(ChangeManagementException):
    """An import would have overwritten a governed asset without review.

    See :func:`asset_approval.gate.refuse_import_overwrite` for
    why this refuses rather than captures.

    The importers re-raise this unchanged rather than folding it into their
    generic "import failed" error, so the person importing is told why and
    what to do instead.
    """

    status = 422

    def __init__(self, asset_kind: str = "asset"):
        self.asset_kind = asset_kind
        super().__init__(
            "Importing over an existing "
            f"{asset_kind} needs review, which imports do not support yet. "
            "Import without overwriting, or ask an administrator to turn "
            "review off for this import."
        )


class UnreviewableWriteRefusedError(ChangeManagementException):
    """A write path that cannot be captured for review was refused.

    Some writes have no request body that an approval could replay to the
    same effect: a dataset refresh re-reads the source table at whatever
    moment it runs, so the reviewer would be approving a change nobody can
    show them. While review is required these are refused, with a pointer
    to the reviewed path that achieves the same thing, rather than allowed
    through unreviewed (SOW 5.7: the gate fails closed on every write path).
    """

    status = 422

    def __init__(self, action: str, alternative: str):
        self.action = action
        self.alternative = alternative
        super().__init__(
            f"{action} needs review, which this action does not support yet. "
            f"{alternative}"
        )


class ReplayFailedError(ChangeManagementException):
    """Approving could not apply the change, so nothing was applied.

    The replay runs inside the approval's transaction; raising this rolls
    both back, leaving the request pending for another attempt.
    """

    status = 422
