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
"""Unit tests for ``superset.versioning.activity`` pure helpers (sc-107283).

No app context, no DB, no Flask. Covers the helpers that can be exercised
in isolation: window intersection, scope resolution branching, entity-
window merging, AV-012 summary headlines, ``changed_by`` projection,
read-predicate fall-through, and the no-impact paths of
``_compute_impact``. The DB-touching helpers
(``_charts_attached_to_dashboard``, ``_datasets_used_by_chart``,
``_fetch_change_records``, ``_denormalize_entity_names``,
``_check_entity_tombstones``, ``_lookup_entity_uuids``) are exercised
by the integration suite in
``tests/integration_tests/versioning/activity_view_tests.py``.
"""

from __future__ import annotations

from typing import Optional

import pytest

from superset.versioning.activity import (
    _API_KIND_TO_TABLE,
    _build_summary,
    _can_read,
    _changed_by_dict,
    _compute_impact,
    _intersect_windows,
    _merge_entity_windows,
    _resolve_scope,
    _TABLE_KIND_TO_API,
    EntityWindows,
    Window,
)

# ---- _intersect_windows ---------------------------------------------------


@pytest.mark.parametrize(
    "outer, inner, expected",
    [
        # Inner fully inside outer
        ((10, 20), (15, 18), (15, 18)),
        # Left overlap — clipped on the left
        ((10, 20), (5, 15), (10, 15)),
        # Right overlap — clipped on the right
        ((10, 20), (15, 25), (15, 20)),
        # Outer fully inside inner
        ((10, 20), (5, 25), (10, 20)),
        # Touching at end → half-open semantics yield disjoint
        ((10, 20), (20, 30), None),
        # Disjoint to the right
        ((10, 20), (25, 30), None),
        # Disjoint to the left
        ((10, 20), (0, 5), None),
        # Open-ended outer (end_tx=None means +∞)
        ((10, None), (5, 25), (10, 25)),
        # Open-ended inner
        ((10, 20), (5, None), (10, 20)),
        # Both open-ended
        ((10, None), (5, None), (10, None)),
        # Identical
        ((10, 20), (10, 20), (10, 20)),
    ],
)
def test_intersect_windows(
    outer: Window, inner: Window, expected: Optional[Window]
) -> None:
    assert _intersect_windows(outer, inner) == expected


# ---- _resolve_scope -------------------------------------------------------


def test_resolve_scope_self_only_for_dashboard() -> None:
    """``include='self'`` yields exactly one tuple covering all transactions."""
    assert _resolve_scope("Dashboard", 42, "self") == [
        ("Dashboard", 42, [(0, None)]),
    ]


def test_resolve_scope_self_only_for_chart() -> None:
    assert _resolve_scope("Slice", 7, "self") == [("Slice", 7, [(0, None)])]


def test_resolve_scope_self_only_for_dataset() -> None:
    assert _resolve_scope("SqlaTable", 9, "self") == [
        ("SqlaTable", 9, [(0, None)]),
    ]


def test_dataset_has_no_related_scope() -> None:
    """AV-004: datasets are not transitive recipients of activity in V2."""
    assert _resolve_scope("SqlaTable", 9, "related") == []


def test_dataset_all_returns_only_self() -> None:
    """For datasets, ``include='all'`` == ``include='self'`` (AV-004)."""
    assert _resolve_scope("SqlaTable", 9, "all") == [
        ("SqlaTable", 9, [(0, None)]),
    ]


# ---- _merge_entity_windows -----------------------------------------------


def test_merge_entity_windows_collapses_repeated_keys() -> None:
    """Repeated ``(api_kind, entity_id)`` entries union their window lists
    so the fetch query's OR-clause stays compact."""
    merged = _merge_entity_windows(
        [
            ("Slice", 1, [(0, 100)]),
            ("Slice", 1, [(200, 300)]),
            ("SqlaTable", 5, [(0, None)]),
        ]
    )
    by_key = {(kind, eid): windows for kind, eid, windows in merged}
    assert by_key[("Slice", 1)] == [(0, 100), (200, 300)]
    assert by_key[("SqlaTable", 5)] == [(0, None)]


