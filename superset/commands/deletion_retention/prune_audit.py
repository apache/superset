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
   row), only the first row of each run of consecutive same-reason rows
   survives: the streak's earliest row and the first row after every
   change of block reason. Later same-reason repeats are removed
   regardless of age. The survivors carry the "blocked since" fact and
   the reason history — for coded reasons, the same rows the audit writer's
   own suppression rule retains (reason-less legacy runs are additionally
   collapsed to their earliest here) — and are never deleted while the
   streak is current.
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

Three invariants keep the survivor safe without a distributed lock, which
matters because runs can overlap and both ``reconcile_pending`` and the
purge path finalize rows concurrently. A duplicate is only ever deleted
when no concurrent transition could turn it into a survivor first:

* **A boundary is never removed while it still bounds anything.** Evidence
  expiry refuses to delete a row while an older ``blocked`` or ``pending``
  row for the same entity survives. Boundaries therefore never *recede*,
  which would otherwise promote resolved rows into a current streak.
* **A blocked row whose classification is unstable is never deleted.**
  Finalizing a ``pending`` row resolves it *in place*, keeping its original
  timestamp, so an unresolved attempt is a boundary that may appear
  mid-history at any moment — and the blocked row after it would become its
  streak's survivor. Blocked rows preceded by an unresolved attempt are
  therefore skipped by **both** the duplicate and the operational category.
  Age does not stabilize the classification: an old blocked row inside a
  live streak is exactly the "blocked for years" case FR-009 protects.
  Without this, a boundary moving *forward* would demote the current
  survivor and promote the next row into its place — possibly a row already
  selected for deletion.
* **Deletes are conditional and counted from rowcounts.** A row whose
  status changed since selection is not matched, so overlapping runs can
  neither double-remove nor double-report.

Boundaries moving forward past *all* of an entity's blocked rows leave no
survivor to promote, so a selected duplicate may be removed slightly ahead
of its retention window in that case. It was redundant either way and the
streak's earliest row is untouched.

Timestamps order rows. Ties are possible — legacy second-precision rows,
two writers within one clock tick — and are resolved on the preserving
side: a ``pending`` row tied with a blocked row counts as preceding it (the
block is deferred until the attempt resolves); a blocked row tied with a
boundary sits on the boundary's *resolved* side (it ages out instead of
seeding a new current streak, and the boundary is not removed before it);
and tied same-reason blocked rows are all retained.

Candidate selection is embedded in each ``DELETE`` statement. The derived-table
wrapper keeps that shape legal on MySQL while ensuring that a pending or
recovered row committed before the delete is evaluated participates in the
survivor and boundary predicates. No stale list of candidate ids crosses a
transaction boundary.

Audit creation/recovery and every pruning batch take the same singleton
database write lock before assigning a timestamp or evaluating candidates.
The lock is held through commit, so an audit row cannot become visible in an
already-processed logical past. Automatic pruning still ships disabled by
default so operators explicitly choose their retention policy.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Literal, NamedTuple, TypeAlias

import sqlalchemy as sa
from flask import current_app

from superset import db
from superset.commands.deletion_retention.audit import (
    acquire_coordination_lock,
    utc_now,
)
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

OPERATIONAL_RETENTION_KEY: str = "PURGE_AUDIT_OPERATIONAL_RETENTION_DAYS"
EVIDENCE_RETENTION_KEY: str = "PURGE_AUDIT_EVIDENCE_RETENTION_DAYS"


class ResolvedWindow(NamedTuple):
    """A retention window resolved from config.

    Distinguishes the three outcomes a caller must tell apart: a usable
    window, the deliberate "off" default, and operator error. Collapsing
    the last two into a bare ``None`` would force every caller to re-read
    config to find out which it got.
    """

    days: int | None
    invalid_key: str | None = None


