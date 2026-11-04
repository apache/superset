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
"""The write gate.

One function, :func:`gate_write`, is called from each governed command
after its authorization checks and before it mutates anything. When the
feature is on it captures the request payload, commits it as a
:class:`~asset_approval.models.ChangeRequest`, and raises
:class:`~asset_approval.exceptions.ChangeRequestCreated` so the
caller's transaction rolls back. When the feature is off it returns
immediately and Superset behaves exactly as it does today (SOW 6.1).
"""

from __future__ import annotations

import inspect
import logging
import uuid as uuid_module
from dataclasses import dataclass
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

from flask import g
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError

from superset import db
from asset_approval.exceptions import (
    AssetLockedError,
    ChangeRequestCreated,
    ImportOverwriteRefusedError,
    UnattributableWriteRefusedError,
    UnreviewableWriteRefusedError,
)
from asset_approval.changes import (
    _comparable,
    baseline_of,
    changed_fields,
    EXEMPT_EXTRA_KEYS,
    EXEMPT_FIELDS,
    IGNORED_FIELDS,
    is_empty_change,
    reverted_fields,
)
from asset_approval.models import ChangeRequest, PublishedAsset
from asset_approval.types import (
    AssetType,
    ChangeStatus,
    OPEN_SLOT,
    OPEN_STATUSES,
    Operation,
)
from superset.utils import json
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)

FEATURE_FLAG = "CHANGE_MANAGEMENT"

#: Set on ``flask.g`` while an approved change is being replayed through the
#: shipped command. Without it the replay would be captured as a fresh change
#: request and the approval would never actually land -- the feature would
#: deadlock against itself.
REPLAY_FLAG = "change_management_replaying"

#: Key in ``command_args`` naming which command replays a capture, for
#: assets with more than one governed write command. Absent means the
#: asset's main update command, which keeps every request captured before
#: the key existed replaying exactly as it did.
COMMAND_KEY = "command"

#: ``command_args[COMMAND_KEY]`` of a captured version restore. Shared by all
#: three asset kinds, each of which has its own restore command.
RESTORE_VERSION_COMMAND = "restore_version"

#: ``command_args[COMMAND_KEY]`` of a captured un-archive. Restoring a
#: soft-deleted asset puts it back in front of viewers, so it is a publish
#: like any other -- and because the delete that archived it went through
#: review, leaving the restore ungated let one editor undo a decision two
#: people made (QA-17). Distinct from ``RESTORE_VERSION_COMMAND``, which
#: rolls content back without ever having been archived.
RESTORE_COMMAND = "restore"

#: ``command_args[COMMAND_KEY]`` of a captured embedded-config upsert. The
#: host build has no command for this write -- the dashboard API calls the
#: DAO inline -- so the name lives here rather than on a command class.
UPSERT_EMBEDDED_COMMAND = "upsert_embedded"

#: How a further capture folds into the author's existing open request of
#: the same kind: ``combine(existing_body, new_body) -> stored_body``.
Combine = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]

#: A fold that knows more about its asset than "a field replaces a field":
#: ``refine(draft_body, new_body, merged) -> stored_body``, handed the plain
#: field-by-field merge to correct. Passed as ``fold_fields`` in place of
#: ``True``. For a body that carries one blob holding several independent
#: things -- a dashboard's ``json_metadata`` holds its layout -- where
#: replacing the blob wholesale replaces all of them.
Refine = Callable[[dict[str, Any], dict[str, Any], dict[str, Any]], dict[str, Any]]

#: ``command_args`` entry the chart gate carries: which keys Explore
#: rewrote on its own as it loaded the chart, for version history. The new
#: body of a *partial* second save has no ``params`` at all and so nothing
#: to say about normalisation, and ``command_args`` is replaced wholesale on
#: a fold -- so without keeping it, a rename through the Properties dialog
#: erased the first save's list.
NORMALIZATION_KEY = "normalization_changes"

#: ``command_args`` entry holding the command's own keyword arguments -- the
#: ones that are not the asset id or the request body.
#:
#: The gate used to capture the body and then a hand-picked argument or two
#: (``override_columns``, ``normalization_changes``), so every keyword a
#: command grew was a write that reached the asset without being captured,
#: shown or replayed: ``delete_metric_ids`` reached viewers unreviewed
#: (an empty body has no diff to hold), ``preserve_existing_metrics`` was
#: dropped on approval and took the dataset's other metrics with it, and the
#: legacy chart save's ``save_to_dashboard_id`` was never carried at all.
#:
#: So the rule is now the opposite way round: whatever the command was
#: constructed with is captured, and only what is known to change nothing is
#: left out. Holds the arguments that differ from the command's own default
#: and so change what the write does; replay hands every one of them back to
#: the same command, or refuses to approve what it cannot hand back.
KWARGS_KEY = "kwargs"

#: ``command_args`` entry naming the exempt fields this write changed.
#:
#: An exempt field (editors, viewers, tags, ...) normally applies the moment
#: it is saved, so a captured copy of one is only a snapshot -- except when it
#: travelled in the same write as a governed field, in which case the gate
#: held it too and nothing else will ever apply it. Capture is per write and
#: replay used to be per field (B4); this is how replay tells the two apart.
#: Absent on a request captured before it existed, which replays as it always
#: did: every exempt field dropped.
EXEMPT_APPLIED_KEY = "exempt_fields"


def captured_arguments(command_args: Any) -> dict[str, Any]:
    """The command keyword arguments a capture carries, by name.

    The one place the display, replay and the fold ask "what else does this
    write do besides its body?". Empty for a write that is only its body.
    Tolerant of the stand-ins some callers hand over instead of a real
    ``command_args``.
    """
    if not isinstance(command_args, dict):
        return {}
    arguments = command_args.get(KWARGS_KEY)
    return dict(arguments) if isinstance(arguments, dict) else {}


#: Where :func:`remember_signature` keeps a constructor's real signature.
_SIGNATURE_ATTR = "__asset_approval_signature__"


def remember_signature(command_cls: type) -> None:
    """Keep the constructor's signature before anything wraps the constructor.

    The bindings wrap ``__init__`` to snapshot what the command was built
    with, and a wrapper takes ``(*args, **kwargs)``: asked afterwards, the
    class would claim to take nothing in particular. Replay needs the real
    parameters to hand captured arguments back, so they are read once, first.
    """
    owner = _constructor_owner(command_cls)
    if owner is not None and _SIGNATURE_ATTR not in owner.__dict__:
        setattr(owner, _SIGNATURE_ATTR, inspect.signature(owner.__init__))


def _constructor_owner(command_cls: type) -> type | None:
    return next(
        (klass for klass in command_cls.__mro__ if "__init__" in klass.__dict__), None
    )


def ctor_signature(command_cls: type) -> inspect.Signature:
    """What the command's constructor takes, whether or not it is wrapped."""
    owner = _constructor_owner(command_cls)
    if owner is None:
        return inspect.signature(command_cls.__init__)
    return owner.__dict__.get(_SIGNATURE_ATTR) or inspect.signature(owner.__init__)


def captured_exempt_fields(command_args: Any) -> list[str] | None:
    """The exempt fields this capture owns, or ``None`` if it never recorded."""
    if not isinstance(command_args, dict):
        return None
    owned = command_args.get(EXEMPT_APPLIED_KEY)
    return list(owned) if isinstance(owned, (list, tuple)) else None


@contextmanager
def replaying() -> Iterator[None]:
    """Suspend the gate for the duration of an approved replay.

    Scoped to one block and restored afterwards, including on error, so a
    failed replay cannot leave the gate switched off for the rest of the
    request.
    """
    previous = getattr(g, REPLAY_FLAG, False)
    setattr(g, REPLAY_FLAG, True)
    try:
        # A replay is also the first of the narrow ways through the
        # deny-by-default guard (see ``permitted``).
        with permitted("replaying an approved change"):
            yield
    finally:
        setattr(g, REPLAY_FLAG, previous)


def is_replaying() -> bool:
    return bool(getattr(g, REPLAY_FLAG, False))


def is_enabled() -> bool:
    """Whether review is required on this instance.

    Read through ``is_feature_enabled`` on every call rather than cached at
    import: the SOW calls for an instance flag read at startup (SOW 5.7),
    and reading live keeps tests and a future per-workspace switch honest
    without changing any call site.
    """
    from superset.extensions import (  # pylint: disable=import-outside-toplevel
        feature_flag_manager,
    )

    return feature_flag_manager.is_feature_enabled(FEATURE_FLAG)


def find_open_request(asset_type: AssetType, asset_id: int) -> ChangeRequest | None:
    """The asset's single open request, if one exists."""
    return (
        db.session.query(ChangeRequest)
        .filter(
            ChangeRequest.asset_type == asset_type.value,
            ChangeRequest.asset_id == asset_id,
            ChangeRequest.status.in_([s.value for s in OPEN_STATUSES]),
        )
        .one_or_none()
    )


def has_ever_been_published(asset_type: AssetType, asset_id: int) -> bool:
    """Whether this instance has ever seen the asset published.

    Read on its own connection, like the write below. By the time the gate
    runs, the caller's session is already inside a transaction that loaded
    the asset, so a mark another worker committed since then is invisible
    to it -- and invisible reads as "never published", which is the
    permissive answer of the two.
    """
    table = PublishedAsset.__table__
    with db.engine.connect() as connection:
        return (
            connection.execute(
                select(table.c.id).where(
                    table.c.asset_type == asset_type.value,
                    table.c.asset_id == asset_id,
                )
            ).first()
            is not None
        )


