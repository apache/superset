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
"""DB-touching helpers for the activity-view read path.

All Phase A relationship walks (``charts_attached_to_dashboard``,
``datasets_used_by_chart``, ``batch_datasets_used_by_charts``),
the Phase B change-record fetch (``fetch_change_records`` /
``_select_change_rows_for_kinds``), the name-denormalization helpers
(``_resolve_names_for_kind`` / ``apply_entity_name_denormalization``), the
path-entity resolution helper (``resolve_path_entity``), and the
tombstone-state lookup (``check_entity_tombstones``) live here.

Each helper is a thin SELECT-and-shape function — no orchestration,
no business logic. Callers in :mod:`scope`, :mod:`render`, and
:mod:`orchestrator` compose them into the end-to-end request.

**Inline imports.** Continuum's ``version_class`` / ``versioning_manager``
and the Superset model classes are imported inside each helper because
this package is loaded from ``init_versioning()`` before all SQLAlchemy
mappers are configured.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask_appbuilder import Model

from superset.extensions import db
from superset.versioning.activity.kinds import (
    API_KIND_TO_TABLE,
    chunked_ids,
    EntityWindows,
    load_live_model,
    NAME_COLUMN,
    NOT_FOUND_EXC,
    TABLE_KIND_TO_API,
    Window,
)
from superset.versioning.activity.windows import row_within_any_window
from superset.versioning.changes import version_changes_table

logger = logging.getLogger(__name__)

# ---- Path-entity resolution -----------------------------------------------


def resolve_path_entity(model_cls: type[Model], entity_uuid: UUID) -> tuple[Any, int]:
    """Resolve *entity_uuid* to ``(live_entity, entity_id)`` or raise a
    typed 404.

    Soft-delete handling is inherited transparently from
    :func:`superset.versioning.queries.find_active_by_uuid` once it
    learns to filter out ``deleted_at IS NOT NULL`` rows; at that point
    soft-deleted paths will also raise here.
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.queries import find_active_by_uuid

    entity = find_active_by_uuid(model_cls, entity_uuid)
    if entity is None:
        api_kind = model_cls.__name__
        exc_cls = NOT_FOUND_EXC.get(api_kind)
        if exc_cls is None:
            raise LookupError(
                f"Activity view does not support model class {api_kind!r}"
            )
        raise exc_cls(str(entity_uuid))
    return entity, entity.id


def first_tracked_tx(
    model_cls: type[Model], entity_id: int, entity_uuid: UUID
) -> int | None:
    """Return the earliest Continuum transaction_id of the shadow rows
    that belong to *this* live entity, matched on ``(id, uuid)``; ``None``
    when the entity has no tracked history yet.

    Used to lower-bound the self-scope window. Matching on the integer
    ``id`` alone would inherit a previously hard-deleted entity's history
    under id reuse (SQLite/MySQL reuse ``max(id)+1``); pinning the uuid
    too — the same discrimination :func:`mark_first_tracked_saves` uses —
    scopes the window to the current entity's own transactions.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    shadow_tbl = version_class(model_cls).__table__
    stmt = sa.select(sa.func.min(shadow_tbl.c.transaction_id)).where(
        shadow_tbl.c.id == entity_id,
        shadow_tbl.c.uuid == entity_uuid,
    )
    return db.session.connection().execute(stmt).scalar()


# ---- Phase A: relationship-traversal queries ------------------------------


def charts_attached_to_dashboard(dashboard_id: int) -> list[tuple[int, Window]]:
    """Return ``(slice_id, window)`` for every chart that has ever been on
    *dashboard_id*, with each association's validity window in
    transaction-id space.

    Reads from ``dashboard_slices_version`` (Continuum's auto-generated
    M2M shadow). Rows with ``operation_type = 2`` (DELETE) are excluded
    so we don't synthesize a phantom window from a detachment row.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.dashboard import Dashboard

    metadata = version_class(Dashboard).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")
    if m2m_tbl is None:
        return []

    rows = (
        db.session.connection()
        .execute(
            sa.select(
                m2m_tbl.c.slice_id,
                m2m_tbl.c.transaction_id,
                m2m_tbl.c.end_transaction_id,
            ).where(
                m2m_tbl.c.dashboard_id == dashboard_id,
                m2m_tbl.c.operation_type != 2,
                m2m_tbl.c.slice_id.is_not(None),
            )
        )
        .all()
    )
    result: list[tuple[int, Window]] = []
    for row in rows:
        try:
            window = Window(row[1], row[2])
        except ValueError:
            # A degenerate shadow row (end_tx <= start_tx) must not 500 the
            # endpoint; skip it and leave a breadcrumb for investigation.
            logger.warning(
                "activity: skipping degenerate dashboard_slices_version row "
                "(dashboard_id=%s, slice_id=%s, tx=%s, end_tx=%s)",
                dashboard_id,
                row[0],
                row[1],
                row[2],
            )
            continue
        result.append((row[0], window))
    return result


