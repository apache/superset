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
"""Window arithmetic and scope resolution.

The activity-view fetches change records across an entity's transitive
dependency chain, time-bounded by when each relationship was active.
This module collects all the pure functions that build the
``list[EntityWindows]`` scope passed to
:func:`~superset.versioning.activity.queries._fetch_change_records`:

* :func:`_intersect_windows` / :func:`_union_windows` — pure interval
  arithmetic on half-open ``[start_tx, end_tx)`` ranges.
* :func:`_row_within_any_window` — Python post-filter for records the
  SQL fetch can't pre-narrow (used inside the orchestrator after the
  per-kind fetch).
* :func:`_merge_entity_windows` — collapses repeated entity entries
  into one row per ``(api_kind, entity_id)`` with a minimal disjoint
  cover of windows. Keeps the OR-clause count in
  :func:`_fetch_change_records` proportional to *distinct* validity
  intervals, not the number of shadow rows.
* :func:`_resolve_scope` / :func:`_resolve_dashboard_scope` /
  :func:`_resolve_chart_scope` / :func:`_resolve_related_scope` —
  branch by path-kind to compute the full related-entity scope.

The DB-touching relationship traversers used by the dashboard/chart
scope resolvers (``_charts_attached_to_dashboard``,
``_datasets_used_by_chart``, ``_batch_datasets_used_by_charts``) live
next door in :mod:`~superset.versioning.activity.queries`.
"""

from __future__ import annotations

from typing import Any, Optional

from superset.versioning.activity.kinds import EntityWindows, Window
from superset.versioning.activity.queries import (
    _batch_datasets_used_by_charts,
    _charts_attached_to_dashboard,
    _datasets_used_by_chart,
)


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


def _row_within_any_window(row: dict[str, Any], windows: list[Window]) -> bool:
    """``True`` iff ``row['transaction_id']`` falls inside at least one
    of *windows*. Half-open interval semantics match
    :func:`_intersect_windows`."""
    if not windows:
        return False
    tx_id = row["transaction_id"]
    return any(
        start <= tx_id and (end is None or tx_id < end) for start, end in windows
    )


def _resolve_scope(path_kind: str, path_id: int, include: str) -> list[EntityWindows]:
    """Build the ``[(api_kind, entity_id, [windows])]`` list that
    :func:`~superset.versioning.activity.queries._fetch_change_records`
    consumes, branching by *path_kind* and *include* mode."""
    want_self = include in ("all", "self")
    want_related = include in ("all", "related")

    scope: list[EntityWindows] = []
    if want_self:
        scope.append((path_kind, path_id, [(0, None)]))
    if want_related:
        scope.extend(_resolve_related_scope(path_kind, path_id))
    return scope


def _resolve_related_scope(path_kind: str, path_id: int) -> list[EntityWindows]:
    """Walk the dependency edges from the path entity to its related
    entities. Per AV-004, datasets have no transitive layer in V2."""
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
    for slice_id, window in _charts_attached_to_dashboard(dashboard_id):
        chart_windows.setdefault(slice_id, []).append(window)

    # One query for the dataset-history of every chart on the dashboard,
    # not one query per chart. The per-slice form was O(n_charts) round-
    # trips which dominated p95 on rich dashboards.
    dataset_windows_by_slice = _batch_datasets_used_by_charts(set(chart_windows))

    for slice_id, attachment_windows in chart_windows.items():
        scope.append(("Slice", slice_id, list(attachment_windows)))
        dataset_windows = dataset_windows_by_slice.get(slice_id, [])
        for attachment in attachment_windows:
            for dataset_id, chart_dataset_window in dataset_windows:
                if (
                    intersect := _intersect_windows(attachment, chart_dataset_window)
                ) is not None:
                    scope.append(("SqlaTable", dataset_id, [intersect]))
    return _merge_entity_windows(scope)


def _resolve_chart_scope(slice_id: int) -> list[EntityWindows]:
    """Datasets the chart pointed at over its full history."""
    scope: list[EntityWindows] = []
    for dataset_id, window in _datasets_used_by_chart(slice_id):
        scope.append(("SqlaTable", dataset_id, [window]))
    return _merge_entity_windows(scope)


def _merge_entity_windows(scope: list[EntityWindows]) -> list[EntityWindows]:
    """Collapse repeated ``(api_kind, entity_id)`` entries by unioning
    their window lists, and collapse overlapping/touching windows
    within each entity into one.

    The OR-clause in
    :func:`~superset.versioning.activity.queries._fetch_change_records`
    generates one branch per (kind, id, window) tuple. Without the
    within-entity union, a chart that's been attached-and-detached
    many times (or that repeated fixture loads have populated the M2M
    shadow for) yields a separate clause per redundant window — at
    ~10 entities × ~50 windows the SQL hits SQLite's
    ``SQLITE_MAX_EXPR_DEPTH`` (1000). Merging here keeps the clause
    count proportional to the number of *distinct* validity intervals,
    not the number of shadow rows.
    """
    merged: dict[tuple[str, int], list[Window]] = {}
    for api_kind, entity_id, windows in scope:
        merged.setdefault((api_kind, entity_id), []).extend(windows)
    return [
        (api_kind, entity_id, _union_windows(windows))
        for (api_kind, entity_id), windows in merged.items()
    ]


def _union_windows(windows: list[Window]) -> list[Window]:
    """Sort + merge overlapping/touching half-open intervals.

    Pure function — no DB. Touching ``[a, b)`` and ``[b, c)`` merge into
    ``[a, c)``. ``end_tx = None`` (open-ended) absorbs everything to its
    right. Returns a minimal disjoint cover of the input set.
    """
    if not windows:
        return []
    sorted_windows = sorted(windows, key=lambda w: w[0])
    out: list[Window] = [sorted_windows[0]]
    for start, end in sorted_windows[1:]:
        prev_start, prev_end = out[-1]
        if prev_end is None:
            # Prior window is open-ended; it absorbs everything past.
            continue
        if start <= prev_end:
            # Overlapping or touching — extend the prior window.
            new_end: Optional[int] = None if end is None else max(prev_end, end)
            out[-1] = (prev_start, new_end)
        else:
            out.append((start, end))
    return out
