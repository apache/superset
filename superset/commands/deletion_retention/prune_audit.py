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
literal surviving ids. On window-capable servers the repeat check computes
timestamp groups for the batch's entities in uncorrelated window tables.
Older or unknown MySQL-family versions use correlated predecessor probes;
the other guards also use correlated probes. Lock-hold depends on the plan
and the batch's entity histories,
not a fixed time bound, which the batch-size setting trades against drain speed.

Audit creation/recovery and every pruning batch's DELETE take the same
singleton database write lock. It serializes creation and recovery, not in-place
finalization: pending-aware candidacy guards protect against that concurrent change.
The expensive candidate discovery runs before the lock, so it does not
extend the lock-hold. Automatic pruning still ships disabled by default so
operators explicitly choose their retention policy.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Literal, NamedTuple, Protocol, TypeAlias

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

#: Candidate ids per batch when ``PURGE_AUDIT_PRUNING_BATCH_SIZE`` is unset.
#: The coordination lock is held for the whole locked re-check of a batch, and
#: that re-check's cost scales with candidates × the candidate entities'
#: history depth, so the batch size is the operator's lever on writer wait
#: (see config.py for the capacity and compatibility limits).
BATCH_SIZE: int = 50
#: The window path uses at most seven positional binds per candidate (id plus
#: two scope lists repeated in three derived tables), plus fewer than 50 scalar
#: binds.
#: A 100-row ceiling keeps both rechecks below SQLite's historical 999-variable
#: limit without changing the window-query plan. Custom SQLite limits
#: below 750 require a smaller configured batch.
MAX_BATCH_SIZE: int = 100
BATCH_SIZE_KEY: str = "PURGE_AUDIT_PRUNING_BATCH_SIZE"
#: Sentinel distinguishing an absent config key from an explicit ``None``.
_ABSENT: object = object()
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


class ResolvedBatchSize(NamedTuple):
    """The validated batch size, or ``None`` with the offending key."""

    size: int | None
    invalid_key: str | None = None


def resolve_batch_size() -> ResolvedBatchSize:
    """The per-batch candidate cap, or a disabled run when invalid.

    An ABSENT key falls back to :data:`BATCH_SIZE` silently (the key is
    optional). A PRESENT value — including an explicit ``None`` — must be a
    non-boolean ``int`` in ``[1, MAX_BATCH_SIZE]``; nothing is coerced, so a
    numeric string, a float, or a ``Decimal`` is refused rather than
    converted: bools and floats are config mistakes on a knob that governs
    deletion, zero or negative would make no progress, and larger than the
    cap risks the parameter budget. Fail-closed like the retention keys — but
    since the batch size governs every category, an invalid value skips the
    whole run rather than one category.
    """
    value: Any = current_app.config.get(BATCH_SIZE_KEY, _ABSENT)
    if value is _ABSENT:
        return ResolvedBatchSize(BATCH_SIZE)
    if (
        isinstance(value, int)
        and not isinstance(value, bool)
        and 1 <= value <= MAX_BATCH_SIZE
    ):
        return ResolvedBatchSize(value)
    logger.warning(
        "prune_audit: invalid %s=%r (expected an integer in [1, %d]); skipping "
        "the run (pruning never widens on bad configuration)",
        BATCH_SIZE_KEY,
        value,
        MAX_BATCH_SIZE,
    )
    return ResolvedBatchSize(None, BATCH_SIZE_KEY)


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


def _repeat_path() -> Literal["legacy", "window"]:
    """Select a query using initialized, vendor-normalized server capabilities."""
    dialect: sa.engine.Dialect = db.session.get_bind().dialect
    if dialect.name not in {"mysql", "mariadb", "sqlite"}:
        return "window"
    if dialect.server_version_info is None:
        dialect = db.session.connection().dialect
    version: tuple[int, ...] | None = dialect.server_version_info
    if dialect.name == "sqlite":
        return "window" if version is not None and version >= (3, 25) else "legacy"
    if getattr(dialect, "is_mariadb", False):
        version = getattr(dialect, "_mariadb_normalized_version_info", None)
        return "window" if version is not None and version >= (10, 2) else "legacy"
    return "window" if version is not None and version >= (8, 0) else "legacy"


