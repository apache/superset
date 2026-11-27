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
"""
Pure-classification tests for ``query_context_builder`` (Apache Superset #33615).

These cover the honest-fail gates that run *before* the canonical builder is
invoked (so they need no app context): the viz-type allowlist, the
dashboard-context-filter guard, and the adhoc ``TEMPORAL_RANGE`` preservation
that stops a builder-injected ``"No filter"`` from broadening the result.
"""

from __future__ import annotations

from typing import Any

import pytest

from superset.commands.chart.query_context_builder import (
    _preserve_adhoc_temporal_range,
    bind_slice_id,
    build_query_context_config,
)


@pytest.mark.parametrize("viz_type", ["sankey_v2", "graph_chart", "sankey", "nope"])
def test_non_mapped_viz_type_is_non_derivable(viz_type: str) -> None:
    """
    A viz type the canonical builder has no explicit adapter for is left NULL.

    The generic top-N branch would emit a plausible-looking but wrong context
    (one aggregate row instead of edges), so synthesis must honest-fail rather
    than persist it (#33615 review). Returns None *before* the builder runs, so
    no app context is required.
    """
    params = {"viz_type": viz_type, "metric": "count", "groupby": ["source"]}
    assert build_query_context_config(params, viz_type, 1, "table") is None


@pytest.mark.parametrize(
    "params",
    [
        {"viz_type": "table", "extra_filters": [{"col": "country", "val": "US"}]},
        {
            "viz_type": "table",
            "extra_form_data": {"filters": [{"col": "country", "val": "US"}]},
        },
        {"viz_type": "table", "extra_form_data": {"time_range": "Last week"}},
        # A non-filter override (only ``time_grain_sqla``) still changes the rows
        # the live chart returns, so it must be non-derivable too (#33615 review).
        {"viz_type": "table", "extra_form_data": {"time_grain_sqla": "P1M"}},
        # The ``_b`` variants feed the second query of a ``mixed_timeseries``
        # chart; synthesizing would leave that query unfiltered.
        {
            "viz_type": "mixed_timeseries",
            "extra_filters_b": [{"col": "country", "val": "US"}],
        },
        {
            "viz_type": "mixed_timeseries",
            "extra_form_data_b": {"filters": [{"col": "country", "val": "US"}]},
        },
    ],
)
def test_dashboard_context_filters_are_non_derivable(params: dict[str, Any]) -> None:
    """Charts carrying ``extra_filters`` / ``extra_form_data`` are left NULL."""
    assert build_query_context_config(params, params["viz_type"], 1, "table") is None


@pytest.mark.parametrize(
    "params",
    [
        {"viz_type": "table"},
        # An *empty* override block is not an override: it must stay derivable.
        {"viz_type": "table", "extra_filters": [], "extra_form_data": {}},
        {"viz_type": "mixed_timeseries", "extra_form_data_b": {}},
    ],
)
def test_empty_dashboard_context_blocks_stay_derivable(
    params: dict[str, Any],
) -> None:
    """Absent or empty ``extra_*`` blocks do not force a chart non-derivable."""
    from superset.commands.chart.query_context_builder import (
        _has_dashboard_context_filters,
    )

    assert _has_dashboard_context_filters(params) is False


def test_missing_datasource_and_datasourceless_viz_are_non_derivable() -> None:
    assert build_query_context_config({"viz_type": "table"}, "table", None) is None
    assert build_query_context_config({"viz_type": "markup"}, "markup", 1) is None


def test_preserve_adhoc_temporal_range_drops_injected_no_filter() -> None:
    """A bound TEMPORAL_RANGE filter must survive the injected ``"No filter"``."""
    context = {
        "queries": [
            {
                "time_range": "No filter",
                "filters": [
                    {
                        "col": "ds",
                        "op": "TEMPORAL_RANGE",
                        "val": "2020-01-01 : 2020-02-01",
                    }
                ],
            }
        ]
    }
    _preserve_adhoc_temporal_range(context)
    # The sentinel is dropped so ``_apply_filters`` cannot clobber the range.
    assert "time_range" not in context["queries"][0]


def test_preserve_adhoc_temporal_range_keeps_unbounded_and_plain_filters() -> None:
    """Only a *bound* TEMPORAL_RANGE triggers the drop; others are untouched."""
    unbounded = {
        "queries": [
            {
                "time_range": "No filter",
                "filters": [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}],
            }
        ]
    }
    _preserve_adhoc_temporal_range(unbounded)
    assert unbounded["queries"][0]["time_range"] == "No filter"

    non_temporal = {
        "queries": [
            {
                "time_range": "No filter",
                "filters": [{"col": "country", "op": "==", "val": "US"}],
            }
        ]
    }
    _preserve_adhoc_temporal_range(non_temporal)
    assert non_temporal["queries"][0]["time_range"] == "No filter"


