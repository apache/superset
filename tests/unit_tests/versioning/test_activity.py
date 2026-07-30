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
(``charts_attached_to_dashboard``, ``datasets_used_by_chart``,
``fetch_change_records``, ``apply_entity_name_denormalization``,
``check_entity_tombstones``, ``_lookup_entity_uuids``) are exercised
by the integration suite in
``tests/integration_tests/versioning/activity_view_tests.py``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest

from superset.versioning.activity import (
    ActivityParamsError,
    EntityWindows,
    parse_activity_query_params,
    Window,
)
from superset.versioning.activity.impact import (
    collect_impact_pairs,
    impact_for_record,
)
from superset.versioning.activity.kinds import API_KIND_TO_TABLE, TABLE_KIND_TO_API
from superset.versioning.activity.orchestrator import (
    _DEFAULT_PAGE_SIZE,
    _emit_request_shape_attributes,
    _MAX_PAGE_SIZE,
)
from superset.versioning.activity.queries import (
    _merge_result_into_heap,
    _record_sort_key,
    BoundedRecordHeap,
)
from superset.versioning.activity.render import (
    _build_summary,
    _changed_by_dict,
    apply_record_decoration,
)
from superset.versioning.activity.scope import resolve_scope
from superset.versioning.activity.windows import (
    intersect_windows,
    merge_entity_windows,
    row_within_any_window,
    union_windows,
)

# ---- intersect_windows ---------------------------------------------------


@pytest.mark.parametrize(
    "outer, inner, expected",
    [
        # Inner fully inside outer
        (Window(10, 20), Window(15, 18), Window(15, 18)),
        # Left overlap — clipped on the left
        (Window(10, 20), Window(5, 15), Window(10, 15)),
        # Right overlap — clipped on the right
        (Window(10, 20), Window(15, 25), Window(15, 20)),
        # Outer fully inside inner
        (Window(10, 20), Window(5, 25), Window(10, 20)),
        # Touching at end → half-open semantics yield disjoint
        (Window(10, 20), Window(20, 30), None),
        # Disjoint to the right
        (Window(10, 20), Window(25, 30), None),
        # Disjoint to the left
        (Window(10, 20), Window(0, 5), None),
        # Open-ended outer (end_tx=None means +∞)
        (Window(10, None), Window(5, 25), Window(10, 25)),
        # Open-ended inner
        (Window(10, 20), Window(5, None), Window(10, 20)),
        # Both open-ended
        (Window(10, None), Window(5, None), Window(10, None)),
        # Identical
        (Window(10, 20), Window(10, 20), Window(10, 20)),
    ],
)
def test_intersect_windows(
    outer: Window, inner: Window, expected: Window | None
) -> None:
    assert intersect_windows(outer, inner) == expected


# ---- resolve_scope -------------------------------------------------------


def test_resolve_scope_self_only_for_dashboard() -> None:
    """``include='self'`` yields exactly one tuple, bounded at the entity's
    first tracked transaction."""
    assert resolve_scope("Dashboard", 42, "self", 0) == [
        ("Dashboard", 42, [Window(0, None)]),
    ]


def test_resolve_scope_self_window_bounded_at_first_tracked_tx() -> None:
    """The self window starts at ``self_start_tx`` (the entity's first
    tracked transaction), not 0 — so a reused integer id can't inherit a
    hard-deleted predecessor's history."""
    assert resolve_scope("Dashboard", 42, "self", 17) == [
        ("Dashboard", 42, [Window(17, None)]),
    ]


def test_resolve_scope_self_empty_when_no_tracked_history() -> None:
    """``self_start_tx=None`` (no shadow rows for this id+uuid yet) yields
    no self window, so a reused id surfaces nothing from its predecessor."""
    assert resolve_scope("Dashboard", 42, "self", None) == []
    assert resolve_scope("Dashboard", 42, "self") == []