def datasets_used_by_chart(slice_id: int) -> list[tuple[int, Window]]:
    """Return ``(datasource_id, window)`` for every dataset that *slice_id*
    has ever pointed at, with each association's validity window.

    Single-slice form, used by ``_resolve_chart_scope`` where there
    is only one chart to walk. The dashboard-scope path calls
    :func:`batch_datasets_used_by_charts` instead so the query fires
    once for all slices on the dashboard, not once per slice.

    Reads from ``slices_version`` (the chart parent shadow). Filters to
    ``datasource_type = 'table'`` because the activity view only follows
    the chart → ``SqlaTable`` dependency edge (not legacy/other
    datasources). Rows with ``operation_type = 2`` are excluded.
    """
    return batch_datasets_used_by_charts({slice_id}).get(slice_id, [])


def batch_datasets_used_by_charts(
    slice_ids: set[int],
) -> dict[int, list[tuple[int, Window]]]:
    """Batch form of :func:`datasets_used_by_chart`. Returns
    ``{slice_id: [(dataset_id, window), ...]}`` in a single query so the
    dashboard-scope walker doesn't fire one query per chart on the
    dashboard. The previous per-slice shape became O(n_charts) round-
    trips, which dominated ``get_activity`` latency on dashboards with
    rich history (profile run 2026-05-26 showed `resolve_scope`
    accounting for ~1.9s out of 4s p95).
    """
    if not slice_ids:
        return {}

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    slices_tbl = version_class(Slice).__table__
    grouped: dict[int, list[tuple[int, Window]]] = {}
    # Chunk the IN-clause under SQLite's bind-variable floor (a dashboard can
    # carry more charts than the floor allows in one statement).
    rows: list[Any] = []
    for chunk in chunked_ids(slice_ids):
        rows.extend(
            db.session.connection()
            .execute(
                sa.select(
                    slices_tbl.c.id,
                    slices_tbl.c.datasource_id,
                    slices_tbl.c.transaction_id,
                    slices_tbl.c.end_transaction_id,
                ).where(
                    slices_tbl.c.id.in_(chunk),
                    slices_tbl.c.datasource_type == "table",
                    slices_tbl.c.operation_type != 2,
                    slices_tbl.c.datasource_id.is_not(None),
                )
            )
            .mappings()
            .all()
        )
    for row in rows:
        try:
            window = Window(row["transaction_id"], row["end_transaction_id"])
        except ValueError:
            # A degenerate shadow row (end_tx <= start_tx) must not 500 the
            # endpoint; skip it and leave a breadcrumb for investigation.
            logger.warning(
                "activity: skipping degenerate slices_version row "
                "(slice_id=%s, datasource_id=%s, tx=%s, end_tx=%s)",
                row["id"],
                row["datasource_id"],
                row["transaction_id"],
                row["end_transaction_id"],
            )
            continue
        grouped.setdefault(row["id"], []).append((row["datasource_id"], window))
    return grouped


# ---- Phase B: change-record fetch -----------------------------------------


