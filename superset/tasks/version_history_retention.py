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
"""Celery task: prune old entity-version history.

Retention is time-based. The task deletes parent + child shadow rows
owned by ``version_transaction`` rows whose ``issued_at`` is older
than ``SUPERSET_VERSION_HISTORY_RETENTION_DAYS`` (default 30, env
overridable, non-positive to disable).

One preservation rule, applied across every shadow table (parent,
child, and the M2M association):

* **Live** (``end_transaction_id IS NULL``) — never pruned.

Baseline rows (``operation_type = 0``) and any closed historical row
are subject to the same retention window as everything else. An
entity that hasn't been edited within the window has only its live
row remaining; the historical chain (including the synthetic
baseline) ages out.

If any shadow row anchored at a transaction is live (in a parent,
child, or M2M shadow), the ``version_transaction`` and its
``version_changes`` rows are preserved. Closed shadow rows whose lifecycle
touches a pruned transaction are removed so their foreign keys cannot retain
otherwise-expired history. Every other prunable transaction is dropped, and
its ``version_changes`` rows cascade via the FK.

Registered via ``CeleryConfig.beat_schedule`` in ``superset/config.py``.
Idempotent: a second run prunes nothing.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import sqlalchemy as sa
from flask import current_app
from sqlalchemy.exc import OperationalError

from superset.extensions import celery_app, db, stats_logger_manager

logger: logging.Logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ShadowTables:
    """The four Continuum-managed Table objects the prune walks.

    Bundled here so the prune helper's signature stays at two arguments
    instead of five. The shape is set once at task entry by
    ``_resolve_shadow_tables`` and threaded through the retry loop.
    """

    parent: list[sa.Table]
    child: list[sa.Table]
    m2m: sa.Table | None
    transaction: sa.Table


def _resolve_shadow_tables(tx_table: sa.Table) -> ShadowTables:
    """Resolve the parent / child / m2m shadow Tables from Continuum's
    mapper registry and bundle them with the transaction Table.

    ``dashboard_slices_version`` is M2M-tracked by Continuum and lives
    in metadata under that name (Continuum auto-creates the Table; it
    isn't registered as a versioned class). Carried separately on the
    ``ShadowTables`` dataclass because it doesn't follow the parent /
    child class shape.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class
    from sqlalchemy_continuum.exc import ClassNotVersioned

    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    # ``ClassNotVersioned`` is the only expected failure here — versioning
    # init runs at startup; if it didn't, every class lookup raises this.
    # Narrowing the catch keeps a real underlying failure (e.g. a metadata
    # inconsistency after ``make_versioned``) from being silently swallowed
    # into a no-op retention pass.
    missing_tables: list[str] = []
    parent_tables: list[sa.Table] = []
    for cls in (Dashboard, Slice, SqlaTable):
        try:
            parent_tables.append(version_class(cls).__table__)
        except ClassNotVersioned:
            missing_tables.append(cls.__name__)

    child_tables: list[sa.Table] = []
    for cls in (TableColumn, SqlMetric):
        try:
            child_tables.append(version_class(cls).__table__)
        except ClassNotVersioned:
            missing_tables.append(cls.__name__)

    metadata = parent_tables[0].metadata if parent_tables else None
    m2m_table = (
        metadata.tables.get("dashboard_slices_version")
        if metadata is not None
        else None
    )
    if m2m_table is None:
        missing_tables.append("dashboard_slices_version")

    if missing_tables:
        raise RuntimeError(
            "version-history retention requires every shadow table; missing: "
            + ", ".join(missing_tables)
        )

    return ShadowTables(
        parent=parent_tables,
        child=child_tables,
        m2m=m2m_table,
        transaction=tx_table,
    )


@dataclass(frozen=True)
class _PruneWindow:
    """One id-ordered window of prune candidates.

    ``prunable`` is the subset of the window's candidate transactions
    that are safe to delete. ``candidate_count`` and ``max_candidate_id``
    drive the batch loop in :func:`_prune_old_versions_impl`: the loop
    stops when a window returns fewer than ``_MAX_PRUNE_BATCH``
    candidates, and otherwise advances ``after_id`` to
    ``max_candidate_id`` to fetch the next window.
    """

    prunable: list[int]
    candidate_count: int
    max_candidate_id: int


def _resolve_prune_window(
    conn: sa.engine.Connection,
    cutoff: datetime,
    shadow_tables: list[sa.Table],
    after_id: int,
    batch_size: int,
) -> _PruneWindow:
    """Resolve one id-ordered window of ``version_transaction`` rows
    eligible to prune: ``issued_at < cutoff`` AND ``id > after_id``,
    ordered by ``id`` and capped at *batch_size*. From that window,
    ``prunable`` excludes any transaction still serving as the live row
    (``end_transaction_id IS NULL``) of any versioned entity in *any*
    shadow table — parent, child, or M2M.

    A child (``table_columns_version`` / ``sql_metrics_version``) or the
    M2M association (``dashboard_slices_version``) is versioned on a
    validity lifecycle independent of its parent: after a parent-only
    edit, an unchanged child stays live anchored at an *older*
    transaction than the parent's current live row. That older
    transaction must be preserved too — otherwise
    :func:`_delete_for_transactions` would drop the still-live
    child/association row and silently strip the surviving version of its
    columns / metrics / slices. Scanning every shadow for live rows (not
    just parents) is what prevents that corruption.

    Windowing by ``id`` (rather than materializing the whole backlog)
    keeps per-pass memory and lock/transaction-hold time bounded. Live
    rows older than the cutoff are never deleted but are skipped via the
    ``after_id`` watermark, so the batch loop still terminates.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    tx_table = versioning_manager.transaction_cls.__table__
    # ``ORDER BY id LIMIT`` lets PostgreSQL and MySQL use the primary key for
    # a populated backlog, where expired transactions cluster at the low-id
    # end. The separate ``issued_at`` index added by migration d3b9a1f6c204
    # covers the complementary case: when no rows meet the cutoff, both
    # engines choose it for an empty range scan instead of walking the full
    # primary key. Planner checks with 500,000 rows confirmed that adding the
    # cutoff index does not displace the efficient primary-key backlog plan.
    candidate_ids: list[int] = [
        row[0]
        for row in conn.execute(
            sa.select(tx_table.c.id)
            .where(tx_table.c.issued_at < cutoff)
            .where(tx_table.c.id > after_id)
            .order_by(tx_table.c.id)
            .limit(batch_size)
        )
    ]
    if not candidate_ids:
        return _PruneWindow(prunable=[], candidate_count=0, max_candidate_id=after_id)

    # The select is ordered by ``id`` ascending, so the last element is
    # the watermark for the next window.
    max_candidate_id = candidate_ids[-1]

    # Build the set of transaction ids that still anchor a live row
    # (``end_transaction_id IS NULL``) in some shadow table. Those
    # transactions represent the current state of an entity (or one of
    # its children / associations) and must be preserved regardless of
    # age. Chunked over the candidates to keep the bind-parameter count
    # inside SQLite's ``SQLITE_MAX_VARIABLE_NUMBER`` floor (see
    # ``_TX_ID_CHUNK_SIZE`` below). Ids already confirmed live by an
    # earlier table are skipped before probing the next one.
    preserved_ids: set[int] = set()
    for stbl in shadow_tables:
        remaining = [tx_id for tx_id in candidate_ids if tx_id not in preserved_ids]
        if not remaining:
            break
        for chunk in _chunked(remaining, _TX_ID_CHUNK_SIZE):
            for row in conn.execute(
                sa.select(stbl.c.transaction_id)
                .where(stbl.c.transaction_id.in_(chunk))
                .where(stbl.c.end_transaction_id.is_(None))
                .distinct()
            ):
                preserved_ids.add(row[0])

    prunable = [tx_id for tx_id in candidate_ids if tx_id not in preserved_ids]
    return _PruneWindow(
        prunable=prunable,
        candidate_count=len(candidate_ids),
        max_candidate_id=max_candidate_id,
    )


# SQLite's ``SQLITE_MAX_VARIABLE_NUMBER`` defaults to 999 (lifted to
# 32766 in 3.32+ but the older limit can still apply in shipped
# builds). Postgres + MySQL handle tens of thousands of bind params
# without complaint, so the chunk size is dictated by the SQLite floor.
# 500 keeps each single-column DELETE / SELECT (see ``_delete_for_transactions``,
# which splits the create/close predicates into two statements) well inside
# that floor, with margin for any other bound params in the surrounding
# statement.
_TX_ID_CHUNK_SIZE: int = 500

# Maximum ``version_transaction`` rows resolved + pruned per SERIALIZABLE
# pass. The prune loops over id-ordered windows of this size (see
# ``_prune_old_versions_impl``) so memory and lock/transaction-hold time
# stay bounded per pass instead of scaling with the full backlog on the
# first run after deploy.
_MAX_PRUNE_BATCH: int = 1000


def _delete_for_transactions(
    conn: sa.engine.Connection,
    tables: list[sa.Table],
    tx_ids: list[int],
) -> int:
    """Delete shadow rows in *tables* whose lifespan touches a pruned
    transaction — either ``transaction_id`` (created at) or
    ``end_transaction_id`` (closed at) is in *tx_ids*. Returns total
    rowcount across all tables.

    The ``end_transaction_id`` predicate is required to keep referential
    integrity when transactions span multiple entities. A flush that
    saves dashboard + slice + dataset at the same ``tx=X`` produces
    three shadow rows sharing that tx. If only the dashboard is later
    edited at ``tx=Y``, the dashboard row at ``tx=X`` is closed
    (``end_tx=Y``) while the slice/dataset rows stay live at
    ``tx=X``. Retention preserves ``tx=X`` (slice/dataset are live
    there) and prunes ``tx=Y``. Without the ``end_tx`` predicate, the
    dashboard's closed row at ``tx=X`` survives step 1 — its
    ``end_transaction_id=Y`` then violates the FK when step 2 deletes
    ``version_transaction`` row ``Y``.

    Live rows are never matched by either predicate
    (``end_transaction_id IS NULL`` is not ``IN`` anything; live rows'
    ``transaction_id`` is preserved by construction in
    :func:`_resolve_prune_window`).

    ``tx_ids`` is chunked into batches of ``_TX_ID_CHUNK_SIZE`` so the
    bind-parameter count stays inside SQLite's ``SQLITE_MAX_VARIABLE_
    NUMBER`` limit. Postgres and MySQL would happily accept the full
    list, but the floor is dialect-agnostic since the retention task is
    the only path that accumulates open-ended id batches.
    """
    if not tx_ids:
        return 0
    total = 0
    for tbl in tables:
        for chunk in _chunked(tx_ids, _TX_ID_CHUNK_SIZE):
            # Two single-column DELETEs rather than one ``OR`` of both
            # columns. The OR form binds every id twice (once for
            # ``transaction_id``, once for ``end_transaction_id``), so a
            # full chunk would bind ``2 * _TX_ID_CHUNK_SIZE`` params and
            # overflow SQLite's ``SQLITE_MAX_VARIABLE_NUMBER`` floor. Each
            # single-column statement binds at most ``_TX_ID_CHUNK_SIZE``.
            # A row whose create- and close-tx are both pruned is removed
            # by the first matching DELETE; the second finds nothing, so
            # there is no double count.
            for col in (tbl.c.transaction_id, tbl.c.end_transaction_id):
                result = conn.execute(sa.delete(tbl).where(col.in_(chunk)))
                total += result.rowcount or 0
    return total


def _chunked(items: list[int], size: int) -> Iterator[list[int]]:
    """Yield *items* in fixed-size lists. Final chunk may be smaller."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


#: Maximum number of attempts the prune will make before giving up.
#: A daily Celery beat schedule means the next chance is 24h out, so
#: a small inline retry materially improves the recovery time for the
#: serialization-conflict path.
_MAX_RETRY_ATTEMPTS: int = 3

#: Base for exponential backoff between retries (seconds). Worst-case
#: extra latency with the 3-attempt cap above and the factor below is
#: ``BASE + BASE * FACTOR`` = ~0.5s — well inside the prune's own
#: typical runtime.
_RETRY_BACKOFF_BASE_SECONDS: float = 0.1

#: Exponential-backoff multiplier between successive retry attempts.
#: Backoff for attempt N is ``BASE * (FACTOR ** (N - 1))``.
_RETRY_BACKOFF_FACTOR: int = 4

#: Statsd metric prefix for retention emissions. Mirrors the activity-view
#: orchestrator's ``superset.activity_view.*`` namespace so a single
#: Grafana filter (``superset.versioning.*``) catches both sides of the
#: feature. The pruned-count gauge fires every run; the skipped counter
#: fires for the "retention disabled" and "no versioned classes" cases;
#: the retried counter fires when the SERIALIZABLE block tripped at
#: least one conflict before settling.
_METRIC_PREFIX: str = "superset.versioning.retention"


def _run_prune_pass(
    cutoff: datetime, tables: ShadowTables, after_id: int = 0
) -> dict[str, Any]:
    """One SERIALIZABLE pass over a single id-ordered window of candidate
    transactions starting after ``after_id``. The caller wraps this in
    the retry loop (serialization conflict → fresh connection from a
    clean snapshot) and the batch loop (advance ``after_id`` until the
    backlog drains). The returned ``candidate_count`` / ``max_candidate_id``
    drive that batch loop."""
    # Scan every shadow (parent + child + M2M) for live rows, not just
    # parents: children and the M2M association live on independent
    # validity lifecycles and may anchor a still-live row at an older
    # transaction than the parent's current live row.
    live_bearing_tables: list[sa.Table] = [*tables.parent, *tables.child]
    if tables.m2m is not None:
        live_bearing_tables.append(tables.m2m)

    # The Celery task runs outside the request-bound DB session, so we
    # use a fresh connection rather than ``db.session`` to avoid stepping
    # on web-request state.
    with (
        db.engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn,
        conn.begin(),
    ):
        window = _resolve_prune_window(
            conn, cutoff, live_bearing_tables, after_id, _MAX_PRUNE_BATCH
        )
        tx_ids = window.prunable

        parent_rows = _delete_for_transactions(conn, tables.parent, tx_ids)
        child_rows = _delete_for_transactions(conn, tables.child, tx_ids)
        m2m_rows = (
            _delete_for_transactions(conn, [tables.m2m], tx_ids)
            if tables.m2m is not None
            else 0
        )

        # Drop the version_transaction rows themselves. ON DELETE
        # CASCADE on version_changes.transaction_id removes the
        # associated change records automatically. Same SQLite bind-
        # parameter chunking applies as the shadow deletes above.
        tx_rows = 0
        for chunk in _chunked(tx_ids, _TX_ID_CHUNK_SIZE):
            tx_rows += (
                conn.execute(
                    sa.delete(tables.transaction).where(
                        tables.transaction.c.id.in_(chunk)
                    )
                ).rowcount
                or 0
            )

    return {
        "cutoff": cutoff.isoformat(),
        "candidate_count": window.candidate_count,
        "max_candidate_id": window.max_candidate_id,
        "pruned_transactions": tx_rows,
        "pruned_parent_shadows": parent_rows,
        "pruned_child_shadows": child_rows,
        "pruned_m2m_shadows": m2m_rows,
    }


def _run_pass_with_retry(
    cutoff: datetime, tables: ShadowTables, after_id: int
) -> tuple[dict[str, Any], int]:
    """Run one window pass, retrying on serialization conflict. Returns
    ``(stats, retries_used)``; re-raises the ``OperationalError`` if all
    ``_MAX_RETRY_ATTEMPTS`` attempts conflict.

    Postgres surfaces conflicts as ``SerializationFailure`` (a subclass
    of ``sqlalchemy.exc.OperationalError``). The catch is deliberately the
    broader ``OperationalError`` — it also covers transient faults such as
    SQLite's "database is locked" and dropped connections, all of which are
    safe to retry because each pass is idempotent and runs in its own fresh
    transaction. Without the inline retry a single conflict pushes the next
    attempt 24h out (daily Celery beat), so under sustained write pressure
    the prune could silently fail for days in a row.
    """
    for attempt in range(1, _MAX_RETRY_ATTEMPTS + 1):
        try:
            return _run_prune_pass(cutoff, tables, after_id), attempt - 1
        except OperationalError as exc:
            stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.retried")
            if attempt == _MAX_RETRY_ATTEMPTS:
                logger.warning(
                    "version_history_retention: gave up after %d attempts: %s",
                    _MAX_RETRY_ATTEMPTS,
                    exc,
                )
                raise
            backoff = _RETRY_BACKOFF_BASE_SECONDS * (
                _RETRY_BACKOFF_FACTOR ** (attempt - 1)
            )
            logger.info(
                "version_history_retention: attempt %d hit %s; retrying in %.2fs",
                attempt,
                type(exc).__name__,
                backoff,
            )
            time.sleep(backoff)
    raise AssertionError("unreachable")  # pragma: no cover


def _prune_old_versions_impl(retention_days: int) -> dict[str, Any]:
    """Pure-Python implementation of the prune. Split out from the
    Celery task wrapper so unit tests can call it directly without the
    Celery harness.

    Returns a stats dict for logging / test assertions.

    Isolation level: SERIALIZABLE. The prune is logically a multi-step
    read-then-write (candidate-vs-preserved SELECTs feeding the shadow
    DELETEs). At READ COMMITTED there is a TOCTOU window — a save
    committing between the preserved-ids snapshot and the DELETEs can
    leave a stale view of which transaction ids are still serving as
    the live row of some entity, and a shadow row that became live
    mid-task can be silently dropped. SERIALIZABLE makes the prune
    atomic against concurrent writers. SQLite is single-writer so
    SERIALIZABLE is the only level available; MySQL InnoDB and Postgres
    both support it natively.

    Postgres surfaces conflicts as ``SerializationFailure`` (a subclass
    of ``sqlalchemy.exc.OperationalError``). The prune retries up to
    ``_MAX_RETRY_ATTEMPTS`` with exponential backoff before giving up
    and letting the outer Celery wrapper log + return ``{"error": 1}``.
    Without the inline retry, a single conflict pushes the next attempt
    24 hours out (daily Celery beat), and under sustained write
    pressure the prune can silently fail for many days in a row.
    """
    if retention_days <= 0:
        logger.info(
            "version_history_retention: SUPERSET_VERSION_HISTORY_RETENTION_DAYS "
            "<= 0; skipping",
        )
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.skipped")
        return {"skipped": 1}

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    tables = _resolve_shadow_tables(versioning_manager.transaction_cls.__table__)
    # Naive-UTC to match ``version_transaction.issued_at`` (Continuum stores
    # it tz-naive via ``utc_now()``); ``datetime.utcnow()`` is deprecated on
    # 3.12+, so derive the same value from the tz-aware clock and drop tzinfo.
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=retention_days
    )

    # Drain the backlog one bounded, id-ordered window at a time. Each
    # window is its own retried SERIALIZABLE pass, so memory and
    # lock/transaction-hold time stay bounded per pass even on the first
    # run after deploy. The loop stops once a window returns fewer than a
    # full batch of candidates (nothing left older than the cutoff).
    totals: dict[str, int] = {
        "pruned_transactions": 0,
        "pruned_parent_shadows": 0,
        "pruned_child_shadows": 0,
        "pruned_m2m_shadows": 0,
    }
    total_retried = 0
    after_id = 0
    while True:
        pass_stats, retries = _run_pass_with_retry(cutoff, tables, after_id)
        total_retried += retries
        for key in totals:
            totals[key] += pass_stats.get(key, 0)
        if pass_stats.get("candidate_count", 0) < _MAX_PRUNE_BATCH:
            break
        after_id = pass_stats.get("max_candidate_id", after_id)

    stats: dict[str, Any] = {"cutoff": cutoff.isoformat(), **totals}
    if total_retried:
        stats["retried"] = total_retried
    stats_logger_manager.instance.gauge(
        f"{_METRIC_PREFIX}.pruned_transactions", stats["pruned_transactions"]
    )
    logger.info("version_history_retention: %s", stats)
    return stats


@celery_app.task(name="version_history.prune_old_versions")
def prune_old_versions() -> dict[str, Any]:
    """Celery beat task entry point. Wraps the implementation with
    config lookup + broad exception handling so a single failed run
    doesn't poison the schedule (the next firing retries from a clean
    slate).
    """
    try:
        retention_days = int(
            current_app.config.get("SUPERSET_VERSION_HISTORY_RETENTION_DAYS", 30)
        )
        return _prune_old_versions_impl(retention_days)
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_history.prune_old_versions: task failed")
        # Emit a failure counter so a prune that fails every night (e.g. an
        # exhausted-retry serialization storm, or a non-OperationalError
        # fault) is alertable via statsd rather than only via log inspection —
        # this is the destructive job's primary failure mode.
        stats_logger_manager.instance.incr(f"{_METRIC_PREFIX}.failed")
        return {"error": 1}
