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
from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
from flask import current_app

from superset.dashboards.excel_export.sync_budget import plan_inline_export
from superset.utils import json

MODULE = "superset.dashboards.excel_export.sync_budget"


def _chart(chart_id: int, *queries: dict[str, Any]) -> mock.MagicMock:
    """A chart whose saved query context holds ``queries``."""
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = f"Chart {chart_id}"
    chart.viz_type = "table"
    chart.query_context = json.dumps({"queries": list(queries)})
    return chart


def _unexportable_chart(chart_id: int) -> mock.MagicMock:
    """A chart the export has to skip: no context, and no rebuilding it."""
    chart = _chart(chart_id)
    chart.query_context = None
    chart.viz_type = "mixed_timeseries"  # outside the rebuild allowlist
    return chart


@pytest.fixture
def charts() -> Iterator[mock.MagicMock]:
    """Patch the layout walk so tests supply the dashboard's charts directly."""
    with mock.patch(f"{MODULE}.get_charts_in_layout_order") as ordered:
        yield ordered


@pytest.fixture(autouse=True)
def restore_config() -> Iterator[None]:
    """Undo config edits: the app fixture is shared by every test in the module."""
    original = current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"]
    yield
    current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"] = original


def test_plan_sums_the_row_limit_of_every_chart(charts: mock.MagicMock) -> None:
    charts.return_value = [
        _chart(10, {"row_limit": 1000}),
        _chart(20, {"row_limit": 250}),
    ]

    assert plan_inline_export(mock.MagicMock()).requested_rows == 1250


def test_plan_counts_every_query_of_a_multi_query_chart(
    charts: mock.MagicMock,
) -> None:
    # A mixed-series chart fans out to several queries, each of which becomes its
    # own sheet and runs its own row_limit worth of rows.
    charts.return_value = [_chart(10, {"row_limit": 100}, {"row_limit": 400})]

    assert plan_inline_export(mock.MagicMock()).requested_rows == 500


@pytest.mark.parametrize(
    "query",
    [
        {},  # no row_limit at all
        {"row_limit": 0},  # 0 means "fall back to the configured limits"
        {"row_limit": None},
        {"row_limit": "1000"},  # not an integer
        {"row_limit": -5},
    ],
)
def test_plan_row_total_is_indeterminate_without_a_finite_row_limit(
    charts: mock.MagicMock, query: dict[str, Any]
) -> None:
    # Without a finite limit on every query the export's size is unknown, so the
    # plan cannot vouch for it and the caller must not run it inline.
    charts.return_value = [_chart(10, {"row_limit": 100}), _chart(20, query)]

    plan = plan_inline_export(mock.MagicMock())

    assert plan.requested_rows is None
    assert plan.fits_row_budget is False


def test_plan_ignores_charts_that_cannot_be_exported(charts: mock.MagicMock) -> None:
    # A chart with no usable query context is skipped by the export itself, so it
    # runs no query and cannot contribute rows.
    charts.return_value = [_chart(10, {"row_limit": 100}), _unexportable_chart(20)]

    assert plan_inline_export(mock.MagicMock()).requested_rows == 100


@pytest.mark.parametrize(
    ("row_limit", "fits"),
    [
        (99_999, True),  # below the limit
        (100_000, True),  # exactly at the limit
        (100_001, False),  # above the limit
    ],
)
def test_plan_fits_totals_up_to_and_including_the_limit(
    charts: mock.MagicMock, row_limit: int, fits: bool
) -> None:
    charts.return_value = [_chart(10, {"row_limit": row_limit})]

    assert plan_inline_export(mock.MagicMock()).fits_row_budget is fits


def test_plan_honors_the_configured_limit(charts: mock.MagicMock) -> None:
    charts.return_value = [_chart(10, {"row_limit": 5_000})]
    current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"] = 1_000

    assert plan_inline_export(mock.MagicMock()).fits_row_budget is False

    current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"] = 10_000

    assert plan_inline_export(mock.MagicMock()).fits_row_budget is True


def test_plan_carries_the_resolved_context_of_every_chart(
    charts: mock.MagicMock,
) -> None:
    # The plan hands back what it resolved so the export runs exactly the queries
    # the budget was measured against, rather than resolving a second time.
    exportable = _chart(10, {"row_limit": 100})
    charts.return_value = [exportable, _unexportable_chart(20)]

    plan = plan_inline_export(mock.MagicMock())

    assert plan.query_contexts[10] == {"queries": [{"row_limit": 100}]}
    # Present but None: resolved, and resolved to "this chart cannot be exported".
    assert 20 in plan.query_contexts
    assert plan.query_contexts[20] is None


def test_plan_resolves_each_chart_exactly_once(charts: mock.MagicMock) -> None:
    # Resolution can be expensive and, through
    # EXCEL_EXPORT_QUERY_CONTEXT_BUILDER, need not be deterministic, so the plan
    # must not resolve a chart it has already resolved.
    charts.return_value = [_chart(10, {"row_limit": 1}), _chart(20, {"row_limit": 2})]

    with mock.patch(f"{MODULE}.resolve_query_context") as resolve:
        resolve.return_value = {"queries": [{"row_limit": 1}]}
        plan_inline_export(mock.MagicMock())

    assert resolve.call_count == 2
