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
"""Deletion-only pruning of the ``purge_audit_log`` table.

Bounds the audit history's growth without ever weakening its evidentiary
value. Three delete categories, applied in priority order under one shared
per-run batch budget:

1. **Blocked duplicates** — within an entity's *current* blockage streak
   (its ``blocked`` rows newer than the entity's newest non-blocked
   finalized row), every row except the streak's earliest survives only in
   the survivor: later duplicates are removed regardless of age. The
   survivor carries the "blocked since" fact and is never deleted while the
   streak is current.
2. **Operational expiry** — ``blocked`` rows of *resolved* streaks and
   ``failed`` rows older than ``PURGE_AUDIT_RETENTION_DAYS`` age out.
3. **Evidence expiry** — ``confirmed`` / ``target_absent`` rows are
   untouchable unless ``PURGE_AUDIT_EVIDENCE_RETENTION_DAYS`` is explicitly
   set (the operator's compliance assertion), and then only rows older than
   that window.

``pending`` rows belong to :func:`audit.reconcile_pending` and rows with
future timestamps (clock skew) are never candidates in any category.
Deletes are conditional on the expected status and counted from statement
rowcounts, so overlapping runs cannot double-remove or double-report.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask import current_app

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

#: Operational records: noise-prone outcomes whose compliance value decays —
#: a blocked or failed purge leaves the object in place (FR-001).
OPERATIONAL_STATUSES: frozenset[str] = frozenset({STATUS_BLOCKED, STATUS_FAILED})
#: Protected evidence: the only surviving trace of a destroyed object.
PROTECTED_STATUSES: frozenset[str] = frozenset({STATUS_CONFIRMED, STATUS_TARGET_ABSENT})
#: Finalized non-blocked statuses — the outcomes that terminate a blockage
#: streak. ``pending`` is provisional and neither joins nor breaks streaks.
_STREAK_BREAKING_STATUSES: frozenset[str] = frozenset(
    {STATUS_CONFIRMED, STATUS_FAILED, STATUS_TARGET_ABSENT}
)

#: Rows deleted per statement, matching the purge task's batch convention.
BATCH_SIZE: int = 500
#: One shared budget for the whole run across all three categories; the
#: remaining backlog carries over to the next scheduled run (FR-004/SC-004).
MAX_BATCHES_PER_RUN: int = 10

_OPERATIONAL_RETENTION_KEY = "PURGE_AUDIT_RETENTION_DAYS"
_EVIDENCE_RETENTION_KEY = "PURGE_AUDIT_EVIDENCE_RETENTION_DAYS"
_DEFAULT_OPERATIONAL_RETENTION_DAYS = 90


def _utc_now() -> datetime:
    """Naive-UTC now, matching the audit write path's ``created_on`` clock.

    ``audit._utc_now()`` stamps every audit row with
    ``datetime.now(timezone.utc).replace(tzinfo=None)``; cutoffs computed on
    any other clock would shift the retention window by the server's UTC
    offset.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _validated_days(key: str, value: Any) -> int | None:
    """Return a positive day count, or ``None`` (with a warning) when invalid.

    Fail closed: an invalid value disables its category for the run rather
    than widening removal (FR-005/SC-005). Booleans are rejected explicitly
    because ``bool`` is an ``int`` subclass.
    """
    try:
        # bool is an int subclass; floats would silently truncate — both are
        # config mistakes, not day counts, on a knob that deletes rows.
        if isinstance(value, (bool, float)):
            raise ValueError
        days = int(value)
        if days <= 0:
            raise ValueError
        return days
    except (TypeError, ValueError):
        logger.warning(
            "prune_audit: invalid %s=%r; skipping this category for the run "
            "(pruning never widens on bad configuration)",
            key,
            value,
        )
        return None


def resolve_operational_retention_days() -> int | None:
    """The operational retention window in days, or ``None`` when invalid."""
    value = current_app.config.get(
        _OPERATIONAL_RETENTION_KEY, _DEFAULT_OPERATIONAL_RETENTION_DAYS
    )
    return _validated_days(_OPERATIONAL_RETENTION_KEY, value)


def resolve_evidence_retention_days() -> int | None:
    """The evidence expiration window in days, or ``None`` when off/invalid.

    ``None`` in config is the default "never expire evidence" state, not an
    error — no warning is logged for it (FR-006).
    """
    value = current_app.config.get(_EVIDENCE_RETENTION_KEY)
    if value is None:
        return None
    return _validated_days(_EVIDENCE_RETENTION_KEY, value)