def test_resolve_scope_related_empty_when_no_tracked_incarnation() -> None:
    """A fresh entity reusing an integer id inherits no related history."""
    with patch(
        "superset.versioning.activity.scope._resolve_dashboard_scope"
    ) as resolve_related:
        assert resolve_scope("Dashboard", 42, "related", None) == []
        resolve_related.assert_not_called()


def test_resolve_scope_clips_related_windows_to_current_incarnation() -> None:
    """Dependency windows from a reused path id start at its own first tx."""
    with patch(
        "superset.versioning.activity.scope._resolve_dashboard_scope",
        return_value=[
            ("Slice", 7, [Window(5, 15), Window(20, None)]),
            ("SqlaTable", 9, [Window(1, 8)]),
        ],
    ):
        assert resolve_scope("Dashboard", 42, "related", 10) == [
            ("Slice", 7, [Window(10, 15), Window(20, None)]),
        ]


def test_resolve_scope_self_only_for_chart() -> None:
    assert resolve_scope("Slice", 7, "self", 0) == [("Slice", 7, [Window(0, None)])]


def test_resolve_scope_self_only_for_dataset() -> None:
    assert resolve_scope("SqlaTable", 9, "self", 0) == [
        ("SqlaTable", 9, [Window(0, None)]),
    ]


def test_dataset_has_no_related_scope() -> None:
    """AV-004: datasets are not transitive recipients of activity in V2."""
    assert resolve_scope("SqlaTable", 9, "related") == []


def test_dataset_all_returns_only_self() -> None:
    """For datasets, ``include='all'`` == ``include='self'`` (AV-004)."""
    assert resolve_scope("SqlaTable", 9, "all", 0) == [
        ("SqlaTable", 9, [Window(0, None)]),
    ]


def test_decoration_redacts_record_from_reused_entity_id() -> None:
    """A historical UUID mismatch identifies a deleted predecessor."""
    live_uuid = uuid4()
    historical_uuid = uuid4()
    record = {
        "entity_kind": "chart",
        "entity_id": 7,
        "transaction_id": 20,
        "sequence": 0,
        "kind": "field",
        "operation": "update",
        "action_kind": None,
        "path": "slice_name",
        "from_value": "predecessor",
        "to_value": "renamed",
        "entity_name": "Old chart",
        "changed_by_id": 1,
        "first_name": "Ada",
        "last_name": "Lovelace",
        "user_id": 1,
    }
    with (
        patch(
            "superset.versioning.activity.render.check_entity_tombstones",
            return_value={("Slice", 7): {"deleted": False, "deletion_state": None}},
        ),
        patch(
            "superset.versioning.activity.render._lookup_entity_uuids",
            return_value={("Slice", 7): live_uuid},
        ),
        patch(
            "superset.versioning.activity.render.resolve_historical_entity_uuids",
            return_value={("Slice", 7, 20): historical_uuid},
        ),
        patch(
            "superset.versioning.activity.render.batch_chart_counts", return_value={}
        ),
    ):
        apply_record_decoration([record], "Dashboard", 1)

    assert record["entity_deleted"] is True
    assert record["entity_uuid"] is None
    assert record["version_uuid"] is None
    assert record["entity_name"] == ""
    assert record["from_value"] is None
    assert record["to_value"] is None


def test_bounded_heap_merges_newer_rows_from_later_id_chunks() -> None:
    """A full early chunk cannot hide newer records from a later chunk."""

    class Result(list[dict[str, Any]]):
        closed = False

        def close(self) -> None:
            self.closed = True

    def row(transaction_id: int, entity_id: int) -> dict[str, Any]:
        return {
            "issued_at": datetime(2026, 1, 1, 0, 0, transaction_id),
            "transaction_id": transaction_id,
            "sequence": 0,
            "entity_kind": "chart",
            "entity_id": entity_id,
        }

    windows = {
        ("chart", 1): [Window(0, None)],
        ("chart", 501): [Window(0, None)],
    }
    heap: BoundedRecordHeap = []
    first = Result([row(2, 1), row(1, 1)])
    second = Result([row(4, 501), row(3, 501)])

    ordinal = _merge_result_into_heap(first, heap, windows, 2, 0)
    _merge_result_into_heap(second, heap, windows, 2, ordinal)

    assert first.closed
    assert second.closed
    assert [
        entry[2]["transaction_id"]
        for entry in sorted(heap, key=lambda entry: entry[0], reverse=True)
    ] == [4, 3, 2]