def _repeats_an_earlier_block(
    table: sa.FromClause,
    now: datetime,
    scope_entities: Sequence[tuple[str, str | None]] | None = None,
) -> sa.ColumnElement[bool]:
    """Select the repeat query supported by the metadata server.

    MySQL before 8.0, MariaDB before 10.2 and SQLite before 3.25 need the
    correlated query.
    Unknown server versions use that conservative path. The dialect's
    server version is initialized on connection, not inferred from its name.
    Discovery initializes it before the coordination-locked re-check.
    """
    if _repeat_path() == "legacy":
        # Correlated probes already use candidate identity; literal scope lists
        # only optimize the window path. The locked re-check bounds candidates
        # by ID; unlocked discovery still scans eligible history.
        return _legacy_repeats_an_earlier_block(table, now)
    return _window_repeats_an_earlier_block(table, now, scope_entities)


def _legacy_repeats_an_earlier_block(
    table: sa.FromClause,
    now: datetime,
) -> sa.ColumnElement[bool]:
    """Use predecessor probes for older or unknown MySQL-family/SQLite versions.

    This compatibility path retains correlated probes rather than the window
    optimization; its cost depends on each candidate's entity history.
    """
    earlier: sa.FromClause = table.alias("earlier_block")
    between: sa.FromClause = table.alias("reason_change")
    reason_changed_between: sa.ColumnElement[bool] = sa.exists(
        sa.select(sa.literal(1))
        .select_from(between)
        .where(
            between.c.status == STATUS_BLOCKED,
            between.c.entity_type == table.c.entity_type,
            between.c.entity_uuid == table.c.entity_uuid,
            between.c.created_on >= earlier.c.created_on,
            between.c.created_on <= table.c.created_on,
            between.c.reason.is_distinct_from(table.c.reason),
        )
        .correlate(table, earlier)
    )
    repeats: sa.ColumnElement[bool] = sa.exists(
        sa.select(sa.literal(1))
        .select_from(earlier)
        .where(
            earlier.c.status == STATUS_BLOCKED,
            earlier.c.entity_type == table.c.entity_type,
            earlier.c.entity_uuid == table.c.entity_uuid,
            _in_current_streak(earlier, now),
            earlier.c.created_on < table.c.created_on,
            earlier.c.reason.is_not_distinct_from(table.c.reason),
            sa.not_(reason_changed_between),
        )
        .correlate(table)
    )
    # These candidate gates also exist at call sites. Keep them here so the
    # legacy and window predicates agree in isolation, including under NOT.
    return sa.and_(
        table.c.status == STATUS_BLOCKED,
        table.c.entity_uuid.is_not(None),
        table.c.created_on <= now,
        table.c.trigger != TRIGGER_FORCE,
        repeats,
    )


