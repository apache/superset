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
overridable, ``0`` to disable).

One preservation rule, applied per parent shadow:

* **Live** (``end_transaction_id IS NULL``) — never pruned.

Baseline rows (``operation_type = 0``) and any closed historical row
are subject to the same retention window as everything else. An
entity that hasn't been edited within the window has only its live
row remaining; the historical chain (including the synthetic
baseline) ages out.

If a transaction's parent shadow includes the live row, the whole
transaction is preserved (along with its child shadows and
``version_changes`` rows). Otherwise, all of the transaction's shadow
rows are deleted and the ``version_transaction`` row itself is
dropped — its ``version_changes`` rows cascade via the FK.

Registered via ``CELERYBEAT_SCHEDULE`` in ``superset/config.py``.
Idempotent: a second run prunes nothing.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa
from flask import current_app

from superset.extensions import celery_app, db

logger = logging.getLogger(__name__)


def _resolve_shadow_tables() -> tuple[list[sa.Table], list[sa.Table], sa.Table | None]:
    """Resolve the (parent, child, m2m) shadow Table objects from
    Continuum's mapper registry.

    Returns:
        (parent_tables, child_tables, dashboard_slices_version_table)

    ``dashboard_slices_version`` is M2M-tracked by Continuum and lives
    in metadata under that name (Continuum auto-creates the Table; it
    isn't registered as a versioned class). Returned separately because
    it doesn't follow the parent/child class shape.
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
    parent_tables: list[sa.Table] = []
    for cls in (Dashboard, Slice, SqlaTable):
        try:
            parent_tables.append(version_class(cls).__table__)
        except ClassNotVersioned:
            logger.warning(
                "retention: %s is not versioned; skipping shadow", cls.__name__
            )

    child_tables: list[sa.Table] = []
    for cls in (TableColumn, SqlMetric):
        try:
            child_tables.append(version_class(cls).__table__)
        except ClassNotVersioned:
            logger.warning(
                "retention: %s is not versioned; skipping shadow", cls.__name__
            )

    metadata = parent_tables[0].metadata if parent_tables else None
    m2m_table = (
        metadata.tables.get("dashboard_slices_version")
        if metadata is not None
        else None
    )

    return parent_tables, child_tables, m2m_table


def _candidate_transaction_ids(
    conn: sa.engine.Connection,
    cutoff: datetime,
    parent_tables: list[sa.Table],
) -> list[int]:
    """Find ``version_transaction.id`` values that are eligible to
    prune: ``issued_at < cutoff`` AND not currently the live row of
    any versioned entity.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    tx_table = versioning_manager.transaction_cls.__table__
    candidate_ids = [
        row[0]
        for row in conn.execute(
            sa.select(tx_table.c.id).where(tx_table.c.issued_at < cutoff)
        )
    ]
    if not candidate_ids:
        return []

    # Build the set of transaction ids whose parent shadow includes a
    # live row (``end_transaction_id IS NULL``). Those transactions
    # represent the current state of an entity and must be preserved
    # regardless of age. Chunked over candidate_ids to keep the bind-
    # parameter count inside SQLite's ``SQLITE_MAX_VARIABLE_NUMBER``
    # floor (see ``_TX_ID_CHUNK_SIZE`` below).
    preserved_ids: set[int] = set()
    for ptbl in parent_tables:
        for chunk in _chunked(candidate_ids, _TX_ID_CHUNK_SIZE):
            for row in conn.execute(
                sa.select(ptbl.c.transaction_id)
                .where(ptbl.c.transaction_id.in_(chunk))
                .where(ptbl.c.end_transaction_id.is_(None))
                .distinct()
            ):
                preserved_ids.add(row[0])

    return [tx_id for tx_id in candidate_ids if tx_id not in preserved_ids]


