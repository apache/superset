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
    ],
)
def test_dashboard_context_filters_are_non_derivable(params: dict[str, Any]) -> None:
    """Charts carrying ``extra_filters`` / ``extra_form_data`` are left NULL."""
    assert build_query_context_config(params, "table", 1, "table") is None


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