def test_merge_entity_windows_preserves_singletons() -> None:
    """Non-duplicated entries pass through unchanged."""
    inputs: list[EntityWindows] = [
        ("Slice", 1, [(0, 100)]),
        ("Dashboard", 2, [(10, 20)]),
    ]
    merged = _merge_entity_windows(inputs)
    assert sorted(merged) == sorted(inputs)


# ---- Kind translation round-trip -----------------------------------------


def test_kind_translation_is_bijective_for_supported_kinds() -> None:
    """Every API kind maps to a table kind and back to the same value.
    Locks in the contract that the two maps don't drift."""
    for api_kind, table_kind in _API_KIND_TO_TABLE.items():
        assert _TABLE_KIND_TO_API[table_kind] == api_kind


# ---- _build_summary (AV-012) ---------------------------------------------


def test_summary_for_dataset_column_change() -> None:
    rec = {"kind": "column", "entity_name": "Sales Transactions"}
    assert _build_summary("SqlaTable", rec) == (
        "Dataset column changed: Sales Transactions"
    )


def test_summary_for_chart_filter_change() -> None:
    rec = {"kind": "filter", "entity_name": "Top Charts"}
    assert _build_summary("Slice", rec) == "Chart filter changed: Top Charts"


def test_summary_for_restore_event() -> None:
    rec = {"kind": "restore", "entity_name": "Q4 Dashboard"}
    assert _build_summary("Dashboard", rec) == "Dashboard restored: Q4 Dashboard"


def test_summary_unknown_kind_falls_back_to_updated() -> None:
    """Unmapped change kinds collapse to a generic 'updated' verb."""
    rec = {"kind": "mystery_kind", "entity_name": "X"}
    assert _build_summary("Dashboard", rec) == "Dashboard updated: X"


def test_summary_without_entity_name_drops_colon() -> None:
    """Tombstoned entities have no name; the headline reads naturally
    without a trailing colon and empty value."""
    rec = {"kind": "filter", "entity_name": ""}
    assert _build_summary("Slice", rec) == "Chart filter changed"


# ---- _changed_by_dict ----------------------------------------------------


def test_changed_by_returns_none_when_no_user_attached() -> None:
    """Saves from CLI/Celery/import have no Flask user (sc-103156 §Session
    2026-05-18 clarification)."""
    assert _changed_by_dict({"changed_by_id": None}) is None


def test_changed_by_projects_only_display_fields() -> None:
    """Per the ActivityChangedBy contract: id + first_name + last_name only.
    Username is intentionally omitted (data-model.md)."""
    record = {
        "changed_by_id": 5,
        "first_name": "Mike",
        "last_name": "Bridge",
        "user_id": 5,  # internal column, must not leak
    }
    result = _changed_by_dict(record)
    assert result == {"id": 5, "first_name": "Mike", "last_name": "Bridge"}
    assert result is not None
    assert "username" not in result


# ---- _can_read fallthrough -----------------------------------------------


def test_can_read_returns_true_for_unsupported_kind() -> None:
    """Unknown kinds aren't subject to the per-kind security predicate,
    so they pass through (defensive default; tombstones land here too)."""

    class _StubSecurityManager:
        pass

    assert _can_read("UnknownKind", object(), _StubSecurityManager()) is True


# ---- _compute_impact no-impact paths -------------------------------------


def test_compute_impact_self_path_yields_no_impact() -> None:
    """The chart-self case: a dashboard's chart-related record has no
    further dependent layer (chart is a direct child of dashboard)."""
    record = {
        "entity_kind": "chart",
        "entity_id": 5,
        "transaction_id": 100,
    }
    assert _compute_impact("Dashboard", 1, record) is None


def test_compute_impact_chart_path_with_dataset_related_yields_no_impact() -> None:
    """Chart → dataset: the chart itself is the only dependent of the
    dataset edit, so no impact count."""
    record = {
        "entity_kind": "dataset",
        "entity_id": 5,
        "transaction_id": 100,
    }
    assert _compute_impact("Slice", 1, record) is None


def test_compute_impact_unknown_path_kind_yields_no_impact() -> None:
    """Defensive fallthrough — any other shape returns no impact."""
    record = {
        "entity_kind": "dataset",
        "entity_id": 5,
        "transaction_id": 100,
    }
    assert _compute_impact("SqlaTable", 1, record) is None
