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
   (its ``blocked`` rows newer than the entity's newest streak-breaking
   row), only the streak's earliest row survives: later duplicates are
   removed regardless of age. The survivor carries the "blocked since"
   fact and is never deleted while the streak is current.
2. **Operational expiry** — ``blocked`` rows of *resolved* streaks and
   ``failed`` rows older than ``PURGE_AUDIT_OPERATIONAL_RETENTION_DAYS``
   age out.
3. **Evidence expiry** — ``confirmed`` / ``target_absent`` rows are
   untouchable unless ``PURGE_AUDIT_EVIDENCE_RETENTION_DAYS`` is
   explicitly set (the operator's compliance assertion), and then only
   rows older than that window.

``pending`` rows belong to :func:`audit.reconcile_pending` and rows with
future timestamps (clock skew) are excluded from every category *and* from
streak classification, so a skewed writer cannot reclassify a live streak.

Two invariants keep the survivor safe without a distributed lock, which
matters because runs can overlap and ``reconcile_pending`` finalizes rows
concurrently:

* **A streak boundary is never removed while it still bounds anything.**
  Only ``confirmed``/``target_absent`` rows break streaks, and evidence
  expiry refuses to delete one while any older ``blocked`` row for the same
  entity survives. The boundary therefore never recedes, so a row selected
  as a duplicate cannot be promoted to survivor between its selection and
  its deletion. (A boundary moving *forward* — reconciliation finalizing a
  stale ``pending`` row — can only demote rows to resolved-streak status,
  which at worst removes an already-doomed duplicate ahead of its window.)
* **Deletes are conditional and counted from rowcounts.** A row whose
  status changed since selection is not matched, so overlapping runs can
  neither double-remove nor double-report.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
from typing import Any, NamedTuple
from uuid import UUID

import sqlalchemy as sa
from flask import current_app

from superset import db
from superset.commands.deletion_retention.audit import utc_now
from superset.models.purge_audit_log import (
    PurgeAuditLog,
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_TARGET_ABSENT,
)

logger: logging.Logger = logging.getLogger(__name__)

#: Operational records: noise-prone outcomes whose compliance value decays —
#: a blocked or failed purge leaves the object in place (FR-001).
OPERATIONAL_STATUSES: frozenset[str] = frozenset({STATUS_BLOCKED, STATUS_FAILED})
#: Protected evidence: the only surviving trace of a destroyed object.
PROTECTED_STATUSES: frozenset[str] = frozenset({STATUS_CONFIRMED, STATUS_TARGET_ABSENT})
#: The outcomes that end a blockage streak — proof the object is gone.
#:
#: ``failed`` is deliberately absent. A failed purge is an infrastructure
#: outcome (the cascade raised), not evidence the blockage cleared: the
#: policy that blocked the entity is untouched, so the blockage continues
#: across it. Treating ``failed`` as a boundary would let one transient
#: error demote the "blocked since" survivor to an ageing duplicate and
#: restate the blockage as beginning after the failure — losing exactly the
#: fact FR-003 exists to preserve. ``pending`` is provisional and likewise
#: neither joins nor breaks streaks.
_STREAK_BREAKING_STATUSES: frozenset[str] = frozenset(
    {STATUS_CONFIRMED, STATUS_TARGET_ABSENT}
)

#: Rows deleted per statement, matching the purge task's batch convention.
BATCH_SIZE: int = 500
#: One shared budget for the whole run across all three categories; the
#: remaining backlog carries over to the next scheduled run (FR-004/SC-004).
MAX_BATCHES_PER_RUN: int = 10

OPERATIONAL_RETENTION_KEY = "PURGE_AUDIT_OPERATIONAL_RETENTION_DAYS"
EVIDENCE_RETENTION_KEY = "PURGE_AUDIT_EVIDENCE_RETENTION_DAYS"


class ResolvedWindow(NamedTuple):
    """A retention window resolved from config.

    Distinguishes the three outcomes a caller must tell apart: a usable
    window, the deliberate "off" default, and operator error. Collapsing
    the last two into a bare ``None`` would force every caller to re-read
    config to find out which it got.
    """

    days: int | None
    invalid_key: str | None = None

    @property
    def enabled(self) -> bool:
        """Whether this category should run at all."""
        return self.days is not None


def _validated_window(key: str, value: Any) -> ResolvedWindow:
    """Validate a configured day count, failing closed on anything odd.

    An invalid value disables its category for the run rather than widening
    removal (FR-005/SC-005).
    """
    # bool is an int subclass and floats would silently truncate — both are
    # config mistakes, not day counts, on a knob that deletes rows.
    if not isinstance(value, bool) and not isinstance(value, float):
        try:
            days = int(value)
        except (TypeError, ValueError):
            days = 0
        if days > 0:
            return ResolvedWindow(days)
    logger.warning(
        "prune_audit: invalid %s=%r; skipping this category for the run "
        "(pruning never widens on bad configuration)",
        key,
        value,
    )
    return ResolvedWindow(None, key)


def resolve_operational_retention_days() -> ResolvedWindow:
    """The operational retention window, or a disabled window when invalid."""
    return _validated_window(
        OPERATIONAL_RETENTION_KEY, current_app.config.get(OPERATIONAL_RETENTION_KEY)
    )


def resolve_evidence_retention_days() -> ResolvedWindow:
    """The evidence expiration window; disabled unless explicitly opted in.

    Unset is the documented "never expire evidence" default (FR-006), not an
    error, so it produces a disabled window with no warning.
    """
    value = current_app.config.get(EVIDENCE_RETENTION_KEY)
    if value is None:
        return ResolvedWindow(None)
    return _validated_window(EVIDENCE_RETENTION_KEY, value)


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


def _streak_boundary_subquery(now: datetime) -> sa.Subquery:
    """Per entity, the ``created_on`` of its newest streak-breaking row.

    Entities absent from this subquery have never been proven destroyed —
    all their blocked rows form one current streak. Future-dated rows are
    excluded so a skewed writer clock cannot push the boundary ahead of a
    live streak and make its rows look resolved.
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
        .where(table.c.created_on <= now)
        .group_by(table.c.entity_type, table.c.entity_uuid)
        .subquery("streak_boundary")
    )


def _survivor_subquery(now: datetime) -> sa.Subquery:
    """Per entity, the ``created_on`` of its current streak's earliest row.

    The survivor is the earliest ``blocked`` row strictly newer than the
    entity's boundary (or its earliest blocked row outright when no boundary
    exists). Rows sharing that exact timestamp are all treated as survivors —
    with microsecond precision ties are pathological, and keeping an extra
    row errs on the preserving side.
    """
    table = PurgeAuditLog.__table__
    boundary = _streak_boundary_subquery(now)
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
        .where(table.c.created_on <= now)
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
    survivor = _survivor_subquery(now)
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
    when it began. A ``blocked`` row with no ``entity_uuid`` has no streak to
    belong to and so can never be *proven* redundant — it is kept rather
    than aged out, matching the fail-closed posture everywhere else here.
    """
    table = PurgeAuditLog.__table__
    survivor = _survivor_subquery(now)
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
    unidentified_block = sa.and_(
        table.c.status == STATUS_BLOCKED, table.c.entity_uuid.is_(None)
    )
    stmt = (
        sa.select(table.c.id)
        .where(table.c.status.in_(OPERATIONAL_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .where(sa.not_(sa.and_(table.c.status == STATUS_BLOCKED, is_survivor)))
        .where(sa.not_(unidentified_block))
        # Ascending order is load-bearing beyond fairness: within a resolved
        # streak the blocked rows are always removed no later than the
        # boundary that resolved them, so a budget-truncated run can never
        # leave blocked rows behind a deleted boundary.
        .order_by(table.c.created_on)
        .limit(limit)
    )
    return [row[0] for row in db.session.execute(stmt)]


def _evidence_candidate_ids(now: datetime, cutoff: datetime, limit: int) -> list[UUID]:
    """Ids of protected-evidence rows older than the explicit opt-in window.

    Excludes any row that still acts as a streak boundary — that is, one with
    a surviving ``blocked`` row older than it for the same entity. Deleting
    such a row would let the boundary recede and promote those older blocked
    rows into a *current* streak, minting a survivor that is exempt from
    age-out forever and falsely reporting an ongoing blockage for an object
    that was actually destroyed. This is what keeps the survivor invariant
    true under overlapping runs, and it makes an evidence window shorter
    than the operational window safe rather than corrupting.
    """
    table = PurgeAuditLog.__table__
    older = table.alias("older_blocked")
    bounds_surviving_blocks = sa.exists(
        sa.select(sa.literal(1))
        .select_from(older)
        .where(
            sa.and_(
                older.c.status == STATUS_BLOCKED,
                older.c.entity_type == table.c.entity_type,
                older.c.entity_uuid == table.c.entity_uuid,
                older.c.created_on < table.c.created_on,
            )
        )
    )
    stmt = (
        sa.select(table.c.id)
        .where(table.c.status.in_(PROTECTED_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .where(sa.not_(bounds_surviving_blocks))
        .order_by(table.c.created_on)
        .limit(limit)
    )
    return [row[0] for row in db.session.execute(stmt)]


def _delete_batch(ids: list[UUID], expected_statuses: frozenset[str]) -> int:
    """Conditionally delete a candidate batch; return the actual rowcount.

    The status re-check makes overlapping runs and racing writers safe: a row
    that changed status (or was already deleted) since candidate selection is
    simply not matched, and the count reflects only what this statement
    removed (FR-010). Deleting by primary key rather than by re-running the
    selection predicate also keeps the statement portable — a self-referencing
    subquery in a ``DELETE`` is rejected outright by MySQL.
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


class _Category(NamedTuple):
    """One delete category: what to select, what to delete, where to count."""

    field_name: str
    expected_statuses: frozenset[str]
    select_ids: Callable[[int], list[UUID]]


def _drain(category: _Category, budget: int) -> tuple[int, int, bool]:
    """Delete one category in batches. Returns (removed, budget_left, drained).

    Candidates are re-selected per batch rather than paged from one snapshot:
    each delete changes the streak picture, and re-selecting is what keeps a
    budget-truncated run's view consistent with the rows still present.
    """
    removed = 0
    while budget > 0:
        ids = category.select_ids(BATCH_SIZE)
        if not ids:
            return removed, budget, True
        removed += _delete_batch(ids, category.expected_statuses)
        budget -= 1
        if len(ids) < BATCH_SIZE:
            return removed, budget, True
    return removed, budget, False


def run_prune() -> PruneRunResult:
    """Apply the retention policy once, under one shared batch budget.

    Categories drain in priority order — blocked duplicates, then
    operational expiry, then evidence expiry — so the bounding rule that
    motivated the feature makes progress first when the budget is tight.
    ``pending`` rows are structurally excluded (no candidate query selects
    them).
    """
    now = utc_now()
    result = PruneRunResult()
    budget = MAX_BATCHES_PER_RUN

    operational = resolve_operational_retention_days()
    evidence = resolve_evidence_retention_days()
    result.invalid_config_keys = [
        window.invalid_key
        for window in (operational, evidence)
        if window.invalid_key is not None
    ]

    categories = [
        _Category(
            "blocked_duplicates",
            frozenset({STATUS_BLOCKED}),
            partial(_duplicate_candidate_ids, now),
        )
    ]
    if operational.days is not None:
        categories.append(
            _Category(
                "operational_expired",
                OPERATIONAL_STATUSES,
                partial(
                    _operational_candidate_ids,
                    now,
                    now - timedelta(days=operational.days),
                ),
            )
        )
    if evidence.days is not None:
        categories.append(
            _Category(
                "evidence_expired",
                PROTECTED_STATUSES,
                partial(
                    _evidence_candidate_ids, now, now - timedelta(days=evidence.days)
                ),
            )
        )

    for category in categories:
        removed, budget, drained = _drain(category, budget)
        setattr(result, category.field_name, removed)
        result.carried_over = result.carried_over or not drained

    return result


__all__ = [
    "BATCH_SIZE",
    "EVIDENCE_RETENTION_KEY",
    "MAX_BATCHES_PER_RUN",
    "OPERATIONAL_RETENTION_KEY",
    "OPERATIONAL_STATUSES",
    "PROTECTED_STATUSES",
    "PruneRunResult",
    "ResolvedWindow",
    "resolve_evidence_retention_days",
    "resolve_operational_retention_days",
    "run_prune",
]
