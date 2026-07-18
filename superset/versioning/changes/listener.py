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

The listeners retain each entity's first pre-flush state, force the final
flush from ``before_commit``, and write one net initial-to-final semantic
projection for the Continuum transaction. Completion of the outer transaction
clears all session-scoped state so long-lived sessions cannot leak versioning
intent.

Scope:
  - Slice, Dashboard, SqlaTable **scalar fields** (via the cached
    field set from :mod:`superset.versioning.changes.state` — new
    columns are picked up automatically).
  - ``Slice.params`` kind-classification (filter / metric / time_range
    / color_palette / dimension, plus generic ``field`` fallback).

Child-collection diffs (dataset ``TableColumn`` / ``SqlMetric``,
dashboard ``dashboard_slices``) read the pre- and post-state from
Continuum shadow tables via the helpers in
:mod:`superset.versioning.changes.shadow_queries`, executed during commit
finalization after the explicit final flush has written Continuum's tx-N rows.

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
from sqlalchemy.orm import Session, SessionTransaction

from superset.versioning.changes.shadow_queries import (
    _dashboard_child_records_for_tx_from_shadows,
    _dataset_child_records_for_tx_from_shadows,
)
from superset.versioning.changes.state import (
    bulk_insert_records,
    capture_initial_state,
    compute_records_from_state,
)
from superset.versioning.changes.table import ENTITY_KIND_BY_CLASS_NAME
from superset.versioning.diff import (
    ChangeRecord,
    fold_dashboard_layout_with_chart_changes,
)

logger = logging.getLogger(__name__)


# Keys for transaction-scoped state stored on ``session.info``.
_INITIAL_STATES_KEY = "_version_changes_initial_states"
_FINALIZING_KEY = "_version_changes_finalizing"

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
# The listener pops the key after stamping, and outer-transaction cleanup pops
# it again as a safety net, so a
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


def _capture_dirty_entity_initial_state(
    session: Session,
    obj: Any,
    initial_states: dict[tuple[str, int], tuple[Any, dict[str, Any]]],
) -> None:
    """Retain one dirty entity's first database state for this transaction."""
    entity_kind = ENTITY_KIND_BY_CLASS_NAME.get(type(obj).__name__)
    if entity_kind is None:
        return
    entity_id = getattr(obj, "id", None)
    if entity_id is None:
        return
    key = (entity_kind, entity_id)
    if key in initial_states:
        return
    if (pre_state := capture_initial_state(session, obj)) is not None:
        initial_states[key] = (obj, pre_state)


def _build_scalar_buffer(
    initial_states: dict[tuple[str, int], tuple[Any, dict[str, Any]]],
) -> dict[tuple[str, int], list[ChangeRecord]]:
    """Build net scalar records from retained initial and final entity states."""
    buffer: dict[tuple[str, int], list[ChangeRecord]] = {}
    for key, (obj, pre_state) in initial_states.items():
        try:
            records = compute_records_from_state(obj, pre_state)
        except Exception:  # pylint: disable=broad-except
            logger.exception(
                "version_changes: final diff failed for %s id=%s",
                type(obj).__name__,
                key[1],
            )
            continue
        if records:
            buffer[key] = records
    return buffer


def _reset_transaction_state(session: Session) -> None:
    """Discard versioning intent and retained state after a terminal event."""
    session.info.pop(ACTION_KIND_KEY, None)
    session.info.pop(ACTION_META_KEY, None)
    session.info.pop(_INITIAL_STATES_KEY, None)
    session.info.pop(_FINALIZING_KEY, None)


def _reset_after_outer_transaction(
    session: Session, transaction: SessionTransaction
) -> None:
    """Clear retained state only when the outer transaction has ended."""
    if transaction.parent is None:
        _reset_transaction_state(session)


def _append_child_records_to_buffer(
    session: Session,
    tx_id: int,
    buffer: dict[tuple[str, int], list[ChangeRecord]],
) -> None:
    """Compute dataset + dashboard child-collection records + append to buffer.

    Runs during commit finalization after the explicit final flush, so the
    shadow tables already have the current-tx rows. Reads from Continuum shadow tables
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

    No-op when no command set the key and, critically, does not pop when the
    final buffer is empty. Prepended rather than appended so the headline gets
    ``sequence`` 0 and renders first. Malformed payloads are logged and dropped:
    a headline is descriptive enrichment, never worth failing the user's save.
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


def _write_action_kind(
    session: Session, tx_table: sa.Table, tx_id: int, action_kind: str
) -> None:
    """Write action metadata through the transaction's existing connection."""
    session.connection().execute(
        sa.update(tx_table)
        .where(tx_table.c.id == tx_id)
        .values(action_kind=action_kind)
    )


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
    failed stamp is rolled back to a SAVEPOINT, logged, and swallowed:
    action_kind is descriptive enrichment, not a correctness invariant.
    The SAVEPOINT is opened after the final flush, so a failed metadata
    statement cannot poison the user transaction or disturb Continuum's
    canonical shadows.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    action_kind = session.info.pop(ACTION_KIND_KEY, None)
    if action_kind is None:
        return
    tx_tbl = versioning_manager.transaction_cls.__table__
    try:
        with session.connection().begin_nested():
            _write_action_kind(session, tx_tbl, tx_id, action_kind)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "version_changes: failed to stamp action_kind=%s on tx %s",
            action_kind,
            tx_id,
        )


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


def register_change_record_listener() -> None:  # noqa: C901
    """Attach transaction-scoped version-change listeners.

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

    def capture_initial_states(
        session: Session, _flush_context: Any, _instances: Any
    ) -> None:
        initial_states: dict[tuple[str, int], tuple[Any, dict[str, Any]]] = (
            session.info.setdefault(_INITIAL_STATES_KEY, {})
        )
        for obj in list(session.dirty):
            if isinstance(obj, versioned_classes):
                _capture_dirty_entity_initial_state(session, obj, initial_states)

    def finalize_change_records(session: Session) -> None:
        if session.in_nested_transaction() or session.info.get(_FINALIZING_KEY):
            return

        session.info[_FINALIZING_KEY] = True
        try:
            session.flush()
            initial_states: dict[tuple[str, int], tuple[Any, dict[str, Any]]] = (
                session.info.get(_INITIAL_STATES_KEY, {})
            )
            buffer = _build_scalar_buffer(initial_states)

            tx_id = _current_transaction_id(session)
            if tx_id is None:
                return

            _stamp_action_kind_on_transaction(session, tx_id)
            _append_child_records_to_buffer(session, tx_id, buffer)
            _inject_action_meta_record(session, buffer)

            if buffer:
                _persist_buffered_records(session, tx_id, buffer)
        finally:
            session.info.pop(_FINALIZING_KEY, None)

    event.listen(db.session, "before_flush", capture_initial_states)
    event.listen(db.session, "before_commit", finalize_change_records)
    event.listen(db.session, "after_transaction_end", _reset_after_outer_transaction)
    setattr(db.session, _REGISTERED_SENTINEL, True)
