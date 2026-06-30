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
"""Session-level listeners that drive ``version_changes`` writes.

Two flush events cooperate, plus two post-commit / post-rollback
cleanups:

- ``before_flush``: for each versioned entity in ``session.dirty``,
  reads the pre-save scalar state from the DB via raw SQL inside
  ``session.no_autoflush`` (same idiom as the baseline listener, not
  Continuum's internal ``units_of_work`` which is a private API), reads
  the post-save state from the in-memory ORM object, calls the diff
  engine, and buffers the resulting :class:`ChangeRecord` list on
  ``session.info``. This must run before the flush because after the
  flush the DB already reflects the post-state; we can't recover the
  pre-state from it.

- ``after_flush``: drains the buffer, resolves the current Continuum
  transaction id via ``versioning_manager.units_of_work``, and bulk-
  inserts one ``version_changes`` row per record with a monotonic
  ``sequence`` number. Records accumulated across multiple before_flush
  calls within one transaction share the same ``transaction_id`` and
  contiguous sequence numbers.

- ``after_commit`` / ``after_rollback``: clean up session-scoped
  state (processed-tx set, ``action_kind`` / ``action_meta`` keys, and
  the pending-records buffer) so a long-lived session doesn't carry any
  of it into the next transaction.

Scope:
  - Slice, Dashboard, SqlaTable **scalar fields** (via the cached
    field set from :mod:`superset.versioning.changes.state` — new
    columns are picked up automatically).
  - ``Slice.params`` kind-classification (filter / metric / time_range
    / color_palette / dimension, plus generic ``field`` fallback).

Child-collection diffs (dataset ``TableColumn`` / ``SqlMetric``,
dashboard ``dashboard_slices``) read the pre- and post-state from
Continuum shadow tables via the helpers in
:mod:`superset.versioning.changes.shadow_queries`, executed in
``after_flush`` once Continuum has written its tx-N rows.

``session.new`` entities are not processed in this listener:
operation_type=0 transactions (baseline capture and first-save INSERTs)
produce zero change records by design.
"""

from __future__ import annotations

import logging
from typing import Any

import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from superset.versioning.changes.shadow_queries import (
    _dashboard_child_records_for_tx_from_shadows,
    _dataset_child_records_for_tx_from_shadows,
)
from superset.versioning.changes.state import (
    bulk_insert_records,
    compute_records_for_entity,
)
from superset.versioning.changes.table import ENTITY_KIND_BY_CLASS_NAME
from superset.versioning.diff import (
    ChangeRecord,
    fold_dashboard_layout_with_chart_changes,
)

logger = logging.getLogger(__name__)


# Key under which the pending-records buffer is stored on ``session.info``.
# Using ``session.info`` (SQLAlchemy's user-data dict) avoids the need
# for a module-level WeakKeyDictionary and keeps buffers naturally scoped
# to the session's lifetime.
_BUFFER_KEY = "_version_changes_pending"

# Key for the set of Continuum transaction ids whose change records
# have already been written in this session. ``after_flush`` can fire
# more than once for a single transaction (e.g. autoflush triggered by
# a mid-commit query), and our child-diff path reads snapshot tables
# that don't care about the buffer state — without this marker we'd
# re-insert the same child records on the second flush and hit the
# UNIQUE(transaction_id, entity_kind, entity_id, sequence) constraint.
_PROCESSED_TXS_KEY = "_version_changes_processed_txs"

# Key on ``session.info`` that commands set to declare the high-level
# action that produced the current transaction. Read once per flush by
# the change-record listener and stamped onto the
# ``version_transaction.action_kind`` column via ``sa.update()``.
# ``None`` (the default) means "ordinary save".
#
# Commands set this immediately before ``db.session.commit()``:
#
#     db.session.info[ACTION_KIND_KEY] = ACTION_KIND_RESTORE
#     db.session.commit()
#
# The listener pops the key after stamping, and ``after_commit`` /
# ``after_rollback`` cleanup pop it again as a safety net, so a
# long-lived session can't accidentally carry the value into the next
# transaction.
ACTION_KIND_KEY = "_versioning_action_kind"