def fetch_change_records(
    entity_window_tuples: list[EntityWindows],
    since: datetime | None,
    until: datetime | None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch all ``version_changes`` rows matching any of the supplied
    entity-window tuples, joined with ``version_transaction`` for
    ``issued_at`` and ``user_id``.

    Each tuple is ``(api_kind, entity_id, [(start_tx, end_tx), ...])``;
    a record matches when ``entity_kind`` equals the table-stored form
    of *api_kind*, ``entity_id`` matches, and ``transaction_id`` falls
    inside at least one of the entity's windows. ``since``/``until``
    further restrict by ``issued_at``.

    Implementation: one SELECT per kind with ``entity_id IN (...)`` and
    a wide ``transaction_id`` bound (the union of all windows for that
    kind). Per-window precision is applied in Python afterward. This
    keeps the SQL shape proportional to the number of *kinds* (≤3) and
    the bound proportional to the union of windows, not the cross-
    product of (entity, window) — which previously generated one OR
    clause per (entity, window) pair and hit SQLite's
    ``SQLITE_MAX_EXPR_DEPTH`` limit on dashboards with many slices
    or many historical attachment windows.

    The visibility filter runs after this function (records
    the requester can't read are silently dropped and must not
    contribute to ``count``), so the orchestrator paginates in Python
    over the filtered list — there is no DB-level page ``OFFSET`` here.
    There IS a per-kind safety ceiling (``_MAX_FETCHED_RECORDS``) that
    bounds how much history a single request materializes (to at most
    ``n_kinds * _MAX_FETCHED_RECORDS``); when a kind exhausts it, the
    second return value is ``True``, the returned stream is clamped to a
    clean time cut (records older than the highest per-kind fetch floor
    are dropped so truncation is a time boundary, not per-kind holes), and
    the caller surfaces ``truncated`` on the response.

    Returns ``(records, truncated)``. Records are ordered by
    ``(issued_at DESC, transaction_id DESC, sequence DESC)`` — the
    secondary keys break ties for the stable-ordering contract.
    """
    if not entity_window_tuples:
        return [], False

    # Group windows by (table_kind, entity_id) and by table_kind for SQL
    # narrowing. The fetch is per-kind; the post-filter is per-entity.
    windows_by_entity: dict[tuple[str, int], list[Window]] = {}
    ids_by_kind: dict[str, set[int]] = {}
    for api_kind, entity_id, windows in entity_window_tuples:
        table_kind = API_KIND_TO_TABLE.get(api_kind)
        if table_kind is None or not windows:
            continue
        ids_by_kind.setdefault(table_kind, set()).add(entity_id)
        windows_by_entity.setdefault((table_kind, entity_id), []).extend(windows)

    if not ids_by_kind:
        return [], False

    # Per-kind transaction_id bounds = the union of that kind's windows.
    # Pushing these into the SQL WHERE ensures the per-statement LIMIT
    # selects from IN-WINDOW rows. Without it, a related entity whose
    # association window is far in the past would have the newest ``limit``
    # (out-of-window) rows fetched and discarded, silently dropping its
    # in-window records that lie beyond the limit. ``end_tx = None``
    # (open-ended/current) means no upper bound for that kind.
    bounds_by_kind: dict[str, tuple[int, int | None]] = {}
    for (table_kind, _entity_id), windows in windows_by_entity.items():
        for w in windows:
            cur = bounds_by_kind.get(table_kind)
            if cur is None:
                bounds_by_kind[table_kind] = (w.start_tx, w.end_tx)
                continue
            lo = min(cur[0], w.start_tx)
            hi = None if (cur[1] is None or w.end_tx is None) else max(cur[1], w.end_tx)
            bounds_by_kind[table_kind] = (lo, hi)

    rows, truncated, truncation_floor = _select_change_rows_for_kinds(
        ids_by_kind, bounds_by_kind, since, until, _MAX_FETCHED_RECORDS
    )
    filtered = [
        row
        for row in rows
        if row_within_any_window(
            row, windows_by_entity.get((row["entity_kind"], row["entity_id"]), [])
        )
    ]
    if truncated and truncation_floor is not None:
        # Collapse truncation to a clean time cut. Below the highest per-kind
        # fetch floor at least one kind is missing rows, so surfacing the
        # other kinds there would present an incomplete ("nothing else
        # changed") picture. Drop everything older than the floor so
        # ``truncated=True`` means "complete at/after this instant, nothing
        # shown before it" — a time boundary rather than per-kind holes.
        filtered = [r for r in filtered if r["issued_at"] >= truncation_floor]
    # Sort key must be TOTAL so pagination is stable across requests: two
    # records from different entities can share (issued_at, transaction_id,
    # sequence), so append (entity_kind, entity_id) to break remaining ties
    # deterministically. Without these the relative order of tied records
    # depends on set-iteration order and a record could shift pages.
    filtered.sort(
        key=lambda r: (
            r["issued_at"],
            r["transaction_id"],
            r["sequence"],
            r["entity_kind"],
            r["entity_id"],
        ),
        reverse=True,
    )
    return filtered, truncated


def _select_change_rows_for_kinds(
    ids_by_kind: dict[str, set[int]],
    bounds_by_kind: dict[str, tuple[int, int | None]],
    since: datetime | None,
    until: datetime | None,
    limit: int,
) -> tuple[list[dict[str, Any]], bool, datetime | None]:
    """Fire one SELECT per entity_kind with ``entity_id IN (...)``;
    concatenate the results. Each SELECT joins ``version_transaction``
    + ``ab_user`` so the orchestrator has the columns it needs for
    decoration.

    Per-kind, not one query: SQLAlchemy's ``tuple_(entity_kind,
    entity_id).in_(...)`` would collapse the three queries into one,
    but its SQL emission is not portable across Postgres, MySQL, and
    SQLite. The per-kind shape is the correct trade-off given
    Superset's multi-dialect requirement (at most 3 round-trips per
    request, bounded by the kind taxonomy). Do not "optimise" into a
    composite-tuple IN clause without verifying the SQL on all three
    dialects.

    **Init-order dependency.** ``tx_tbl.c.action_kind`` resolves only
    after ``init_versioning()`` has run — the column is appended onto
    Continuum's transaction Table by
    ``superset.versioning.factory.VersionTransactionFactory`` at app
    start via ``append_column`` + ``add_property``. This helper is
    safe to call from request-path code because the app is fully
    initialised by then; calling it from a script that imports the
    versioning package without going through ``init_versioning()``
    will raise ``AttributeError`` on the ``action_kind`` attribute
    access below."""
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    from superset import security_manager

    tx_tbl = versioning_manager.transaction_cls.__table__
    user_tbl = security_manager.user_model.__table__
    vc = version_changes_table
    join_tree = vc.join(tx_tbl, vc.c.transaction_id == tx_tbl.c.id).outerjoin(
        user_tbl, tx_tbl.c.user_id == user_tbl.c.id
    )
    select_cols = (
        vc.c.transaction_id,
        vc.c.entity_kind,
        vc.c.entity_id,
        vc.c.sequence,
        vc.c.kind,
        vc.c.operation,
        vc.c.path,
        vc.c.from_value,
        vc.c.to_value,
        tx_tbl.c.issued_at,
        tx_tbl.c.user_id,
        # ``action_kind`` is the high-level avenue (restore / import /
        # clone / NULL=ordinary save) stamped by the originating
        # command via the change-record listener. All records sharing a
        # ``transaction_id`` share the same value. The column is
        # declared on the Continuum Table by ``VersionTransactionFactory``,
        # so ``tx_tbl.c.action_kind`` resolves cleanly here. See
        # the three change-record dimensions.
        tx_tbl.c.action_kind,
        user_tbl.c.id.label("changed_by_id"),
        user_tbl.c.first_name,
        user_tbl.c.last_name,
    )

    out: list[dict[str, Any]] = []
    truncated = False
    truncation_floors: list[datetime] = []
    for table_kind, entity_ids in ids_by_kind.items():
        # The fetch budget is per KIND, not per id-chunk. A kind whose
        # entity_ids span several bind-variable chunks shares one ``limit``
        # across those chunks, so the rows a single request materializes are
        # bounded by ``n_kinds * limit`` (<= 3 * _MAX_FETCHED_RECORDS), not
        # ``n_chunks * limit``. ``entity_ids`` is chunked to stay inside
        # SQLite's ``SQLITE_MAX_VARIABLE_NUMBER`` floor (default 999 in many
        # builds); Postgres + MySQL accept the full list but the chunk is
        # dialect-agnostic for simplicity.
        kind_rows: list[dict[str, Any]] = []
        for chunk in chunked_ids(entity_ids):
            remaining = limit - len(kind_rows)
            if remaining <= 0:
                break
            stmt = (
                sa.select(*select_cols)
                .select_from(join_tree)
                .where(
                    vc.c.entity_kind == table_kind,
                    vc.c.entity_id.in_(chunk),
                )
            )
            # Bound by the kind's window union so the LIMIT picks in-window
            # rows (see fetch_change_records). The per-entity window filter
            # still runs in Python afterwards for exact membership.
            tx_lo, tx_hi = bounds_by_kind[table_kind]
            stmt = stmt.where(vc.c.transaction_id >= tx_lo)
            if tx_hi is not None:
                stmt = stmt.where(vc.c.transaction_id < tx_hi)
            if since is not None:
                stmt = stmt.where(tx_tbl.c.issued_at >= since)
            if until is not None:
                stmt = stmt.where(tx_tbl.c.issued_at < until)
            # Match fetch_change_records' final Python sort key order
            # (issued_at, transaction_id, sequence, entity_id) so the
            # per-kind budget keeps exactly the rows the final sort ranks
            # highest. entity_kind is constant within a per-kind statement.
            stmt = stmt.order_by(
                tx_tbl.c.issued_at.desc(),
                vc.c.transaction_id.desc(),
                vc.c.sequence.desc(),
                vc.c.entity_id.desc(),
            ).limit(remaining)
            kind_rows.extend(
                dict(row)
                for row in db.session.connection().execute(stmt).mappings().all()
            )
        if len(kind_rows) >= limit:
            # This kind exhausted its budget; older rows almost certainly
            # exist beyond it. Record the oldest ``issued_at`` fetched for
            # the kind so the caller can collapse truncation into a single
            # clean time cut across all kinds (see fetch_change_records).
            truncated = True
            truncation_floors.append(min(r["issued_at"] for r in kind_rows))
        out.extend(kind_rows)
    truncation_floor = max(truncation_floors) if truncation_floors else None
    return out, truncated, truncation_floor


# Per-KIND safety ceiling on how many change rows a single activity request
# will materialize for one entity kind (shared across that kind's id-chunks).
# Bounds memory/CPU for a path entity with very long history or many related
# entities to <= n_kinds * _MAX_FETCHED_RECORDS per request. When a kind
# exhausts its budget the response is flagged ``truncated`` and the returned
# stream is clamped to a clean time cut so clients see a complete window with
# older records omitted, not per-kind holes.
_MAX_FETCHED_RECORDS = 5000


def mark_first_tracked_saves(records: list[dict[str, Any]]) -> None:
    """Set ``first_tracked_save`` on each record in place: ``True`` when
    the record's transaction is the entity's FIRST UPDATE (op=1) in its
    shadow table.

    The first save of an entity that predates versioning replays every
    params-normalization delta against the retroactive baseline — a
    legacy chart's first Explore save produced ~74 records in one
    transaction (version-history UI feedback). The server
    can't distinguish "normalization" from "the user changed 74 things",
    but it CAN say "this was the entity's first tracked save"; clients
    use the marker to collapse such transactions.

    One ``GROUP BY`` query per kind (≤3), chunked like the record fetch.
    Shadow rows are matched on ``(id, uuid)`` against the live row — a
    bare ``id`` match would inherit a previously hard-deleted entity's
    history under id reuse (SQLite/MySQL reuse ``max(id)+1``) and mark
    the wrong transaction. Consequence: hard-deleted entities (no live
    row) and NULL-uuid shadow rows never get a ``True`` marker — their
    records always carry ``first_tracked_save=False``. Mutates *records*
    in place — same contract as the other decoration passes in
    :mod:`superset.versioning.activity.render`.
    """
    if not records:
        return
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    ids_by_kind: dict[str, set[int]] = {}
    for r in records:
        ids_by_kind.setdefault(r["entity_kind"], set()).add(r["entity_id"])

    first_tx_by_entity: dict[tuple[str, int], int] = {}
    for table_kind, entity_ids in ids_by_kind.items():
        model_name = TABLE_KIND_TO_API.get(table_kind)
        if model_name is None:
            continue
        live_model = load_live_model(model_name)
        live_tbl = live_model.__table__
        shadow_tbl = version_class(live_model).__table__
        for chunk in chunked_ids(entity_ids):
            stmt = (
                sa.select(
                    shadow_tbl.c.id,
                    sa.func.min(shadow_tbl.c.transaction_id),
                )
                .select_from(
                    shadow_tbl.join(
                        live_tbl,
                        sa.and_(
                            shadow_tbl.c.id == live_tbl.c.id,
                            shadow_tbl.c.uuid == live_tbl.c.uuid,
                        ),
                    )
                )
                .where(
                    shadow_tbl.c.operation_type == 1,
                    shadow_tbl.c.id.in_(chunk),
                )
                .group_by(shadow_tbl.c.id)
            )
            for entity_id, min_tx in db.session.connection().execute(stmt):
                first_tx_by_entity[(table_kind, entity_id)] = min_tx

    for r in records:
        r["first_tracked_save"] = (
            first_tx_by_entity.get((r["entity_kind"], r["entity_id"]))
            == r["transaction_id"]
        )


# ---- Name denormalization -------------------------------------------------


def _resolve_names_for_kind(
    api_kind: str, pairs: set[tuple[int, int]]
) -> dict[tuple[int, int], str]:
    """For one entity kind, return ``{(entity_id, target_tx): name}`` from
    the shadow row valid at *target_tx* (validity-strategy predicate).
    Empty mapping when the kind has no name column registered.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    if api_kind not in NAME_COLUMN or not pairs:
        return {}

    model_name, name_col = NAME_COLUMN[api_kind]
    model_cls = load_live_model(model_name)
    shadow_tbl = version_class(model_cls).__table__
    ids = {eid for eid, _ in pairs}
    # Bound the scan to the transaction range the page-set actually needs.
    # A row valid at some target_tx must start at/before the newest target
    # and stay open past the oldest one, so rows outside
    # ``[min_target_tx, max_target_tx]`` can never win the validity match.
    # Without this bound the query loads every historical version row of
    # every referenced entity — an entity with thousands of versions would
    # defeat the memory ceiling the change-record fetch enforces.
    target_txs = {target_tx for _, target_tx in pairs}
    min_tx, max_tx = min(target_txs), max(target_txs)
    per_entity: dict[int, list[tuple[int, int | None, Any]]] = {}
    # Chunk the IN-clause to stay under SQLite's bind-variable floor (the
    # same reason _select_change_rows_for_kinds chunks).
    for chunk in chunked_ids(ids):
        rows = (
            db.session.connection()
            .execute(
                sa.select(
                    shadow_tbl.c.id,
                    shadow_tbl.c.transaction_id,
                    shadow_tbl.c.end_transaction_id,
                    shadow_tbl.c[name_col],
                ).where(
                    shadow_tbl.c.id.in_(chunk),
                    shadow_tbl.c.transaction_id <= max_tx,
                    sa.or_(
                        shadow_tbl.c.end_transaction_id.is_(None),
                        shadow_tbl.c.end_transaction_id > min_tx,
                    ),
                )
            )
            .all()
        )
        for row in rows:
            per_entity.setdefault(row[0], []).append((row[1], row[2], row[3]))

    resolved: dict[tuple[int, int], str] = {}
    for entity_id, target_tx in pairs:
        for start_tx, end_tx, name in per_entity.get(entity_id, []):
            if start_tx <= target_tx and (end_tx is None or end_tx > target_tx):
                # Coerce a NULL name (e.g. a DELETE shadow row winning the
                # validity match) to "" so entity_name is never None.
                resolved[(entity_id, target_tx)] = name if name is not None else ""
                break
    return resolved


