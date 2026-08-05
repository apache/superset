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
"""Write-ahead purge audit record.

Every purge — time-based or force — writes an immutable record that
**survives** the entity it names, on a **dedicated session** outside the
purge transaction so it neither entangles with the ``DBEventLogger``
(which shares ``db.session`` and commits mid-request) nor vanishes if the
purge rolls back. The record is written ``pending`` *before* the purge and
flipped to ``confirmed`` *after* it commits, so a crash leaves at most a
``pending`` row, never a missing one. ``pending`` rows are reconciled on the
next run (the purge is convergent).

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
from datetime import datetime, timedelta, timezone
from typing import Any, cast
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from superset import db
from superset.models.purge_audit_log import (
    PurgeAuditLog,
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_PENDING,
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

    Missing entities prove the entity transaction committed, so the attempt is
    confirmed. A surviving or unresolvable entity means the attempt did not
    durably purge it and is finalized as failed; normal selection may retry.
    """
    cutoff = stale_before or _utc_now() - _PENDING_STALE_AFTER
    reconciled = confirmed = failed = 0
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
                record.status = STATUS_CONFIRMED
                record.confirmed_on = _utc_now()
                confirmed += 1
            else:
                record.status = STATUS_FAILED
                failed += 1
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
    return {"reconciled": reconciled, "confirmed": confirmed, "failed": failed}