# SQLite's ``SQLITE_MAX_VARIABLE_NUMBER`` defaults to 999 (lifted to
# 32766 in 3.32+ but the older limit can still apply in shipped
# builds). Postgres + MySQL handle tens of thousands of bind params
# without complaint, so the chunk size is dictated by the SQLite floor.
# 500 leaves headroom for the ``transaction_id`` + ``end_transaction_id``
# OR-pair (each ``tx_id`` is bound twice in the DELETE) plus a margin
# for any other bound params in the surrounding statement.
_TX_ID_CHUNK_SIZE = 500


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
    :func:`_candidate_transaction_ids`).

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
            result = conn.execute(
                sa.delete(tbl).where(
                    sa.or_(
                        tbl.c.transaction_id.in_(chunk),
                        tbl.c.end_transaction_id.in_(chunk),
                    )
                )
            )
            total += result.rowcount or 0
    return total


def _chunked(items: list[int], size: int) -> Iterator[list[int]]:
    """Yield *items* in fixed-size lists. Final chunk may be smaller."""
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _prune_old_versions_impl(retention_days: int) -> dict[str, Any]:
    """Pure-Python implementation of the prune. Split out from the
    Celery task wrapper so unit tests can call it directly without the
    Celery harness.

    Returns a stats dict for logging / test assertions.
    """
    if retention_days <= 0:
        logger.info(
            "version_history_retention: SUPERSET_VERSION_HISTORY_RETENTION_DAYS "
            "<= 0; skipping",
        )
        return {"skipped": 1}

    parent_tables, child_tables, m2m_table = _resolve_shadow_tables()
    if not parent_tables:
        logger.warning(
            "version_history_retention: no versioned classes resolved; skipping",
        )
        return {"skipped": 1}

    cutoff = datetime.utcnow() - timedelta(days=retention_days)

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    tx_table = versioning_manager.transaction_cls.__table__

    # The Celery task runs outside the request-bound DB session, so we
    # use a fresh connection rather than ``db.session`` to avoid stepping
    # on web-request state.
    #
    # Isolation level: SERIALIZABLE. The prune is logically a multi-step
    # read-then-write (candidate-vs-preserved SELECTs feeding the shadow
    # DELETEs). At READ COMMITTED there is a TOCTOU window — a save
    # committing between the preserved-ids snapshot and the DELETEs can
    # leave a stale view of which transaction ids are still serving as
    # the live row of some entity, and a shadow row that became live
    # mid-task can be silently dropped. SERIALIZABLE makes the prune
    # atomic against concurrent writers. Postgres surfaces conflicts as
    # ``SerializationFailure``; the outer Celery wrapper logs and
    # returns ``{"error": 1}`` so the next firing retries from a clean
    # slate. SQLite is single-writer so SERIALIZABLE is the only level
    # available; MySQL InnoDB and Postgres both support it natively.
    with (
        db.engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn,
        conn.begin(),
    ):
        tx_ids = _candidate_transaction_ids(conn, cutoff, parent_tables)
        if not tx_ids:
            return {"pruned_transactions": 0, "cutoff": cutoff.isoformat()}

        parent_rows = _delete_for_transactions(conn, parent_tables, tx_ids)
        child_rows = _delete_for_transactions(conn, child_tables, tx_ids)
        m2m_rows = (
            _delete_for_transactions(conn, [m2m_table], tx_ids)
            if m2m_table is not None
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
                    sa.delete(tx_table).where(tx_table.c.id.in_(chunk))
                ).rowcount
                or 0
            )

    stats = {
        "cutoff": cutoff.isoformat(),
        "pruned_transactions": tx_rows,
        "pruned_parent_shadows": parent_rows,
        "pruned_child_shadows": child_rows,
        "pruned_m2m_shadows": m2m_rows,
    }
    logger.info("version_history_retention: %s", stats)
    return stats


@celery_app.task(name="version_history.prune_old_versions")
def prune_old_versions() -> dict[str, Any]:
    """Celery beat task entry point. Wraps the implementation with
    config lookup + broad exception handling so a single failed run
    doesn't poison the schedule (the next firing retries from a clean
    slate).
    """
    retention_days: int = current_app.config.get(
        "SUPERSET_VERSION_HISTORY_RETENTION_DAYS", 30
    )
    try:
        return _prune_old_versions_impl(retention_days)
    except Exception:  # pylint: disable=broad-except
        logger.exception("version_history.prune_old_versions: task failed")
        return {"error": 1}
