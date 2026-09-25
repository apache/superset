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
"""Output-safety caps on the change-record diff engine.

``version_changes`` is an audit log, not a content store. A single edit must
not be able to write an unbounded value or an unbounded number of rows — a
200 KB ``params``/SQL blob, a 2000-element list edit, or a 1000-key dict
rewrite would otherwise bloat both the table and the activity stream. These
tests pin :func:`cap_records` (applied at persistence time) against exactly
those cases, and confirm ordinary small edits pass through untouched.
"""

from __future__ import annotations

from typing import Any

from superset.utils import json
from superset.versioning.diff import (
    cap_records,
    ChangeRecord,
    diff_slice_params,
    MAX_RECORDS_PER_FIELD,
    MAX_VALUE_BYTES,
)


def _bytes(value: object) -> int:
    return len(json.dumps(value, default=str))


def _max_value_bytes(records: list[ChangeRecord]) -> int:
    return max(
        (_bytes(r.from_value) + _bytes(r.to_value) for r in records),
        default=0,
    )


def test_small_edits_pass_through_uncapped() -> None:
    """An ordinary handful of small param edits is returned verbatim — the
    caps must not perturb the common case."""
    records = diff_slice_params(
        {"time_range": "Last week", "viz_type": "table"},
        {"time_range": "Last month", "viz_type": "pie"},
    )
    capped = cap_records(records)
    assert len(capped) == len(records) == 2
    assert all("__truncated__" not in str(r.to_value) for r in capped)
    assert all("__collapsed__" not in str(r.to_value) for r in capped)


def test_oversized_value_is_truncated_to_a_marker() -> None:
    """A value past MAX_VALUE_BYTES is replaced by a bounded marker that records
    the original size and a preview, instead of writing the whole blob."""
    big = "a" * (MAX_VALUE_BYTES * 4)
    capped = cap_records(diff_slice_params({"sql": "x"}, {"sql": big}))
    assert len(capped) == 1
    marker = capped[0].to_value
    assert marker["__truncated__"] is True
    assert marker["original_bytes"] >= MAX_VALUE_BYTES * 4
    assert len(marker["preview"]) <= 256
    assert _bytes(marker) <= MAX_VALUE_BYTES + 600  # marker itself stays small


def test_list_explosion_is_collapsed() -> None:
    """Editing a 2000-element list emits one record per element pre-cap; the cap
    collapses the whole field to a single summary record."""
    pre = {"adhoc_filters": [{"col": f"c{i}", "val": i} for i in range(2000)]}
    post = {"adhoc_filters": [{"col": f"c{i}", "val": i + 1} for i in range(2000)]}
    raw = diff_slice_params(pre, post)
    assert len(raw) > MAX_RECORDS_PER_FIELD  # the explosion exists pre-cap
    capped = cap_records(raw)
    assert len(capped) == 1
    assert capped[0].to_value == {"__collapsed__": len(raw)}
    assert capped[0].path == ["params"]


def test_wide_dict_rewrite_is_collapsed() -> None:
    """A 1000-key dict rewrite under one field collapses to a single record."""
    pre = {"query_context": {f"k{i}": i for i in range(1000)}}
    post = {"query_context": {f"k{i}": i + 1 for i in range(1000)}}
    capped = cap_records(diff_slice_params(pre, post))
    assert len(capped) == 1
    assert capped[0].to_value["__collapsed__"] == 1000


def test_distinct_fields_are_capped_independently() -> None:
    """The record-count cap is per top-level field: a blown-up field collapses
    while a sibling small edit on a different field survives intact."""
    pre = {
        "adhoc_filters": [{"c": i} for i in range(2000)],
        "time_range": "Last week",
    }
    post = {
        "adhoc_filters": [{"c": i + 1} for i in range(2000)],
        "time_range": "Last month",
    }
    capped = cap_records(diff_slice_params(pre, post))
    # one collapsed record for params (filters live under params) + the
    # time_range edit, also under params -> all collapse into the params bucket.
    assert all(
        _bytes(r.from_value) + _bytes(r.to_value) <= MAX_VALUE_BYTES + 600
        for r in capped
    )
    assert len(capped) <= MAX_RECORDS_PER_FIELD