def test_bind_slice_id_sets_local_id_in_embedded_form_data() -> None:
    context: dict[str, Any] = {"form_data": {"viz_type": "table"}, "queries": [{}]}
    assert bind_slice_id(context, 4242) is context
    assert context["form_data"]["slice_id"] == 4242


def test_build_config_preserves_bound_temporal_range(app_context: None) -> None:
    """
    End-to-end through ``build_query_context_config``: a bound ``TEMPORAL_RANGE``
    adhoc filter with no top-level ``time_range`` keeps its range and gets no
    query-level ``time_range`` sentinel. Removing the ``_preserve_...`` call from
    ``build_query_context_config`` reinstates ``"No filter"`` and fails this.
    """
    params = {
        "viz_type": "table",
        "metrics": ["count"],
        "groupby": ["name"],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "2020-01-01 : 2020-02-01",
            }
        ],
    }

    context = build_query_context_config(params, "table", 1, "table")

    assert context is not None
    query = context["queries"][0]
    assert "time_range" not in query
    temporal = [f for f in query.get("filters", []) if f.get("op") == "TEMPORAL_RANGE"]
    assert temporal
    assert temporal[0]["val"] == "2020-01-01 : 2020-02-01"


def test_preserve_adhoc_temporal_range_is_per_query() -> None:
    """
    Preservation is decided per query, not per chart (#33615 review).

    A ``mixed_timeseries`` context has query A with its own explicit range and
    query B (built from the ``_b`` controls) carrying the builder's injected
    ``"No filter"`` over a bound ``TEMPORAL_RANGE`` filter. A's real range must be
    left intact while B's sentinel is dropped.
    """
    context = {
        "queries": [
            {
                "time_range": "2021-01-01 : 2021-02-01",
                "filters": [
                    {
                        "col": "ds",
                        "op": "TEMPORAL_RANGE",
                        "val": "2021-01-01 : 2021-02-01",
                    }
                ],
            },
            {
                "time_range": "No filter",
                "filters": [
                    {
                        "col": "ds",
                        "op": "TEMPORAL_RANGE",
                        "val": "2020-01-01 : 2020-02-01",
                    }
                ],
            },
        ]
    }
    _preserve_adhoc_temporal_range(context)
    # Query A kept its real range; only query B's injected sentinel was dropped.
    assert context["queries"][0]["time_range"] == "2021-01-01 : 2021-02-01"
    assert "time_range" not in context["queries"][1]


def test_build_config_preserves_temporal_range_per_query_not_per_chart(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Regression for the removed chart-wide ``had_explicit_time_range`` gate.

    Query A has an explicit top-level range; query B (the ``_b`` series of a
    ``mixed_timeseries`` chart) carries the builder's injected ``"No filter"``
    over a bound ``TEMPORAL_RANGE`` of its own. The old gate skipped preservation
    for *both* queries because the chart had a top-level range, so at read time
    B's bound filter was overwritten with ``"No filter"`` and returned every date.
    ``build_query_context_config`` must now preserve B regardless. The canonical
    builder is stubbed so the assertion targets the gate, not the builder output.
    """
    built = {
        "queries": [
            {"time_range": "2021-01-01 : 2021-02-01", "filters": []},
            {
                "time_range": "No filter",
                "filters": [
                    {
                        "col": "ds",
                        "op": "TEMPORAL_RANGE",
                        "val": "2020-01-01 : 2020-02-01",
                    }
                ],
            },
        ]
    }
    monkeypatch.setattr(
        "superset.commands.chart.query_context_builder."
        "build_query_context_from_form_data",
        lambda *args, **kwargs: built,
    )
    params = {
        "viz_type": "mixed_timeseries",
        "metrics": ["count"],
        # Query A's explicit top-level range — the condition the old gate keyed on.
        "time_range": "2021-01-01 : 2021-02-01",
    }

    context = build_query_context_config(params, "mixed_timeseries", 1, "table")

    assert context is not None
    assert context["queries"][0]["time_range"] == "2021-01-01 : 2021-02-01"
    assert "time_range" not in context["queries"][1]


def test_build_config_keeps_explicit_top_level_time_range(app_context: None) -> None:
    """Control: an explicit top-level ``time_range`` is never stripped."""
    params = {
        "viz_type": "table",
        "metrics": ["count"],
        "groupby": ["name"],
        "time_range": "2021-01-01 : 2021-02-01",
    }

    context = build_query_context_config(params, "table", 1, "table")

    assert context is not None
    assert context["queries"][0]["time_range"] == "2021-01-01 : 2021-02-01"
