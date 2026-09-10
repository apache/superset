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

Each batch discovers ≤``BATCH_SIZE`` candidate ids with an UNLOCKED select,
then under the coordination lock RE-CHECKS them with a SELECT that re-applies
the same candidacy predicates scoped to those ids, and DELETEs the survivors by
literal id. So the candidate ids do cross the lock boundary — but only as a
hint: candidacy is re-verified under the lock over current committed state, so a
pending or recovered row committed before the lock is honoured (a row it turned
into a survivor fails the re-check and is not deleted). The re-check is a SELECT
rather than a correlated ``WHERE`` on the DELETE because MySQL rejects a DELETE
whose subquery reads the target table (ERROR 1093); the DELETE names only the
literal surviving ids. Because the re-check predicates are correlated
(per-entity index probes) and scoped to ≤``BATCH_SIZE`` ids, the locked work is
bounded rather than a full-table scan, keeping lock-hold time short even on
large tables.

Audit creation/recovery and every pruning batch's DELETE take the same
singleton database write lock. The lock is held through commit, so an audit row
committed after the lock is acquired cannot land in the streak a batch just
pruned. The expensive candidate discovery runs before the lock, so it does not
extend the lock-hold. Automatic pruning still ships disabled by default so
operators explicitly choose their retention policy.
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
    TRIGGER_FORCE,
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


def _streak_boundary_scalar(target: sa.FromClause, now: datetime) -> sa.ScalarSelect:
    """Correlated per-entity streak boundary for *target*.

    The newest ``created_on`` among *target*'s entity's streak-breaking rows,
    or NULL if the entity has none (never proven destroyed — all its blocked
    rows form one current streak). This is a **correlated scalar subquery**,
    not a global ``GROUP BY`` aggregate: a discovery/delete already filtered to
    a bounded id set resolves it as per-entity index probes rather than a
    full-table aggregate, which is what keeps the coordination-locked re-check
    delete's work bounded (sc-116701 lock-hold-time). It matches the previous
    global boundary's filters verbatim — same ``(entity_type, entity_uuid)``
    key, the ``entity_uuid IS NOT NULL`` guard, and the future-date
    (``created_on <= now``) exclusion so a skewed writer clock cannot push the
    boundary ahead of a live streak — so it is semantically identical, just
    evaluated per row instead of once per group.
    """
    boundary: sa.FromClause = PurgeAuditLog.__table__.alias("streak_break")
    return (
        sa.select(sa.func.max(boundary.c.created_on))
        .where(
            boundary.c.entity_type == target.c.entity_type,
            boundary.c.entity_uuid == target.c.entity_uuid,
            boundary.c.entity_uuid.is_not(None),
            boundary.c.status.in_(_STREAK_BREAKING_STATUSES),
            boundary.c.created_on <= now,
        )
        .correlate(target)
        .scalar_subquery()
    )


def _in_current_streak(target: sa.FromClause, now: datetime) -> sa.ColumnElement[bool]:
    """Whether ``target`` is newer than its entity's streak boundary.

    Strictly newer: a row tied with the boundary sits on its resolved side.
    A boundary proves the object was gone at that instant, and a block that
    cannot be ordered after the destruction must not seed a new "current"
    streak — that would mint a survivor exempt from age-out forever for an
    object that no longer exists. A NULL boundary (no streak-breaking row)
    means every block is in the current streak.
    """
    boundary: sa.ScalarSelect = _streak_boundary_scalar(target, now)
    return sa.or_(boundary.is_(None), target.c.created_on > boundary)


