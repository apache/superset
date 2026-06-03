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
* :mod:`queries._fetch_change_records` can import
  :func:`_row_within_any_window` at module-top instead of through a
  lazy import that previously dodged a ``scope ↔ queries`` cycle.

Everything here is pure Python — no DB, no Flask. ``end_tx = None``
means "open-ended (current)" and behaves like positive infinity.
"""

from __future__ import annotations

from typing import Any

from superset.versioning.activity.kinds import EntityWindows, Window


def _intersect_windows(outer: Window, inner: Window) -> Window | None:
    """Intersect two half-open ``[start_tx, end_tx)`` windows.

    Returns the clipped overlap, or ``None`` when they are disjoint.
    ``end_tx = None`` means "open ended (current)" and acts like
    positive infinity.
    """
    o_start, o_end = outer
    i_start, i_end = inner
    start = max(o_start, i_start)
    end: int | None
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
            new_end: int | None = None if end is None else max(prev_end, end)
            out[-1] = (prev_start, new_end)
        else:
            out.append((start, end))
    return out
