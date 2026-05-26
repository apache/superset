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
"""Read-side queries for the cross-entity activity-view API (sc-107283).

Companion to :mod:`superset.versioning.queries`. Whereas ``queries.py``
returns transaction-level history for a single entity, the helpers here
unify change-record history across an entity's transitive dependency
chain — a dashboard's activity stream includes edits to charts that
were attached to it AND edits to datasets those charts pointed at,
each time-bounded by when the relationship was active.

One public entry point — ``get_activity(model_cls, entity_uuid, ...)`` —
dispatches on the first argument to serve all three endpoint families:

* ``get_activity(Dashboard, dashboard_uuid, ...)`` — own edits + charts
  attached during their dashboard window + datasets those charts used
  during their chart window.
* ``get_activity(Slice, chart_uuid, ...)`` — own edits + datasets the
  chart pointed at during association.
* ``get_activity(SqlaTable, dataset_uuid, ...)`` — own edits only.
  Datasets are not transitive recipients of activity in V2.

Built on top of sc-103156's shadow tables:

* ``dashboards_version`` / ``slices_version`` / ``tables_version`` —
  per-entity scalar shadows.
* ``dashboard_slices_version`` — M2M shadow capturing chart-on-dashboard
  validity windows.
* ``version_changes`` — atomic per-field change records keyed by
  ``(transaction_id, entity_kind, entity_id)``.
* ``version_transaction`` — per-commit metadata (``issued_at``, ``user_id``).

The relationship-traversal logic and time-window intersection live here;
sc-103156's read primitives (``find_active_by_uuid``,
``derive_version_uuid``, ``_resolve_version_tables``) are reused as-is.

See the spec at ``specs/sc-107283-versioning-activity-view/spec.md``
(AV-001..AV-020) and the plan's decision log (D-01..D-19) for the
design rationale.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import sqlalchemy as sa

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.extensions import db
from superset.versioning.changes import (
    _ENTITY_KIND_BY_CLASS_NAME,
    version_changes_table,
)

logger = logging.getLogger(__name__)


# ---- Kind translation -----------------------------------------------------

# ``version_changes.entity_kind`` stores the friendly downstream-tooling
# value (``"chart"``, ``"dashboard"``, ``"dataset"``) per sc-103156's
# ``_ENTITY_KIND_BY_CLASS_NAME``. The activity-view DTO returns the
# Python class name instead (``"Slice"``, ``"Dashboard"``,
# ``"SqlaTable"``) so the contract aligns with ``__class__.__name__``
# (data-model.md §"``ActivityRecord`` DTO"). Translate at the boundary.
_TABLE_KIND_TO_API: dict[str, str] = {
    table_kind: class_name
    for class_name, table_kind in _ENTITY_KIND_BY_CLASS_NAME.items()
}
_API_KIND_TO_TABLE: dict[str, str] = dict(_ENTITY_KIND_BY_CLASS_NAME)

# Human-readable label for AV-012 summary headlines
# ("Dataset updated: Sales Transactions"). Keyed by the API kind.
_API_KIND_LABEL: dict[str, str] = {
    "Dashboard": "Dashboard",
    "Slice": "Chart",
    "SqlaTable": "Dataset",
}

# 404 exception class per API kind. Each accepts a string positional arg
# (the path-entity UUID) that gets formatted into the exception message.
_NOT_FOUND_EXC: dict[str, type[Exception]] = {
    "Dashboard": DashboardNotFoundError,
    "Slice": ChartNotFoundError,
    "SqlaTable": DatasetNotFoundError,
}


# ---- Types ----------------------------------------------------------------

#: A validity window in Continuum transaction-id space, half-open as
#: ``[start_tx, end_tx)``. ``end_tx = None`` means "open ended (current)".
Window = tuple[int, Optional[int]]

#: A related-entity scope row: ``(api_kind, entity_id, [windows])``.
#: ``api_kind`` is the DTO-facing kind (``"Slice"``, etc.), not the
#: table-stored kind.
EntityWindows = tuple[str, int, list[Window]]


# ---- T004: Path-entity resolution -----------------------------------------


def _resolve_path_entity(model_cls: type, entity_uuid: UUID) -> tuple[Any, int]:
    """Resolve *entity_uuid* to ``(live_entity, entity_id)`` or raise a
    typed 404 per AV-009.

    Soft-delete handling (sc-103157) is inherited transparently from
    :func:`superset.versioning.queries.find_active_by_uuid` once it
    learns to filter out ``deleted_at IS NOT NULL`` rows; at that point
    soft-deleted paths will also raise here.
    """
    # pylint: disable=import-outside-toplevel
    from superset.versioning.queries import find_active_by_uuid

    entity = find_active_by_uuid(model_cls, entity_uuid)
    if entity is None:
        api_kind = model_cls.__name__
        exc_cls = _NOT_FOUND_EXC.get(api_kind)
        if exc_cls is None:
            raise LookupError(
                f"Activity view does not support model class {api_kind!r}"
            )
        raise exc_cls(str(entity_uuid))
    return entity, entity.id


# ---- T005 / T006: Phase A relationship-traversal queries ------------------


def _charts_attached_to_dashboard(dashboard_id: int) -> list[tuple[int, Window]]:
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
    return [(row[0], (row[1], row[2])) for row in rows]


def _datasets_used_by_chart(slice_id: int) -> list[tuple[int, Window]]:
    """Return ``(datasource_id, window)`` for every dataset that *slice_id*
    has ever pointed at, with each association's validity window.

    Reads from ``slices_version`` (the chart parent shadow). Filters to
    ``datasource_type = 'table'`` because the activity view only follows
    the chart → ``SqlaTable`` dependency edge (not legacy/other
    datasources). Rows with ``operation_type = 2`` are excluded.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    slices_tbl = version_class(Slice).__table__
    rows = (
        db.session.connection()
        .execute(
            sa.select(
                slices_tbl.c.datasource_id,
                slices_tbl.c.transaction_id,
                slices_tbl.c.end_transaction_id,
            ).where(
                slices_tbl.c.id == slice_id,
                slices_tbl.c.datasource_type == "table",
                slices_tbl.c.operation_type != 2,
                slices_tbl.c.datasource_id.is_not(None),
            )
        )
        .all()
    )
    return [(row[0], (row[1], row[2])) for row in rows]


