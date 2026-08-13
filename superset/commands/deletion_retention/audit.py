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
"""Write-ahead purge audit records and retained purge outcomes.

Every purge evaluation — scheduled or force — writes a provisional record on
a **dedicated session** outside the
purge transaction so it neither entangles with the ``DBEventLogger``
(which shares ``db.session`` and commits mid-request) nor vanishes if the
purge rolls back. The record is written ``pending`` *before* the purge and
flipped to ``confirmed`` *after* it commits, so a crash leaves at most a
``pending`` row, never a missing one. ``pending`` rows are reconciled on the
next run. Completed records are immutable. Consecutive scheduled evaluations
that remain blocked may discard only their current redundant provisional row;
force-purge and other meaningful outcomes are retained independently.

The dedicated ``purge_audit_log`` table is content-free (no name or PII; only
action, actor, UTC time, entity type, UUID, and affected referrers) and is never
removed by the purge cascade.
"""

# Explicit commit/rollback on the dedicated session is the whole point of
# this module — the audit row must survive independently of the purge
# transaction, which the @transaction decorator (scoped to db.session)
# cannot express.
# pylint: disable=consider-using-transaction

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, cast, Literal, TypeAlias
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from superset import db
from superset.models.purge_audit_log import (
    PurgeAuditLog,
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_TARGET_ABSENT,
)

logger: logging.Logger = logging.getLogger(__name__)


def _dedicated_session() -> Session:
    """A fresh session on its own connection, independent of the request /
    task ``db.session``. The audit write must commit on its own so it survives
    a rolled-back or crashed purge."""
    return sessionmaker(bind=db.engine)()


_PENDING_STALE_AFTER = timedelta(hours=1)

TRIGGER_RETENTION = "retention"
TRIGGER_FORCE = "force"

ACTOR_SYSTEM = "system"

RetentionBlockedDisposition: TypeAlias = Literal["retained", "suppressed", "fallback"]


@dataclass(frozen=True)
class _AuditRecoverySnapshot:
    id: UUID
    actor: str
    entity_type: str
    entity_uuid: str | None
    created_on: datetime