def mark_published(asset_type: AssetType, asset_id: int) -> None:
    """Record that the asset is published, once and for good.

    Called wherever a write is seen against a published asset, which covers
    the asset being published through review, an asset already published
    when the extension was installed, and the unpublish itself -- an asset
    cannot be unpublished without having been published.

    Written on its own connection for the same reason ``_insert_request``
    is, and it is the same mistake either way: every path that reaches here
    goes on to raise :class:`ChangeRequestCreated`, so a mark riding the
    caller's session is rolled back with it and the table stays empty. An
    empty table answers "never published" for everything, which is exactly
    the behaviour the mark exists to replace (QA-18).

    A concurrent writer racing to the same row cannot fail the caller's
    write: two workers both deciding to mark is the expected case, and the
    unique constraint is what makes the second one a no-op.
    """
    if has_ever_been_published(asset_type, asset_id):
        return
    try:
        with db.engine.begin() as connection:
            connection.execute(
                insert(PublishedAsset.__table__).values(
                    asset_type=asset_type.value,
                    asset_id=asset_id,
                    first_seen_at=datetime.now(timezone.utc),
                )
            )
    except IntegrityError:
        # Another worker got there first, which is the outcome either way.
        logger.debug(
            "Publish mark for %s %s already written by another worker",
            asset_type.value,
            asset_id,
        )


def _same_kind(existing: Any, command_args: dict[str, Any] | None) -> bool:
    """Whether this write replays through the same command as the open one.

    One request replays through one command, so a native-filter diff and a
    properties draft can never be folded together. ``getattr``: some callers
    hand the fold a partial stand-in for the row rather than the row.

    "The same command" includes the arguments it was given. A body can be
    folded onto another because replacing a field is how two saves compose;
    there is no such rule for a keyword, and guessing one is how a draft is
    quietly rewritten into something nobody asked for (a delete of metric 5
    folded into a draft that preserves the rest would apply both to a body
    neither was written for). Two writes whose arguments differ therefore
    cannot share a request, and the second is told so rather than replacing
    the first.
    """
    kind = (command_args or {}).get(COMMAND_KEY)
    if getattr(existing, "command_args", {}).get(COMMAND_KEY) != kind:
        return False
    return _same_arguments(existing, command_args)


def _is_update(existing: Any) -> bool:
    try:
        return (
            Operation(getattr(existing, "operation", Operation.UPDATE.value))
            is Operation.UPDATE
        )
    except ValueError:
        return True


def _same_arguments(existing: Any, command_args: dict[str, Any] | None) -> bool:
    """Whether the open request and this write were given the same arguments.

    Only an update's arguments are compared: a delete carries none, and a
    save that takes a pending delete's place is a case of its own, reported
    as such (129078).
    """
    if not _is_update(existing):
        return True
    return captured_arguments(getattr(existing, "command_args", {})) == (
        captured_arguments(command_args)
    )


def _can_fold(
    existing: Any,
    author_id: int | None,
    command_args: dict[str, Any] | None,
    operation: Operation,
) -> bool:
    """Whether this write's body may be merged with the open request's.

    The author's own, the same command, and the same operation. Anything
    else either belongs to someone else (and is refused further down) or
    describes a different act, and merging across either of those would
    put a payload in the queue that no single screen ever asserted.
    """
    if existing is None or author_id is None:
        return False
    if getattr(existing, "author_fk", None) != author_id:
        return False
    if not _same_kind(existing, command_args):
        return False
    return (
        Operation(getattr(existing, "operation", Operation.UPDATE.value)) is operation
    )