def apply_entity_name_denormalization(records: list[dict[str, Any]]) -> None:
    """Resolve each record's ``entity_name`` from the shadow row valid at
    its ``transaction_id``. Adds an ``entity_name`` key to every record
    in place; returns ``None``.

    The lookup is per (table-stored ``entity_kind``, ``entity_id``,
    ``transaction_id``) triple. One ``IN``-clause query per kind keeps
    round-trips bounded by the number of distinct kinds (≤3) regardless
    of result-set size. The in-place mutation avoids re-allocating
    thousands of dicts on hot dashboards; the name + return signature
    make the side effect explicit instead of pretending to be a pure
    projection.
    """
    if not records:
        return

    needed_by_kind: dict[str, set[tuple[int, int]]] = {}
    for record in records:
        api_kind = TABLE_KIND_TO_API.get(record["entity_kind"])
        if api_kind is None or api_kind not in NAME_COLUMN:
            continue
        needed_by_kind.setdefault(api_kind, set()).add(
            (record["entity_id"], record["transaction_id"])
        )

    resolved: dict[tuple[str, int, int], str] = {}
    for api_kind, pairs in needed_by_kind.items():
        for (entity_id, target_tx), name in _resolve_names_for_kind(
            api_kind, pairs
        ).items():
            resolved[(api_kind, entity_id, target_tx)] = name

    for record in records:
        api_kind_for_record = TABLE_KIND_TO_API.get(record["entity_kind"], "")
        key = (api_kind_for_record, record["entity_id"], record["transaction_id"])
        record["entity_name"] = resolved.get(key, "")