def test_total_sort_key_distinguishes_rows_at_same_timestamp() -> None:
    issued_at = datetime(2026, 1, 1)
    older = {
        "issued_at": issued_at,
        "transaction_id": 10,
        "sequence": 1,
        "entity_kind": "chart",
        "entity_id": 7,
    }
    newer = {**older, "sequence": 2}
    assert _record_sort_key(newer) > _record_sort_key(older)


# ---- merge_entity_windows -----------------------------------------------


def test_merge_entity_windows_collapses_repeated_keys() -> None:
    """Repeated ``(api_kind, entity_id)`` entries union their window lists
    so the fetch query's OR-clause stays compact."""
    merged = merge_entity_windows(
        [
            ("Slice", 1, [Window(0, 100)]),
            ("Slice", 1, [Window(200, 300)]),
            ("SqlaTable", 5, [Window(0, None)]),
        ]
    )
    by_key = {(kind, eid): windows for kind, eid, windows in merged}
    assert by_key[("Slice", 1)] == [Window(0, 100), Window(200, 300)]
    assert by_key[("SqlaTable", 5)] == [Window(0, None)]


def test_merge_entity_windows_preserves_singletons() -> None:
    """Non-duplicated entries pass through unchanged."""
    inputs: list[EntityWindows] = [
        ("Slice", 1, [Window(0, 100)]),
        ("Dashboard", 2, [Window(10, 20)]),
    ]
    merged = merge_entity_windows(inputs)
    assert sorted(merged) == sorted(inputs)


def test_merge_entity_windows_unions_overlapping_windows_for_one_entity() -> None:
    """Same entity, many redundant attachment windows → collapsed to one.

    This guards the SQLite expression-tree limit: a fixture that
    re-creates a chart-on-dashboard association across many transactions
    used to produce N separate OR branches in the fetch query (one per
    redundant window). merge_entity_windows must coalesce them.
    """
    scope: list[EntityWindows] = [
        ("Slice", 1, [Window(10, 20)]),
        ("Slice", 1, [Window(15, 25)]),  # overlaps
        ("Slice", 1, [Window(25, 30)]),  # touches
        ("Slice", 1, [Window(40, 50)]),  # disjoint
    ]
    merged = merge_entity_windows(scope)
    assert merged == [("Slice", 1, [Window(10, 30), Window(40, 50)])]


# ---- union_windows -------------------------------------------------------


@pytest.mark.parametrize(
    "windows, expected",
    [
        # Disjoint windows pass through
        (
            [Window(10, 20), Window(30, 40)],
            [Window(10, 20), Window(30, 40)],
        ),
        # Overlapping windows merge
        ([Window(10, 20), Window(15, 25)], [Window(10, 25)]),
        # Touching windows merge (half-open: [10,20) + [20,30) = [10,30))
        ([Window(10, 20), Window(20, 30)], [Window(10, 30)]),
        # Many overlapping windows collapse to one
        (
            [Window(10, 20), Window(15, 25), Window(20, 30), Window(25, 35)],
            [Window(10, 35)],
        ),
        # Input order doesn't matter
        (
            [Window(30, 40), Window(10, 20), Window(15, 25)],
            [Window(10, 25), Window(30, 40)],
        ),
        # Open-ended absorbs everything to the right
        ([Window(10, None), Window(50, 60)], [Window(10, None)]),
        # Open-ended at the right merges into open-ended
        ([Window(10, 20), Window(15, None)], [Window(10, None)]),
        # Empty input
        ([], []),
        # Single window pass-through
        ([Window(5, 10)], [Window(5, 10)]),
    ],
)
def test_union_windows(windows: list[Window], expected: list[Window]) -> None:
    assert union_windows(windows) == expected


