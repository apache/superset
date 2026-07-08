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
"""Scope resolution — turn a path entity into the related-entity walk.

Composes :mod:`~superset.versioning.activity.queries` (Phase A
relationship walks) and :mod:`~superset.versioning.activity.windows`
(pure interval arithmetic) into the
``list[EntityWindows]`` scope that
:func:`~superset.versioning.activity.queries.fetch_change_records`
consumes.

The functions here read the DB (via the Phase A helpers in
:mod:`~superset.versioning.activity.queries`); the pure window-
arithmetic functions previously colocated here now live in
:mod:`~superset.versioning.activity.windows` so the package no longer
needs a lazy import to dodge a ``scope ↔ queries`` cycle.
"""

from __future__ import annotations

from superset.versioning.activity.kinds import EntityWindows, Window
from superset.versioning.activity.queries import (
    batch_datasets_used_by_charts,
    charts_attached_to_dashboard,
    datasets_used_by_chart,
)
from superset.versioning.activity.windows import (
    intersect_windows,
    merge_entity_windows,
)


def resolve_scope(
    path_kind: str,
    path_id: int,
    include: str,
    self_start_tx: int | None = None,
) -> list[EntityWindows]:
    """Build the ``[(api_kind, entity_id, [windows])]`` list that
    :func:`~superset.versioning.activity.queries.fetch_change_records`
    consumes, branching by *path_kind* and *include* mode.

    *self_start_tx* lower-bounds the self window at the path entity's first
    tracked transaction (see
    :func:`~superset.versioning.activity.queries.first_tracked_tx`). This
    scopes the self stream to the current entity's own history: matching
    self records on the bare integer id would otherwise inherit a
    hard-deleted predecessor's change records under id reuse
    (SQLite/MySQL reuse ``max(id)+1``). ``None`` means the entity has no
    tracked history yet, so the self stream contributes nothing.
    """
    want_self = include in ("all", "self")
    want_related = include in ("all", "related")

    scope: list[EntityWindows] = []
    if want_self and self_start_tx is not None:
        scope.append((path_kind, path_id, [Window(self_start_tx, None)]))
    if want_related:
        scope.extend(_resolve_related_scope(path_kind, path_id))
    return scope


def _resolve_related_scope(path_kind: str, path_id: int) -> list[EntityWindows]:
    """Walk the dependency edges from the path entity to its related
    entities. Datasets have no transitive layer in V2."""
    if path_kind == "Dashboard":
        return _resolve_dashboard_scope(path_id)
    if path_kind == "Slice":
        return _resolve_chart_scope(path_id)
    return []


def _resolve_dashboard_scope(dashboard_id: int) -> list[EntityWindows]:
    """Charts on the dashboard during their attachment window, plus
    datasets each chart pointed at during the intersection of (chart-
    attachment, chart-on-dataset)."""
    scope: list[EntityWindows] = []
    chart_windows: dict[int, list[Window]] = {}
    for slice_id, window in charts_attached_to_dashboard(dashboard_id):
        chart_windows.setdefault(slice_id, []).append(window)

    # One query for the dataset-history of every chart on the dashboard,
    # not one query per chart. The per-slice form was O(n_charts) round-
    # trips which dominated p95 on rich dashboards.
    dataset_windows_by_slice = batch_datasets_used_by_charts(set(chart_windows))

    for slice_id, attachment_windows in chart_windows.items():
        scope.append(("Slice", slice_id, list(attachment_windows)))
        dataset_windows = dataset_windows_by_slice.get(slice_id, [])
        for attachment in attachment_windows:
            for dataset_id, chart_dataset_window in dataset_windows:
                if (
                    intersect := intersect_windows(attachment, chart_dataset_window)
                ) is not None:
                    scope.append(("SqlaTable", dataset_id, [intersect]))
    return merge_entity_windows(scope)


def _resolve_chart_scope(slice_id: int) -> list[EntityWindows]:
    """Datasets the chart pointed at over its full history."""
    scope: list[EntityWindows] = []
    for dataset_id, window in datasets_used_by_chart(slice_id):
        scope.append(("SqlaTable", dataset_id, [window]))
    return merge_entity_windows(scope)
