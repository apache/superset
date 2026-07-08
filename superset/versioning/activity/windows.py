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
"""Pure window arithmetic on half-open ``[start_tx, end_tx)`` intervals.

Extracted from the DB-touching scope resolution so that:

* :mod:`scope` (DB-touching) can import this module at module-top.
* :mod:`queries.fetch_change_records` can import
  :func:`row_within_any_window` at module-top instead of through a
  lazy import that previously dodged a ``scope ↔ queries`` cycle.

Everything here is pure Python — no DB, no Flask. ``end_tx = None``
means "open-ended (current)" and behaves like positive infinity.
"""

from __future__ import annotations

from typing import Any

from superset.versioning.activity.kinds import EntityWindows, Window


def intersect_windows(outer: Window, inner: Window) -> Window | None:
    """Intersect two half-open ``[start_tx, end_tx)`` windows.

    Returns the clipped overlap, or ``None`` when they are disjoint.
    ``end_tx = None`` means "open ended (current)" and acts like
    positive infinity. Thin wrapper over :meth:`Window.intersect` —
    kept as a free function so callers and tests don't have to migrate
    to method form in lockstep with the dataclass promotion.
    """
    return outer.intersect(inner)


def row_within_any_window(row: dict[str, Any], windows: list[Window]) -> bool:
    """``True`` iff ``row['transaction_id']`` falls inside at least one
    of *windows*. Half-open interval semantics match
    :func:`intersect_windows`."""
    if not windows:
        return False
    tx_id = row["transaction_id"]
    return any(w.contains(tx_id) for w in windows)


def merge_entity_windows(scope: list[EntityWindows]) -> list[EntityWindows]:
    """Collapse repeated ``(api_kind, entity_id)`` entries by unioning
    their window lists, and collapse overlapping/touching windows
    within each entity into one.

    The OR-clause in
    :func:`~superset.versioning.activity.queries.fetch_change_records`
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
        (api_kind, entity_id, union_windows(windows))
        for (api_kind, entity_id), windows in merged.items()
    ]


def union_windows(windows: list[Window]) -> list[Window]:
    """Sort + merge overlapping/touching half-open intervals.

    Pure function — no DB. Touching ``[a, b)`` and ``[b, c)`` merge into
    ``[a, c)``. ``end_tx = None`` (open-ended) absorbs everything to its
    right. Returns a minimal disjoint cover of the input set.
    """
    if not windows:
        return []
    sorted_windows = sorted(windows, key=lambda w: w.start_tx)
    out: list[Window] = [sorted_windows[0]]
    for current in sorted_windows[1:]:
        prev = out[-1]
        if not prev.merges_with(current):
            out.append(current)
            continue
        if prev.end_tx is None:
            # Prior window is open-ended; it absorbs everything past.
            continue
        # Overlapping or touching — extend the prior window.
        new_end: int | None = (
            None if current.end_tx is None else max(prev.end_tx, current.end_tx)
        )
        out[-1] = Window(prev.start_tx, new_end)
    return out
