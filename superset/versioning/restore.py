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
"""Write-side: restore a versioned entity to an earlier state.

Companion to :mod:`superset.versioning.queries`. The
``BaseRestoreVersionCommand`` in :mod:`superset.commands.version_restore`
is the only intended caller; the backward-compat ``VersionDAO`` façade
in :mod:`superset.daos.version` re-exports ``restore_version``.

Restore semantics are strictly per-entity: a restore rewrites the target
entity's own fields (and, for datasets, its own columns/metrics — the
aggregate's internal parts), never the content of other entities. A
dashboard restore reattaches membership to charts that still exist;
charts that have been deleted since the snapshot stay deleted and are
reported as skipped rather than revived or dangling.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.versioning.baseline import OPERATION_DELETE, OPERATION_INSERT
from superset.versioning.queries import find_active_by_uuid
from superset.versioning.utils import single_flush_scope

logger = logging.getLogger(__name__)

# A DELETE version row (``OPERATION_DELETE``) is never a valid restore
# target: Continuum's ``Reverter`` would delete the live entity and report
# success — the opposite of the non-destructive contract — so the engine
# treats it as not-found.


# Per-model relationships that Continuum's Reverter recurses into during a
# restore — deliberately limited to the entity's OWN aggregate parts
# (``TableColumn`` / ``SqlMetric`` on ``SqlaTable``). ``Dashboard`` is NOT
# given ``slices`` here: recursing into the M2M would run a full child
# revert on every member chart, overwriting live charts' content with
# historical values (charts are shared entities with their own restore),
# and re-creating hard-deleted charts. Dashboard membership is instead
# reconstructed by :func:`_restore_dashboard_membership`.
#
# Unknown models fail closed (``LookupError``) rather than defaulting to a
# relation-less restore — a silently partial restore is worse than a loud
# failure (mirrors ``_version_endpoint_models`` in ``api_helpers``).
_RESTORE_RELATIONS: dict[str, list[str]] = {
    "SqlaTable": ["columns", "metrics"],
    "Dashboard": [],
    "Slice": [],
}


class PrunedChildHistoryError(Exception):
    """The target version's child history is no longer fully recoverable.

    Version-history retention prunes closed child shadow rows (and their
    ``version_transaction`` rows) once they age out; a restore that
    proceeded anyway would persist an INCOMPLETE column/metric set for a
    ``SqlaTable`` — a durable partial write. Restore fails closed
    instead (sc-120012). The message is user-facing.
    """

    def __init__(self, model_name: str, detail: str) -> None:
        super().__init__(
            f"This {model_name} version can no longer be fully restored: "
            f"{detail} needed by the snapshot were pruned by "
            "version-history retention. The entity was left unchanged."
        )


def _verify_child_history_complete(entity: Any, target_tx: int) -> None:
    """Refuse the restore when a needed child shadow row was pruned.

    ``revert(relations=...)`` reconstructs a ``SqlaTable``'s columns and
    metrics from the child shadow rows valid at *target_tx*. Retention
    can have pruned exactly those rows while the parent's row at
    *target_tx* survives; the pruner also deletes the covering
    ``version_transaction`` rows (change records cascade with them), so
    the only surviving evidence is the validity chain itself. Per child
    (grouped by the child's own ``id``), the state at *target_tx* is
    PROVABLE when a surviving row's validity interval covers it (a
    non-DELETE covering row: present, restored; a DELETE covering row:
    provably absent). Without a covering interval, a last same-parent
    row at/before the target that is DELETE is accepted as absence.
    If no row is at/before the target, an earliest surviving INSERT
    is accepted as born-after evidence, not proof of the original birth. See
    :func:`_child_state_provable_at` for the interval semantics.

    Anything else means a pruned row MAY have covered ``target_tx`` —
    fail closed (sc-120012).

    Known limitation (ratified, sc-120012): the fail-closed guard refuses
    every DETECTABLE pruning of needed child history, including a pruned
    closed row whose successor survives, and protects all restores
    targeting versions within the retention window. Missing evidence can
    be indistinguishable from legitimate absence in three shapes:

    * a column/metric deleted AFTER the target version whose entire
      shadow chain — including its closing DELETE row — has aged out of
      retention leaves no surviving evidence anywhere;
    * an erased same-parent re-birth window leaves an earlier terminal
      DELETE, indistinguishable from a purged foreign incarnation;
    * erased birth and covering rows leave only a later re-insertion
      INSERT, indistinguishable from a child first born after the target.

    No read-side check can recover that erased evidence. The pruner
    deletes shadow rows by create-tx OR close-tx
    (``tasks/version_history_retention.py`` ``_delete_for_transactions``)
    and then the ``version_transaction`` rows themselves, cascading the
    change records (same module, transaction-delete step) — and change
    records are per-tx DIFFS (``versioning/changes/table.py`` path /
    from_value / to_value columns), never a full child set, so replay
    cannot reconstruct what pruning erased. Only reachable for targets
    older than the retention window (the closing DELETE row's own tx must
    itself have been prunable). Dependency-closure retention is the
    separate post-GA sc-120945 follow-up, not implemented by this guard.
    """
    # pylint: disable=import-outside-toplevel
    # Local imports: the models pull in the initialised-app graph (same
    # bootstrap-cycle rationale as the other deferred imports here).
    from superset.connectors.sqla.models import SqlMetric, TableColumn

    # SQLite drops FOR UPDATE, and pysqlite's legacy mode starts no real
    # transaction for SELECTs — the verification reads and the reverter's
    # re-reads could straddle a concurrent commit, and the write lock
    # would otherwise arrive only at the deferred flush. Reserve the
    # write lock up front (BEGIN IMMEDIATE) so no other writer can commit
    # between the check and the restore's own commit; the read-to-write
    # upgrade conflict cannot occur because the reservation precedes
    # every read. No-op when the driver is already in a transaction.
    if db.engine.dialect.name == "sqlite":
        conn: sa.engine.Connection = db.session.connection()
        if not conn.connection.dbapi_connection.in_transaction:
            # Issued through the SQLAlchemy Connection (not the raw DBAPI
            # handle) so exception translation applies: reservation
            # contention surfaces as sqlalchemy.exc.OperationalError,
            # which the command's @transaction wraps into its failure
            # type and the endpoint maps to 422 — a raw sqlite3 error
            # would escape both as a 500.
            conn.exec_driver_sql("BEGIN IMMEDIATE")

    missing: list[str] = []
    for label, child_cls in (("column", TableColumn), ("metric", SqlMetric)):
        shadow: sa.Table = version_class(child_cls).__table__
        # One locked read: EVERY surviving row the verdict depends on is
        # taken FOR UPDATE in the transaction that owns the restore —
        # covering non-DELETE rows (the reconstruction inputs) AND
        # covering DELETE witnesses. The witnesses are load-bearing for
        # the WRITE as well as the verdict: Continuum's one-to-many
        # reconstruction selects the latest surviving row at/before the
        # target and then excludes DELETEs, so a pruner deleting a
        # covering DELETE witness mid-restore would resurrect an older
        # incarnation the target never had. The row locks block the
        # pruner's DELETE until this transaction commits (its
        # SERIALIZABLE pass waits or retries). On SQLite the BEGIN
        # IMMEDIATE reservation above provides the equivalent.
        rows: Sequence[sa.engine.Row[Any]] = db.session.execute(
            sa.select(
                shadow.c.id,
                shadow.c.transaction_id,
                shadow.c.end_transaction_id,
                shadow.c.operation_type,
            )
            .where(shadow.c.table_id == entity.id)
            .order_by(shadow.c.id, shadow.c.transaction_id)
            .with_for_update()
        ).all()
        by_child: dict[int, list[Any]] = {}
        for row in rows:
            by_child.setdefault(row.id, []).append(row)

        for child_id, child_rows in by_child.items():
            if not _child_state_provable_at(child_rows, target_tx):
                missing.append(f"{label} id={child_id}")
                # The refusal is fail-closed by design; the chain dump is
                # what lets an operator (or CI) see WHY this child's state
                # at the target is unprovable from the surviving intervals.
                logger.warning(
                    "versioning: restore refused for %s id=%s at tx=%s — "
                    "%s id=%s surviving chain=%s",
                    type(entity).__name__,
                    entity.id,
                    target_tx,
                    label,
                    child_id,
                    [
                        (
                            row.transaction_id,
                            row.end_transaction_id,
                            row.operation_type,
                        )
                        for row in child_rows
                    ],
                )

    if missing:
        raise PrunedChildHistoryError(
            type(entity).__name__,
            f"{len(missing)} column/metric history row(s) ({', '.join(missing[:10])})",
        )


def _child_state_provable_at(rows: list[Any], target_tx: int) -> bool:
    """Whether *rows* (one child's surviving SAME-PARENT shadow rows,
    in any order) prove the child's state at *target_tx*.

    Interval semantics: a row is valid over ``[transaction_id,
    end_transaction_id)`` (open end = unbounded). A covering interval
    proves the state (non-DELETE: present, restored; DELETE: provably
    absent). With no covering interval the verdict rests on the LAST
    same-parent row at/before the target:

    * none at all → born-after: provable only when the earliest
      surviving row is INSERT (original birth and re-insertion cannot
      be distinguished if earlier history was erased);
    * a DELETE → provably absent, UNCONDITIONALLY — even with a closed
      end whose closer row no longer survives. Two invariants make this
      sound (ratified, sc-120012): retention cannot erase the closer of
      a surviving closed DELETE (the pruner deletes rows whose CLOSE
      transaction is pruned, so this DELETE row would have gone with
      it), and purge never touches the live parent's own rows — so a
      missing closer is a purged FOREIGN incarnation of a recycled id,
      not this parent's history;
    * a non-DELETE whose interval expired before the target → its
      same-parent successor is missing (that row's close-tx was pruned
      while its own create-tx survived): the child may have existed at
      the target — fail closed. This is the classic pruned-history
      shape the guard exists for.

    Known limitation (ratified): a same-parent re-birth whose window
    ``[X, e)`` was retention-pruned via ``e`` while ``X`` survived is
    observationally identical to a purged foreign closer, and is
    accepted as absence. Only reachable for targets inside a
    retention-pruned window (older than the cutoff); the consequence is
    a silently omitted column that existed only in that window. Closing
    it is sc-120945's separate post-GA dependency-closure retention work.
    Similarly, if only a later re-insertion INSERT survives, the born-after
    branch cannot distinguish it from the child's original birth.
    """
    for row in rows:
        if row.transaction_id <= target_tx and (
            row.end_transaction_id is None or row.end_transaction_id > target_tx
        ):
            return True
    at_or_before: list[Any] = [row for row in rows if row.transaction_id <= target_tx]
    if not at_or_before:
        earliest: Any = min(rows, key=lambda row: row.transaction_id)
        return earliest.operation_type == OPERATION_INSERT
    last: Any = max(at_or_before, key=lambda row: row.transaction_id)
    return last.operation_type == OPERATION_DELETE


@dataclass
class RestoreResult:
    """Outcome of a successful restore.

    ``skipped_slice_ids`` is only ever populated for dashboard restores:
    member charts referenced by the snapshot that no longer exist and were
    therefore not reattached (they stay deleted — restore never revives
    entities).
    """

    entity: Any
    skipped_slice_ids: list[int] = field(default_factory=list)


def restore_version(
    model_cls: type,
    entity_uuid: UUID,
    transaction_id: int,
    *,
    entity: Any | None = None,
) -> RestoreResult | None:
    """Restore the entity identified by *entity_uuid* to the state captured
    at *transaction_id* (the stable identifier resolved from a
    ``version_uuid`` by :func:`superset.versioning.queries.resolve_version`).

    Returns a :class:`RestoreResult` wrapping the live entity, or ``None``
    when the UUID does not match an active entity, no version row exists at
    *transaction_id*, or the target row is a DELETE — callers should
    translate all three to a 404.

    Pass *entity* to skip the ``find_active_by_uuid`` lookup when the
    caller has already loaded the row (the command's ``validate()`` has).

    Uses SQLAlchemy-Continuum's native ``version_obj.revert(relations=...)``
    and delegates commit to the caller (expected to be a command decorated
    with ``@transaction()``). The ``relations`` list depends on the model
    type and is looked up in :data:`_RESTORE_RELATIONS`; unknown models
    raise ``LookupError`` rather than silently restoring without children.

    Within the same flush, ``changed_on`` / ``changed_by_fk`` are
    re-stamped with the current time and the restoring user's id so the
    new version row produced by the restoring commit reflects who clicked
    Restore, not the original author. ``created_on`` / ``created_by_fk``
    are left alone.
    """
    if entity is None:
        entity = find_active_by_uuid(model_cls, entity_uuid)
        if entity is None:
            return None
    elif entity.uuid != entity_uuid:
        # The caller-supplied shortcut must describe the same row as
        # *entity_uuid*: everything downstream (the version lookup, the
        # audit stamp, the caller's logging) trusts them to agree. Fail
        # loudly rather than restore one entity while reporting another.
        raise ValueError(
            f"entity.uuid ({entity.uuid!r}) does not match entity_uuid "
            f"({entity_uuid!r}); the preloaded entity must be the one "
            "identified by entity_uuid"
        )

    ver_cls = version_class(model_cls)
    target_version = (
        db.session.query(ver_cls)
        .filter(
            # Pin to (id, uuid): a hard delete frees the integer id, so
            # matching on it alone can resolve a *predecessor's* version row
            # and restore its content over the current entity.
            ver_cls.id == entity.id,
            ver_cls.uuid == entity.uuid,
            ver_cls.transaction_id == transaction_id,
        )
        .one_or_none()
    )
    if target_version is None or target_version.operation_type == OPERATION_DELETE:
        return None

    relations = _RESTORE_RELATIONS.get(model_cls.__name__)
    if relations is None:
        raise LookupError(
            f"No restore relations registered for {model_cls.__name__!r}; "
            "register the model in _RESTORE_RELATIONS before wiring a "
            "restore command for it."
        )

    # Run the whole revert — including membership reconstruction and audit
    # stamping — inside a single flush scope so SQLAlchemy-Continuum's
    # ``Reverter`` can iterate relations without tripping its autoflush
    # race, and so the change-records listener sees the complete state in
    # one ``after_flush`` pass. See ``single_flush_scope`` for the full
    # rationale.
    # SC-120012 (fail closed): ``revert(relations=...)`` reconstructs
    # children from the child shadow rows valid at the target transaction,
    # and retention can have pruned exactly those rows while the parent's
    # row survives — proceeding would persist an incomplete column/metric
    # set. Verified BEFORE any write; refusal leaves the entity untouched.
    # The verification also row-locks the reconstruction inputs in this
    # same transaction, so a retention pass committing between the check
    # and the reverter's re-reads cannot delete them out from under the
    # restore (the pruner blocks on the locks until this commits).
    if model_cls.__name__ == "SqlaTable":
        _verify_child_history_complete(entity, transaction_id)

    skipped_slice_ids: list[int] = []
    try:
        with single_flush_scope(db.session):
            target_version.revert(relations=relations)
            if model_cls.__name__ == "Dashboard":
                skipped_slice_ids = _restore_dashboard_membership(
                    entity, transaction_id
                )
            _stamp_audit_fields_for_restore(entity)
    except Exception:
        logger.exception(
            "Continuum revert() failed for %s id=%s tx=%s relations=%s",
            model_cls.__name__,
            entity.id,
            transaction_id,
            relations,
        )
        raise

    logger.info(
        "versioning: restored %s id=%s uuid=%s to tx=%s (skipped_slices=%s)",
        model_cls.__name__,
        entity.id,
        entity_uuid,
        transaction_id,
        skipped_slice_ids or None,
    )
    return RestoreResult(entity=entity, skipped_slice_ids=skipped_slice_ids)


def _restore_dashboard_membership(dashboard: Any, transaction_id: int) -> list[int]:
    """Reset *dashboard*'s chart membership to what it was at
    *transaction_id*, reattaching only charts that still exist.

    Membership is derived from the ``dashboard_slices_version`` shadow
    (Continuum's auto-generated M2M table) by pairing each slice's
    INSERT/DELETE rows into ``[attach, detach)`` windows: a slice was a
    member at tx T iff one of its attachment windows contains T. The
    ``shadow_rows_valid_at`` validity filter must **not** be used here —
    Continuum never closes an association shadow's ``end_transaction_id``,
    so that filter would re-attach a chart that had been removed before T
    (attached@1, removed@5, restore to tx10 → the chart wrongly returns).
    ``shadow_rows_valid_at`` stays correct for parent/child shadows, whose
    ``end_transaction_id`` the validity backfill does close (sc-119907).

    Returns the ids of snapshot members that no longer exist and were
    skipped. Live charts' content is never touched — restoring a chart's
    content is the chart's own restore endpoint's job.
    """
    # pylint: disable=import-outside-toplevel
    # Local imports: models.slice transitively imports models.core, which needs
    # the initialised app — a module-top import would recreate the bootstrap
    # cycle documented in changes/listener.py. chart_attachment_windows_for_dashboard is
    # imported lazily for the same reason: it pulls the window helpers, whose
    # package transitively imports the versioning.changes listener graph, so a
    # module-top import here would re-enter that same bootstrap cycle.
    from superset.models.slice import Slice
    from superset.versioning.membership import chart_attachment_windows_for_dashboard

    # chart_attachment_windows_for_dashboard owns the association-shadow read and the
    # attach/detach window pairing (the single place that must never filter the
    # M2M shadow by end_transaction_id — Continuum never closes it). A slice was
    # a member at transaction_id iff one of its windows contains it (sc-119907).
    member_ids = sorted(
        {
            slice_id
            for slice_id, window in chart_attachment_windows_for_dashboard(dashboard.id)
            if window.contains(transaction_id)
        }
    )
    if not member_ids:
        dashboard.slices = []
        return []

    live_slices = db.session.query(Slice).filter(Slice.id.in_(member_ids)).all()
    live_ids = {slc.id for slc in live_slices}
    skipped = sorted(set(member_ids) - live_ids)
    if skipped:
        logger.warning(
            "versioning: dashboard id=%s restore to tx=%s skipped %d "
            "member chart(s) that no longer exist: %s",
            dashboard.id,
            transaction_id,
            len(skipped),
            skipped,
        )
    dashboard.slices = live_slices
    return skipped


def _stamp_audit_fields_for_restore(entity: Any) -> None:
    """Overwrite ``changed_on`` / ``changed_by_fk`` on *entity* with the
    current time and current user id, so that the restore is attributed
    to the restoring user rather than the version snapshot's original
    author. Runs inside the restore's single flush scope so the stamp
    rides the same Continuum transaction as the revert."""
    # pylint: disable=import-outside-toplevel
    # Local import: utils.core pulls in the feature-flag manager, which
    # needs the initialised app (same cycle as models.slice above).
    from superset.utils.core import get_user_id

    entity.changed_on = datetime.now()
    entity.changed_by_fk = get_user_id()