@dataclass
class PruneRunResult:
    """Per-category removal counts and run disposition for one pruning run."""

    blocked_duplicates: int = 0
    operational_expired: int = 0
    evidence_expired: int = 0
    #: True when the shared batch budget ran out before every category's
    #: candidates were drained; the remainder converges on later runs.
    carried_over: bool = False
    invalid_config_keys: list[str] = field(default_factory=list)

    @property
    def total_removed(self) -> int:
        """Total rows removed across every category."""
        return (
            self.blocked_duplicates + self.operational_expired + self.evidence_expired
        )

    def as_dict(self) -> dict[str, Any]:
        """The task-return / log-line shape of this result."""
        return {
            "removed": {
                "blocked_duplicates": self.blocked_duplicates,
                "operational_expired": self.operational_expired,
                "evidence_expired": self.evidence_expired,
            },
            "carried_over": self.carried_over,
            "invalid_config_keys": list(self.invalid_config_keys),
        }


def _streak_boundary_subquery() -> Any:
    """Per entity, the ``created_on`` of its newest non-blocked finalized row.

    Entities absent from this subquery have never had a finalized non-blocked
    outcome — all their blocked rows form the current streak.
    """
    table = PurgeAuditLog.__table__
    return (
        sa.select(
            table.c.entity_type.label("entity_type"),
            table.c.entity_uuid.label("entity_uuid"),
            sa.func.max(table.c.created_on).label("boundary"),
        )
        .where(table.c.status.in_(_STREAK_BREAKING_STATUSES))
        .where(table.c.entity_uuid.is_not(None))
        .group_by(table.c.entity_type, table.c.entity_uuid)
        .subquery("streak_boundary")
    )


def _survivor_subquery() -> Any:
    """Per entity, the ``created_on`` of its current streak's earliest row.

    The survivor is the earliest ``blocked`` row strictly newer than the
    entity's boundary (or its earliest blocked row outright when no boundary
    exists). Rows sharing that exact timestamp are all treated as survivors —
    with microsecond precision ties are pathological, and keeping an extra
    row errs on the preserving side.
    """
    table = PurgeAuditLog.__table__
    boundary = _streak_boundary_subquery()
    return (
        sa.select(
            table.c.entity_type.label("entity_type"),
            table.c.entity_uuid.label("entity_uuid"),
            sa.func.min(table.c.created_on).label("survivor_created_on"),
        )
        .select_from(
            table.outerjoin(
                boundary,
                sa.and_(
                    table.c.entity_type == boundary.c.entity_type,
                    table.c.entity_uuid == boundary.c.entity_uuid,
                ),
            )
        )
        .where(table.c.status == STATUS_BLOCKED)
        .where(table.c.entity_uuid.is_not(None))
        .where(
            sa.or_(
                boundary.c.boundary.is_(None),
                table.c.created_on > boundary.c.boundary,
            )
        )
        .group_by(table.c.entity_type, table.c.entity_uuid)
        .subquery("streak_survivor")
    )


def _duplicate_candidate_ids(now: datetime, limit: int) -> list[UUID]:
    """Ids of current-streak blocked rows that are not the streak survivor.

    Age-independent by design (FR-003): a duplicate is prunable the moment a
    streak has a survivor, regardless of the retention window. Trigger is not
    a discriminator — ``scheduled`` and ``force`` blocked rows share streaks.
    """
    table = PurgeAuditLog.__table__
    survivor = _survivor_subquery()
    stmt = (
        sa.select(table.c.id)
        .select_from(
            table.join(
                survivor,
                sa.and_(
                    table.c.entity_type == survivor.c.entity_type,
                    table.c.entity_uuid == survivor.c.entity_uuid,
                ),
            )
        )
        .where(table.c.status == STATUS_BLOCKED)
        .where(table.c.created_on > survivor.c.survivor_created_on)
        .where(table.c.created_on <= now)
        .order_by(table.c.created_on)
        .limit(limit)
    )
    return [row[0] for row in db.session.execute(stmt)]