# ---- row_within_any_window (Python post-filter for the fetch query) ------


def test_row_in_window_inside() -> None:
    assert row_within_any_window({"transaction_id": 15}, [Window(10, 20)])


def test_row_in_window_at_start_boundary_inclusive() -> None:
    """Half-open: ``[10, 20)`` includes 10."""
    assert row_within_any_window({"transaction_id": 10}, [Window(10, 20)])


def test_row_in_window_at_end_boundary_exclusive() -> None:
    """Half-open: ``[10, 20)`` excludes 20."""
    assert not row_within_any_window({"transaction_id": 20}, [Window(10, 20)])


def test_row_in_open_ended_window() -> None:
    """``end=None`` means +∞."""
    assert row_within_any_window({"transaction_id": 999}, [Window(10, None)])


def test_row_in_any_of_several_windows() -> None:
    assert row_within_any_window(
        {"transaction_id": 50},
        [Window(10, 20), Window(40, 60), Window(90, 100)],
    )


def test_row_in_no_windows_returns_false() -> None:
    assert not row_within_any_window({"transaction_id": 50}, [])
    assert not row_within_any_window(
        {"transaction_id": 25}, [Window(10, 20), Window(30, 40)]
    )


# ---- Kind translation round-trip -----------------------------------------


def test_kind_translation_is_bijective_for_supported_kinds() -> None:
    """Every API kind maps to a table kind and back to the same value.
    Locks in the contract that the two maps don't drift."""
    for api_kind, table_kind in API_KIND_TO_TABLE.items():
        assert TABLE_KIND_TO_API[table_kind] == api_kind


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


# ---- impact_for_record (pure, post-batch) -------------------------------


def test_impact_for_record_dashboard_path_dataset_related_uses_count() -> None:
    """The only path/related shape that carries impact: ``Dashboard`` →
    ``SqlaTable``. The count comes from the pre-batched lookup."""
    record = {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100}
    counts = {(5, 100): 3}
    assert impact_for_record(record, "Dashboard", counts) == {"charts": 3}


def test_impact_for_record_missing_count_yields_none() -> None:
    """A pair the batch query didn't return (no matching siblings)
    collapses to ``None`` rather than ``{"charts": 0}``."""
    record = {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100}
    assert impact_for_record(record, "Dashboard", {}) is None


def test_impact_for_record_zero_count_yields_none() -> None:
    """Explicit zero in the counts map is treated the same as missing —
    no impact field on the wire."""
    record = {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100}
    assert impact_for_record(record, "Dashboard", {(5, 100): 0}) is None


def test_impact_for_record_dashboard_path_chart_related_yields_none() -> None:
    """Dashboard → chart is a direct dependency; no further sibling
    layer to count."""
    record = {"entity_kind": "chart", "entity_id": 5, "transaction_id": 100}
    assert impact_for_record(record, "Dashboard", {(5, 100): 999}) is None


def test_impact_for_record_chart_path_with_dataset_related_yields_none() -> None:
    """Chart → dataset: the chart is itself the only dependent of the
    dataset edit."""
    record = {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100}
    assert impact_for_record(record, "Slice", {(5, 100): 999}) is None


def test_impact_for_record_dataset_path_yields_none() -> None:
    """Datasets have no transitive layer (AV-004)."""
    record = {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100}
    assert impact_for_record(record, "SqlaTable", {(5, 100): 999}) is None


# ---- collect_impact_pairs -----------------------------------------------


def test_collect_impact_pairs_dashboard_path_collects_only_datasets() -> None:
    """The batched pre-query only needs ``(dataset_id, tx)`` pairs.
    Chart-related and self records aren't relevant."""
    records = [
        {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100},
        {"entity_kind": "dataset", "entity_id": 7, "transaction_id": 200},
        {"entity_kind": "chart", "entity_id": 9, "transaction_id": 300},
        {"entity_kind": "dashboard", "entity_id": 1, "transaction_id": 400},
    ]
    assert collect_impact_pairs(records, "Dashboard") == {(5, 100), (7, 200)}


