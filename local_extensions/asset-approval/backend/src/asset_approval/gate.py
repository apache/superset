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

import logging
import uuid as uuid_module
from collections.abc import Callable, Iterator
from contextlib import contextmanager
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
from asset_approval.changes import baseline_of, is_empty_change
from asset_approval.models import ChangeRequest, PublishedAsset
from asset_approval.types import (
    AssetType,
    ChangeStatus,
    OPEN_SLOT,
    OPEN_STATUSES,
    Operation,
)
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
    """Whether this instance has ever seen the asset published."""
    return (
        db.session.query(PublishedAsset.id)
        .filter(
            PublishedAsset.asset_type == asset_type.value,
            PublishedAsset.asset_id == asset_id,
        )
        .first()
        is not None
    )


def mark_published(asset_type: AssetType, asset_id: int) -> None:
    """Record that the asset is published, once and for good.

    Called wherever a write is seen against a published asset, which covers
    the asset being published through review, an asset already published
    when the extension was installed, and the unpublish itself -- an asset
    cannot be unpublished without having been published.

    Written in its own nested transaction so a concurrent writer racing to
    the same row cannot fail the caller's write: two workers both deciding
    to mark is the expected case, and the unique constraint is what makes
    the second one a no-op rather than a duplicate.
    """
    if has_ever_been_published(asset_type, asset_id):
        return
    try:
        with db.session.begin_nested():
            db.session.add(
                PublishedAsset(
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


def gate_write(
    asset_type: AssetType,
    asset_id: int,
    payload: dict[str, Any],
    note: str | None = None,
    command_args: dict[str, Any] | None = None,
    operation: Operation = Operation.UPDATE,
    combine: Combine | None = None,
) -> None:
    """Capture this write for review, or return so the caller may proceed.

    :raises ChangeRequestCreated: when the write was captured. The caller's
        transaction must be allowed to unwind; do not catch this inside the
        command.
    :param command_args: constructor arguments the command takes outside
        the request body, which replay needs in order to invoke the same
        command the author did. ``command_args[COMMAND_KEY]`` selects a
        command other than the asset's main update.
    :param combine: for commands whose body is a *diff* rather than the
        asset's full state, how a further edit folds into the author's open
        request of the same kind. Without it the new body replaces the old,
        which is right for full-state bodies and loses work for diffs.
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
    comparable = (
        operation is Operation.UPDATE
        and combine is None
        and not (command_args or {}).get(COMMAND_KEY)
    )
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
        if live is not None and is_empty_change(live, payload):
            return

    author_id = get_user_id()
    if author_id is None:
        # No identity means we cannot attribute the change or decide who may
        # approve it. Refusing is the only safe answer: the SOW requires the
        # gate to fail closed on every write path (SOW 3, 5.7).
        raise UnattributableWriteRefusedError(asset_type.value, asset_id)

    # What the asset holds right now in the fields this change reviews, so
    # an approval can tell whether the asset moved while the request waited
    # (QA-24). Only full-state bodies have one; a diff describes an
    # operation, not the asset's fields.
    base = baseline_of(live, payload) if comparable else {}

    existing = find_open_request(asset_type, asset_id)
    if existing is not None and existing.author_fk != author_id:
        raise AssetLockedError(
            asset_type.value,
            asset_id,
            _display_name(existing.author),
        )

    if existing is not None:
        kind = (command_args or {}).get(COMMAND_KEY)
        existing_kind = existing.command_args.get(COMMAND_KEY)
        if kind != existing_kind:
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
        if combine is not None and Operation(existing.operation) is operation:
            payload = combine(existing.payload_dict, payload)
        change_request_id = _update_own_request(
            existing.id, payload, note, command_args, operation, base=base
        )
    else:
        change_request_id = _insert_request(
            asset_type,
            asset_id,
            payload,
            author_id,
            note,
            command_args,
            operation,
            base=base,
        )

    raise ChangeRequestCreated(
        change_request_id,
        asset_type.value,
        asset_id,
        operation=operation.value,
        updated_existing=existing is not None,
    )


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


def _insert_request(
    asset_type: AssetType,
    asset_id: int,
    payload: dict[str, Any],
    author_id: int,
    note: str | None,
    command_args: dict[str, Any] | None = None,
    operation: Operation = Operation.UPDATE,
    base: dict[str, Any] | None = None,
) -> int:
    """Write a new request on its own connection and commit it.

    The capture must survive the rollback that :class:`ChangeRequestCreated`
    triggers, so it cannot ride the caller's session. A separate connection
    from the same engine commits independently of whatever the command's
    transaction goes on to do.
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
    with db.engine.begin() as connection:
        try:
            result = connection.execute(insert(table).values(**values))
        except IntegrityError as ex:
            # Lost the race for the asset's open slot. The unique constraint
            # is the real guard; the lookup above is only a nicer message.
            raise AssetLockedError(asset_type.value, asset_id) from ex
        inserted = result.inserted_primary_key
        if inserted is not None and inserted[0] is not None:
            return int(inserted[0])
        # Backends that do not return the generated key: read it back on the
        # same connection, inside the same transaction.
        return int(
            connection.execute(
                select(table.c.id).where(
                    table.c.asset_type == asset_type.value,
                    table.c.asset_id == asset_id,
                    table.c.active_slot == OPEN_SLOT,
                )
            ).scalar_one()
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
    with db.engine.begin() as connection:
        connection.execute(
            table.update().where(table.c.id == change_request_id).values(**values)
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
    all (SOW 8), so it is unaffected.
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
