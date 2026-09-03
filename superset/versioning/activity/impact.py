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
"""Per-record impact computation for the activity DTO.

Only dashboard-path activity records pointing at a ``SqlaTable``
related entity carry an ``impact`` field — the charts on the
dashboard at that transaction that were pointing at the dataset, as
a count plus per-chart id/name references. This module computes that
payload in a single batched read per request:

* :func:`collect_impact_pairs` — pulls the distinct
  ``(dataset_id, transaction_id)`` pairs that need computing.
* :func:`batch_chart_impacts` — collects the matching charts without a
  join: dashboard membership comes from ``charts_attached_to_dashboard``'s
  attach/detach windows over ``dashboard_slices_version``, and a
  member-scoped ``slices_version`` scan supplies the chart→dataset window
  and the chart's name-at-transaction; the two are combined per pair by
  :func:`_collect_attached_charts_at`.
* :func:`impact_for_record` — pure projection from the pre-fetched
  chart references onto each record (returns ``None`` for
  non-Dashboard paths or non-SqlaTable kinds, matching the
  ``impact`` computation).

Splitting the batched read from the pure projection keeps the SQL
inside one function and the per-record decoration inside another
(no DB).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

import sqlalchemy as sa

from superset.extensions import db
from superset.versioning.activity.kinds import (
    chunked_ids,
    ENTITY_ID_CHUNK_SIZE,
    TABLE_KIND_TO_API,
    Window,
)
from superset.versioning.baseline import OPERATION_DELETE


class ChartRef(TypedDict):
    """One affected chart in an ``impact`` payload: id plus name-at-transaction."""

    id: int
    name: str


# The wire ``chart_names`` list is capped so one dataset feeding very many
# charts cannot balloon every related record on the page (page sizes reach
# 200 records); ``charts`` always carries the full count.
IMPACT_CHART_NAMES_CAP = 50

# Headroom left below SQLite's 999 bind-variable floor for the handful of scalar
# binds in the slice-scan WHERE (datasource_type, operation_type, the two tx
# bounds) once a member-id chunk and the dataset IN are accounted for.
_SCALAR_BIND_HEADROOM = 20


def collect_impact_pairs(
    records: list[dict[str, Any]], path_kind: str
) -> set[tuple[int, int]]:
    """Distinct ``(dataset_id, transaction_id)`` pairs from *records*
    that require an impact computation.

    Only dashboard-path records whose related entity is a ``SqlaTable``
    produce a non-null ``impact`` field; for any other shape this set
    is empty and no DB query needs to fire.
    """
    if path_kind != "Dashboard":
        return set()
    return {
        (record["entity_id"], record["transaction_id"])
        for record in records
        if TABLE_KIND_TO_API.get(record["entity_kind"]) == "SqlaTable"
    }


def batch_chart_impacts(
    dashboard_id: int, pairs: set[tuple[int, int]]
) -> dict[tuple[int, int], list[ChartRef]]:
    """For every ``(dataset_id, target_tx)`` in *pairs*, collect the
    distinct charts that were both on *dashboard_id* and pointing at
    *dataset_id* at *target_tx*, as id + name-at-transaction references.

    No join: ``charts_attached_to_dashboard`` supplies each member chart's
    ``[attach, detach)`` windows from the association shadow (Continuum never
    closes an M2M shadow's ``end_transaction_id``, so a validity-window filter
    on it would include a chart removed before ``target_tx`` — sc-119907), and a
    member-scoped scan of ``slices_version`` supplies the chart→dataset window
    (whose ``end_transaction_id`` the validity backfill *does* close, so the
    ordinary validity predicate is right there) plus the chart's name at that
    transaction. The Python loop counts a slice for a pair when both an
    attachment window and its chart→dataset window contain ``target_tx``.
    Replaces the previous N+1 shape that fired one COUNT per related record, and
    the m2m⋈slices join whose M2M validity window was the buggy naive filter.

    Returns ``{(dataset_id, target_tx): [ChartRef, ...]}`` with each pair's
    charts sorted by name; the name is the chart's name at that transaction (the
    matched version row). Pairs with no matching charts are omitted so the
    caller's ``.get(key)`` falsiness check is correct.
    """
    if not pairs:
        return {}

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice
    from superset.versioning.membership import charts_attached_to_dashboard

    slices_tbl = version_class(Slice).__table__

    dataset_ids: set[int] = {dataset_id for dataset_id, _ in pairs}
    target_txs: set[int] = {target_tx for _, target_tx in pairs}
    min_tx, max_tx = min(target_txs), max(target_txs)

    # Attachment membership per slice. charts_attached_to_dashboard owns the
    # association-shadow read and the attach/detach window pairing — the single
    # place that must never filter the M2M shadow by end_transaction_id, which
    # Continuum never closes (sc-119907). Reused here so restore.py, the
    # activity relationship walk, and this rollup share one implementation.
    attach_windows: dict[int, list[Window]] = {}
    for slice_id, window in charts_attached_to_dashboard(dashboard_id):
        attach_windows.setdefault(slice_id, []).append(window)
    if not attach_windows:
        return {}

    # Chart→dataset validity and name from the slice parent shadow, whose
    # end_transaction_id the validity backfill *does* close, so the ordinary
    # half-open validity predicate is correct here. Bounded on the DB side to
    # this dashboard's member charts (the attach_windows keys) and the
    # transaction range; the member-id IN-clause is chunked to stay under
    # SQLite's 999 bind-variable floor.
    #
    # The requested-dataset prune is applied on the DB side too, but only when
    # the dataset set co-binds with a full member chunk under that floor — a
    # member chunk (<= ENTITY_ID_CHUNK_SIZE) plus the dataset IN plus the few
    # scalar binds must stay < 999. When there are too many requested datasets,
    # the DB-side dataset predicate is dropped and the combiner filters datasets
    # in Python (it already keys on pairs_by_dataset), so a wide dashboard does
    # not overflow the bind limit (sc-119907 review).
    filter_datasets_in_sql = (
        len(dataset_ids) <= 999 - ENTITY_ID_CHUNK_SIZE - _SCALAR_BIND_HEADROOM
    )
    slice_rows: list[Any] = []
    for chunk in chunked_ids(set(attach_windows), ENTITY_ID_CHUNK_SIZE):
        conditions = [
            slices_tbl.c.id.in_(chunk),
            slices_tbl.c.datasource_type == "table",
            slices_tbl.c.operation_type != OPERATION_DELETE,
            slices_tbl.c.transaction_id <= max_tx,
            sa.or_(
                slices_tbl.c.end_transaction_id.is_(None),
                slices_tbl.c.end_transaction_id > min_tx,
            ),
        ]
        if filter_datasets_in_sql:
            conditions.append(slices_tbl.c.datasource_id.in_(dataset_ids))
        stmt = sa.select(
            slices_tbl.c.id.label("slice_id"),
            slices_tbl.c.slice_name,
            slices_tbl.c.datasource_id,
            slices_tbl.c.transaction_id.label("slice_start"),
            slices_tbl.c.end_transaction_id.label("slice_end"),
        ).where(*conditions)
        slice_rows.extend(db.session.connection().execute(stmt).mappings().all())

    pairs_by_dataset: dict[int, list[int]] = {}
    for dataset_id, target_tx in pairs:
        pairs_by_dataset.setdefault(dataset_id, []).append(target_tx)

    return _sorted_chart_refs(
        _collect_attached_charts_at(attach_windows, slice_rows, pairs_by_dataset)
    )


def _collect_attached_charts_at(
    attach_windows: dict[int, list[Window]],
    slice_rows: Sequence[Mapping[str, Any]],
    pairs_by_dataset: dict[int, list[int]],
) -> dict[tuple[int, int], dict[int, str]]:
    """Pure combiner: for each ``(dataset_id, target_tx)``, collect the distinct
    charts (``slice_id`` → name-at-transaction) whose attachment window and
    chart→dataset window both contain ``target_tx``.

    *attach_windows* maps ``slice_id`` to its ``[attach, detach)`` episodes
    (from the association shadow — see
    :func:`~superset.versioning.activity.windows.attachment_windows`); a chart
    removed before ``target_tx`` has no window containing it and is therefore
    not collected. *slice_rows* are the chart→dataset parent-shadow rows
    (``slice_id``, ``slice_name``, ``datasource_id``, ``slice_start``,
    ``slice_end``), whose ``end_transaction_id`` (``slice_end``) the validity
    backfill does close, so the half-open validity predicate is correct for
    them; ``slice_name`` is the chart's name on that matched version row. Split
    out of :func:`batch_chart_impacts` so this membership logic is unit-testable
    without a live shadow-table fixture.
    """
    matches: dict[tuple[int, int], dict[int, str]] = {}
    for row in slice_rows:
        windows = attach_windows.get(row["slice_id"])
        if not windows:
            continue
        ds_id = row["datasource_id"]
        for target_tx in pairs_by_dataset.get(ds_id, ()):
            in_attach = any(w.contains(target_tx) for w in windows)
            in_slice = row["slice_start"] <= target_tx and (
                row["slice_end"] is None or row["slice_end"] > target_tx
            )
            if in_attach and in_slice:
                matches.setdefault((ds_id, target_tx), {})[row["slice_id"]] = (
                    row["slice_name"] or ""
                )
    return matches


def _sorted_chart_refs(
    matches: dict[tuple[int, int], dict[int, str]],
) -> dict[tuple[int, int], list[ChartRef]]:
    """Order each pair's deduped charts by (casefolded name, id).

    Pure function, split from the batched read so the ordering contract is
    directly testable: names compare case-insensitively, ties break on id
    for a deterministic wire order, and empty names sort first (they render
    as an "Untitled" fallback downstream).
    """
    return {
        pair: sorted(
            (ChartRef(id=slice_id, name=name) for slice_id, name in charts.items()),
            key=lambda chart: (chart["name"].casefold(), chart["id"]),
        )
        for pair, charts in matches.items()
    }


def impact_for_record(
    record: dict[str, Any],
    path_kind: str,
    impacts: dict[tuple[int, int], list[ChartRef]],
) -> dict[str, Any] | None:
    """Synthesize the ``impact`` field for one record from *impacts*.

    Pure function — no DB. For the ``impact`` computation: only
    ``path=Dashboard`` and ``related=SqlaTable`` shapes carry an
    impact; everything else returns ``None``. The payload keeps the
    ``charts`` count and adds ``chart_names`` — the affected charts
    (id + name) that the count summarizes — so the rollup entry's
    hover tooltip can list them. ``chart_names`` is capped at
    :data:`IMPACT_CHART_NAMES_CAP`; ``charts`` stays the full count so
    the consumer can render an "and N more" overflow line.
    """
    api_kind = TABLE_KIND_TO_API.get(record["entity_kind"])
    if path_kind != "Dashboard" or api_kind != "SqlaTable":
        return None
    key = (record["entity_id"], record["transaction_id"])
    charts = impacts.get(key) or []
    if not charts:
        return None
    return {
        "charts": len(charts),
        "chart_names": charts[:IMPACT_CHART_NAMES_CAP],
    }