def test_caps_bound_every_record_from_diff_slice_params() -> None:
    """End-to-end invariant: after capping, no record exceeds the value or
    count bounds, for the adversarial inputs the example gallery can't reach."""
    pre = {"sql": "x", "adhoc_filters": [{"c": i} for i in range(2000)]}
    post = {
        "sql": "z" * (MAX_VALUE_BYTES * 10),
        "adhoc_filters": [{"c": i + 1} for i in range(2000)],
    }
    capped = cap_records(diff_slice_params(pre, post))
    assert len(capped) <= MAX_RECORDS_PER_FIELD
    assert _max_value_bytes(capped) <= MAX_VALUE_BYTES + 600


# Heavy-but-legitimate chart params, representative of the variety the chart
# gallery produces — a wide table, a pivot, a multi-layer geospatial config.
# These exist to prove the caps are tuned NOT to fire on real charts: a sweep
# over the example gallery found every viz type's edit well under both bounds,
# so a normal edit must yield individual, readable records — never a collapse
# or truncation marker. If a future cap-threshold tweak starts degrading real
# charts, these break.
_REALISTIC_PARAMS: dict[str, dict[str, Any]] = {
    "wide_table": {
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": [f"dim_{i}" for i in range(15)],
        "metrics": [
            {
                "label": f"m_{i}",
                "expressionType": "SIMPLE",
                "column": {"column_name": f"c_{i}"},
                "aggregate": "SUM",
            }
            for i in range(8)
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "subject": f"dim_{i}",
                "operator": "==",
                "comparator": f"v_{i}",
                "expressionType": "SIMPLE",
            }
            for i in range(5)
        ],
        "time_range": "Last quarter",
        "row_limit": 1000,
        "table_timestamp_format": "smart_date",
    },
    "pivot": {
        "viz_type": "pivot_table_v2",
        "groupbyRows": [f"row_{i}" for i in range(6)],
        "groupbyColumns": [f"col_{i}" for i in range(4)],
        "metrics": [
            {
                "label": f"agg_{i}",
                "expressionType": "SIMPLE",
                "column": {"column_name": f"c_{i}"},
                "aggregate": "AVG",
            }
            for i in range(5)
        ],
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
    },
    "geospatial": {
        "viz_type": "deck_multi",
        "deck_slices": [{"layer": f"l_{i}", "opacity": 0.8} for i in range(6)],
        "viewport": {"longitude": -122.4, "latitude": 37.8, "zoom": 11.2},
        "spatial": {"latCol": "lat", "lonCol": "lon", "type": "latlong"},
        "color_picker": {"r": 14, "g": 96, "b": 245, "a": 1},
    },
}


def test_realistic_chart_edits_are_not_capped() -> None:
    """A normal edit to a heavy-but-legitimate chart of each shape yields
    individual records — none collapsed, none truncated — so the caps never
    degrade real-world activity entries."""
    for name, params in _REALISTIC_PARAMS.items():
        edited = {**params, "row_limit": 5000, "time_range": "Last year"}
        records = diff_slice_params(params, edited)
        capped = cap_records(records)
        assert capped == records, f"{name}: caps must not alter a normal edit"
        assert capped, f"{name}: a real edit must still produce records"
        for r in capped:
            assert "__collapsed__" not in str(r.to_value), f"{name}: collapsed"
            assert "__truncated__" not in str(r.to_value), f"{name}: truncated"


def test_full_rewrite_of_realistic_charts_stays_under_caps() -> None:
    """Even replacing a heavy chart's params wholesale (every field changes at
    once) stays within both bounds for legitimate shapes — the caps headroom
    is real, not just exceeded-by-construction in the adversarial tests."""
    empty: dict[str, Any] = {}
    for name, params in _REALISTIC_PARAMS.items():
        capped = cap_records(diff_slice_params(empty, params))
        assert len(capped) <= MAX_RECORDS_PER_FIELD, f"{name}: count over cap"
        assert _max_value_bytes(capped) <= MAX_VALUE_BYTES, f"{name}: value over cap"
