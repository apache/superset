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
related entity carry an ``impact`` field — the number of charts on
the dashboard at that transaction that were pointing at the dataset.
This module computes that count in a single batched query per
request:

* :func:`collect_impact_pairs` — pulls the distinct
  ``(dataset_id, transaction_id)`` pairs that need counts.
* :func:`batch_chart_counts` — one SQL query joining
  ``dashboard_slices_version`` and ``slices_version`` to count
  the matching charts validity-strategy-style.
* :func:`impact_for_record` — pure projection from the pre-fetched
  counts onto each record (returns ``None`` for non-Dashboard paths
  or non-SqlaTable kinds, matching data-model.md §"``impact``
  computation").

Splitting the count batching from the pure projection keeps the SQL
inside one function (the batched read) and the per-record decoration
inside another (no DB).
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from superset.extensions import db
from superset.versioning.activity.kinds import TABLE_KIND_TO_API


def collect_impact_pairs(
    records: list[dict[str, Any]], path_kind: str
) -> set[tuple[int, int]]:
    """Distinct ``(dataset_id, transaction_id)`` pairs from *records*
    that require an impact computation per data-model.md.

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


def batch_chart_counts(
    dashboard_id: int, pairs: set[tuple[int, int]]
) -> dict[tuple[int, int], int]:
    """For every ``(dataset_id, target_tx)`` in *pairs*, count the
    distinct charts that were both on *dashboard_id* and pointing at
    *dataset_id* at *target_tx*.

    One SELECT against ``dashboard_slices_version`` ⨝ ``slices_version``,
    pulling the (slice, dataset, validity-window) state for every slice
    ever on the dashboard whose dataset matches one of the requested
    dataset_ids. The Python loop then applies the validity-strategy
    predicate per pair. Replaces the previous N+1 shape that fired one
    COUNT per related record.

    Returns ``{(dataset_id, target_tx): count}``; pairs whose count
    would be zero are omitted so the caller's ``.get(key, 0)`` is
    correct.
    """
    if not pairs:
        return {}

    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class

    from superset.models.slice import Slice

    metadata = version_class(Slice).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")
    slices_tbl = version_class(Slice).__table__
    if m2m_tbl is None:
        return {}

    dataset_ids = {dataset_id for dataset_id, _ in pairs}
    stmt = sa.select(
        m2m_tbl.c.slice_id,
        slices_tbl.c.datasource_id,
        m2m_tbl.c.transaction_id.label("m2m_start"),
        m2m_tbl.c.end_transaction_id.label("m2m_end"),
        slices_tbl.c.transaction_id.label("slice_start"),
        slices_tbl.c.end_transaction_id.label("slice_end"),
    ).where(
        m2m_tbl.c.dashboard_id == dashboard_id,
        m2m_tbl.c.operation_type != 2,
        slices_tbl.c.id == m2m_tbl.c.slice_id,
        slices_tbl.c.datasource_id.in_(dataset_ids),
        slices_tbl.c.datasource_type == "table",
        slices_tbl.c.operation_type != 2,
    )
    rows = db.session.connection().execute(stmt).mappings().all()

    # For each pair, collect the slice_ids whose two validity windows
    # both straddle target_tx. ``set`` dedupes within a pair.
    matches: dict[tuple[int, int], set[int]] = {}
    pairs_by_dataset: dict[int, list[int]] = {}
    for dataset_id, target_tx in pairs:
        pairs_by_dataset.setdefault(dataset_id, []).append(target_tx)

    for row in rows:
        ds_id = row["datasource_id"]
        for target_tx in pairs_by_dataset.get(ds_id, ()):
            in_m2m = row["m2m_start"] <= target_tx and (
                row["m2m_end"] is None or row["m2m_end"] > target_tx
            )
            in_slice = row["slice_start"] <= target_tx and (
                row["slice_end"] is None or row["slice_end"] > target_tx
            )
            if in_m2m and in_slice:
                matches.setdefault((ds_id, target_tx), set()).add(row["slice_id"])

    return {pair: len(slice_ids) for pair, slice_ids in matches.items()}


def impact_for_record(
    record: dict[str, Any],
    path_kind: str,
    counts: dict[tuple[int, int], int],
) -> dict[str, int] | None:
    """Synthesize the ``impact`` field for one record using the pre-
    fetched *counts* mapping. Pure function — no DB.

    Per data-model.md §"``impact`` computation": only
    ``path=Dashboard`` and ``related=SqlaTable`` shapes carry an
    impact; everything else returns ``None``.
    """
    api_kind = TABLE_KIND_TO_API.get(record["entity_kind"])
    if path_kind != "Dashboard" or api_kind != "SqlaTable":
        return None
    key = (record["entity_id"], record["transaction_id"])
    chart_count = counts.get(key, 0)
    if chart_count == 0:
        return None
    return {"charts": chart_count}