def test_collect_impact_pairs_dedupes_repeated_pairs() -> None:
    """Multiple change records for the same (dataset, tx) collapse to
    one pair — the batch query computes the count once."""
    records = [
        {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100},
        {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100},
        {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100},
    ]
    pairs = collect_impact_pairs(records, "Dashboard")
    assert pairs == {(5, 100)}


def test_collect_impact_pairs_chart_path_returns_empty() -> None:
    """Chart paths have no dashboard layer to count siblings on, so the
    batch never needs to fire."""
    records = [
        {"entity_kind": "dataset", "entity_id": 5, "transaction_id": 100},
    ]
    assert collect_impact_pairs(records, "Slice") == set()


def test_collect_impact_pairs_dataset_path_returns_empty() -> None:
    records = [
        {"entity_kind": "chart", "entity_id": 5, "transaction_id": 100},
    ]
    assert collect_impact_pairs(records, "SqlaTable") == set()


def test_collect_impact_pairs_empty_records_returns_empty() -> None:
    assert collect_impact_pairs([], "Dashboard") == set()


# ---- parse_activity_query_params (shared API helper) ---------------------


def test_parser_defaults_when_empty() -> None:
    """No params → ``include='all'``, ``page=0``, ``page_size=DEFAULT``."""
    assert parse_activity_query_params({}) == {
        "include": "all",
        "page": 0,
        "page_size": _DEFAULT_PAGE_SIZE,
    }


def test_parser_clamps_page_size_to_max() -> None:
    """A request for more than the contract maximum is clamped, not 400'd
    (silent clamp matches AV-019's bounded-payload guarantee)."""
    params = parse_activity_query_params({"page_size": str(_MAX_PAGE_SIZE * 5)})
    assert params["page_size"] == _MAX_PAGE_SIZE


def test_parser_accepts_iso_datetime_with_z_suffix() -> None:
    """Python <3.11 fromisoformat rejects 'Z'; the parser tolerates it."""
    params = parse_activity_query_params({"since": "2026-01-01T00:00:00Z"})
    assert params["since"].year == 2026


def test_parser_normalises_z_suffix_to_naive_utc() -> None:
    """The 'Z' result must be tz-NAIVE: ``issued_at`` is a naive column, so a
    tz-aware bind shifts the comparison by the session offset (or raises) on
    PostgreSQL. The 'Z' instant is already UTC, so the value is unchanged."""
    since = parse_activity_query_params({"since": "2026-01-01T00:00:00Z"})["since"]
    assert since.tzinfo is None
    assert since == datetime(2026, 1, 1, 0, 0, 0)


def test_parser_normalises_offset_to_naive_utc() -> None:
    """A non-UTC offset is converted to UTC and stripped to naive, so the
    comparison against the naive ``issued_at`` column is in the same frame."""
    since = parse_activity_query_params({"since": "2026-01-01T05:00:00+02:00"})["since"]
    assert since.tzinfo is None
    assert since == datetime(2026, 1, 1, 3, 0, 0)  # 05:00 +02:00 -> 03:00 UTC


def test_parser_rejects_invalid_include() -> None:
    with pytest.raises(ActivityParamsError, match="include"):
        parse_activity_query_params({"include": "sibling"})


def test_parser_rejects_malformed_datetime() -> None:
    with pytest.raises(ActivityParamsError, match="since"):
        parse_activity_query_params({"since": "yesterday"})


def test_parser_rejects_negative_page() -> None:
    with pytest.raises(ActivityParamsError, match="page"):
        parse_activity_query_params({"page": "-1"})


def test_parser_rejects_zero_page_size() -> None:
    with pytest.raises(ActivityParamsError, match="page_size"):
        parse_activity_query_params({"page_size": "0"})


def test_parser_error_is_a_value_error() -> None:
    """``ActivityParamsError`` subclasses ``ValueError`` so callers that
    only know about the standard library exception hierarchy still catch
    it correctly."""
    with pytest.raises(ValueError, match="include"):
        parse_activity_query_params({"include": "nope"})