# ---- T007: Window intersection (pure) -------------------------------------


def _intersect_windows(outer: Window, inner: Window) -> Optional[Window]:
    """Intersect two half-open ``[start_tx, end_tx)`` windows.

    Returns the clipped overlap, or ``None`` when they are disjoint.
    ``end_tx = None`` means "open ended (current)" and acts like
    positive infinity.
    """
    o_start, o_end = outer
    i_start, i_end = inner
    start = max(o_start, i_start)
    end: Optional[int]
    if o_end is None:
        end = i_end
    elif i_end is None:
        end = o_end
    else:
        end = min(o_end, i_end)
    if end is not None and end <= start:
        return None
    return (start, end)


# ---- T008: Phase B — fetch change records ---------------------------------


def _fetch_change_records(
    entity_window_tuples: list[EntityWindows],
    since: Optional[datetime],
    until: Optional[datetime],
) -> list[dict[str, Any]]:
    """Fetch all ``version_changes`` rows matching any of the supplied
    entity-window tuples, joined with ``version_transaction`` for
    ``issued_at`` and ``user_id``.

    Each tuple is ``(api_kind, entity_id, [(start_tx, end_tx), ...])``;
    a record matches when ``entity_kind`` equals the table-stored form
    of *api_kind*, ``entity_id`` matches, and ``transaction_id`` falls
    inside at least one of the entity's windows. ``since``/``until``
    further restrict by ``issued_at``.

    No DB-level ``LIMIT``/``OFFSET`` here: per AV-008 the visibility
    filter is applied after this query (records the requester can't read
    are silently dropped and must not contribute to ``count``), so the
    orchestrator paginates in Python over the filtered list. The
    query is still bounded by the date filters and the entity scope.

    Returned rows are ordered by ``(issued_at DESC, transaction_id DESC,
    sequence DESC)`` — the secondary keys break ties for AV-006's
    stable-ordering contract.
    """
    if not entity_window_tuples:
        return []

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import versioning_manager

    from superset import security_manager

    tx_tbl = versioning_manager.transaction_cls.__table__
    user_tbl = security_manager.user_model.__table__
    vc = version_changes_table

    entity_clauses: list[Any] = []
    for api_kind, entity_id, windows in entity_window_tuples:
        table_kind = _API_KIND_TO_TABLE.get(api_kind)
        if table_kind is None or not windows:
            continue
        for start_tx, end_tx in windows:
            conds = [
                vc.c.entity_kind == table_kind,
                vc.c.entity_id == entity_id,
                vc.c.transaction_id >= start_tx,
            ]
            if end_tx is not None:
                conds.append(vc.c.transaction_id < end_tx)
            entity_clauses.append(sa.and_(*conds))

    if not entity_clauses:
        return []

    stmt = (
        sa.select(
            vc.c.transaction_id,
            vc.c.entity_kind,
            vc.c.entity_id,
            vc.c.sequence,
            vc.c.kind,
            vc.c.path,
            vc.c.from_value,
            vc.c.to_value,
            tx_tbl.c.issued_at,
            tx_tbl.c.user_id,
            user_tbl.c.id.label("changed_by_id"),
            user_tbl.c.first_name,
            user_tbl.c.last_name,
        )
        .select_from(
            vc.join(tx_tbl, vc.c.transaction_id == tx_tbl.c.id).outerjoin(
                user_tbl, tx_tbl.c.user_id == user_tbl.c.id
            )
        )
        .where(sa.or_(*entity_clauses))
        .order_by(
            tx_tbl.c.issued_at.desc(),
            vc.c.transaction_id.desc(),
            vc.c.sequence.desc(),
        )
    )

    if since is not None:
        stmt = stmt.where(tx_tbl.c.issued_at >= since)
    if until is not None:
        stmt = stmt.where(tx_tbl.c.issued_at < until)

    rows = db.session.connection().execute(stmt).mappings().all()
    return [dict(row) for row in rows]