def _operational_candidate_ids(
    now: datetime, cutoff: datetime, limit: int
) -> list[UUID]:
    """Ids of aged-out operational rows, excluding current-streak survivors.

    Covers ``failed`` rows and resolved-streak ``blocked`` rows older than
    the cutoff. A current streak's survivor is exempt regardless of age
    (FR-005/FR-009): a blockage that has persisted for years must still show
    when it began.
    """
    table = PurgeAuditLog.__table__
    survivor = _survivor_subquery()
    is_survivor = sa.exists(
        sa.select(sa.literal(1))
        .select_from(survivor)
        .where(
            sa.and_(
                survivor.c.entity_type == table.c.entity_type,
                survivor.c.entity_uuid == table.c.entity_uuid,
                survivor.c.survivor_created_on == table.c.created_on,
            )
        )
    )
    stmt = (
        sa.select(table.c.id)
        .where(table.c.status.in_(OPERATIONAL_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .where(sa.not_(sa.and_(table.c.status == STATUS_BLOCKED, is_survivor)))
        .order_by(table.c.created_on)
        .limit(limit)
    )
    return [row[0] for row in db.session.execute(stmt)]


def _evidence_candidate_ids(now: datetime, cutoff: datetime, limit: int) -> list[UUID]:
    """Ids of protected-evidence rows older than the explicit opt-in window."""
    table = PurgeAuditLog.__table__
    stmt = (
        sa.select(table.c.id)
        .where(table.c.status.in_(PROTECTED_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .order_by(table.c.created_on)
        .limit(limit)
    )
    return [row[0] for row in db.session.execute(stmt)]


def _delete_batch(ids: list[UUID], expected_statuses: frozenset[str]) -> int:
    """Conditionally delete a candidate batch; return the actual rowcount.

    The status re-check makes overlapping runs and racing writers safe: a row
    that changed status (or was already deleted) since candidate selection is
    simply not matched, and the count reflects only what this statement
    removed (FR-010).
    """
    if not ids:
        return 0
    result = db.session.execute(
        sa.delete(PurgeAuditLog.__table__).where(
            PurgeAuditLog.__table__.c.id.in_(ids),
            PurgeAuditLog.__table__.c.status.in_(expected_statuses),
        )
    )
    db.session.commit()  # pylint: disable=consider-using-transaction
    return int(result.rowcount or 0)


def run_prune() -> PruneRunResult:
    """Apply the retention policy once, under one shared batch budget.

    Categories drain in priority order — blocked duplicates, then
    operational expiry, then evidence expiry — so the bounding rule that
    motivated the feature makes progress first when the budget is tight.
    ``pending`` rows are structurally excluded (no candidate query selects
    them).
    """
    now = _utc_now()
    result = PruneRunResult()
    budget = MAX_BATCHES_PER_RUN

    operational_days = resolve_operational_retention_days()
    if operational_days is None:
        result.invalid_config_keys.append(_OPERATIONAL_RETENTION_KEY)
    evidence_config = current_app.config.get(_EVIDENCE_RETENTION_KEY)
    evidence_days = resolve_evidence_retention_days()
    if evidence_config is not None and evidence_days is None:
        result.invalid_config_keys.append(_EVIDENCE_RETENTION_KEY)

    def drain(
        select_ids: Any, expected_statuses: frozenset[str], remaining: int
    ) -> tuple[int, int, bool]:
        """Drain one category. Returns (removed, budget_left, drained)."""
        removed = 0
        while remaining > 0:
            ids = select_ids(BATCH_SIZE)
            if not ids:
                return removed, remaining, True
            removed += _delete_batch(ids, expected_statuses)
            remaining -= 1
            if len(ids) < BATCH_SIZE:
                return removed, remaining, True
        return removed, remaining, False

    removed, budget, drained = drain(
        lambda limit: _duplicate_candidate_ids(now, limit),
        frozenset({STATUS_BLOCKED}),
        budget,
    )
    result.blocked_duplicates = removed
    result.carried_over = result.carried_over or not drained

    if operational_days is not None:
        cutoff = now - timedelta(days=operational_days)
        removed, budget, drained = drain(
            lambda limit: _operational_candidate_ids(now, cutoff, limit),
            OPERATIONAL_STATUSES,
            budget,
        )
        result.operational_expired = removed
        result.carried_over = result.carried_over or not drained

    if evidence_days is not None:
        cutoff = now - timedelta(days=evidence_days)
        removed, budget, drained = drain(
            lambda limit: _evidence_candidate_ids(now, cutoff, limit),
            PROTECTED_STATUSES,
            budget,
        )
        result.evidence_expired = removed
        result.carried_over = result.carried_over or not drained

    return result


__all__ = [
    "BATCH_SIZE",
    "MAX_BATCHES_PER_RUN",
    "OPERATIONAL_STATUSES",
    "PROTECTED_STATUSES",
    "PruneRunResult",
    "resolve_evidence_retention_days",
    "resolve_operational_retention_days",
    "run_prune",
    "STATUS_PENDING",
]