def _fold_into(
    existing: Any,
    payload: dict[str, Any],
    command_args: dict[str, Any] | None,
    combine: Combine | None,
    fold_fields: bool | Refine,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """One body folded onto the open request's, and the args that go with it.

    The whole of R2: *a fold of body B into open draft D must equal applying
    D and then B.* Which merge that is depends on what the body is.

    - A **diff** body (``combine``) is added to the one already stored, or
      approving the draft would apply only the last edit.
    - A **partial full-state** body (``fold_fields``) replaces the fields it
      carries and leaves the rest of the draft standing. Explore posts every
      control, so a body with ``params`` asserts the whole chart and
      replacing that one field is right; the chart Properties dialog, REST
      and MCP post a handful of fields and say nothing about the others, and
      replacing the payload wholesale is how a captured ``params`` edit
      disappeared behind a later rename.
    - Neither: the body replaces, which is what a full-state body means.

    ``fold_fields`` may be a :data:`Refine` instead of ``True``, for a body
    with a blob that is several things at once. That is not a corner: the
    dashboard's layout travels *inside* ``json_metadata``, so the plain
    per-field merge let a Properties save -- whose ``json_metadata`` has no
    layout in it -- replace a draft's whole layout edit.

    Top-level fields only. Never inside ``params``, ``query_context`` or
    ``json_metadata``: the server cannot tell a key the author edited from
    one Explore normalised on its way through, so a three-way merge there
    would overwrite draft values for every key Explore touches on its own,
    could not express a revert, and would hand the approver a chart that was
    never on anybody's screen.

    Lives here rather than at either call site because there are **two**
    fold sites -- ``gate_write`` and ``_lost_the_slot``, which a double
    click on Save reaches -- and a fix landing on the one a unit test calls
    and not the one a double click reaches is this epic's own failure mode.
    """
    if combine is not None:
        return combine(existing.payload_dict, payload), command_args
    if not fold_fields:
        return payload, command_args
    merged = {**existing.payload_dict, **payload}
    if callable(fold_fields):
        merged = fold_fields(existing.payload_dict, payload, merged)
    if "params" in payload:
        return merged, command_args
    # The incoming body has no ``params``, so it has nothing to say about
    # what Explore normalised, and ``command_args`` is replaced wholesale.
    previous = getattr(existing, "command_args", {}).get(NORMALIZATION_KEY)
    if previous is None or (command_args or {}).get(NORMALIZATION_KEY):
        return merged, command_args
    return merged, {**(command_args or {}), NORMALIZATION_KEY: previous}


def gate_write(
    asset_type: AssetType,
    asset_id: int,
    payload: dict[str, Any],
    note: str | None = None,
    command_args: dict[str, Any] | None = None,
    operation: Operation = Operation.UPDATE,
    combine: Combine | None = None,
    fold_fields: bool | Refine = False,
) -> None:
    """Capture this write for review, or return so the caller may proceed.

    :raises ChangeRequestCreated: when the write was captured. The caller's
        transaction must be allowed to unwind; do not catch this inside the
        command.
    :param command_args: constructor arguments the command takes outside
        the request body, which replay needs in order to invoke the same
        command the author did. ``command_args[COMMAND_KEY]`` selects a
        command other than the asset's main update; ``command_args[KWARGS_KEY]``
        holds the keyword arguments that change what the write does. A write
        that carries any is never "empty", whatever its body says: a body
        with nothing in it is exactly how ``delete_metric_ids`` and
        ``preserve_existing_metrics`` reached the asset unreviewed.
    :param combine: for commands whose body is a *diff* rather than the
        asset's full state, how a further edit folds into the author's open
        request of the same kind. Without it the new body replaces the old,
        which is right for full-state bodies and loses work for diffs.
    :param fold_fields: for commands whose body may be a *partial* statement
        of the asset's fields -- the chart main update, which the Properties
        dialog, REST and MCP all post a handful of fields to -- fold the new
        body's fields onto the open request's instead of replacing it.
        Separate from ``combine`` on purpose: ``combine`` also switches off
        ``comparable`` below, so reusing it here would silently turn off the
        empty-change test (129076), the baseline (QA-24) and R4-01 for every
        chart. It is the obvious one-line fix and it is the trap.
    :raises AssetLockedError: when a different author already holds the
        asset's open slot, or when the author's own open request is for a
        different command and so cannot absorb this write.
    """
    if not is_enabled() or is_replaying():
        return

    # A save that alters nothing is not a change to review. It used to make
    # a request anyway, which locked the asset against other editors and put
    # an empty diff in an approver's queue -- both costs paid for a write
    # that was going to be a no-op regardless (129076). Letting it through
    # is safe precisely because there is nothing to apply.
    # Only a full-state body can be compared with the asset. A diff body
    # (`combine`) or a sub-command's body (`COMMAND_KEY`) describes an
    # operation, not the asset's fields, so measuring it against the asset
    # finds nothing in common and would call every such write empty --
    # letting native-filter and colour changes through the gate entirely.
    #
    # "Comparable" is about the *body*: whether it can be measured against the
    # asset's fields, for the empty-change test, the baseline and the revert
    # tripwire. It says nothing about what else the write does. That is
    # ``carries_effect``, and it vetoes only the first of those three -- a
    # write whose keyword arguments act on the asset is not a no-op whatever
    # its body says, but its body still has a live value to be measured
    # against, and giving up the baseline for it would let a stale approval
    # through (QA-24).
    comparable = _is_comparable(operation, combine, command_args)
    carries_effect = bool(captured_arguments(command_args))
    live = None
    if comparable:
        # Imported here: `replay` imports this module, so taking it at the
        # top would close a cycle.
        from asset_approval.replay import load_asset

        try:
            live = load_asset(asset_type, asset_id)
        except Exception:  # noqa: BLE001
            # Unreadable means unknowable, and an unknowable change is not
            # an empty one. Falling through captures it for review, which
            # is the direction a gate is allowed to be wrong in.
            logger.warning(
                "asset-approval: could not load %s %s to test for an empty "
                "change; capturing it",
                asset_type.value,
                asset_id,
                exc_info=True,
            )
    # Read here rather than beside the refusal below, because deciding
    # whether this body may be folded onto an open request needs to know
    # whose request it is. The refusal itself stays where it was, after the
    # emptiness test: an identity-less write that changes nothing has always
    # been let through, and this is not the change that starts refusing it.
    author_id = get_user_id()

    # The author's own open request is looked up *before* this write is
    # judged, because what the save really proposes is the body folded onto
    # that request -- and every question below has to be asked of the fold
    # rather than of the body. R4-01 used to read the body alone, so a
    # partial save whose own fields all matched live was called "empty" and
    # discarded a draft carrying an unrelated ``params`` edit. Only the
    # *lookup* moves: the refusals stay below the emptiness test, because a
    # save that changes nothing has never been refused for a lock it is not
    # going to take.
    existing = _open_request_or_none(asset_type, asset_id)
    foldable = _can_fold(existing, author_id, command_args, operation)
    proposed, folded_args = (
        _fold_into(existing, payload, command_args, combine, fold_fields)
        if foldable
        else (payload, command_args)
    )

    # Settings the draft had moved off live that this body puts back. Said
    # out loud in the response and never refused: it is the oracle for every
    # editing surface that still opens on the live asset, including the REST
    # clients that never saw a dialog, and a deliberate revert deserves a
    # true sentence rather than a false 409.
    put_back = (
        reverted_fields(live, existing.payload_dict, _as_stored(proposed, payload))
        if foldable and live is not None
        else []
    )

    if (
        comparable
        and live is not None
        and not carries_effect
        and is_empty_change(live, proposed)
    ):
        # Nothing to capture -- but the author may just have typed their own
        # draft back to what is live, and the draft would otherwise go on
        # proposing the text they thought they had undone (R4-01).
        _drop_a_fully_reverted_draft(asset_type, asset_id)
        return

    if author_id is None:
        # No identity means we cannot attribute the change or decide who may
        # approve it. Refusing is the only safe answer: the SOW requires the
        # gate to fail closed on every write path (SOW 3, 5.7).
        raise UnattributableWriteRefusedError(asset_type.value, asset_id)

    # What the asset holds right now in the fields this change reviews, so
    # an approval can tell whether the asset moved while the request waited
    # (QA-24). Measured on the folded payload, which is what the request
    # proposes and therefore what an approval has to find unmoved. Only
    # full-state bodies have one; a diff describes an operation, not the
    # asset's fields.
    base = baseline_of(live, proposed) if comparable else {}
    if comparable:
        folded_args, base = _own_the_exempt_fields(live, proposed, folded_args, base)

    if existing is not None and existing.author_fk != author_id:
        raise AssetLockedError(
            asset_type.value,
            asset_id,
            _display_name(existing.author),
        )

    replaced_delete = False
    left_review = False
    if existing is not None:
        if not _same_kind(existing, command_args):
            # One request replays through one command. Folding a native
            # filter diff into a properties draft (or the reverse) would
            # either be unreplayable or silently discard the earlier edit.
            raise AssetLockedError(
                asset_type.value,
                asset_id,
                message=(
                    f"You already have other changes open on this "
                    f"{asset_type.value}. Submit or discard them before "
                    "making this change."
                ),
            )
        # Read before the update overwrites the row. A save that takes the
        # place of a delete, or that pulls a submitted request out of review,
        # has to say so: the delete direction already did, and this one left
        # the author with "Changes updated in your existing draft" while
        # their submitted delete was discarded and the approver's queued
        # item vanished (129078).
        # ``getattr``: a request is also folded into from paths that hand
        # this a partial stand-in for the row, and neither answer is worth
        # failing a write over.
        replaced_delete = (
            Operation(getattr(existing, "operation", Operation.UPDATE.value))
            is Operation.DELETE
        )
        left_review = (
            ChangeStatus(getattr(existing, "status", ChangeStatus.DRAFT.value))
            is ChangeStatus.PENDING
        )
        change_request_id = _update_own_request(
            existing.id,
            proposed,
            note,
            folded_args,
            operation,
            # A rename that replaces a pending delete must not inherit the
            # delete's note: the approver was reading "delete it" as the note
            # on a rename (E3). The delete direction already clears it; this
            # is the mirror.
            #
            # A save that pulls the request back out of review clears it for
            # the same reason. The note was written to tell a reviewer what
            # they were being asked to look at, and the content has just
            # changed underneath it. Kept, it is pre-filled into the next
            # request-review dialog, so an author in a hurry sends their
            # reviewer a description of work the draft no longer contains --
            # which is what a tester did, and rated the worst thing they hit.
            clear_note=replaced_delete or left_review,
            base=base,
        )
    else:
        # ``payload`` and the args as stamped, not the folded pair: there was
        # nothing to fold into. If the insert loses the asset's open slot to
        # the author's own second click, ``_lost_the_slot`` folds against
        # whatever won it, through the same ``_fold_into``.
        outcome: dict[str, Any] = {}
        change_request_id = _insert_request(
            asset_type,
            asset_id,
            payload,
            author_id,
            note,
            folded_args,
            operation,
            base=base,
            combine=combine,
            fold_fields=fold_fields,
            live=live,
            outcome=outcome,
        )
        put_back = outcome.get("reverted_fields", put_back)

    raise ChangeRequestCreated(
        change_request_id,
        asset_type.value,
        asset_id,
        operation=operation.value,
        updated_existing=existing is not None,
        replaced_delete=existing is not None and replaced_delete,
        left_review=existing is not None and left_review,
        reverted_fields=put_back,
    )


def _is_comparable(
    operation: Operation, combine: Combine | None, command_args: dict[str, Any] | None
) -> bool:
    """Whether the body can be measured against the asset's own fields.

    Only a full-state body can. A diff body (``combine``) or a sub-command's
    body (``COMMAND_KEY``) describes an operation, not the asset's fields.
    """
    return (
        operation is Operation.UPDATE
        and combine is None
        and not (command_args or {}).get(COMMAND_KEY)
    )


def proposes_nothing(change_request: Any, asset: Any) -> bool:
    """Whether this stored request would leave the live asset exactly as it is.

    The question ``gate_write`` asks of a save before it makes a request,
    asked again of the request itself when it is about to go to a reviewer.
    Answered by the same test (``is_empty_change``) under the same conditions
    (``_is_comparable``, and no keyword that acts on the asset), so there is
    one definition of "changed" and the two places cannot disagree about it.

    A delete, a sub-command's body and a request carrying keyword arguments
    never answer yes: they are not measured against the asset's fields.
    """
    if asset is None:
        return False
    try:
        operation = Operation(change_request.operation)
        args = change_request.command_args
        if not _is_comparable(operation, None, args) or captured_arguments(args):
            return False
        return is_empty_change(asset, change_request.payload_dict)
    except Exception:  # noqa: BLE001 -- unknowable is not empty
        logger.warning(
            "asset-approval: could not tell whether request %s proposes nothing",
            getattr(change_request, "id", None),
            exc_info=True,
        )
        return False


def _as_stored(proposed: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    """The fields ``body`` carries, as the fold is going to store them.

    The revert tripwire asks whether this save undid something the draft had
    moved. After a refined fold a field can be stored with more in it than
    the body had (a dashboard's ``json_metadata`` keeps the draft's layout),
    and asking about the body's own value would report that layout as put
    back when the fold has just kept it.
    """
    return {field: proposed[field] for field in body if field in proposed}


def _exempt_fields_this_write_changes(live: Any, proposed: dict[str, Any]) -> list[str]:
    """The exempt fields in ``proposed`` that differ from what is live now.

    That is what separates the two things a captured exempt field can be. One
    that differs from the live asset was put there on purpose: a save that
    leaves a field as it found it is not changing it, and an exempt change
    made alone never reaches the gate at all. One that equals the live value
    is only the dialog echoing the form back, a snapshot that will be wrong
    the moment someone else touches the field.
    """
    carried = {k: v for k, v in proposed.items() if k in EXEMPT_FIELDS}
    if not carried:
        return []
    if live is None:
        # Unreadable is unknowable, and an unknowable change is the author's.
        return sorted(carried)
    return changed_fields(live, carried)


def _own_the_exempt_fields(
    live: Any,
    proposed: dict[str, Any],
    command_args: dict[str, Any] | None,
    base: dict[str, Any],
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Record which exempt fields this capture is responsible for applying.

    Replay drops an exempt field unless it is named here (129071: the copy in
    a request is a snapshot, and writing it back undid anything done to the
    field since). Naming the ones the author changed in this very write is
    what lets the rest of that rule stand without losing the edit that rode
    along with a governed one (B4).

    An owned field is applied, so it also joins the baseline. The baseline
    deliberately leaves exempt fields out, so that adding an editor during a
    review does not make the review unapprovable; an exempt field this
    request will *write* is a different thing, and writing a stale list over
    one that has moved since is the 129071 defect again. It is refused with
    the field named, as any other moved field is, and the author saves again.
    """
    args = {k: v for k, v in (command_args or {}).items() if k != EXEMPT_APPLIED_KEY}
    owned = _exempt_fields_this_write_changes(live, proposed)
    if not owned:
        return (args if command_args is not None else None), base
    if live is not None:
        for field in owned:
            if not hasattr(live, field):
                continue
            try:
                base = {**base, field: _comparable(getattr(live, field), field)}
            except Exception:  # noqa: BLE001 -- a baseline must never block a write
                logger.warning(
                    "asset-approval: could not record a baseline for %r", field
                )
    return {**args, EXEMPT_APPLIED_KEY: owned}, base


def _open_request_or_none(asset_type: AssetType, asset_id: int) -> ChangeRequest | None:
    """The asset's open request, or nothing if it cannot be read.

    The lookup now happens before the write is judged at all, so a database
    it cannot reach must not turn a save into a 500. An unreadable slot
    answers "no open request", which is what every path below this already
    does with one.
    """
    try:
        return find_open_request(asset_type, asset_id)
    except Exception:  # noqa: BLE001
        logger.warning(
            "asset-approval: could not look up the open request on %s %s",
            asset_type.value,
            asset_id,
            exc_info=True,
        )
        return None


def _display_name(user: Any) -> str | None:
    """Name the lock holder the way the review banner does ("Alex Rivera")."""
    if user is None:
        return None
    full = " ".join(
        part
        for part in (
            getattr(user, "first_name", None),
            getattr(user, "last_name", None),
        )
        if part
    )
    return full or getattr(user, "username", None)


def _serialized(
    payload: dict[str, Any],
    command_args: dict[str, Any] | None,
    base: dict[str, Any] | None = None,
) -> str:
    return ChangeRequest.serialize_payload(payload, command_args, base)


def _drop_a_fully_reverted_draft(asset_type: AssetType, asset_id: int) -> None:
    """Close the author's own draft once they have undone all of it.

    This write leaves the asset exactly as it is, so for anyone else it is
    a no-op. For the author of the asset's open request it is the last
    edit of several, and what it says is that the draft now proposes
    nothing: every field is back to the live value. Leaving it open told
    the author they had reverted while an approver could still publish the
    original proposal (R4-01).

    Only ever the author's own, and only a draft replayed by the asset's
    main update -- a native-filter or colours draft describes an operation
    this body cannot speak for, so it is left alone. Anything unreadable
    leaves the request as it was: failing to tidy up is survivable, and
    discarding the wrong draft is not.

    A **draft**, and nothing further on. The name said so and the guards
    did not: ``find_open_request`` returns ``PENDING`` and
    ``CHANGES_REQUESTED`` alike, so an ordinary save that happened to
    change nothing closed a request the author had already submitted. That
    answered 200 with no mention of review, recorded the author as the
    reviewer of their own change, and emptied the approver's queue with
    nothing said to either of them. Undoing your own draft is yours to do;
    a submitted change belongs to the review, and withdrawing it is a
    transition with its own name.
    """
    author_id = get_user_id()
    if author_id is None:
        return
    try:
        existing = find_open_request(asset_type, asset_id)
    except Exception:  # noqa: BLE001
        logger.warning(
            "asset-approval: could not look up the open request on %s %s",
            asset_type.value,
            asset_id,
            exc_info=True,
        )
        return
    if existing is None or existing.author_fk != author_id:
        return
    if ChangeStatus(existing.status) is not ChangeStatus.DRAFT:
        return
    if existing.command_args.get(COMMAND_KEY):
        return
    if captured_arguments(existing.command_args):
        # The draft does something its body does not say (a metric delete, a
        # dashboard attach). A body that matches live says only that this
        # save changes nothing; it cannot speak for the arguments.
        return
    _discard_request(existing.id, author_id)


def _discard_request(change_request_id: int, decided_by: int) -> None:
    """Close a request and free the asset's slot, on its own connection.

    The same connection discipline ``_insert_request`` explains: the gate's
    bookkeeping has to settle whether or not the caller's transaction does.

    Recorded the way ``lifecycle.discard`` records one, so a request closed
    this way reads no differently in the author's history from one they
    closed through the banner.
    """
    now = datetime.now(timezone.utc)
    table = ChangeRequest.__table__
    with db.engine.begin() as connection:
        connection.execute(
            table.update()
            .where(
                table.c.id == change_request_id,
                # Only a draft, as the caller checked a moment ago: a request
                # submitted or decided since is not this save's to close.
                table.c.status == ChangeStatus.DRAFT.value,
            )
            .values(
                status=ChangeStatus.DISCARDED.value,
                active_slot=None,
                reviewer_fk=decided_by,
                decided_at=now,
                changed_on=now,
            )
        )


def discard_the_authors_draft_on(asset_type: AssetType, asset_id: int) -> None:
    """Close the author's own draft on an asset that is about to be deleted.

    A dashboard no viewer has ever reached is deleted outright rather than
    held (see ``bindings._gate_dashboard_delete``), and a draft describing an
    edit to it would otherwise outlive the asset it describes: a row in the
    author's history and a slot held against an id that no longer resolves.

    Only the author's own, and only a **draft**. Anything submitted means the
    delete was held instead of applied, so this is never reached for it.
    Anything unreadable leaves the request alone, on the same reasoning as
    the revert tidy-up above: failing to tidy up is survivable.
    """
    author_id = get_user_id()
    if author_id is None:
        return
    try:
        existing = find_open_request(asset_type, asset_id)
    except Exception:  # noqa: BLE001
        logger.warning(
            "asset-approval: could not look up the open request on %s %s",
            asset_type.value,
            asset_id,
            exc_info=True,
        )
        return
    if existing is None or existing.author_fk != author_id:
        return
    if ChangeStatus(existing.status) is not ChangeStatus.DRAFT:
        return
    _discard_request(existing.id, author_id)


def _insert_request(
    asset_type: AssetType,
    asset_id: int,
    payload: dict[str, Any],
    author_id: int,
    note: str | None,
    command_args: dict[str, Any] | None = None,
    operation: Operation = Operation.UPDATE,
    base: dict[str, Any] | None = None,
    *,
    combine: Combine | None = None,
    fold_fields: bool | Refine = False,
    live: Any = None,
    outcome: dict[str, Any] | None = None,
) -> int:
    """Write a new request on its own connection and commit it.

    The capture must survive the rollback that :class:`ChangeRequestCreated`
    triggers, so it cannot ride the caller's session. A separate connection
    from the same engine commits independently of whatever the command's
    transaction goes on to do.

    ``combine``, ``fold_fields`` and ``live`` are carried only so that
    ``_lost_the_slot`` can fold the same way ``gate_write`` does when this
    insert loses the asset's open slot; ``outcome`` is how it reports what
    that fold put back, since the caller is the one that raises.
    """
    now = datetime.now(timezone.utc)
    # Written explicitly: this is a Core insert, so the ORM-level
    # ``default=uuid.uuid4`` on the column never fires.
    values = {
        "uuid": uuid_module.uuid4(),
        "asset_type": asset_type.value,
        "asset_id": asset_id,
        "operation": operation.value,
        "status": ChangeStatus.DRAFT.value,
        "active_slot": OPEN_SLOT,
        "payload": _serialized(payload, command_args, base),
        "author_fk": author_id,
        "note": note,
        "created_on": now,
        "changed_on": now,
        "created_by_fk": author_id,
        "changed_by_fk": author_id,
    }
    table = ChangeRequest.__table__
    try:
        with db.engine.begin() as connection:
            result = connection.execute(insert(table).values(**values))
            inserted = result.inserted_primary_key
            if inserted is not None and inserted[0] is not None:
                return int(inserted[0])
            # Backends that do not return the generated key: read it back
            # on the same connection, inside the same transaction.
            return int(
                connection.execute(
                    select(table.c.id).where(
                        table.c.asset_type == asset_type.value,
                        table.c.asset_id == asset_id,
                        table.c.active_slot == OPEN_SLOT,
                    )
                ).scalar_one()
            )
    except IntegrityError as ex:
        # Lost the race for the asset's open slot. The unique constraint is
        # the real guard; the lookup in ``gate_write`` is only a nicer
        # message, and between the two another write got there first.
        #
        # Settled outside the ``with``: the insert broke that transaction,
        # so nothing further can be read on it.
        return _lost_the_slot(
            asset_type,
            asset_id,
            payload,
            author_id,
            note,
            command_args,
            operation,
            base,
            ex,
            combine=combine,
            fold_fields=fold_fields,
            live=live,
            outcome=outcome,
        )


def _lost_the_slot(
    asset_type: AssetType,
    asset_id: int,
    payload: dict[str, Any],
    author_id: int,
    note: str | None,
    command_args: dict[str, Any] | None,
    operation: Operation,
    base: dict[str, Any] | None,
    cause: IntegrityError,
    *,
    combine: Combine | None = None,
    fold_fields: bool | Refine = False,
    live: Any = None,
    outcome: dict[str, Any] | None = None,
) -> int:
    """Someone else reached the asset's open slot first. Who, and so what.

    The commonest way here is not two people: it is one author whose Save
    fired twice, and both halves of that race used to come back as *"another
    editor already has changes open"* -- an accusation about a colleague who
    does not exist -- with the losing payload dropped. Doing it in sequence
    folds, so doing it at once should too.

    Same author, same command: fold, through the *same* ``_fold_into`` the
    sequential path uses. It used to replace the payload here instead of
    merging it, which made this the one chart path a double click could
    still lose an edit on -- a fix landing on the branch a unit test calls
    and not on the branch a double click reaches. There is now one fold, so
    the two cannot drift again.

    The baseline is recomputed on the folded payload for the same reason
    ``gate_write`` measures it there: it is what an approval has to find
    unmoved. The emptiness test is *not* re-run -- a race whose fold happens
    to come out equal to live is a tidy-up, and this is not the place to
    discard a request that another connection has just committed.
    """
    try:
        holder = find_open_request(asset_type, asset_id)
    except Exception:  # noqa: BLE001 -- the refusal matters more than the name
        holder = None

    if holder is None:
        # It was taken and released again between the insert and this read.
        # Nothing to fold into and nobody to name.
        raise AssetLockedError(asset_type.value, asset_id) from cause

    if holder.author_fk != author_id:
        raise AssetLockedError(
            asset_type.value,
            asset_id,
            _display_name(holder.author),
        ) from cause

    if not _same_kind(holder, command_args):
        raise AssetLockedError(
            asset_type.value,
            asset_id,
            message=(
                f"You already have other changes open on this "
                f"{asset_type.value}. Submit or discard them before "
                "making this change."
            ),
        ) from cause

    if _can_fold(holder, author_id, command_args, operation):
        body = payload
        payload, command_args = _fold_into(
            holder, payload, command_args, combine, fold_fields
        )
        if outcome is not None and live is not None:
            outcome["reverted_fields"] = reverted_fields(
                live, holder.payload_dict, _as_stored(payload, body)
            )
        if live is not None:
            base = baseline_of(live, payload)
    if live is not None and _is_comparable(operation, combine, command_args):
        # Measured on whatever is stored, folded or not: what this request
        # owns is a fact about the body it ends up with.
        command_args, base = _own_the_exempt_fields(
            live, payload, command_args, base or {}
        )

    return _update_own_request(
        holder.id,
        payload,
        note,
        command_args,
        operation,
        base=base,
    )


def _update_own_request(
    change_request_id: int,
    payload: dict[str, Any],
    note: str | None,
    command_args: dict[str, Any] | None = None,
    operation: Operation = Operation.UPDATE,
    clear_note: bool = False,
    base: dict[str, Any] | None = None,
) -> int:
    """Fold a further edit into the author's existing open request.

    SOW 5.5: a second save by the same author says "Changes updated in your
    existing draft", never "Overwritten". Submitting again replaces the
    captured payload, because an approval must cover exactly what was last
    reviewed.
    """
    table = ChangeRequest.__table__
    now = datetime.now(timezone.utc)
    values: dict[str, Any] = {
        "payload": _serialized(payload, command_args, base),
        "operation": operation.value,
        "changed_on": now,
        # A fresh edit returns a bounced request to the author's hands.
        "status": ChangeStatus.DRAFT.value,
        "active_slot": OPEN_SLOT,
        "review_note": None,
        "submitted_at": None,
    }
    if clear_note:
        # The note explained a change this request no longer carries, so it
        # would be read as describing the new one (129078).
        values["note"] = None
    elif note is not None:
        values["note"] = note
    # Conditional on the request still being open, not merely on its id.
    #
    # The caller read the request a moment ago and decided to fold into it,
    # and a reviewer may decide it in between: approving takes a row lock on
    # the request, this write is on another connection and so waits for it,
    # and an unconditional UPDATE then ran the moment the approval committed.
    # It put the *approved* request back to ``draft``, reopened its slot and
    # replaced its payload with the author's newer one, so the record of what
    # was approved was overwritten by what had not been (R7-05). Nothing in
    # the capture path takes the lifecycle's lock; a status predicate on the
    # write is what makes the race lose cleanly instead.
    with db.engine.begin() as connection:
        result = connection.execute(
            table.update()
            .where(
                table.c.id == change_request_id,
                table.c.status.in_([s.value for s in OPEN_STATUSES]),
            )
            .values(**values)
        )
    if result.rowcount == 0:
        raise AssetLockedError(
            "change request",
            change_request_id,
            message=(
                "This change was reviewed while you were saving, so your "
                "latest edit was not saved. Reload it and save again."
            ),
        )
    return change_request_id


def gate_delete(asset_type: AssetType, asset_ids: list[int]) -> None:
    """Capture a delete for review, one request per asset.

    Deletes arrive in bulk -- the commands take a list of ids -- but each
    asset is reviewed on its own, the same way an import that overwrites
    three assets raises three requests (SOW 5.1, Visa Q12). An approver
    deciding about one dashboard should not be made to decide about four.

    Locks are checked for every asset before any request is written. A
    partial capture would be worse than a refusal: the author would be told
    the delete was rejected while some of it sat waiting for review.

    :raises ChangeRequestCreated: when the delete was captured.
    :raises AssetLockedError: when any of the assets is already held.
    """
    if not is_enabled() or is_replaying():
        return

    author_id = get_user_id()
    if author_id is None:
        raise UnattributableWriteRefusedError(
            asset_type.value, asset_ids[0] if asset_ids else None
        )

    held: list[ChangeRequest] = []
    for asset_id in asset_ids:
        existing = find_open_request(asset_type, asset_id)
        if existing is not None and existing.author_fk != author_id:
            raise AssetLockedError(
                asset_type.value,
                asset_id,
                getattr(existing.author, "username", None),
            )
        if existing is not None:
            held.append(existing)

    held_by_asset = {c.asset_id: c for c in held}
    created: list[int] = []
    replaced_edit = False
    for asset_id in asset_ids:
        existing = held_by_asset.get(asset_id)
        if existing is not None:
            # Replacing an edit with a delete is a different change, not an
            # update to the same one: the edit's note described a rename
            # that is no longer on the table (129078).
            replacing_an_edit = Operation(existing.operation) is not Operation.DELETE
            replaced_edit = replaced_edit or replacing_an_edit
            created.append(
                _update_own_request(
                    existing.id,
                    {},
                    None,
                    {},
                    Operation.DELETE,
                    clear_note=replacing_an_edit,
                )
            )
        else:
            created.append(
                _insert_request(
                    asset_type, asset_id, {}, author_id, None, {}, Operation.DELETE
                )
            )

    raise ChangeRequestCreated(
        created[0] if created else 0,
        asset_type.value,
        asset_ids[0] if asset_ids else 0,
        count=len(created),
        change_request_ids=created,
        operation=Operation.DELETE.value,
        replaced_edit=replaced_edit,
    )


def refuse_import_overwrite(asset_kind: str = "asset") -> None:
    """Refuse an import that would overwrite a governed asset.

    SOW 5.1 puts imports under review and SOW 5.7 requires the gate to fail
    closed on every write path, import included. Capturing an import the way
    an edit is captured means storing the uploaded bundle and replaying it on
    approval -- the payload is a zip, not a request body, so it needs
    somewhere to live that the change_requests table is not.

    Until that exists, the honest behaviour is to refuse rather than to let
    an import overwrite governed assets unreviewed. Refusing is a departure
    from "each overwritten asset gets its own request" (Visa Q12) and is
    deliberately loud about it: an unreviewed overwrite would be a hole in
    the control the whole feature exists to provide, while a refusal is
    merely inconvenient and visible.

    A non-overwriting import creates new assets, which V1 does not gate at
    all (SOW 8), so it is unaffected. Nor is an overwriting import that
    happens to land on nothing: the callers in ``bindings`` decide that by
    resolving the identity the import would really bind -- the bundle's
    uuids, and the other unique keys a fresh uuid can still be matched onto
    (R5-03) -- so this is only reached once a live asset really is in the
    way (S-06).
    """
    if not is_enabled() or is_replaying():
        return
    raise ImportOverwriteRefusedError(asset_kind)


def refuse_unreviewable_write(action: str, alternative: str) -> None:
    """Refuse a governed write that cannot be captured for review.

    For write paths with nothing an approval could faithfully replay (see
    :class:`~asset_approval.exceptions.UnreviewableWriteRefusedError`).
    A no-op when the feature is off, and during an approved replay.

    :param action: what was refused, as the person would describe it.
    :param alternative: the reviewed way to achieve the same thing.
    """
    if not is_enabled() or is_replaying():
        return
    raise UnreviewableWriteRefusedError(action, alternative)


def combine_config_diffs(
    existing: dict[str, Any], new: dict[str, Any]
) -> dict[str, Any]:
    """Fold two ``{modified, deleted, reordered}`` diffs into one.

    The dashboard native filter and chart customization endpoints take a
    diff against the stored configuration, not the full configuration. A
    second edit captured into the same draft must therefore be *added* to
    the first, or approving the draft would apply only the last edit.

    Applying the result is equivalent to applying ``existing`` then
    ``new``: a later modification of an item wins, a later delete removes
    any earlier modification, a later modification revives an earlier
    delete, and the latest non-empty ordering wins.
    """

    def item_id(item: Any) -> Any:
        return item.get("id") if isinstance(item, dict) else None

    new_modified = list(new.get("modified") or [])
    new_deleted = list(new.get("deleted") or [])
    touched = {item_id(item) for item in new_modified} | set(new_deleted)
    # An item without an id cannot be matched to anything; keep every one.
    touched.discard(None)

    combined: dict[str, Any] = {
        "modified": [
            item
            for item in existing.get("modified") or []
            if item_id(item) not in touched
        ]
        + new_modified,
        "deleted": [
            deleted
            for deleted in existing.get("deleted") or []
            if deleted not in touched
        ]
        + new_deleted,
    }
    if reordered := new.get("reordered") or existing.get("reordered"):
        combined["reordered"] = reordered
    return combined


def combine_key_values(existing: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """Fold two partial key/value updates into one; later keys win."""
    return {**existing, **new}


# ===========================================================================
# Deny by default
# ===========================================================================
#
# Everything above is an allowlist: a write path is bound by name, and a write
# that nobody named reaches the asset untouched. QA samples that unbounded set
# round after round (an MCP tool that mutates a live chart, a theme delete that
# nulls ``theme_id`` on published dashboards, an import that appends charts to a
# live dashboard) and every sample is a new row. This is the other half: the
# gate no longer has to *name* a write to stop it.
#
# The hook is the SQLAlchemy session, because that is the one place every ORM
# write to a governed row passes through whoever wrote it -- a command, an MCP
# tool holding a bare ``db.session``, a CLI, a task. Anything a bound gate has
# looked at and let through runs inside :func:`permitted`; anything else that
# changes what a viewer would see on a governed asset is refused at flush.
#
# What it is for, and what it is not for:
#
# * It is scoped to the governed asset types, their child rows and the two
#   dependency types that show text on a chart. It does not touch logging,
#   preferences, query history, caches, tags or version history.
# * Creation is free. A new chart or dataset reaches nobody by being created,
#   and a new dashboard is a draft (SOW 5.1). What is governed is the first
#   *exposure*: a dashboard being published, or a chart being placed on a
#   dashboard viewers can already reach.
# * It is a second line, not a replacement for the declared gates: those
#   capture a write and make it reviewable, this one only refuses one that
#   was never going to be reviewed.

#: Turns the guard off without a code change. Read like every other flag in
#: ``FEATURE_FLAGS`` and absent means off, so the name is the escape hatch
#: ("allow"), not the protection.
ALLOW_UNLISTED_FLAG = "CHANGE_MANAGEMENT_ALLOW_UNLISTED_WRITES"

#: Reasons a block of code is allowed to write governed rows unreviewed. A
#: context variable, not ``flask.g``: the guard also runs outside a request.
_PERMITS: ContextVar[tuple[str, ...]] = ContextVar(
    "asset_approval_permits", default=()
)


@contextmanager
def permitted(reason: str) -> Iterator[None]:
    """Let the writes inside this block through the deny-by-default guard.

    Entered in exactly three places, each named in the log if it is ever
    asked about: a replay of an approved change (``replaying``), the body of
    a *gated* command after its gate has looked at the write and let it by
    (``install.gate_run``), and the few declared internal writers that are not
    someone editing an asset (``bindings.WRITE_PATHS``, ``permit=True``).
    It is not a switch a caller can leave on: it is scoped to the block and
    restored on the way out, and nothing here reads it from a request.
    """
    token = _PERMITS.set((*_PERMITS.get(), reason))
    try:
        yield
    finally:
        _PERMITS.reset(token)


def current_permits() -> tuple[str, ...]:
    return _PERMITS.get()


def unlisted_writes_allowed() -> bool:
    """Whether an operator has switched the guard off."""
    try:
        from superset.extensions import feature_flag_manager

        return bool(feature_flag_manager.is_feature_enabled(ALLOW_UNLISTED_FLAG))
    except Exception:  # noqa: BLE001 -- flags not configured yet: not switched off
        return False


def _running_a_migration() -> bool:
    """Whether Alembic is running a schema migration in this context.

    A data migration rewrites charts and dashboards through the ORM (a viz
    type renamed, a parameter reshaped) in a session of its own, during
    ``superset db upgrade`` and with the same feature flags as the running
    app. It is not someone editing an asset, and refusing it would fail the
    upgrade half way. Read from Alembic's own operations proxy, which exists
    only for the duration of a migration.
    """
    try:
        from alembic import op

        return getattr(op, "_proxy", None) is not None
    except Exception:  # noqa: BLE001
        return False


def guard_is_live() -> bool:
    """Whether a write made right now is subject to the guard."""
    if _PERMITS.get() or _running_a_migration():
        return False
    try:
        if is_replaying():
            return False
    except RuntimeError:  # outside an application context
        pass
    try:
        if not is_enabled():
            return False
    except Exception:  # noqa: BLE001 -- asked before the flags exist
        return False
    return not unlisted_writes_allowed()


#: Columns whose change is not a change to what a viewer sees: who saved and
#: when, and the permission strings Superset derives from the dataset. The
#: host's own version history leaves the same ones out.
BOOKKEEPING_FIELDS = IGNORED_FIELDS | frozenset(
    {
        "created_on",
        "created_by",
        "created_by_fk",
        "perm",
        "schema_perm",
        "catalog_perm",
        # Revoking guest tokens narrows who can reach an embedded dashboard.
        "guest_token_revoked_before",
        "id",
    }
)

#: Not governed on any path: the SOW exempts them (``EXEMPT_FIELDS``), and a
#: dashboard's legacy ``roles`` list is access control of the same kind as
#: ``viewers`` and is written by an MCP tool the repo already declares exempt.
UNGOVERNED_FIELDS = BOOKKEEPING_FIELDS | EXEMPT_FIELDS | frozenset({"roles"})

#: The join between a chart and a dashboard, seen from either end.
MEMBERSHIP_FIELDS = frozenset({"slices", "dashboards"})

#: Model class name -> the asset it is, for the models that *are* assets.
_ASSET_CLASSES = {
    "Dashboard": AssetType.DASHBOARD,
    "Slice": AssetType.CHART,
    "SqlaTable": AssetType.DATASET,
}

#: Child rows: ``(foreign key, relationship, the asset they belong to)``.
_CHILD_CLASSES = {
    "TableColumn": ("table_id", "table", AssetType.DATASET),
    "SqlMetric": ("table_id", "table", AssetType.DATASET),
    "EmbeddedDashboard": ("dashboard_id", "dashboard", AssetType.DASHBOARD),
}

#: Rows a chart *displays* without being part of it, and the column that names
#: the layer. Not asset types: they have no editors, so no approver could ever
#: exist for one (SOW 5.4). They are guarded only while a chart shows them.
_DEPENDENCY_CLASSES = {"Annotation": "layer_id", "AnnotationLayer": "id"}

#: Tables a bulk statement can reach a governed row through.
_GOVERNED_TABLES = {
    "dashboards": AssetType.DASHBOARD,
    "slices": AssetType.CHART,
    "tables": AssetType.DATASET,
    "table_columns": AssetType.DATASET,
    "sql_metrics": AssetType.DATASET,
    "embedded_dashboards": AssetType.DASHBOARD,
    "dashboard_slices": AssetType.DASHBOARD,
}

#: Columns a *bulk* statement may write because the host derives them from
#: something else. A dataset's ``catalog`` follows its database's default
#: catalog, and ``UpdateDatabaseCommand`` rewrites it for every dataset on that
#: database in one UPDATE when an administrator changes the connection. Only
#: through a bulk statement: setting ``catalog`` on one dataset's row is still
#: an edit to that dataset.
_BULK_DERIVED = {"tables": frozenset({"catalog"})}

_BORN = "asset_approval_born"
_DEMOTED = "asset_approval_demoted"

#: The note on the publish request filed for a dashboard that was submitted
#: already published.
FIRST_PUBLISH_NOTE = (
    "Created as a draft: it was submitted already published, and a dashboard "
    "is first shown to viewers through review."
)


def _classify(obj: Any) -> tuple[str, str, Any] | None:
    """``(role, class name, what it belongs to)`` for a governed row, else None."""
    for klass in type(obj).__mro__:
        if not str(getattr(klass, "__module__", "")).startswith("superset."):
            continue
        name = klass.__name__
        if name in _ASSET_CLASSES:
            return "asset", name, _ASSET_CLASSES[name]
        if name in _CHILD_CLASSES:
            return "child", name, _CHILD_CLASSES[name]
        if name in _DEPENDENCY_CLASSES:
            return "dependency", name, _DEPENDENCY_CLASSES[name]
    return None


def _changes(obj: Any) -> dict[str, Any]:
    """Attribute -> history, for every attribute the flush would write."""
    from sqlalchemy import inspect as sa_inspect

    return {
        attribute.key: attribute.history
        for attribute in sa_inspect(obj).attrs
        if attribute.history.has_changes()
    }


_UNKNOWN = object()


class _NoHistory:
    added: tuple = ()
    deleted: tuple = ()


_NO_HISTORY = _NoHistory()


def _before(history: Any) -> Any:
    if history.deleted:
        return history.deleted[0]
    if history.unchanged:
        return history.unchanged[0]
    return _UNKNOWN


def _after(history: Any) -> Any:
    return history.added[0] if history.added else None


def _born(session: Any) -> set[tuple[str, int]]:
    return session.info.setdefault(_BORN, set())


def _is_born(session: Any, asset: AssetType, asset_id: Any) -> bool:
    return asset_id is not None and (asset.value, asset_id) in _born(session)


def _pending_review_exists(asset_type: AssetType, asset_id: int) -> bool:
    """Whether the asset has a request waiting on a reviewer right now.

    On its own connection, like the other reads the guard makes, so a request
    another worker has just submitted is visible.
    """
    table = ChangeRequest.__table__
    try:
        with db.engine.connect() as connection:
            return (
                connection.execute(
                    select(table.c.id).where(
                        table.c.asset_type == asset_type.value,
                        table.c.asset_id == asset_id,
                        table.c.status == ChangeStatus.PENDING.value,
                    )
                ).first()
                is not None
            )
    except Exception:  # noqa: BLE001
        # Unknowable is not "nobody is reviewing": the cautious answer.
        logger.warning(
            "asset-approval: could not tell whether %s %s is in review",
            asset_type.value,
            asset_id,
            exc_info=True,
        )
        return True


def has_pending_request(asset_type: AssetType, asset_id: int) -> bool:
    """Whether the asset's request has been submitted and not yet decided."""
    return _pending_review_exists(asset_type, asset_id)


def _published_before_this_flush(session: Any, dashboard: Any) -> bool:
    """What the dashboard's Draft flag held before the write being judged."""
    from sqlalchemy import inspect as sa_inspect

    try:
        history = sa_inspect(dashboard).attrs.published.history
    except Exception:  # noqa: BLE001 -- not a mapped row: a stand-in
        return bool(getattr(dashboard, "published", False))
    was = _before(history)
    if was is not _UNKNOWN:
        return bool(was)
    dashboard_id = getattr(dashboard, "id", None)
    session = session or sa_inspect(dashboard).session
    if dashboard_id is None or session is None:
        return False
    # Set without the old value loaded, so ask the database what it holds.
    from superset.models.dashboard import Dashboard

    table = Dashboard.__table__
    return bool(
        session.execute(
            select(table.c.published).where(table.c.id == dashboard_id)
        ).scalar()
    )


def dashboard_is_exposed(dashboard: Any, session: Any = None) -> bool:
    """Whether viewers can reach this dashboard, or ever have.

    The same question ``bindings._gate_dashboard_update`` asks to decide
    whether a draft may be edited freely: published now, or ever recorded as
    published. Used for the other half of exposure too -- placing a chart on
    a dashboard changes what the dashboard's viewers can reach.
    """
    if _published_before_this_flush(session, dashboard):
        return True
    dashboard_id = getattr(dashboard, "id", None)
    return dashboard_id is not None and has_ever_been_published(
        AssetType.DASHBOARD, dashboard_id
    )


def _extra_is_only_certification(history: Any) -> bool:
    from asset_approval.changes import _parsed

    before, after = _before(history), _after(history)
    if before is _UNKNOWN:
        return False
    old, new = _parsed(before) or {}, _parsed(after) or {}
    if not isinstance(old, dict) or not isinstance(new, dict):
        return False
    moved = {
        key
        for key in set(old) | set(new)
        if _parsed(old.get(key)) != _parsed(new.get(key))
    }
    return bool(moved) and moved <= EXEMPT_EXTRA_KEYS


def _annotation_layer_in_use(session: Any, layer_id: Any) -> bool:
    """Whether a chart is configured to display this annotation layer."""
    if layer_id is None:
        return False
    from superset.models.slice import Slice

    with session.no_autoflush:
        rows = session.execute(
            select(Slice.params).where(Slice.params.like("%annotation_layers%"))
        ).scalars()
        for params in rows:
            try:
                layers = (json.loads(params) or {}).get("annotation_layers") or []
            except (ValueError, TypeError, AttributeError):
                continue
            for layer in layers:
                if (
                    isinstance(layer, dict)
                    and layer.get("sourceType", "NATIVE") == "NATIVE"
                    and str(layer.get("value")) == str(layer_id)
                ):
                    return True
    return False


@dataclass
class _Finding:
    asset: str
    asset_id: Any
    what: str
    alternative: str
    objects: list[Any]

    def action(self) -> str:
        where = f"{self.asset} {self.asset_id}" if self.asset_id else self.asset
        return f"Writing {self.what} on {where} outside the editor"


_EDITOR = (
    "Make the change in the editor, or through the API's own update call, so "
    "it can be reviewed."
)


def _named(keys: Any) -> str:
    names = sorted(keys)
    shown = ", ".join(names[:4])
    return shown + (f" and {len(names) - 4} more" if len(names) > 4 else "")


def demote_new_published_dashboards(session: Any) -> list[Any]:
    """Make every dashboard being created in this flush a draft.

    SOW 5.1: a dashboard is created as a draft, and showing it to viewers is
    an edit that requires approval. A creation that arrives already published
    (the REST create with ``published: true``, an MCP tool, an import) used to
    skip that: it landed live with no request, and the product's own refusal
    text conceded as much ("an import that only creates new assets is
    unaffected"). The dashboard is created, as it was asked to be, and not
    published; a request to publish it is filed once the creation commits.

    Returns the dashboards it changed.
    """
    changed = []
    for obj in list(session.new):
        classified = _classify(obj)
        if classified is None or classified[1] != "Dashboard":
            continue
        if bool(getattr(obj, "published", False)):
            obj.published = False
            changed.append(obj)
    return changed


def _review_flush(session: Any) -> list[_Finding]:  # noqa: C901
    findings: list[_Finding] = []
    exposed_cache: dict[int, bool] = {}

    def exposed(dashboard: Any) -> bool:
        key = id(dashboard)
        if key not in exposed_cache:
            exposed_cache[key] = dashboard_is_exposed(dashboard, session)
        return exposed_cache[key]

    deleted_ids = {
        (c[2].value, getattr(o, "id", None))
        for o in session.deleted
        if (c := _classify(o)) and c[0] == "asset"
    }

    def parent_of(child: Any, spec: tuple[str, str, AssetType]) -> tuple[AssetType, Any]:
        foreign_key, relationship, asset = spec
        parent_id = getattr(child, foreign_key, None)
        if parent_id is None:
            parent = getattr(child, relationship, None)
            parent_id = getattr(parent, "id", None)
        return asset, parent_id

    def add(asset: AssetType, asset_id: Any, what: str, alt: str, obj: Any) -> None:
        findings.append(_Finding(asset.value, asset_id, what, alt, [obj]))

    for obj in session.new:
        classified = _classify(obj)
        if classified is None:
            continue
        role, name, target = classified
        if role == "asset" and name == "Slice":
            # A new chart is free, but not onto a dashboard viewers can reach.
            # Read off the chart's own side of the join: the dashboard's
            # collection may not be loaded, and then it is not flagged either.
            for dashboard in _changes(obj).get("dashboards", _NO_HISTORY).added:
                dash_id = getattr(dashboard, "id", None)
                if (
                    dash_id is not None
                    and not _is_born(session, AssetType.DASHBOARD, dash_id)
                    and exposed(dashboard)
                ):
                    add(AssetType.DASHBOARD, dash_id, "the charts on it",
                        _PLACE_CHART, obj)
        if role == "child":
            asset, parent_id = parent_of(obj, target)
            if parent_id is not None and not _is_born(session, asset, parent_id):
                what = "an embedded config" if name == "EmbeddedDashboard" else (
                    "a new column" if name == "TableColumn" else "a new metric"
                )
                add(asset, parent_id, what, _EDITOR, obj)
        elif role == "dependency":
            layer_id = getattr(obj, target, None)
            if _annotation_layer_in_use(session, layer_id):
                add(AssetType.CHART, None, f"an annotation in layer {layer_id}",
                    _IN_USE_ANNOTATION, obj)

    for obj in session.dirty:
        classified = _classify(obj)
        if classified is None:
            continue
        role, name, target = classified
        changes = _changes(obj)
        if not changes:
            continue
        if role == "dependency":
            layer_id = getattr(obj, target, None)
            if set(changes) - BOOKKEEPING_FIELDS and _annotation_layer_in_use(
                session, layer_id
            ):
                add(AssetType.CHART, None, f"annotation layer {layer_id}",
                    _IN_USE_ANNOTATION, obj)
            continue
        if role == "child":
            asset, parent_id = parent_of(obj, target)
            moved = set(changes) - BOOKKEEPING_FIELDS
            if moved and parent_id is not None and not _is_born(session, asset, parent_id):
                add(asset, parent_id, _named(moved), _EDITOR, obj)
            continue

        asset = target
        born = _is_born(session, asset, getattr(obj, "id", None))
        keys = set(changes) - UNGOVERNED_FIELDS
        if "extra" in keys and _extra_is_only_certification(changes["extra"]):
            keys.discard("extra")
        membership = keys & MEMBERSHIP_FIELDS
        content = keys - MEMBERSHIP_FIELDS

        if name == "Dashboard":
            if "published" in content:
                content.discard("published")
                if not born or bool(_after(changes["published"])):
                    add(asset, obj.id, "its published state", _EDITOR, obj)
            # A draft that nobody has seen is built freely (SOW 5.1) -- unless
            # it has been submitted, when the reviewer is looking at it.
            if (content or membership) and not born:
                if exposed(obj):
                    pass
                elif obj.id is not None and _pending_review_exists(asset, obj.id):
                    add(asset, obj.id, _named(content | membership) + " while it is in review",
                        "Withdraw the request to keep editing, or wait for the decision.", obj)
                    continue
                else:
                    continue
            if membership and not born and exposed(obj):
                add(asset, obj.id, "the charts on it", _EDITOR, obj)
            if content and not born and exposed(obj):
                add(asset, obj.id, _named(content), _EDITOR, obj)
            continue

        if name == "Slice" and "dashboards" in membership:
            for dashboard in (*changes["dashboards"].added, *changes["dashboards"].deleted):
                dash_id = getattr(dashboard, "id", None)
                if dash_id is None or _is_born(session, AssetType.DASHBOARD, dash_id):
                    continue
                if exposed(dashboard):
                    add(AssetType.DASHBOARD, dash_id, "the charts on it",
                        _PLACE_CHART, obj)
        if content and not born:
            add(asset, obj.id, _named(content), _EDITOR, obj)

    for obj in session.deleted:
        classified = _classify(obj)
        if classified is None:
            continue
        role, name, target = classified
        if role == "asset":
            if not _is_born(session, target, getattr(obj, "id", None)):
                add(target, obj.id, "a delete", _EDITOR, obj)
        elif role == "child":
            asset, parent_id = parent_of(obj, target)
            if (
                parent_id is not None
                and (asset.value, parent_id) not in deleted_ids
                and not _is_born(session, asset, parent_id)
            ):
                add(asset, parent_id, "a removed column, metric or embedded config",
                    _EDITOR, obj)
        else:
            layer_id = getattr(obj, target, None)
            if _annotation_layer_in_use(session, layer_id):
                add(AssetType.CHART, None, f"a delete in annotation layer {layer_id}",
                    _IN_USE_ANNOTATION, obj)
    return findings


_IN_USE_ANNOTATION = (
    "A chart displays this layer to its viewers. Create a new layer and point "
    "the chart at it from the chart editor, so the change can be reviewed."
)
_PLACE_CHART = (
    "Save the chart on its own, then add it to the dashboard from the "
    "dashboard editor, so the change can be reviewed."
)


def _drop_pending(session: Any, findings: list[_Finding]) -> None:
    """Take the refused writes out of the session, so they are not retried.

    A caller that catches the refusal and goes on to commit again (an event
    logger does) would otherwise be refused on every flush after, with the
    refused change still sitting in the session waiting for one that is not
    checked.
    """
    for finding in findings:
        for obj in finding.objects:
            try:
                if obj in session.new or obj in session.deleted:
                    session.expunge(obj)
                else:
                    session.expire(obj)
            except Exception:  # noqa: BLE001
                logger.warning("asset-approval: could not drop a refused write",
                               exc_info=True)


def _refuse(findings: list[_Finding], session: Any = None) -> None:
    first = findings[0]
    logger.warning(
        "asset-approval: refused %d unlisted write(s) to governed assets -- "
        "first: %s. To switch the deny-by-default guard off, set "
        "FEATURE_FLAGS[%r] = True.",
        len(findings),
        first.action(),
        ALLOW_UNLISTED_FLAG,
    )
    if session is not None:
        _drop_pending(session, findings)
    raise UnreviewableWriteRefusedError(first.action(), first.alternative)


def refuse_unlisted_writes(session: Any, _context: Any = None, _instances: Any = None) -> None:
    """``before_flush``: refuse a write to a governed asset nobody declared.

    A no-op for a flush that touches no governed row, which is almost all of
    them, so it costs one pass over the session's pending objects.
    """
    pending = (*session.new, *session.dirty, *session.deleted)
    if not any(_classify(obj) is not None for obj in pending):
        return
    if not guard_is_live():
        return
    try:
        demoted = demote_new_published_dashboards(session)
        if demoted:
            author = _author_or_none()
            session.info.setdefault(_DEMOTED, []).extend(
                {"object": obj, "id": None, "author": author} for obj in demoted
            )
        findings = _review_flush(session)
    except UnreviewableWriteRefusedError:
        raise
    except Exception as ex:  # noqa: BLE001
        # Fails closed: a write the guard could not read is not one it can
        # call harmless. Loud, because the way out is the off switch.
        logger.error("asset-approval: the deny-by-default guard failed", exc_info=True)
        raise UnreviewableWriteRefusedError(
            "Writing to a governed asset outside the editor",
            "The write could not be checked, so it was not made. " + _EDITOR,
        ) from ex
    if findings:
        _refuse(findings, session)


def _author_or_none() -> int | None:
    try:
        return get_user_id()
    except Exception:  # noqa: BLE001
        return None


def note_flush(session: Any, _context: Any = None) -> None:
    """``after_flush``: remember what this transaction created.

    Anything created in a transaction that has not committed has been seen by
    nobody, so a later write to it in the same transaction is still part of
    creating it. Also learns the ids of the dashboards that were demoted,
    which exist only now.
    """
    born = None
    for obj in session.new:
        classified = _classify(obj)
        if classified is None or classified[0] != "asset":
            continue
        if getattr(obj, "id", None) is not None:
            born = born if born is not None else _born(session)
            born.add((classified[2].value, obj.id))
    for entry in session.info.get(_DEMOTED, ()):
        if entry["id"] is None:
            entry["id"] = getattr(entry["object"], "id", None)


def file_first_publish_request(asset_id: int, author_id: int | None) -> int | None:
    """Ask for a dashboard that was created published to be published.

    On the connection ``_insert_request`` uses, because it runs after the
    creation has committed. Nothing is filed for a dashboard that is not there
    or is already published (a savepoint rolled back, or review published it),
    and nothing for a write with nobody to attribute it to: a request needs an
    author, and the dashboard is a draft either way.
    """
    if author_id is None:
        logger.warning(
            "asset-approval: dashboard %s was created published by nobody "
            "identifiable; it is a draft and no publish request was filed",
            asset_id,
        )
        return None
    from superset.models.dashboard import Dashboard

    table = Dashboard.__table__
    with db.engine.connect() as connection:
        row = connection.execute(
            select(table.c.published).where(table.c.id == asset_id)
        ).first()
    if row is None or row[0]:
        return None
    from types import SimpleNamespace

    return _insert_request(
        AssetType.DASHBOARD,
        asset_id,
        {"published": True},
        author_id,
        FIRST_PUBLISH_NOTE,
        None,
        Operation.UPDATE,
        base=baseline_of(SimpleNamespace(published=False), {"published": True}),
    )


def settle_after_commit(session: Any) -> None:
    """``after_commit``: file the publish requests for demoted dashboards."""
    entries = session.info.pop(_DEMOTED, None)
    for entry in entries or ():
        if entry["id"] is None:
            continue
        try:
            file_first_publish_request(entry["id"], entry["author"])
        except Exception:  # noqa: BLE001 -- the commit has happened; say so
            logger.warning(
                "asset-approval: dashboard %s was created as a draft but its "
                "publish request could not be filed",
                entry["id"],
                exc_info=True,
            )


def forget_transaction(session: Any, transaction: Any) -> None:
    """``after_transaction_end``: a finished transaction created nothing more."""
    if getattr(transaction, "parent", None) is None:
        session.info.pop(_BORN, None)
        session.info.pop(_DEMOTED, None)


def refuse_unlisted_bulk_writes(state: Any) -> None:
    """``do_orm_execute``: the same refusal for UPDATE and DELETE statements.

    ``Query.update`` and a Core ``update()`` run through ``Session.execute``
    and never appear in a flush, which is how the theme delete nulled
    ``theme_id`` on every bound dashboard without touching one of them.
    """
    if not (state.is_update or state.is_delete):
        return
    table = getattr(getattr(state, "statement", None), "table", None)
    asset = _GOVERNED_TABLES.get(getattr(table, "name", None))
    if asset is None or not guard_is_live():
        return
    if state.is_update:
        statement = state.statement
        names = {
            getattr(key, "key", None) or str(key)
            for key in (getattr(statement, "_values", None) or {})
        }
        parameters = state.parameters
        if isinstance(parameters, dict):
            names |= set(parameters)
        elif parameters:
            for row in parameters:
                names |= set(row)
        if names and names <= UNGOVERNED_FIELDS | _BULK_DERIVED.get(table.name, frozenset()):
            return
        moved = _named(names - UNGOVERNED_FIELDS) if names else "rows"
        if "theme_id" in names:
            logger.warning("asset-approval: refused a bulk change of theme_id")
            raise UnreviewableWriteRefusedError(
                "Deleting a theme that dashboards use",
                "Move those dashboards to another theme first (a change to a "
                "published dashboard goes through review), then delete this one.",
            )
        what = f"{moved} on {table.name} in bulk"
    else:
        what = f"rows of {table.name} in bulk (a delete)"
    logger.warning(
        "asset-approval: refused %s. To switch the deny-by-default guard off, "
        "set FEATURE_FLAGS[%r] = True.",
        what,
        ALLOW_UNLISTED_FLAG,
    )
    raise UnreviewableWriteRefusedError(f"Writing {what}", _EDITOR)


#: ``(event, listener)`` for everything ``install.install_flush_guard`` binds
#: to the SQLAlchemy ``Session`` class.
GUARD_LISTENERS: tuple[tuple[str, Callable[..., Any]], ...] = (
    ("before_flush", refuse_unlisted_writes),
    ("after_flush", note_flush),
    ("after_commit", settle_after_commit),
    ("after_transaction_end", forget_transaction),
    ("do_orm_execute", refuse_unlisted_bulk_writes),
)


def snapshot_draft_for_review(change_request: ChangeRequest, asset: Any) -> None:
    """Record what the reviewer is about to be shown of a draft being published.

    A dashboard that has never been published is edited freely, and that
    includes while its request to publish is waiting: the request carries the
    flag alone, so nothing in it moves when the content does, the reviewer's
    revision still matches, and approving published a dashboard they had not
    read (R7-03). Taken at submit -- not at capture, because the author keeps
    editing the draft until they ask for review -- and compared at approval
    with the same check that guards every other request.
    """
    if AssetType(change_request.asset_type) is not AssetType.DASHBOARD:
        return
    if change_request.command_args.get(COMMAND_KEY):
        return
    if change_request.payload_dict.get("published") is not True:
        return
    if asset is None or bool(getattr(asset, "published", False)):
        return
    fields = {name: None for name in FIRST_PUBLISH_CONTENT}
    base = {**change_request.base_dict, **baseline_of(asset, fields)}
    change_request.payload = ChangeRequest.serialize_payload(
        change_request.payload_dict, change_request.command_args, base
    )


#: What a viewer would first see of a dashboard, which a publish request does
#: not carry and the reviewer is nonetheless approving.
FIRST_PUBLISH_CONTENT = (
    "dashboard_title",
    "position_json",
    "json_metadata",
    "css",
    "slug",
    "theme_id",
)