# Recognised ``action_kind`` values — the single source of truth shared
# by the four command-side stampers (restore / import / clone) and the
# listener that writes them to ``version_transaction.action_kind``.
# Schemas / response decorators that need an allowlist read from
# ``ACTION_KINDS`` so a future addition (e.g. ``"thumbnail_warm"``) only
# has to update this one constant. ``None`` is *not* a member — it
# represents the default "ordinary save" path that never sets the key.
ACTION_KIND_RESTORE = "restore"
ACTION_KIND_IMPORT = "import"
ACTION_KIND_CLONE = "clone"
ACTION_KINDS: frozenset[str] = frozenset(
    {ACTION_KIND_RESTORE, ACTION_KIND_IMPORT, ACTION_KIND_CLONE}
)

# Key on ``session.info`` carrying a synthetic "headline" change record
# for the current transaction — the ``__meta__`` record convention. Set
# by commands alongside ``ACTION_KIND_KEY`` when the avenue has a payload
# the field-level diff can't express; the canonical case is restore,
# whose transaction otherwise carries no pointer to WHICH version was
# restored (surfaced by the version-history UI: "Restored to
# X from [date]" can't be rendered from API data alone).
#
# Build the value with :func:`build_action_headline` — the single owner
# of the record shape — rather than hand-rolling the dict; renderers
# dispatch on ``kind == "__meta__"`` plus the transaction's
# ``action_kind`` (the verb deliberately does NOT ride in ``path``,
# which stays pure navigation per the ChangeRecord contract).
#
# The listener pops the key on the first record-bearing firing for the
# transaction and PREPENDS the record to the entity's buffer (sequence 0
# — headline first). Same lifecycle as ``ACTION_KIND_KEY``: popped on
# use, and the ``after_commit`` / ``after_rollback`` cleanups pop it as
# a safety net.
ACTION_META_KEY = "_versioning_action_meta"

# ``operation`` value for synthetic headline records: a headline
# announces an action, it does not mutate a field, so the field-verb
# vocabulary (add / remove / move / edit) would be dishonest here.
OPERATION_ANNOUNCE = "announce"


def build_action_headline(
    entity_kind: str,
    entity_id: int,
    to_value: dict[str, Any],
) -> dict[str, Any]:
    """Build the ``ACTION_META_KEY`` payload — the single owner of the
    ``__meta__`` headline record's shape.

    *entity_kind* is the table-kind (see ``ENTITY_KIND_BY_CLASS_NAME``);
    *to_value* carries the action's payload (for restore:
    ``{"version_uuid": ..., "version_number": ...}``). The action itself
    is identified by the transaction's ``action_kind`` column, which the
    same command stamps via ``ACTION_KIND_KEY`` — renderers join the
    two rather than parsing the verb out of the record.
    """
    return {
        "entity_kind": entity_kind,
        "entity_id": entity_id,
        "record": ChangeRecord(
            kind="__meta__",
            operation=OPERATION_ANNOUNCE,
            path=["__meta__"],
            from_value=None,
            to_value=to_value,
        ),
    }


# Sentinel attribute set on the session target after first successful
# registration. Subsequent calls become no-ops. Storing the flag on the
# target itself (rather than module-level state) keeps the guard
# naturally scoped — a fresh session proxy gets a fresh registration —
# and avoids the TOCTOU race between ``event.contains`` and
# ``event.listen`` that a module-level ref would have under concurrent
# init. In test fixtures that instantiate multiple Superset apps per
# process, the shared ``db.session`` carries the sentinel and re-entry
# is correctly deduped.
_REGISTERED_SENTINEL = "_versioning_change_listener_registered"

#: Metric namespace for swallowed capture-path failures. The capture
#: listeners fail open (a versioning bug must never break a user's save),
#: so the read path (``activity/orchestrator``) is richly instrumented but
#: the write path historically logged-and-swallowed with no counter. Each
#: ``_incr_capture_error(stage)`` emits ``<prefix>.<stage>.error`` so a
#: systematic capture regression is alertable rather than log-grep-only.
_CAPTURE_METRIC_PREFIX = "superset.versioning.capture"