# ---- T009: Denormalize entity name from the shadow row valid at tx --------

#: Per-API-kind: (shadow model class, name column attribute). The shadow
#: table is reached via ``version_class(model_cls).__table__`` so the
#: registry stays small.
_NAME_COLUMN: dict[str, tuple[str, str]] = {
    "Dashboard": ("Dashboard", "dashboard_title"),
    "Slice": ("Slice", "slice_name"),
    "SqlaTable": ("SqlaTable", "table_name"),
}


def _load_shadow_model(model_name: str) -> type:
    """Inline-import a shadow model class by name. Deferred until call
    time because the versioning package is initialised before all model
    mappers are configured (same idiom used throughout
    :mod:`superset.versioning.changes`)."""
    # pylint: disable=import-outside-toplevel
    if model_name == "Dashboard":
        from superset.models.dashboard import Dashboard

        return Dashboard
    if model_name == "Slice":
        from superset.models.slice import Slice

        return Slice
    if model_name == "SqlaTable":
        from superset.connectors.sqla.models import SqlaTable

        return SqlaTable
    raise LookupError(f"No shadow class registered for {model_name!r}")


def _resolve_names_for_kind(
    api_kind: str, pairs: set[tuple[int, int]]
) -> dict[tuple[int, int], str]:
    """For one entity kind, return ``{(entity_id, target_tx): name}`` from
    the shadow row valid at *target_tx* (validity-strategy predicate).
    Empty mapping when the kind has no name column registered.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    if api_kind not in _NAME_COLUMN:
        return {}

    model_name, name_col = _NAME_COLUMN[api_kind]
    model_cls = _load_shadow_model(model_name)
    shadow_tbl = version_class(model_cls).__table__
    ids = sorted({eid for eid, _ in pairs})
    rows = (
        db.session.connection()
        .execute(
            sa.select(
                shadow_tbl.c.id,
                shadow_tbl.c.transaction_id,
                shadow_tbl.c.end_transaction_id,
                shadow_tbl.c[name_col],
            ).where(shadow_tbl.c.id.in_(ids))
        )
        .all()
    )
    per_entity: dict[int, list[tuple[int, Optional[int], Any]]] = {}
    for row in rows:
        per_entity.setdefault(row[0], []).append((row[1], row[2], row[3]))

    resolved: dict[tuple[int, int], str] = {}
    for entity_id, target_tx in pairs:
        for start_tx, end_tx, name in per_entity.get(entity_id, []):
            if start_tx <= target_tx and (end_tx is None or end_tx > target_tx):
                resolved[(entity_id, target_tx)] = name
                break
    return resolved


def _denormalize_entity_names(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve each record's ``entity_name`` from the shadow row valid at
    its ``transaction_id``. Adds an ``entity_name`` key to every record;
    mutates and returns *records* for convenient chaining.

    The lookup is per (table-stored ``entity_kind``, ``entity_id``,
    ``transaction_id``) triple. One ``IN``-clause query per kind keeps
    round-trips bounded by the number of distinct kinds (≤3) regardless
    of result-set size.
    """
    if not records:
        return records

    needed_by_kind: dict[str, set[tuple[int, int]]] = {}
    for record in records:
        api_kind = _TABLE_KIND_TO_API.get(record["entity_kind"])
        if api_kind is None or api_kind not in _NAME_COLUMN:
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
        api_kind_for_record = _TABLE_KIND_TO_API.get(record["entity_kind"], "")
        key = (api_kind_for_record, record["entity_id"], record["transaction_id"])
        record["entity_name"] = resolved.get(key, "")
    return records


# ---- T010: Sibling-count impact -------------------------------------------