def _repeats_an_earlier_block(
    table: sa.FromClause, now: datetime
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

    A ``force`` row is exempt: it is never reported as a repeat (see the
    return), so it is kept out of the duplicate category and marked a
    survivor while its streak is current. It is also exempt from operational
    age-out (see :func:`_operational_candidates`), so an operator force-purge
    block is retained permanently — never pruned by either category.
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
    repeats: sa.ColumnElement[bool] = sa.exists(
        sa.select(sa.literal(1))
        .select_from(earlier)
        .where(
            sa.and_(
                earlier.c.status == STATUS_BLOCKED,
                earlier.c.entity_type == table.c.entity_type,
                earlier.c.entity_uuid == table.c.entity_uuid,
                # ``earlier`` must itself be in the current streak; its
                # boundary scalar correlates to ``earlier`` (not ``table``).
                _in_current_streak(earlier, now),
                earlier.c.created_on < table.c.created_on,
                earlier.c.reason.is_not_distinct_from(table.c.reason),
                sa.not_(reason_changed_between),
            )
        )
        # Correlate the ``earlier`` EXISTS to ``table`` only. The boundary is
        # no longer a passed subquery — it is a scalar correlated inside
        # ``_in_current_streak(earlier, now)`` above, so it must not be
        # co-correlated here.
        .correlate(table)
    )
    # A ``force`` attempt is an operator action the writer never suppresses:
    # audit.py's ``_suppress_redundant_block`` only collapses consecutive
    # scheduled same-reason blocks, so the pruner does not collapse a force row
    # either — it is never reported as a repeat. This keeps it out of the
    # duplicate category and (via ``sa.not_`` in the operational category) marks
    # it a survivor while its streak is current. It is also exempt from
    # operational age-out (``_operational_candidates`` excludes force blocks), so
    # a force block is retained permanently — full immortality for operator
    # force-purge blocks. A force row may still be the *earlier* anchor a later
    # scheduled repeat collapses into — only the force row itself is protected
    # from duplicate removal.
    return sa.and_(table.c.trigger != TRIGGER_FORCE, repeats)


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
    window. Trigger does not gate streak membership — ``scheduled`` and
    ``force`` blocked rows share streaks — but a ``force`` row is itself never
    collapsed as a repeat (see :func:`_repeats_an_earlier_block`). Reason *is*
    a discriminator: the first block after a reason change survives alongside
    the streak's earliest row.

    Rows preceded by an unresolved attempt are skipped: their classification
    is not stable, because that attempt can finalize into a boundary and
    promote them to survivor between selection and deletion. Such rows are
    collected once the attempt resolves. Note that pruning does not depend on
    that happening promptly — reconciliation runs from the purge task, which
    a deployment may have disabled or left in dry-run — so a long-lived
    pending row defers its successors indefinitely rather than risking them.
    """
    table: sa.Table = PurgeAuditLog.__table__
    return (
        sa.select(table.c.id)
        .where(*_duplicate_predicates(table, now))
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _duplicate_predicates(
    table: sa.FromClause, now: datetime
) -> list[sa.ColumnElement[bool]]:
    """The candidacy predicates for the blocked-duplicate category.

    One list, used by BOTH the unlocked discovery select
    (:func:`_duplicate_candidates`) and the coordination-locked re-check
    delete (:func:`_delete_batch`), so the two can never drift — the locked
    delete re-verifies exactly what discovery selected. All predicates are
    correlated on *table* (the streak boundary is a per-row scalar, the
    repeat/pending checks are correlated ``EXISTS``), so applied to a bounded
    id set they resolve as per-entity index probes rather than a full scan.
    """
    return [
        table.c.status == STATUS_BLOCKED,
        table.c.entity_uuid.is_not(None),
        table.c.created_on <= now,
        _in_current_streak(table, now),
        _repeats_an_earlier_block(table, now),
        sa.not_(_preceded_by_unresolved_attempt(table)),
    ]


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

    ``force`` blocked rows are exempt from age-out entirely: an operator
    force-purge block is retained permanently, not just while its streak is
    current, so it never ages at the cutoff. ``failed`` rows (force-triggered
    or not) age normally.
    """
    table: sa.Table = PurgeAuditLog.__table__
    return (
        sa.select(table.c.id)
        .where(*_operational_predicates(table, now, cutoff))
        # Oldest first, so a budget-truncated run makes progress on the
        # rows closest to expiry. (Blocked rows never outlive the boundary
        # that resolved them, but that is enforced by the boundary guard in
        # _evidence_candidates, not by this ordering.)
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _operational_predicates(
    table: sa.FromClause, now: datetime, cutoff: datetime
) -> list[sa.ColumnElement[bool]]:
    """The candidacy predicates for the operational-expiry category.

    One list, shared by the unlocked discovery select
    (:func:`_operational_candidates`) and the coordination-locked re-check
    delete, so the two cannot drift. Correlated on *table*, so a bounded id
    set resolves per-entity via index.
    """
    is_survivor: sa.ColumnElement[bool] = sa.and_(
        _in_current_streak(table, now),
        sa.not_(_repeats_an_earlier_block(table, now)),
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
    # A ``force`` blocked row never ages out — full immortality for operator
    # force-purge blocks. It is already kept out of the duplicate category and
    # marked a survivor while its streak is current; this extends the exemption
    # to the operational window, so a *resolved*-streak force block is retained
    # permanently rather than aged at the cutoff. (A longer-but-not-forever
    # cleanup pass for these is a possible follow-up, deliberately out of scope.)
    # ``force`` gates only ``blocked`` rows here; ``failed`` rows age normally.
    force_block: sa.ColumnElement[bool] = sa.and_(
        table.c.status == STATUS_BLOCKED,
        table.c.trigger == TRIGGER_FORCE,
    )
    return [
        table.c.status.in_(OPERATIONAL_STATUSES),
        table.c.created_on < cutoff,
        table.c.created_on <= now,
        sa.not_(unstable_block),
        sa.not_(force_block),
    ]


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
    return (
        sa.select(table.c.id)
        .where(*_evidence_predicates(table, now, cutoff))
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _evidence_predicates(
    table: sa.FromClause, now: datetime, cutoff: datetime
) -> list[sa.ColumnElement[bool]]:
    """The candidacy predicates for the evidence-expiry category.

    One list, shared by the unlocked discovery select
    (:func:`_evidence_candidates`) and the coordination-locked re-check
    delete. The boundary-recession guard is a correlated ``EXISTS``, so a
    bounded id set resolves per-entity via index.
    """
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
        .correlate(table)
    )
    return [
        table.c.status.in_(PROTECTED_STATUSES),
        table.c.created_on < cutoff,
        table.c.created_on <= now,
        sa.not_(bounds_surviving_blocks),
    ]


def _delete_batch(
    select_candidates: Callable[[int], sa.sql.Select],
    recheck_predicates: Callable[[sa.FromClause], list[sa.ColumnElement[bool]]],
) -> tuple[int, int]:
    """Discover a candidate batch UNLOCKED, then delete it under the lock.

    Returns ``(discovered, removed)``: how many candidate ids discovery found
    (≤``BATCH_SIZE``) and how many the locked re-check actually deleted. The
    caller keys "drained" on *discovered*, not *removed*, so an overlapping run
    that thinned the hints cannot be misread as a fully-drained backlog.

    Discovery (the expensive age-unbounded scan with its boundary / repeat /
    pending correlated subqueries) runs WITHOUT the coordination lock and only
    yields ≤``BATCH_SIZE`` candidate ids — a hint. The lock is then taken for a
    re-check SELECT that re-applies the SAME candidacy predicates scoped to
    those ids, followed by a literal-id DELETE of the survivors. The re-check
    is a SELECT (not a correlated ``WHERE`` on the DELETE) because MySQL rejects
    a DELETE whose subquery reads the target table (ERROR 1093), and the
    candidacy predicates read ``purge_audit_log``; the DELETE then names only
    the literal surviving-id list. Both statements are scoped to the ≤500 ids,
    so the locked work is bounded to per-PK + per-entity index probes regardless
    of table size (sc-116701 lock-hold-time). When discovery finds nothing, no
    lock is taken at all.

    The backdated-write invariant is preserved: a row that a concurrent
    ``write_ahead`` turned into a survivor between the unlocked discovery and
    the lock fails the re-check and is not deleted (a stale hint only ever
    deletes fewer rows, never wrong ones); the ids cross the lock boundary as a
    hint, but candidacy is re-verified under the lock over committed state, so
    the ``write_ahead`` serialization guarantee is unchanged from the previous
    single-statement form.

    It is the same singleton lock ``write_ahead`` takes before stamping
    ``created_on`` (see ``audit.py``), so an audit row committed after the lock
    is acquired is, under bounded clock skew, timestamped after the run cutoff
    -- it does not land in the streak this batch just pruned. (The module's
    streak invariants are the primary safeguard; the lock adds this
    serialization.) The window is bounded by the ≤``BATCH_SIZE`` scoped delete,
    not by holding the lock across discovery.

    Liveness tradeoff (mechanism; the operator-facing note lives in UPDATING.md):
    while the lock is held for the scoped delete, a concurrent scheduled purge's
    ``write_ahead`` cannot stamp its row until the batch commits. Where the write
    just waits (e.g. PostgreSQL, whose ``lock_timeout`` is disabled by default) it
    then succeeds; where a lock or statement timeout is configured -- or on SQLite,
    which does not wait, and MySQL's ``innodb_lock_wait_timeout`` -- it fails closed
    instead, so that purge cycle is skipped and retried next run rather than losing
    data. Either way it is a bounded liveness cost, not data loss.
    """
    table: sa.Table = PurgeAuditLog.__table__
    # Unlocked discovery: the expensive age-unbounded scan runs WITHOUT the
    # coordination lock and only yields a ≤BATCH_SIZE id hint.
    ids: list[Any] = [
        row[0] for row in db.session.execute(select_candidates(BATCH_SIZE))
    ]
    if not ids:
        return 0, 0
    # End the discovery transaction BEFORE taking the lock. Discovery is a
    # read-only SELECT that, on MySQL/InnoDB REPEATABLE READ, fixed this
    # transaction's consistent-read snapshot; the lock's UPDATE does NOT refresh
    # it, so a plain re-check SELECT would keep reading discovery's snapshot and
    # miss a row a concurrent ``write_ahead`` committed in the discovery→lock
    # window — silently deleting a row that should have become a survivor
    # (sc-118200 / the MySQL-RR stale-read class). Rolling back drops that
    # snapshot (discovery wrote nothing) so the re-check opens a FRESH snapshot
    # after the lock is held.
    db.session.rollback()  # pylint: disable=consider-using-transaction
    acquire_coordination_lock(db.session)
    # Locked re-check as a SELECT, then a literal-id DELETE. With the lock held
    # no writer can commit, and the re-check's fresh post-lock snapshot sees
    # current committed state; it re-applies the SAME candidacy predicates
    # scoped to the ≤500 ids, so a row a concurrent write turned into a survivor
    # in the discovery→lock window is filtered out (a stale hint only ever
    # deletes fewer rows, never wrong ones). The re-check is a SELECT — not a
    # correlated WHERE on the DELETE — because MySQL rejects a DELETE whose
    # subquery reads the target table (ERROR 1093), and the candidacy predicates
    # read ``purge_audit_log``; the DELETE then names only the literal surviving
    # ids. Both statements are bounded to ≤500 ids (per-PK + per-entity index
    # probes), so the lock-hold stays short.
    valid_ids: list[Any] = [
        row[0]
        for row in db.session.execute(
            sa.select(table.c.id).where(table.c.id.in_(ids), *recheck_predicates(table))
        )
    ]
    if not valid_ids:
        # Nothing survived the re-check; release the lock without a delete.
        db.session.commit()  # pylint: disable=consider-using-transaction
        return len(ids), 0
    execution_result: Any = db.session.execute(
        sa.delete(table).where(table.c.id.in_(valid_ids))
    )
    db.session.commit()  # pylint: disable=consider-using-transaction
    return len(ids), int(execution_result.rowcount or 0)


def _has_candidates(select_candidates: Callable[[int], sa.sql.Select]) -> bool:
    """Return whether a category still has at least one candidate."""
    return db.session.execute(select_candidates(1)).first() is not None


_CategoryName: TypeAlias = Literal[
    "blocked_duplicates", "operational_expired", "evidence_expired"
]


class _Category(NamedTuple):
    """One delete category: how to discover candidates and how to re-check them.

    ``select_candidates`` is the unlocked discovery select (LIMIT-bounded);
    ``recheck_predicates`` is the SAME candidacy as correlated ``WHERE`` clauses
    for the coordination-locked, id-scoped re-check delete. Both are built from
    one shared predicate list per category, so discovery and the locked gate
    cannot drift.
    """

    name: _CategoryName
    select_candidates: Callable[[int], sa.sql.Select]
    recheck_predicates: Callable[[sa.FromClause], list[sa.ColumnElement[bool]]]


class _DrainResult(NamedTuple):
    """Outcome of draining one pruning category."""

    removed: int
    unused_allowance: int
    drained: bool


def _drain(category: _Category, allowance: int) -> _DrainResult:
    """Delete one category in batches and report its budget outcome.

    Candidates are re-evaluated in each batch rather than paged from one
    snapshot. Each mutation changes the streak picture, so re-evaluation keeps
    a budget-truncated run consistent with the rows still present.

    "Drained" is keyed on how many candidates DISCOVERY found (a short batch
    means the scan reached the end), not on how many the locked re-check
    deleted: an overlapping run that removed some hints first would delete
    <BATCH_SIZE while a real backlog remains, so keying on the delete count
    would report a spurious drain.
    """
    removed: int = 0
    while allowance > 0:
        discovered, batch_removed = _delete_batch(
            category.select_candidates, category.recheck_predicates
        )
        removed += batch_removed
        allowance -= 1
        if discovered < BATCH_SIZE:
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
            partial(_duplicate_predicates, now=now),
        )
    ]
    if operational.days is not None:
        operational_cutoff: datetime = now - timedelta(days=operational.days)
        categories.append(
            _Category(
                "operational_expired",
                partial(_operational_candidates, now, operational_cutoff),
                partial(_operational_predicates, now=now, cutoff=operational_cutoff),
            )
        )
    if evidence.days is not None:
        evidence_cutoff: datetime = now - timedelta(days=evidence.days)
        categories.append(
            _Category(
                "evidence_expired",
                partial(_evidence_candidates, now, evidence_cutoff),
                partial(_evidence_predicates, now=now, cutoff=evidence_cutoff),
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