def _utc_now() -> datetime:
    """Naive UTC now for the audit columns.

    Note this deliberately differs from the metadata schema's audit
    columns (``changed_on`` / ``deleted_at``), which are naive-local per
    the PR #33693 UTC revert — the purge audit table is self-contained
    (``created_on`` and the reconcile cutoff both use this clock), so it
    can use the saner convention without a comparison hazard.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def write_ahead(
    *,
    trigger: str,
    actor: str,
    entity_type: str,
    entity_uuid: str | None,
    removed_dashboard_slices: int = 0,
) -> UUID | None:
    """Insert a ``pending`` audit row on a dedicated session, before the
    purge runs. Returns the row id to confirm later, or ``None`` if the audit
    write itself fails (which must not block the purge)."""
    session = _dedicated_session()
    try:
        record = PurgeAuditLog(
            status=STATUS_PENDING,
            trigger=trigger,
            actor=actor,
            entity_type=entity_type,
            entity_uuid=entity_uuid,
            removed_dashboard_slices=removed_dashboard_slices,
            created_on=_utc_now(),
        )
        session.add(record)
        session.commit()
        return cast(UUID, record.id)
    except Exception:  # pylint: disable=broad-except
        session.rollback()
        logger.warning(
            "deletion_retention: failed to write pending audit row", exc_info=True
        )
        return None
    finally:
        session.close()


def finalize(record_id: UUID | None, status: str, **details: Any) -> None:
    """Finalize a pending attempt on the dedicated audit session."""
    if record_id is None:
        return
    session = _dedicated_session()
    try:
        values: dict[str, Any] = {"status": status}
        if status == STATUS_CONFIRMED:
            values["confirmed_on"] = _utc_now()
        referrers = details.get("affected_referrers")
        if referrers:
            values["affected_referrers"] = ",".join(referrers)
        removed_dashboard_slices = details.get("removed_dashboard_slices")
        if removed_dashboard_slices is not None:
            values["removed_dashboard_slices"] = removed_dashboard_slices
        elif status in (STATUS_FAILED, STATUS_BLOCKED):
            # The write-ahead row recorded the count the purge INTENDED to
            # remove. On a failed or blocked attempt the cleanup rolled back,
            # so leaving it would assert removals that never happened.
            values["removed_dashboard_slices"] = 0
        # Conditional UPDATE, not read-then-write: only pending rows may
        # transition (a delayed worker must not overwrite an outcome
        # reconcile_pending() already recorded — the audit history is
        # immutable once finalized), and the status predicate makes that
        # atomic under concurrent finalizers.
        session.execute(
            sa.update(PurgeAuditLog.__table__)
            .where(
                PurgeAuditLog.__table__.c.id == record_id,
                PurgeAuditLog.__table__.c.status == STATUS_PENDING,
            )
            .values(**values)
        )
        session.commit()
    except Exception:  # pylint: disable=broad-except
        session.rollback()
        logger.warning(
            "deletion_retention: failed to finalize audit row %s as %s",
            record_id,
            status,
            exc_info=True,
        )
    finally:
        session.close()


def confirm(record_id: UUID | None, **details: Any) -> None:
    """Mark an attempt confirmed after the entity transaction commits."""
    finalize(record_id, STATUS_CONFIRMED, **details)


def fail(record_id: UUID | None) -> None:
    """Mark a known failed/no-op attempt so it does not remain pending."""
    finalize(record_id, STATUS_FAILED)


def block(record_id: UUID | None) -> None:
    """Mark an attempt blocked by ordinary deletion policy."""
    finalize(record_id, STATUS_BLOCKED)


def _capture_recovery_snapshot(record: PurgeAuditLog) -> _AuditRecoverySnapshot:
    """Capture the content-free fields needed for fail-safe recovery."""
    return _AuditRecoverySnapshot(
        id=cast(UUID, record.id),
        actor=str(record.actor),
        entity_type=str(record.entity_type),
        entity_uuid=record.entity_uuid,
        created_on=cast(datetime, record.created_on),
    )


def _retention_predecessor(
    session: Session, current: PurgeAuditLog
) -> PurgeAuditLog | None:
    """Return the latest row that could unambiguously precede ``current``."""
    predecessor: PurgeAuditLog | None = session.execute(
        sa.select(PurgeAuditLog)
        .where(PurgeAuditLog.entity_uuid == current.entity_uuid)
        .where(PurgeAuditLog.entity_type == current.entity_type)
        .where(PurgeAuditLog.trigger == TRIGGER_RETENTION)
        .where(PurgeAuditLog.created_on <= current.created_on)
        .where(PurgeAuditLog.id != current.id)
        .order_by(PurgeAuditLog.created_on.desc())
        .limit(1)
    ).scalar_one_or_none()
    if predecessor is None:
        return predecessor
    tied_mixed_status_exists: bool = session.execute(
        sa.select(
            sa.exists().where(
                PurgeAuditLog.entity_uuid == current.entity_uuid,
                PurgeAuditLog.entity_type == current.entity_type,
                PurgeAuditLog.trigger == TRIGGER_RETENTION,
                PurgeAuditLog.created_on == predecessor.created_on,
                PurgeAuditLog.id != current.id,
                PurgeAuditLog.status != predecessor.status,
            )
        )
    ).scalar_one()
    if tied_mixed_status_exists:
        return None
    return predecessor


def _suppress_redundant_block(
    session: Session, current: PurgeAuditLog, predecessor: PurgeAuditLog | None
) -> bool:
    """Delete only a pending row with a strictly older blocked predecessor."""
    if (
        predecessor is None
        or predecessor.created_on >= current.created_on
        or predecessor.status != STATUS_BLOCKED
    ):
        return False
    deleted_rows: int | None = session.execute(
        sa.delete(PurgeAuditLog.__table__).where(
            PurgeAuditLog.__table__.c.id == current.id,
            PurgeAuditLog.__table__.c.status == STATUS_PENDING,
        )
    ).rowcount
    if deleted_rows not in (0, 1):
        raise SQLAlchemyError(
            f"indeterminate purge audit suppression rowcount: {deleted_rows}"
        )
    return deleted_rows == 1


def _retain_blocked(session: Session, record_id: UUID) -> None:
    """Conditionally retain the current provisional row as blocked."""
    session.execute(
        sa.update(PurgeAuditLog.__table__)
        .where(
            PurgeAuditLog.__table__.c.id == record_id,
            PurgeAuditLog.__table__.c.status == STATUS_PENDING,
        )
        .values(status=STATUS_BLOCKED, removed_dashboard_slices=0)
    )


def _recover_retention_blocked(
    record_id: UUID, snapshot: _AuditRecoverySnapshot | None
) -> RetentionBlockedDisposition:
    """Retain blocked evidence on a fresh session after persistence uncertainty."""
    recovery_session: Session = _dedicated_session()
    try:
        current: PurgeAuditLog | None = recovery_session.get(PurgeAuditLog, record_id)
        if current is not None:
            if current.status == STATUS_PENDING:
                _retain_blocked(recovery_session, record_id)
                recovery_session.commit()
            return "fallback"
        if snapshot is None:
            return "fallback"
        recovery_session.add(
            PurgeAuditLog(
                id=snapshot.id,
                status=STATUS_BLOCKED,
                trigger=TRIGGER_RETENTION,
                actor=snapshot.actor,
                entity_type=snapshot.entity_type,
                entity_uuid=snapshot.entity_uuid,
                removed_dashboard_slices=0,
                created_on=snapshot.created_on,
            )
        )
        recovery_session.commit()
    except SQLAlchemyError:
        recovery_session.rollback()
        logger.warning(
            "deletion_retention: failed to recover blocked audit row %s "
            "entity_type=%s entity_uuid=%s",
            record_id,
            snapshot.entity_type if snapshot else None,
            snapshot.entity_uuid if snapshot else None,
            exc_info=True,
        )
    finally:
        recovery_session.close()
    return "fallback"


def finalize_retention_blocked(
    record_id: UUID | None,
) -> RetentionBlockedDisposition:
    """Finalize a scheduled blocker, suppressing only proven redundant evidence."""
    if record_id is None:
        return "fallback"
    session: Session = _dedicated_session()
    snapshot: _AuditRecoverySnapshot | None = None
    try:
        current: PurgeAuditLog | None = session.get(PurgeAuditLog, record_id)
        if current is None:
            return "fallback"
        snapshot = _capture_recovery_snapshot(current)
        if current.status != STATUS_PENDING or current.trigger != TRIGGER_RETENTION:
            return "retained"
        predecessor: PurgeAuditLog | None = None
        if current.entity_uuid is not None:
            predecessor = _retention_predecessor(session, current)
        suppressed: bool = _suppress_redundant_block(session, current, predecessor)
        if not suppressed:
            _retain_blocked(session, record_id)
        session.commit()
        return "suppressed" if suppressed else "retained"
    except SQLAlchemyError:
        session.rollback()
        logger.warning(
            "deletion_retention: persistence uncertainty finalizing blocked "
            "audit row %s",
            record_id,
            exc_info=True,
        )
    finally:
        session.close()
    return _recover_retention_blocked(record_id, snapshot)


def _entity_exists(session: Session, record: PurgeAuditLog) -> bool | None:
    """Return whether the audit target exists, or None if it cannot resolve."""
    # pylint: disable=import-outside-toplevel
    from superset.models.helpers import SoftDeleteMixin

    if record.entity_uuid is None:
        return None
    for model in SoftDeleteMixin._registered_subclasses:  # noqa: SLF001
        table = cast(Any, model).__table__
        if table.name != record.entity_type or "uuid" not in table.c:
            continue
        return (
            session.execute(
                sa.select(table.c.id).where(table.c.uuid == record.entity_uuid).limit(1)
            ).first()
            is not None
        )
    return None


def reconcile_pending(stale_before: datetime | None = None) -> dict[str, int]:
    """Finalize stale pending attempts left by a process crash.

    A missing entity proves *some* purge committed -- but not that it was this
    attempt: a concurrent attempt or an unrelated deletion fits the evidence
    equally well, so the row is finalized ``target_absent`` rather than
    ``confirmed``. A surviving or unresolvable entity means the attempt did
    not durably purge it and is finalized as failed; normal selection may
    retry.
    """
    cutoff = stale_before or _utc_now() - _PENDING_STALE_AFTER
    reconciled = absent = failed = 0
    session = _dedicated_session()
    try:
        records = (
            session.query(PurgeAuditLog)
            .filter(PurgeAuditLog.status == STATUS_PENDING)
            .filter(PurgeAuditLog.created_on < cutoff)
            # Row locks so a delayed worker's finalize() (a conditional
            # UPDATE on status='pending') serializes against this scan
            # on PostgreSQL/MySQL; a no-op on SQLite.
            .with_for_update()
            .all()
        )
        for record in records:
            if _entity_exists(session, record) is False:
                record.status = STATUS_TARGET_ABSENT
                absent += 1
            else:
                record.status = STATUS_FAILED
                failed += 1
            # The write-ahead row recorded the count the attempt INTENDED to
            # remove — same rule as finalize() on failed/blocked: the audit
            # asserts only what it witnessed. A failed attempt rolled back;
            # an absent target proves some purge committed but not that it
            # was this one, so the count is not attributable either way.
            record.removed_dashboard_slices = 0
            reconciled += 1
        session.commit()
    except Exception:  # pylint: disable=broad-except
        session.rollback()
        logger.warning(
            "deletion_retention: failed to reconcile pending audit rows",
            exc_info=True,
        )
    finally:
        session.close()
    return {"reconciled": reconciled, "absent": absent, "failed": failed}