def _compute_impact(
    path_kind: str, path_id: int, related_record: dict[str, Any]
) -> Optional[dict[str, int]]:
    """Synthesize the ``impact`` field for one ``source='related'`` record.

    Per data-model.md §"``impact`` computation":

    * ``path=Dashboard`` and the related entity is a ``Slice``: no impact
      (the chart is a direct child of the dashboard; there's no further
      dependent layer).
    * ``path=Dashboard`` and the related entity is a ``SqlaTable``:
      ``{"charts": N}`` where N is the count of distinct charts on the
      path dashboard that pointed at the dataset at the change's
      ``transaction_id``.
    * ``path=Slice`` and the related entity is a ``SqlaTable``: no impact
      (the chart is itself the only dependent of the dataset edit).
    * Other shapes: no impact.
    """
    table_kind = related_record["entity_kind"]
    api_kind = _TABLE_KIND_TO_API.get(table_kind)
    if path_kind != "Dashboard" or api_kind != "SqlaTable":
        return None

    dataset_id = related_record["entity_id"]
    target_tx = related_record["transaction_id"]
    chart_count = _count_dashboard_charts_pointing_at_dataset_at_tx(
        path_id, dataset_id, target_tx
    )
    if chart_count == 0:
        return None
    return {"charts": chart_count}


def _count_dashboard_charts_pointing_at_dataset_at_tx(
    dashboard_id: int, dataset_id: int, target_tx: int
) -> int:
    """Count distinct slices that were both (a) on *dashboard_id* at
    *target_tx* and (b) pointing at *dataset_id* at *target_tx*.

    Joins ``dashboard_slices_version`` ⨝ ``slices_version`` with the
    validity-strategy predicate on each side (same shape as
    :func:`superset.versioning.changes._dashboard_slice_uuids_at_tx`).
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    metadata = version_class(Slice).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")
    slices_tbl = version_class(Slice).__table__
    if m2m_tbl is None:
        return 0

    stmt = sa.select(sa.func.count(sa.distinct(m2m_tbl.c.slice_id))).where(
        m2m_tbl.c.dashboard_id == dashboard_id,
        m2m_tbl.c.transaction_id <= target_tx,
        sa.or_(
            m2m_tbl.c.end_transaction_id.is_(None),
            m2m_tbl.c.end_transaction_id > target_tx,
        ),
        m2m_tbl.c.operation_type != 2,
        slices_tbl.c.id == m2m_tbl.c.slice_id,
        slices_tbl.c.datasource_id == dataset_id,
        slices_tbl.c.datasource_type == "table",
        slices_tbl.c.transaction_id <= target_tx,
        sa.or_(
            slices_tbl.c.end_transaction_id.is_(None),
            slices_tbl.c.end_transaction_id > target_tx,
        ),
        slices_tbl.c.operation_type != 2,
    )
    return int(db.session.connection().execute(stmt).scalar() or 0)


# ---- T014: Live-row existence + soft-delete state -------------------------


def _check_entity_tombstones(
    distinct_entities: set[tuple[str, int]],
) -> dict[tuple[str, int], dict[str, Any]]:
    """For each ``(api_kind, entity_id)``, report ``deleted`` (no live
    row) and ``deletion_state`` (``"soft_deleted"`` iff the live row has
    a non-null ``deleted_at`` per sc-103157, else ``None``).

    Pre-sc-103157 the model classes don't have a ``deleted_at`` column;
    we probe with ``hasattr`` and report ``deletion_state=None``
    universally in that case. Once sc-103157 lands, this helper picks up
    the new column automatically.
    """
    result: dict[tuple[str, int], dict[str, Any]] = {}
    if not distinct_entities:
        return result

    by_kind: dict[str, list[int]] = {}
    for api_kind, entity_id in distinct_entities:
        by_kind.setdefault(api_kind, []).append(entity_id)

    for api_kind, entity_ids in by_kind.items():
        if api_kind not in _NAME_COLUMN:
            for entity_id in entity_ids:
                result[(api_kind, entity_id)] = {
                    "deleted": True,
                    "deletion_state": None,
                }
            continue

        model_name, _ = _NAME_COLUMN[api_kind]
        model_cls = _load_shadow_model(model_name)
        live_tbl = model_cls.__table__  # type: ignore[attr-defined]
        has_deleted_at = "deleted_at" in live_tbl.c

        cols = [live_tbl.c.id]
        if has_deleted_at:
            cols.append(live_tbl.c.deleted_at)
        rows = (
            db.session.connection()
            .execute(sa.select(*cols).where(live_tbl.c.id.in_(entity_ids)))
            .all()
        )
        live: dict[int, Any] = {}
        for row in rows:
            live[row[0]] = row[1] if has_deleted_at else None

        for entity_id in entity_ids:
            if entity_id not in live:
                result[(api_kind, entity_id)] = {
                    "deleted": True,
                    "deletion_state": None,
                }
            else:
                deleted_at = live[entity_id]
                result[(api_kind, entity_id)] = {
                    "deleted": False,
                    "deletion_state": "soft_deleted" if deleted_at else None,
                }
    return result
