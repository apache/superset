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

from itertools import groupby
from typing import Any

from superset.versioning.activity.kinds import EntityWindows, Window

# ``operation_type`` values on a Continuum association shadow row
# (sqlalchemy_continuum.operation.Operation): INSERT attaches, DELETE detaches.
# UPDATE never occurs for a pure M2M association (there is nothing to update on
# a (dashboard, slice) pair); if it ever appeared it is ignored — neither
# opening nor closing a window — so an open attachment simply continues.
# These mirror the library enum's numeric values; ``test_m2m_op_constants_match_
# continuum`` pins them so a Continuum renumber fails loudly rather than silently.
M2M_OP_INSERT = 0
M2M_OP_DELETE = 2


def attachment_windows(
    rows: list[tuple[int, int, int]],
) -> list[tuple[int, Window]]:
    """Pair INSERT / DELETE association-version rows into ``[attach, detach)``
    windows, one per attachment episode.

    Each row is ``(assoc_id, transaction_id, operation_type)``. Continuum
    **never closes** an association shadow row's ``end_transaction_id`` — its
    unit-of-work only *inserts* association versions
    (``create_association_versions``); the validity backfill that sets
    ``end_transaction_id`` runs for parent objects, not for M2M links. So the
    detach boundary lives on the DELETE row's ``transaction_id``, not on the
    attach row's ``end_transaction_id`` (which stays NULL for the association's
    whole life). An INSERT opens a window; the next DELETE closes it at its
    transaction id; an attachment with no following DELETE stays open (the
    association is still live). A DELETE at the same transaction as its open
    (add-and-remove in one save) yields no window — the association was never
    on a committed state. That last case is a deliberate divergence from
    Continuum's own ``association_subquery`` reverter, which (selecting the
    ``MAX(tx) <= T`` row and excluding only DELETEs) would treat such a pair as
    a member; the never-committed reading is the safer one for restore.

    This is the M2M-correct counterpart to
    :func:`~superset.versioning.changes.shadow_queries.shadow_rows_valid_at`,
    whose ``end_transaction_id`` validity filter is right for parent/child
    shadows but silently re-includes a detached association.
    """
    result: list[tuple[int, Window]] = []
    # operation_type is part of the sort key so that, within one transaction,
    # INSERT (0) sorts before DELETE (2): an add-and-remove in a single save is
    # then seen open-before-close and collapses to no window (the DELETE finds
    # ``tx == open_tx``, not ``>``). Do not drop it from the key.
    rows_sorted = sorted(rows, key=lambda r: (r[0], r[1], r[2]))
    for assoc_id, group in groupby(rows_sorted, key=lambda r: r[0]):
        open_tx: int | None = None
        for _assoc_id, tx, operation_type in group:
            if operation_type == M2M_OP_DELETE:
                if open_tx is not None and tx > open_tx:
                    result.append((assoc_id, Window(open_tx, tx)))
                open_tx = None
            elif operation_type == M2M_OP_INSERT and open_tx is None:
                open_tx = tx
        if open_tx is not None:
            result.append((assoc_id, Window(open_tx, None)))
    return result


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
    tx_id: int = row["transaction_id"]
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
    sorted_windows: list[Window] = sorted(windows, key=lambda w: w.start_tx)
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