def _validated_window(key: str, value: Any) -> ResolvedWindow:
    """Validate a configured day count, failing closed on anything odd.

    An invalid value disables its category for the run rather than widening
    removal (FR-005/SC-005).
    """
    # bool is an int subclass and floats would silently truncate — both are
    # config mistakes, not day counts, on a knob that deletes rows.
    if not isinstance(value, bool) and not isinstance(value, float):
        try:
            days: int = int(value)
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
    value: Any = current_app.config.get(EVIDENCE_RETENTION_KEY)
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
    table: sa.Table = PurgeAuditLog.__table__
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


def _with_boundary(table: sa.Table, boundary: sa.Subquery) -> sa.Join:
    """Outer-join each row to its entity's streak boundary (NULL if none)."""
    return table.outerjoin(
        boundary,
        sa.and_(
            table.c.entity_type == boundary.c.entity_type,
            table.c.entity_uuid == boundary.c.entity_uuid,
        ),
    )


def _in_current_streak(
    row: sa.FromClause, boundary: sa.Subquery
) -> sa.ColumnElement[bool]:
    """Whether ``row`` is newer than its entity's boundary (or there is none).

    Strictly newer: a row tied with the boundary sits on its resolved side.
    A boundary proves the object was gone at that instant, and a block that
    cannot be ordered after the destruction must not seed a new "current"
    streak — that would mint a survivor exempt from age-out forever for an
    object that no longer exists.
    """
    return sa.or_(boundary.c.boundary.is_(None), row.c.created_on > boundary.c.boundary)


def _repeats_an_earlier_block(
    table: sa.Table, boundary: sa.Subquery
) -> sa.ColumnElement[bool]:
    """Whether a same-reason current-streak block precedes this row with no
    change of reason in between.

    This is the audit writer's suppression rule
    (:func:`audit.finalize_retention_blocked`) applied retroactively: a
    block repeating the reason of the block just before it adds nothing,
    while the first block after a reason change is the only durable record
    of the new cause and is retained. The comparison is NULL-safe, so
    consecutive reason-less (pre-feature) rows count as one run, deduped to
    the run's earliest, and the first coded block ends that run. Note this
    is *stricter* than the writer for reason-less rows: the writer never
    suppresses a reason-less block (``_suppress_redundant_block`` bails on a
    missing code), so here the pruner additionally collapses legacy
    pre-feature duplicates — the streak's earliest "blocked since" row is
    still always kept. Tied same-reason rows are not "earlier" than each
    other, so all of them are kept.
    """
    earlier: sa.FromClause = table.alias("earlier_block")
    between: sa.FromClause = table.alias("reason_change")
    reason_changed_between: sa.ColumnElement[bool] = sa.exists(
        sa.select(sa.literal(1))
        .select_from(between)
        .where(
            sa.and_(
                between.c.status == STATUS_BLOCKED,
                between.c.entity_type == table.c.entity_type,
                between.c.entity_uuid == table.c.entity_uuid,
                # Inclusive bounds: a differing-reason block sharing an
                # exact timestamp with either endpoint still breaks the run,
                # so a reason-transition row tied with a neighbour is
                # preserved as a run head rather than pruned as a repeat
                # (the same preserving-side tie rule the pending and evidence
                # guards use). Inclusive bounds only ever add boundaries —
                # i.e. only ever preserve more, never delete more.
                between.c.created_on >= earlier.c.created_on,
                between.c.created_on <= table.c.created_on,
                between.c.reason.is_distinct_from(table.c.reason),
            )
        )
        .correlate(table, earlier)
    )
    return sa.exists(
        sa.select(sa.literal(1))
        .select_from(earlier)
        .where(
            sa.and_(
                earlier.c.status == STATUS_BLOCKED,
                earlier.c.entity_type == table.c.entity_type,
                earlier.c.entity_uuid == table.c.entity_uuid,
                _in_current_streak(earlier, boundary),
                earlier.c.created_on < table.c.created_on,
                earlier.c.reason.is_not_distinct_from(table.c.reason),
                sa.not_(reason_changed_between),
            )
        )
        .correlate(table, boundary)
    )