# ---- Observability metric-key convention (T050 cross-coupling) ----------


def test_metric_prefix_matches_versioning_namespace_convention() -> None:
    """T050: cross-coupling sanity. The activity-view's instrumentation
    prefix (``superset.activity_view.*``) must be a sibling of sc-103156's
    eventual ``superset.versioning.*`` namespace, not nested under
    a different root. Both endpoint families belong to the versioning
    feature; their metrics should be discoverable from one Grafana
    filter (``superset.activity_view.*`` OR ``superset.versioning.*``).

    Locking the prefix in a test catches accidental drift in a code
    review — a future PR renaming the prefix would fail this assertion
    and require explicit acknowledgement.
    """
    from superset.versioning.activity.orchestrator import _METRIC_PREFIX

    assert _METRIC_PREFIX == "superset.activity_view", (
        f"Activity-view metrics prefix changed from "
        f"'superset.activity_view' to {_METRIC_PREFIX!r}. If this was "
        "intentional, update sc-103156's FR-027 instrumentation to "
        "match the new convention OR document the new naming in plan §D-17."
    )
    # Sibling-namespace check: starts with the versioning-feature root.
    assert _METRIC_PREFIX.startswith("superset."), (
        "All Superset metrics live under 'superset.*'; activity_view must too."
    )


# ---- _emit_request_shape_attributes: related-entity counts ---------------
#
# The ``related_entity_count.*`` gauges report how many *other* entities an
# activity request fanned out to. ``resolve_scope`` always prepends the path
# entity itself (the "self" window) to the scope list, so the metric loop
# must exclude that self entry — otherwise a chart/dataset request reports
# one phantom related entity of its own kind.


def _gauge_value(mock_sl: object, suffix: str) -> float:
    """Return the value of the single ``gauge`` call whose metric name ends
    with *suffix*. Fails loudly if absent so a renamed metric surfaces here."""
    for call in mock_sl.gauge.call_args_list:  # type: ignore[attr-defined]
        name = call.args[0]
        if name.endswith(suffix):
            return call.args[1]
    emitted = [c.args[0] for c in mock_sl.gauge.call_args_list]  # type: ignore[attr-defined]
    raise AssertionError(f"no gauge ending {suffix!r}; emitted {emitted}")


@patch("superset.extensions.stats_logger_manager")
def test_related_entity_count_excludes_self_for_chart(mock_mgr) -> None:
    """A chart request scopes to itself + the datasets it used. The charts
    gauge must read 0 (no *related* charts) even though the self Slice is in
    the scope list; the datasets gauge counts only the two related datasets."""
    sl = mock_mgr.instance
    entity_windows: list[EntityWindows] = [
        ("Slice", 7, [Window(0, None)]),  # self — must not be counted
        ("SqlaTable", 5, [Window(0, None)]),  # related dataset
        ("SqlaTable", 9, [Window(0, None)]),  # related dataset
    ]

    _emit_request_shape_attributes(
        "slice",
        include="all",
        has_since_filter=False,
        page_size=25,
        record_count=3,
        entity_windows=entity_windows,
        path_kind="Slice",
        path_id=7,
    )

    assert _gauge_value(sl, "related_entity_count.charts") == 0.0
    assert _gauge_value(sl, "related_entity_count.datasets") == 2.0


@patch("superset.extensions.stats_logger_manager")
def test_related_entity_count_excludes_self_for_dataset(mock_mgr) -> None:
    """Datasets have no related scope, so an ``include=all`` dataset request
    scopes to itself only. The datasets gauge must read 0, not 1."""
    sl = mock_mgr.instance
    entity_windows: list[EntityWindows] = [
        ("SqlaTable", 9, [Window(0, None)]),  # self only
    ]

    _emit_request_shape_attributes(
        "sqlatable",
        include="all",
        has_since_filter=False,
        page_size=25,
        record_count=1,
        entity_windows=entity_windows,
        path_kind="SqlaTable",
        path_id=9,
    )

    assert _gauge_value(sl, "related_entity_count.datasets") == 0.0