def _incr_capture_error(stage: str) -> None:
    """Emit a counter for a swallowed capture-path failure at *stage*.

    Best-effort: metrics emission must never itself break a user's save,
    so it is wrapped in the same fail-open posture as the call site.
    """
    # pylint: disable=import-outside-toplevel
    try:
        from superset.extensions import stats_logger_manager

        stats_logger_manager.instance.incr(f"{_CAPTURE_METRIC_PREFIX}.{stage}.error")
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_changes: failed to emit capture-error metric")


def _process_dirty_entity_into_buffer(
    session: Session,
    obj: Any,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Compute scalar change records for one dirty entity + append to buffer."""
    entity_kind = ENTITY_KIND_BY_CLASS_NAME.get(type(obj).__name__)
    if entity_kind is None:
        return
    entity_id = getattr(obj, "id", None)
    if entity_id is None:
        return
    try:
        records = compute_records_for_entity(session, obj)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: diff failed for %s id=%s",
            type(obj).__name__,
            entity_id,
        )
        _incr_capture_error("scalar_diff")
        return
    if records:
        buffer.setdefault((entity_kind, entity_id), []).extend(records)


def _append_child_records_to_buffer(
    session: Session,
    tx_id: int,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Compute dataset + dashboard child-collection records + append to buffer.

    Runs in ``after_flush`` so the shadow tables already have the
    current-tx rows. Reads from Continuum shadow tables
    (``table_columns_version`` / ``sql_metrics_version`` /
    ``dashboard_slices_version`` / ``slices_version``).
    """
    try:
        for dataset_id, records in _dataset_child_records_for_tx_from_shadows(
            session, tx_id
        ).items():
            buffer.setdefault(("dataset", dataset_id), []).extend(records)
        for dashboard_id, records in (
            _dashboard_child_records_for_tx_from_shadows(session, tx_id)
        ).items():
            buffer.setdefault(("dashboard", dashboard_id), []).extend(records)

        # Post-merge fold: when a dashboard save adds/removes charts,
        # drop the redundant ``position_json.*`` records that mirror
        # the membership change. See
        # ``diff.fold_dashboard_layout_with_chart_changes``.
        for key in list(buffer.keys()):
            if key[0] == "dashboard":
                buffer[key] = fold_dashboard_layout_with_chart_changes(buffer[key])
                if not buffer[key]:
                    del buffer[key]
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_changes: child-diff failed for tx %s", tx_id)
        _incr_capture_error("child_diff")


def _current_transaction_id(session: Session) -> int | None:
    """Return the Continuum transaction id for *session*'s current unit of
    work, or ``None`` when Continuum has no active transaction (e.g. raw
    SQL execution outside the ORM's flush flow).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    uow = versioning_manager.units_of_work.get(session.connection())
    if uow is None or uow.current_transaction is None:
        return None
    return uow.current_transaction.id


def _inject_action_meta_record(
    session: Session,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Pop ``ACTION_META_KEY`` and prepend its synthetic headline record
    to the owning entity's buffer (the ``__meta__`` record convention).

    No-op when no command set the key — and, critically, no-op WITHOUT
    popping when the buffer is empty: the buffer-empty short-circuit in
    ``flush_change_records`` exists so a multi-flush transaction can
    deliver its records on a later firing, and a headline-only buffer
    would defeat it (the first firing would persist just the headline,
    mark the tx processed, and the later flush's real records would be
    silently dropped). Leaving the key in place parks the headline until
    the record-bearing firing. Prepended (not appended) so the headline
    gets ``sequence`` 0 and renders first. Malformed payloads are logged
    and dropped — a headline is descriptive enrichment, never worth
    failing the user's save over.
    """
    if not buffer:
        return
    meta = session.info.pop(ACTION_META_KEY, None)
    if meta is None:
        return
    try:
        key = (meta["entity_kind"], meta["entity_id"])
        record = meta["record"]
        buffer.setdefault(key, []).insert(0, record)
    except (KeyError, TypeError):  # pragma: no cover - defensive
        logger.exception("version_changes: malformed ACTION_META_KEY payload")


def _stamp_action_kind_on_transaction(session: Session, tx_id: int) -> None:
    """Pop the per-tx action_kind from ``session.info`` and stamp it
    onto the ``version_transaction`` row identified by *tx_id*.

    No-op when no command set the action_kind (the default for
    ordinary saves). Emits via ``sa.update()`` against Continuum's
    transaction Table so the identifier is auto-quoted per dialect
    (MySQL would otherwise reject the unquoted column name if it ever
    collided with a reserved word) and the dialect-portable column
    binding is reused instead of hand-written SQL.

    The action_kind is popped (not just read) so a long-lived session
    can't accidentally carry the value into the next transaction. A
    failed stamp is logged and swallowed — action_kind is a
    descriptive enrichment, not a correctness invariant; refusing to
    write change records because an UPDATE on a single column failed
    would punish the user save for an audit-log nicety.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    action_kind = session.info.pop(ACTION_KIND_KEY, None)
    if action_kind is None:
        return
    tx_tbl = versioning_manager.transaction_cls.__table__
    try:
        session.connection().execute(
            sa.update(tx_tbl)
            .where(tx_tbl.c.id == tx_id)
            .values(action_kind=action_kind)
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: failed to stamp action_kind=%s on tx %s",
            action_kind,
            tx_id,
        )
        _incr_capture_error("action_kind_stamp")


def _persist_buffered_records(
    session: Session,
    tx_id: int,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Bulk-insert *buffer*'s records under *tx_id* and reset the buffer.

    Catches ``OperationalError`` / ``ProgrammingError`` to handle the
    pre-migration startup race (version_changes table missing — the
    former on SQLite/MySQL, the latter on PostgreSQL), and ``Exception``
    as the listener-boundary safety net so a malformed record can't
    crash the user's save.

    The insert runs under a SAVEPOINT (``begin_nested`` on the
    connection): on PostgreSQL a failed statement aborts the enclosing
    transaction, so without it the swallowed exception would still
    poison the user's save — the COMMIT that follows this listener
    would raise ``InFailedSqlTransaction``, defeating the fail-open
    guarantee exactly where it matters.
    """
    try:
        with session.connection().begin_nested():
            bulk_insert_records(session, tx_id, buffer)
    except (OperationalError, ProgrammingError):
        # version_changes table missing (migration not yet applied).
        pass
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: bulk insert failed for tx %s (%d entities)",
            tx_id,
            len(buffer),
        )
        _incr_capture_error("bulk_insert")