# ---- Live-row existence + soft-delete state -------------------------------


def check_entity_tombstones(
    distinct_entities: set[tuple[str, int]],
) -> dict[tuple[str, int], dict[str, Any]]:
    """For each ``(api_kind, entity_id)``, report ``deleted`` (no live
    row) and ``deletion_state`` (``"soft_deleted"`` iff the live row has
    a non-null ``deleted_at``, else ``None``).

    The ``deleted_at`` column is probed for at runtime: when the model
    classes don't have one, entities are reported as never soft-deleted
    (``deletion_state=None``); when a ``deleted_at`` column exists, this
    helper picks it up automatically.
    """
    result: dict[tuple[str, int], dict[str, Any]] = {}
    if not distinct_entities:
        return result

    by_kind: dict[str, list[int]] = {}
    for api_kind, entity_id in distinct_entities:
        by_kind.setdefault(api_kind, []).append(entity_id)

    # ``no_autoflush`` mirrors the defensive posture of the listener-
    # side reads. Today's callers run from request-path code with no
    # pending writes; a future caller that probes tombstones before a
    # flush would otherwise trigger autoflush mid-read.
    with db.session.no_autoflush:
        for api_kind, entity_ids in by_kind.items():
            for entity_id, state in _tombstone_states_for_kind(
                api_kind, entity_ids
            ).items():
                result[(api_kind, entity_id)] = state
    return result