def _window_repeats_an_earlier_block(
    table: sa.FromClause,
    now: datetime,
    scope_entities: Sequence[tuple[str, str | None]] | None = None,
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

    P is the immediately preceding distinct blocked timestamp. A row repeats
    only when P is in the current streak and both timestamp groups contain
    solely its reason (including all-NULL groups). LAG over timestamp groups
    supplies P and its reason counts without a group self-join. The sc-120493
    PostgreSQL round-1 plan materialized a groups CTE and joined on entity
    alone before filtering ranks, comparing 36 million row pairs.

    All five ``LAG`` columns share one SQL-level named ``WINDOW w`` (a raw
    text fragment: SQLAlchemy Core has no construct for a named ``WINDOW``
    clause) instead of five separate ``LAG(...) OVER (...)`` expressions that
    happen to repeat the same partition/order spec. PostgreSQL already
    recognizes five identical inline window specs as one logical pass, but
    MySQL 8 does not merge them — each materializes its own temporary table,
    roughly five sequential passes over the batch's timestamp groups. A named
    window is the SQL-level way to say "this is the same window" so MySQL
    evaluates it once; PostgreSQL and SQLite (>= 3.25) accept the same syntax
    unchanged. Only servers routed here run this clause: the MySQL<8,
    MariaDB<10.2 and SQLite<3.25 fallback in
    :func:`_legacy_repeats_an_earlier_block` never reaches it.

    An equality join back to a *second* instance of the timestamp-groups
    derived table (fetching P's aggregates via
    ``(entity_type, entity_uuid, ts = prev_ts)`` instead of four more ``LAG``
    columns) was measured and rejected here: PostgreSQL's planner
    misestimates the derived table's row count for a single-entity batch scope
    and chooses a Nested Loop over an unindexed ``Materialize`` of the second
    instance — an O(batch × history) comparison, the same failure shape as
    the sc-120493 round-1 CTE/entity-only-merge regression, just via a
    different join path. The named-``WINDOW`` shape keeps the exact join
    structure already measured safe on PostgreSQL (sc-120493): only the
    ``LAG`` columns' SQL text changes.

    Keep the repeat-id query uncorrelated: the sc-120493 Variant 2
    measurements showed MySQL repeatedly executing
    per-row predecessor scalars. During re-check, scope blocked rows, timestamp
    groups and boundaries with literal entity-type and UUID lists from the
    unlocked discovery. Their cross-product may include extra entity histories,
    but candidacy remains restricted to the discovered ids and checked in SQL.
    """
    source: sa.Table = PurgeAuditLog.__table__
    scope: list[sa.ColumnElement[bool]] = []
    if scope_entities is not None:
        types: list[str] = sorted({t for t, _ in scope_entities})
        uuids: list[str] = sorted({u for _, u in scope_entities if u is not None})
        scope = [source.c.entity_type.in_(types), source.c.entity_uuid.in_(uuids)]
    blocked_filters: list[sa.ColumnElement[bool]] = [
        source.c.status == STATUS_BLOCKED,
        source.c.entity_uuid.is_not(None),
        source.c.created_on <= now,
    ]
    blocked: sa.Subquery = (
        sa.select(
            source.c.id,
            source.c.entity_type,
            source.c.entity_uuid,
            source.c.created_on,
            source.c.reason,
            source.c.trigger,
        )
        .select_from(source)
        .where(*blocked_filters, *scope)
        .correlate(None)
        .subquery("blocked_rows")
    )
    groups_name: str = "blocked_timestamp_groups"
    groups: sa.Subquery = (
        sa.select(
            source.c.entity_type,
            source.c.entity_uuid,
            source.c.created_on.label("ts"),
            sa.func.count().label("n"),
            sa.func.count(source.c.reason).label("n_coded"),
            sa.func.min(source.c.reason).label("min_reason"),
            sa.func.max(source.c.reason).label("max_reason"),
        )
        .select_from(source)
        .where(*blocked_filters, *scope)
        .group_by(source.c.entity_type, source.c.entity_uuid, source.c.created_on)
        .correlate(None)
        .subquery(groups_name)
    )
    # A raw-text named WINDOW clause: the one construct SQLAlchemy Core
    # cannot emit. ``groups_name`` is the literal alias every LAG column
    # below must qualify with, so the FROM clause and the WINDOW clause
    # stay on the same alias; the column names, however, are hardcoded in
    # both places and must be kept in step by hand.
    window_body: str = (
        f"{groups_name}.entity_type, {groups_name}.entity_uuid "
        f"ORDER BY {groups_name}.ts"
    )
    grp: sa.Subquery = (
        sa.select(
            groups,
            *[
                # Raw text carries no type, so copy the grouped column's own
                # type across. Without it every prev_* lands as NullType and a
                # later comparison against a Python value would bind it with no
                # type processor. Types never reach the emitted SQL, which stays
                # byte-identical on PostgreSQL, MySQL and SQLite.
                sa.literal_column(
                    f"lag({groups_name}.{name}) OVER w", type_=groups.c[name].type
                ).label(f"prev_{name}")
                for name in ("ts", "n", "n_coded", "min_reason", "max_reason")
            ],
        )
        .select_from(groups)
        # Suffixes trail every other clause, so never add ORDER BY/LIMIT to
        # this select: they would be emitted before WINDOW and fail to parse.
        # Aliasing this select (``aliased()``/``.alias()``, or any ORM
        # adaption over ``grp``) rewrites the FROM but not the raw column
        # text or this suffix, so both would keep naming the old alias.
        .suffix_with(f"WINDOW w AS (PARTITION BY {window_body})")
        .correlate(None)
        .subquery("preceding_groups")
    )
    boundary: sa.Subquery = (
        sa.select(
            source.c.entity_type,
            source.c.entity_uuid,
            sa.func.max(source.c.created_on).label("boundary_ts"),
        )
        .select_from(source)
        .where(
            source.c.status.in_(_STREAK_BREAKING_STATUSES),
            source.c.entity_uuid.is_not(None),
            source.c.created_on <= now,
            *scope,
        )
        .group_by(source.c.entity_type, source.c.entity_uuid)
        .correlate(None)
        .subquery("repeat_boundary")
    )

    def uniform(
        n: sa.ColumnElement[Any],
        n_coded: sa.ColumnElement[Any],
        lo: sa.ColumnElement[Any],
        hi: sa.ColumnElement[Any],
    ) -> sa.ColumnElement[bool]:
        """Require all NULL reasons or one shared non-NULL reason."""
        return sa.or_(n_coded == 0, sa.and_(n_coded == n, lo == hi))

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
    not_force: sa.ColumnElement[bool] = blocked.c.trigger != TRIGGER_FORCE
    repeat_ids: sa.sql.Select = (
        sa.select(blocked.c.id)
        .select_from(
            blocked.join(
                grp,
                sa.and_(
                    grp.c.entity_type == blocked.c.entity_type,
                    grp.c.entity_uuid == blocked.c.entity_uuid,
                    grp.c.ts == blocked.c.created_on,
                ),
            ).outerjoin(
                boundary,
                sa.and_(
                    boundary.c.entity_type == blocked.c.entity_type,
                    boundary.c.entity_uuid == blocked.c.entity_uuid,
                ),
            )
        )
        .where(
            not_force,
            grp.c.prev_ts.is_not(None),
            sa.or_(
                boundary.c.boundary_ts.is_(None), grp.c.prev_ts > boundary.c.boundary_ts
            ),
            # Inclusive bounds: a differing-reason block sharing an
            # exact timestamp with either endpoint still breaks the run,
            # so a reason-transition row tied with a neighbour is
            # preserved as a run head rather than pruned as a repeat
            # (the same preserving-side tie rule the pending and evidence
            # guards use). Inclusive bounds only ever add boundaries —
            # i.e. only ever preserve more, never delete more.
            uniform(grp.c.n, grp.c.n_coded, grp.c.min_reason, grp.c.max_reason),
            uniform(
                grp.c.prev_n,
                grp.c.prev_n_coded,
                grp.c.prev_min_reason,
                grp.c.prev_max_reason,
            ),
            grp.c.prev_min_reason.is_not_distinct_from(blocked.c.reason),
        )
        .correlate(None)
    )
    return table.c.id.in_(repeat_ids)


def _preceded_by_unresolved_attempt(table: sa.FromClause) -> sa.ColumnElement[bool]:
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
        sa.select(table.c.id, table.c.entity_type, table.c.entity_uuid)
        .where(*_duplicate_predicates(table, now))
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _duplicate_predicates(
    table: sa.FromClause,
    now: datetime,
    scope_entities: Sequence[tuple[str, str | None]] | None = None,
) -> list[sa.ColumnElement[bool]]:
    """The candidacy predicates for the blocked-duplicate category.

    One list, used by BOTH the unlocked discovery select
    (:func:`_duplicate_candidates`) and the coordination-locked re-check
    delete (:func:`_delete_batch`), so the two can never drift — the locked
    delete re-verifies exactly what discovery selected. The window repeat check
    is an uncorrelated IN over histories scoped by literal entity-type and UUID
    lists; the legacy repeat, boundary and pending checks use correlated probes.
    """
    return [
        table.c.status == STATUS_BLOCKED,
        table.c.entity_uuid.is_not(None),
        table.c.created_on <= now,
        _in_current_streak(table, now),
        _repeats_an_earlier_block(table, now, scope_entities=scope_entities),
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
        sa.select(table.c.id, table.c.entity_type, table.c.entity_uuid)
        .where(*_operational_predicates(table, now, cutoff))
        # Oldest first, so a budget-truncated run makes progress on the
        # rows closest to expiry. (Blocked rows never outlive the boundary
        # that resolved them, but that is enforced by the boundary guard in
        # _evidence_candidates, not by this ordering.)
        .order_by(table.c.created_on)
        .limit(limit)
    )


def _operational_predicates(
    table: sa.FromClause,
    now: datetime,
    cutoff: datetime,
    scope_entities: Sequence[tuple[str, str | None]] | None = None,
) -> list[sa.ColumnElement[bool]]:
    """The candidacy predicates for the operational-expiry category.

    One list, shared by the unlocked discovery select
    (:func:`_operational_candidates`) and the coordination-locked re-check
    delete, so the two cannot drift. Window repeats use an uncorrelated IN scoped
    by the batch's literal entity-type and UUID lists; legacy repeats and other
    guards retain correlated probes.
    """
    is_survivor: sa.ColumnElement[bool] = sa.and_(
        _in_current_streak(table, now),
        sa.not_(_repeats_an_earlier_block(table, now, scope_entities=scope_entities)),
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
    table: sa.FromClause,
    now: datetime,
    cutoff: datetime,
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


class _RecheckPredicates(Protocol):
    """A locked candidacy check with an optional history-query optimization."""

    def __call__(
        self,
        table: sa.FromClause,
        *,
        scope_entities: Sequence[tuple[str, str | None]] | None = None,
    ) -> list[sa.ColumnElement[bool]]:
        """Build the same candidacy predicates used for discovery."""
        ...


@dataclass(frozen=True)
class _DuplicateRecheck:
    """Bind the duplicate clock without erasing the callable's signature."""

    now: datetime

    def __call__(
        self,
        table: sa.FromClause,
        *,
        scope_entities: Sequence[tuple[str, str | None]] | None = None,
    ) -> list[sa.ColumnElement[bool]]:
        """Delegate to discovery's predicate with type-checked arguments."""
        return _duplicate_predicates(table, self.now, scope_entities=scope_entities)


@dataclass(frozen=True)
class _OperationalRecheck:
    """Bind the operational window while retaining argument checking."""

    now: datetime
    cutoff: datetime

    def __call__(
        self,
        table: sa.FromClause,
        *,
        scope_entities: Sequence[tuple[str, str | None]] | None = None,
    ) -> list[sa.ColumnElement[bool]]:
        """Delegate to discovery's predicate with type-checked arguments."""
        return _operational_predicates(
            table, self.now, self.cutoff, scope_entities=scope_entities
        )


@dataclass(frozen=True)
class _EvidenceRecheck:
    """Adapt the scope-independent evidence predicate to the shared seam."""

    now: datetime
    cutoff: datetime

    def __call__(
        self,
        table: sa.FromClause,
        *,
        scope_entities: Sequence[tuple[str, str | None]] | None = None,
    ) -> list[sa.ColumnElement[bool]]:
        """Ignore history scope: evidence uses correlated boundary probes."""
        return _evidence_predicates(table, self.now, self.cutoff)


def _delete_batch(
    select_candidates: Callable[[int], sa.sql.Select],
    recheck_predicates: _RecheckPredicates,
    batch_size: int = BATCH_SIZE,
    *,
    needs_entity_scope: bool = True,
) -> tuple[int, int]:
    """Discover a candidate batch UNLOCKED, then delete it under the lock.

    Returns ``(discovered, removed)``: how many candidate ids discovery found
    (≤``BATCH_SIZE``) and how many the locked re-check actually deleted. The
    caller keys "drained" on *discovered*, not *removed*, so an overlapping run
    that thinned the hints cannot be misread as a fully-drained backlog.

    Discovery (the age-unbounded scan with repeat-group window tables and
    correlated boundary/pending guards) runs WITHOUT the coordination lock and only
    yields ≤``BATCH_SIZE`` candidate ids — a hint. The lock is then taken for a
    re-check SELECT that re-applies the SAME candidacy predicates scoped to
    those ids, followed by a literal-id DELETE of the survivors. The re-check
    is a SELECT (not a correlated ``WHERE`` on the DELETE) because MySQL rejects
    a DELETE whose subquery reads the target table (ERROR 1093), and the
    candidacy predicates read ``purge_audit_log``; the DELETE then names only
    the literal surviving-id list. Both statements are scoped to the batch's
    ids, with repeat groups scoped by literal entity-type and UUID lists read
    during unlocked discovery. Its cost
    depends on batch size, history depth and the optimizer's access plan;
    entity scoping does not guarantee index seeks or a lock-hold time bound
    (sc-120493). When discovery finds nothing, no lock is taken at all.

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
    # coordination lock and only yields a ≤batch_size id hint.
    hints: list[Any] = list(db.session.execute(select_candidates(batch_size)))
    ids: list[Any] = [row[0] for row in hints]
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
    # Scoping only: entity_type/entity_uuid are immutable facts about the hint
    # ids, not a candidacy decision. Carry discovery's pairs across the lock.
    # Concurrent deletions can widen this scope, never exclude a live candidate;
    # the fresh locked SQL re-check still verifies every candidacy predicate.
    # Literal values expose column statistics to the planner; a scope subquery
    # or JOIN caused severe cardinality underestimates and nested loops
    # (sc-120493). Pairs are bounded by len(ids) <= MAX_BATCH_SIZE.
    scope_entities: list[tuple[str, str | None]] | None = None
    if needs_entity_scope:
        scope_entities = list(dict.fromkeys((row[1], row[2]) for row in hints))
    db.session.rollback()  # pylint: disable=consider-using-transaction
    acquire_coordination_lock(db.session)
    # Locked re-check as a SELECT, then a literal-id DELETE. With the lock held
    # no creation/recovery writer can commit; in-place finalization is guarded
    # by the unresolved-attempt predicates. The fresh post-lock snapshot sees
    # current committed state; it re-applies the SAME candidacy predicates
    # scoped to the batch's ids, so a row a concurrent write turned into a survivor
    # in the discovery→lock window is filtered out (a stale hint only ever
    # deletes fewer rows, never wrong ones). The re-check is a SELECT — not a
    # correlated WHERE on the DELETE — because MySQL rejects a DELETE whose
    # subquery reads the target table (ERROR 1093), and the candidacy predicates
    # read ``purge_audit_log``; the DELETE then names only the literal surviving
    # ids. Both statements are bounded to the batch's ids; the lock-hold also
    # depends on the scoped histories and the optimizer's access plan.
    valid_ids: list[Any] = [
        row[0]
        for row in db.session.execute(
            sa.select(table.c.id).where(
                table.c.id.in_(ids),
                *recheck_predicates(table, scope_entities=scope_entities),
            )
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
    ``recheck_predicates`` accepts discovered entity pairs as scope_entities when
    ``needs_entity_scope`` is true, and supplies the SAME candidacy
    for the coordination-locked, id-scoped re-check delete. Both are built from
    one shared predicate list per category, so discovery and the locked gate
    cannot drift.
    """

    name: _CategoryName
    select_candidates: Callable[[int], sa.sql.Select]
    recheck_predicates: _RecheckPredicates
    needs_entity_scope: bool = True


class _DrainResult(NamedTuple):
    """Outcome of draining one pruning category."""

    removed: int
    unused_allowance: int
    drained: bool


def _drain(
    category: _Category, allowance: int, batch_size: int = BATCH_SIZE
) -> _DrainResult:
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
            category.select_candidates,
            category.recheck_predicates,
            batch_size,
            needs_entity_scope=category.needs_entity_scope,
        )
        logger.info(
            "prune_audit: category=%s discovered=%s removed=%s",
            category.name,
            discovered,
            batch_removed,
        )
        removed += batch_removed
        allowance -= 1
        if discovered < batch_size:
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

    batch: ResolvedBatchSize = resolve_batch_size()
    if batch.size is None:
        # The batch size governs every category: with no valid cap there is no
        # bounded batch to run, so the whole run fails closed and reports why.
        result.invalid_config_keys = [BATCH_SIZE_KEY]
        return result

    operational: ResolvedWindow = resolve_operational_retention_days()
    logger.info("prune_audit: repeat_path=%s", _repeat_path())
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
            _DuplicateRecheck(now),
        )
    ]
    if operational.days is not None:
        operational_cutoff: datetime = now - timedelta(days=operational.days)
        categories.append(
            _Category(
                "operational_expired",
                partial(_operational_candidates, now, operational_cutoff),
                _OperationalRecheck(now, operational_cutoff),
            )
        )
    if evidence.days is not None:
        evidence_cutoff: datetime = now - timedelta(days=evidence.days)
        categories.append(
            _Category(
                "evidence_expired",
                partial(_evidence_candidates, now, evidence_cutoff),
                _EvidenceRecheck(now, evidence_cutoff),
                needs_entity_scope=False,
            )
        )

    for index, category in enumerate(categories):
        # Reserve one batch for each category still to come, but never spend
        # past the run's budget — the floor exists to prevent starvation, not
        # to license overrun if the budget is ever set below the category
        # count.
        reserved: int = len(categories) - index - 1
        allowance: int = max(1, budget - reserved) if budget > 0 else 0
        drain_result: _DrainResult = _drain(category, allowance, batch.size)
        budget -= allowance - drain_result.unused_allowance
        _record_removed(result, category.name, drain_result.removed)
        result.carried_over = result.carried_over or not drain_result.drained

    return result


__all__: list[str] = [
    "BATCH_SIZE",
    "BATCH_SIZE_KEY",
    "EVIDENCE_RETENTION_KEY",
    "MAX_BATCH_SIZE",
    "MAX_BATCHES_PER_RUN",
    "OPERATIONAL_RETENTION_KEY",
    "OPERATIONAL_STATUSES",
    "PROTECTED_STATUSES",
    "PruneRunResult",
    "ResolvedBatchSize",
    "ResolvedWindow",
    "resolve_evidence_retention_days",
    "resolve_batch_size",
    "resolve_operational_retention_days",
    "run_prune",
]