@patch("superset.extensions.stats_logger_manager")
def test_related_entity_count_counts_genuine_related_of_same_kind(mock_mgr) -> None:
    """Self-exclusion keys on (kind, id), not kind alone: a dashboard whose
    scope happened to include another dashboard would still count it."""
    sl = mock_mgr.instance
    entity_windows: list[EntityWindows] = [
        ("Dashboard", 1, [Window(0, None)]),  # self
        ("Slice", 5, [Window(0, None)]),  # related chart
        ("Slice", 6, [Window(0, None)]),  # related chart
    ]

    _emit_request_shape_attributes(
        "dashboard",
        include="all",
        has_since_filter=False,
        page_size=25,
        record_count=2,
        entity_windows=entity_windows,
        path_kind="Dashboard",
        path_id=1,
    )

    assert _gauge_value(sl, "related_entity_count.charts") == 2.0


def test_parser_passes_q_through_and_drops_blank() -> None:
    """``q`` reaches get_activity stripped; blank/missing stays absent."""
    assert parse_activity_query_params({"q": "  revenue  "})["q"] == "revenue"
    assert "q" not in parse_activity_query_params({})
    assert "q" not in parse_activity_query_params({"q": "   "})


def test_record_matches_searches_decorated_surfaces() -> None:
    """The q filter covers summary, entity_name, kind, path, and values —
    case-insensitively (PR #40988: client search only covered loaded
    pages; the server filter must cover the same surfaces)."""
    from superset.versioning.activity.orchestrator import _record_matches

    record = {
        "summary": "Dataset updated: Sales Transactions",
        "entity_name": "Sales Transactions",
        "kind": "field",
        "path": ["params", "adhoc_filters", "country"],
        "from_value": None,
        "to_value": {"label": "Revenue (EUR)"},
    }
    assert _record_matches(record, "sales")  # entity_name/summary
    assert _record_matches(record, "COUNTRY")  # path segment
    assert _record_matches(record, "revenue (eur)")  # to_value
    assert not _record_matches(record, "nonexistent")


def test_record_matches_falsy_values_and_json_form() -> None:
    """Falsy values must stay searchable (False/0 must not collapse to
    ''), and values match in their JSON form — the text the client
    renders — not Python repr."""
    from superset.versioning.activity.orchestrator import _record_matches

    record = {
        "summary": "",
        "entity_name": "",
        "kind": "field",
        "path": ["params", "show_legend"],
        "from_value": True,
        "to_value": False,
    }
    assert _record_matches(record, "false")  # JSON 'false', not Python 'False'
    assert _record_matches(record, "true")
    zero = {**record, "path": ["params", "row_limit"], "from_value": 10, "to_value": 0}
    assert _record_matches(zero, "0")
    nested = {**record, "to_value": {"label": "Revenue"}}
    assert _record_matches(nested, '"label"')  # JSON double-quoted key


def test_build_summary_meta_headline_branches() -> None:
    """The __meta__ headline dispatches on the transaction's action_kind
    (path is pure navigation): restore renders 'restored to version N'
    (with entity_name when present); unknown meta actions fall back to
    'updated'."""
    restore = {
        "kind": "__meta__",
        "action_kind": "restore",
        "path": ["__meta__"],
        "to_value": {"version_uuid": "u", "version_number": 3},
        "entity_name": "Top 10 Girls",
    }
    assert _build_summary("Slice", restore) == (
        "Chart restored to version 3: Top 10 Girls"
    )
    nameless = {**restore, "entity_name": ""}
    assert _build_summary("Slice", nameless) == "Chart restored to version 3"
    unknown = {
        "kind": "__meta__",
        "action_kind": "import",
        "path": ["__meta__"],
        "to_value": {},
        "entity_name": "",
    }
    assert _build_summary("Dashboard", unknown) == "Dashboard updated"