_TOMBSTONE = {"deleted": True, "deletion_state": None}


def _tombstone_states_for_kind(
    api_kind: str, entity_ids: list[int]
) -> dict[int, dict[str, Any]]:
    """Resolve ``{entity_id: {deleted, deletion_state}}`` for one kind.

    Kinds outside the change-record taxonomy report as tombstoned. For a
    known kind, an id with no live row is tombstoned; a live row with a
    non-null ``deleted_at`` (when the column exists) is ``soft_deleted``.
    """
    if api_kind not in NAME_COLUMN:
        return {entity_id: dict(_TOMBSTONE) for entity_id in entity_ids}

    model_cls = load_live_model(NAME_COLUMN[api_kind][0])
    live_tbl = model_cls.__table__
    has_deleted_at = "deleted_at" in live_tbl.c
    cols = [live_tbl.c.id] + ([live_tbl.c.deleted_at] if has_deleted_at else [])

    live: dict[int, Any] = {}
    # Chunk the IN-clause to stay under SQLite's bind-variable floor.
    for chunk in chunked_ids(entity_ids):
        for row in (
            db.session.connection()
            .execute(sa.select(*cols).where(live_tbl.c.id.in_(chunk)))
            .all()
        ):
            live[row[0]] = row[1] if has_deleted_at else None

    states: dict[int, dict[str, Any]] = {}
    for entity_id in entity_ids:
        if entity_id not in live:
            states[entity_id] = dict(_TOMBSTONE)
        else:
            states[entity_id] = {
                "deleted": False,
                "deletion_state": "soft_deleted" if live[entity_id] else None,
            }
    return states