def _preceded_by_unresolved_attempt(table: sa.Table) -> sa.ColumnElement[bool]:
    """Whether an unresolved (``pending``) attempt precedes this row.

    A ``pending`` row is the only thing that can insert a streak boundary
    into *history*: every other write lands at ``now``, newer than every
    existing row, whereas reconciliation and the purge path finalize a
    pending row **in place**, keeping its original ``created_on``. So a
    pending row sitting between two blocked rows is a boundary that may
    appear at any moment, and the blocked row after it would become the new
    streak's survivor — the very row pruning must never delete.

    A tied timestamp counts as preceding. Which of the two writes landed
    first is unknowable from the row, the block's classification (current
    duplicate, or resolved-streak row on an age window) changes with the
    attempt's outcome, and deferring it until then costs nothing.
    """
    pending: sa.FromClause = table.alias("unresolved_attempt")
    return sa.exists(
        sa.select(sa.literal(1))
        .select_from(pending)
        .where(
            sa.and_(
                pending.c.status == STATUS_PENDING,
                pending.c.entity_type == table.c.entity_type,
                pending.c.entity_uuid == table.c.entity_uuid,
                pending.c.created_on <= table.c.created_on,
            )
        )
    )


def _duplicate_candidates(now: datetime, limit: int) -> sa.sql.Select:
    """Select current-streak blocked rows that repeat the block before them.

    Age-independent by design (FR-003): a repeat is prunable the moment the
    streak holds an earlier same-reason block, regardless of the retention
    window. Trigger is not a discriminator — ``scheduled`` and ``force``
    blocked rows share streaks. Reason *is*: the first block after a reason
    change survives alongside the streak's earliest row (see
    :func:`_repeats_an_earlier_block`).

    Rows preceded by an unresolved attempt are skipped: their classification
    is not stable, because that attempt can finalize into a boundary and
    promote them to survivor between selection and deletion. Such rows are
    collected once the attempt resolves. Note that pruning does not depend on
    that happening promptly — reconciliation runs from the purge task, which
    a deployment may have disabled or left in dry-run — so a long-lived
    pending row defers its successors indefinitely rather than risking them.
    """
    table: sa.Table = PurgeAuditLog.__table__
    boundary: sa.Subquery = _streak_boundary_subquery(now)
    return (
        sa.select(table.c.id)
        .select_from(_with_boundary(table, boundary))
        .where(table.c.status == STATUS_BLOCKED)
        .where(table.c.entity_uuid.is_not(None))
        .where(table.c.created_on <= now)
        .where(_in_current_streak(table, boundary))
        .where(_repeats_an_earlier_block(table, boundary))
        .where(sa.not_(_preceded_by_unresolved_attempt(table)))
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _operational_candidates(
    now: datetime, cutoff: datetime, limit: int
) -> sa.sql.Select:
    """Select aged-out operational rows, excluding current-streak survivors.

    Covers ``failed`` rows and resolved-streak ``blocked`` rows older than
    the cutoff. A current streak's survivors — its earliest row and the first
    row after each reason change — are exempt regardless of age
    (FR-005/FR-009): a blockage that has persisted for years must still show
    when it began and what has blocked it. Survivors of *resolved* streaks
    are not exempt: the boundary is the evidence there, and the blocked
    rows behind it are operational history on the normal window. A
    ``blocked`` row with no ``entity_uuid`` has no streak to
    belong to and so can never be *proven* redundant — it is kept rather
    than aged out, matching the fail-closed posture everywhere else here.

    Blocked rows preceded by an unresolved attempt are skipped for the same
    reason they are skipped for deduplication: the attempt can finalize into
    a mid-history boundary and make such a row its streak's survivor. Age
    does not make that classification any more stable — an old row in a live
    streak is exactly the "blocked for years" case FR-009 protects — so this
    category needs the guard as much as the duplicate category does.
    ``failed`` rows neither join nor break streaks, so they are unaffected.
    """
    table: sa.Table = PurgeAuditLog.__table__
    boundary: sa.Subquery = _streak_boundary_subquery(now)
    is_survivor: sa.ColumnElement[bool] = sa.and_(
        _in_current_streak(table, boundary),
        sa.not_(_repeats_an_earlier_block(table, boundary)),
    )
    unstable_block: sa.ColumnElement[bool] = sa.and_(
        table.c.status == STATUS_BLOCKED,
        sa.or_(
            # No identity, so no streak to be proven redundant against.
            table.c.entity_uuid.is_(None),
            # Classification could change when the attempt resolves.
            _preceded_by_unresolved_attempt(table),
            is_survivor,
        ),
    )
    return (
        sa.select(table.c.id)
        .select_from(_with_boundary(table, boundary))
        .where(table.c.status.in_(OPERATIONAL_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .where(sa.not_(unstable_block))
        # Oldest first, so a budget-truncated run makes progress on the
        # rows closest to expiry. (Blocked rows never outlive the boundary
        # that resolved them, but that is enforced by the boundary guard in
        # _evidence_candidates, not by this ordering.)
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _evidence_candidates(now: datetime, cutoff: datetime, limit: int) -> sa.sql.Select:
    """Select protected-evidence rows older than the opt-in window.

    Excludes any row that still acts as a streak boundary — that is, one with
    a surviving ``blocked`` row older than it for the same entity. Deleting
    such a row would let the boundary recede and promote those older blocked
    rows into a *current* streak, minting a survivor that is exempt from
    age-out forever and falsely reporting an ongoing blockage for an object
    that was actually destroyed. This is what keeps the survivor invariant
    true under overlapping runs, and it makes an evidence window shorter
    than the operational window safe rather than corrupting.
    """
    table: sa.Table = PurgeAuditLog.__table__
    older: sa.FromClause = table.alias("older_blocked")
    # ``pending`` counts alongside ``blocked``: the purge path finalizes a
    # pending row in place to ``blocked``, so an older pending row is a
    # blocked row that has not announced itself yet. A *tied* row counts
    # too: it sits on this boundary's resolved side (``_in_current_streak``
    # is strict), so this boundary is what resolves it and must outlive it.
    bounds_surviving_blocks: sa.ColumnElement[bool] = sa.exists(
        sa.select(sa.literal(1))
        .select_from(older)
        .where(
            sa.and_(
                older.c.status.in_((STATUS_BLOCKED, STATUS_PENDING)),
                older.c.entity_type == table.c.entity_type,
                older.c.entity_uuid == table.c.entity_uuid,
                older.c.created_on <= table.c.created_on,
            )
        )
    )
    return (
        sa.select(table.c.id)
        .where(table.c.status.in_(PROTECTED_STATUSES))
        .where(table.c.created_on < cutoff)
        .where(table.c.created_on <= now)
        .where(sa.not_(bounds_surviving_blocks))
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _delete_statement(
    select_candidates: Callable[[int], sa.sql.Select],
) -> sa.sql.Delete:
    """Build a portable delete that re-evaluates candidate safety."""
    table: sa.Table = PurgeAuditLog.__table__
    candidates: sa.Subquery = select_candidates(BATCH_SIZE).subquery("prune_candidates")
    candidate_ids: sa.sql.Select = sa.select(candidates.c.id)
    return sa.delete(table).where(table.c.id.in_(candidate_ids))


def _delete_batch(select_candidates: Callable[[int], sa.sql.Select]) -> int:
    """Atomically select and delete one candidate batch.

    The nested derived table is evaluated as part of the DELETE, so every
    survivor, boundary, status, and age predicate sees the same committed
    database state as the mutation. The extra SELECT layer is required by
    MySQL, which rejects a direct self-referencing subquery in DELETE.
    """
    acquire_coordination_lock(db.session)
    execution_result: Any = db.session.execute(_delete_statement(select_candidates))
    db.session.commit()  # pylint: disable=consider-using-transaction
    return int(execution_result.rowcount or 0)


def _has_candidates(select_candidates: Callable[[int], sa.sql.Select]) -> bool:
    """Return whether a category still has at least one candidate."""
    return db.session.execute(select_candidates(1)).first() is not None


_CategoryName: TypeAlias = Literal[
    "blocked_duplicates", "operational_expired", "evidence_expired"
]


class _Category(NamedTuple):
    """One delete category: what to select, what to delete, where to count."""

    name: _CategoryName
    select_candidates: Callable[[int], sa.sql.Select]


class _DrainResult(NamedTuple):
    """Outcome of draining one pruning category."""

    removed: int
    unused_allowance: int
    drained: bool


def _drain(category: _Category, allowance: int) -> _DrainResult:
    """Delete one category in batches and report its budget outcome.

    Candidates are re-evaluated in each DELETE rather than paged from one
    snapshot. Each mutation changes the streak picture, so re-evaluation keeps
    a budget-truncated run consistent with the rows still present.
    """
    removed: int = 0
    while allowance > 0:
        batch_removed: int = _delete_batch(category.select_candidates)
        removed += batch_removed
        allowance -= 1
        if batch_removed < BATCH_SIZE:
            return _DrainResult(removed, allowance, True)
    # Out of allowance. Distinguish "nothing left anyway" from a real
    # backlog, so the carried_over signal only fires when rows remain.
    return _DrainResult(removed, 0, not _has_candidates(category.select_candidates))


def _record_removed(
    result: PruneRunResult, category: _CategoryName, removed: int
) -> None:
    """Record a category count without string-based attribute mutation."""
    if category == "blocked_duplicates":
        result.blocked_duplicates = removed
    elif category == "operational_expired":
        result.operational_expired = removed
    else:
        result.evidence_expired = removed


def run_prune() -> PruneRunResult:
    """Apply the retention policy once, under one shared batch budget.

    Categories drain in priority order — blocked duplicates, then
    operational expiry, then evidence expiry — so the bounding rule that
    motivated the feature makes progress first when the budget is tight.
    Each category is guaranteed at least one batch: strict priority over a
    shared budget would otherwise let a permanent duplicate backlog starve
    the age-based categories forever, which is the same unbounded growth
    this feature exists to stop. ``pending`` rows are structurally excluded
    (no candidate query selects them).
    """
    now: datetime = utc_now()
    result: PruneRunResult = PruneRunResult()
    budget: int = MAX_BATCHES_PER_RUN

    operational: ResolvedWindow = resolve_operational_retention_days()
    evidence: ResolvedWindow = resolve_evidence_retention_days()
    result.invalid_config_keys = [
        window.invalid_key
        for window in (operational, evidence)
        if window.invalid_key is not None
    ]

    categories: list[_Category] = [
        _Category(
            "blocked_duplicates",
            partial(_duplicate_candidates, now),
        )
    ]
    if operational.days is not None:
        categories.append(
            _Category(
                "operational_expired",
                partial(
                    _operational_candidates,
                    now,
                    now - timedelta(days=operational.days),
                ),
            )
        )
    if evidence.days is not None:
        categories.append(
            _Category(
                "evidence_expired",
                partial(_evidence_candidates, now, now - timedelta(days=evidence.days)),
            )
        )

    for index, category in enumerate(categories):
        # Reserve one batch for each category still to come, but never spend
        # past the run's budget — the floor exists to prevent starvation, not
        # to license overrun if the budget is ever set below the category
        # count.
        reserved: int = len(categories) - index - 1
        allowance: int = max(1, budget - reserved) if budget > 0 else 0
        drain_result: _DrainResult = _drain(category, allowance)
        budget -= allowance - drain_result.unused_allowance
        _record_removed(result, category.name, drain_result.removed)
        result.carried_over = result.carried_over or not drain_result.drained

    return result


__all__: list[str] = [
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