def register_change_record_listener() -> None:  # noqa: C901
    """Attach the before_flush + after_flush listeners.

    Registered from :class:`superset.initialization.SupersetAppInitializer`
    (``init_versioning``) alongside the baseline, dataset-snapshot,
    and dashboard-snapshot listeners. Must run after Continuum's
    ``make_versioned()`` so the ``versioning_manager`` is available
    and has installed its own before_flush hook.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import db
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    if getattr(db.session, _REGISTERED_SENTINEL, False):
        return

    versioned_classes: tuple[type, ...] = (Dashboard, Slice, SqlaTable)

    def compute_change_records(
        session: Session, _flush_context: Any, _instances: Any
    ) -> None:
        # session.info persists across before_flush/after_flush within
        # a single transaction. The buffer is keyed on
        # ``(entity_kind, entity_id)`` so scalar records captured here
        # and child records captured in after_flush merge
        # under the same entity without duplication.
        buffer: dict[tuple[str, int], list[ChangeRecord]] = session.info.setdefault(
            _BUFFER_KEY, {}
        )
        for obj in list(session.dirty):
            if isinstance(obj, versioned_classes):
                _process_dirty_entity_into_buffer(session, obj, buffer)

    def flush_change_records(session: Session, _flush_context: Any) -> None:
        buffer: dict[tuple[str, int], list[ChangeRecord]] = session.info.setdefault(
            _BUFFER_KEY, {}
        )

        tx_id = _current_transaction_id(session)
        if tx_id is None:
            session.info[_BUFFER_KEY] = {}
            return

        # Skip if we've already written records for this tx (after_flush
        # can fire more than once per commit — e.g. autoflush from a
        # mid-commit query). Without this guard the child-diff path would
        # re-read the same shadow rows and re-emit the same records,
        # tripping the UNIQUE(transaction_id, entity_kind, entity_id,
        # sequence) constraint on insert.
        processed: set[int] = session.info.setdefault(_PROCESSED_TXS_KEY, set())
        if tx_id in processed:
            # Drop anything buffered after the tx was persisted: records
            # left here would otherwise survive on the long-lived scoped
            # session and be inserted under the NEXT transaction's id.
            session.info[_BUFFER_KEY] = {}
            return

        # Stamp action_kind eagerly, before the buffer-empty short-
        # circuit. Restores / imports / clones may flush across multiple
        # cycles; the FIRST firing for this tx is the one with the
        # value still on ``session.info``. The helper pops on success
        # so subsequent firings see ``None`` and short-circuit cleanly.
        _stamp_action_kind_on_transaction(session, tx_id)

        _append_child_records_to_buffer(session, tx_id, buffer)

        # After the child append and before the emptiness check: the
        # headline joins whichever firing carries the transaction's real
        # records (scalar or child), and its peek-don't-pop guard parks
        # it across record-less firings instead of defeating the
        # multi-flush short-circuit below.
        _inject_action_meta_record(session, buffer)

        if not buffer:
            # Don't mark tx as processed when nothing was inserted. A
            # later after_flush firing for the same tx may carry the
            # records — e.g. when an entity's edit lands across two
            # flushes (a child-only flush followed by a parent-dirty
            # flush): the parent shadow only lands in the parent-dirty
            # flush, so the child-diff path can't find a prior tx to
            # compare against until then.
            session.info[_BUFFER_KEY] = {}
            return

        try:
            _persist_buffered_records(session, tx_id, buffer)
        finally:
            session.info[_BUFFER_KEY] = {}
            processed.add(tx_id)

    def reset_processed_after_commit(session: Session) -> None:
        # ``_PROCESSED_TXS_KEY`` accumulates Continuum tx ids whose change
        # records have already been written, to dedup against multiple
        # ``after_flush`` firings within one transaction. After commit
        # the tx is closed and its id will never recur on this session
        # — drop the set so a long-lived session (Celery worker, CLI)
        # doesn't grow it without bound.
        session.info.pop(_PROCESSED_TXS_KEY, None)
        # If a command set the action_kind but no flush fired (e.g. a
        # save that touched nothing versioned), the value would
        # otherwise leak into the next transaction. Drop it here as a
        # belt-and-suspenders cleanup; the
        # ``_stamp_action_kind_on_transaction`` helper already pops on
        # the normal path.
        session.info.pop(ACTION_KIND_KEY, None)
        session.info.pop(ACTION_META_KEY, None)
        session.info.pop(_BUFFER_KEY, None)

    def reset_action_kind_after_rollback(session: Session) -> None:
        # When a command sets ``ACTION_KIND_KEY`` and then an exception
        # fires before flush (e.g. validation error after the key is
        # set), the transaction rolls back without the listener ever
        # popping the key. The next save on the same session would
        # then inherit the stale value and label an unrelated commit
        # as "restore" / "import" / "clone". Pop here so a rolled-back
        # action's intent doesn't leak forward.
        session.info.pop(ACTION_KIND_KEY, None)
        session.info.pop(ACTION_META_KEY, None)
        session.info.pop(_BUFFER_KEY, None)

    event.listen(db.session, "before_flush", compute_change_records)
    event.listen(db.session, "after_flush", flush_change_records)
    event.listen(db.session, "after_commit", reset_processed_after_commit)
    event.listen(db.session, "after_rollback", reset_action_kind_after_rollback)
    setattr(db.session, _REGISTERED_SENTINEL, True)
