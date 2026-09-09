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

from superset.dashboards.excel_export.sync_budget import (
    is_within_sync_row_budget,
    requested_row_total,
)
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


def test_row_total_sums_the_row_limit_of_every_chart(charts: mock.MagicMock) -> None:
    charts.return_value = [
        _chart(10, {"row_limit": 1000}),
        _chart(20, {"row_limit": 250}),
    ]

    assert requested_row_total(mock.MagicMock(), "data") == 1250


def test_row_total_counts_every_query_of_a_multi_query_chart(
    charts: mock.MagicMock,
) -> None:
    # A mixed-series chart fans out to several queries, each of which becomes its
    # own sheet and runs its own row_limit worth of rows.
    charts.return_value = [_chart(10, {"row_limit": 100}, {"row_limit": 400})]

    assert requested_row_total(mock.MagicMock(), "data") == 500


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
def test_row_total_is_indeterminate_without_a_finite_row_limit(
    charts: mock.MagicMock, query: dict[str, Any]
) -> None:
    # Without a finite limit on every query the export's size is unknown, so the
    # budget cannot vouch for it and the caller must not run it inline.
    charts.return_value = [_chart(10, {"row_limit": 100}), _chart(20, query)]

    assert requested_row_total(mock.MagicMock(), "data") is None


def test_row_total_ignores_charts_that_cannot_be_exported(
    charts: mock.MagicMock,
) -> None:
    # A chart with no usable query context is skipped by the export itself, so it
    # runs no query and cannot contribute rows.
    skipped = _chart(20)
    skipped.query_context = None
    skipped.viz_type = "mixed_timeseries"  # outside the rebuild allowlist
    charts.return_value = [_chart(10, {"row_limit": 100}), skipped]

    assert requested_row_total(mock.MagicMock(), "data") == 100


def test_row_total_ignores_charts_rendered_as_images(charts: mock.MagicMock) -> None:
    # In image mode a non-table chart is rendered through the webdriver instead of
    # queried, so its row_limit is not part of the row budget.
    rendered = _chart(20, {"row_limit": 999_999})
    rendered.viz_type = "pie"  # not a table viz type, so it renders as an image
    charts.return_value = [_chart(10, {"row_limit": 100}), rendered]

    assert requested_row_total(mock.MagicMock(), "images") == 100


@pytest.mark.parametrize(
    ("row_limit", "within"),
    [
        (99_999, True),  # below the limit
        (100_000, True),  # exactly at the limit
        (100_001, False),  # above the limit
    ],
)
def test_budget_allows_totals_up_to_and_including_the_limit(
    charts: mock.MagicMock, row_limit: int, within: bool
) -> None:
    charts.return_value = [_chart(10, {"row_limit": row_limit})]

    assert is_within_sync_row_budget(mock.MagicMock(), "data") is within


def test_budget_refuses_an_indeterminate_total(charts: mock.MagicMock) -> None:
    charts.return_value = [_chart(10, {})]

    assert is_within_sync_row_budget(mock.MagicMock(), "data") is False


def test_budget_honors_the_configured_limit(charts: mock.MagicMock) -> None:
    charts.return_value = [_chart(10, {"row_limit": 5_000})]
    current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"] = 1_000

    assert is_within_sync_row_budget(mock.MagicMock(), "data") is False

    current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"] = 10_000

    assert is_within_sync_row_budget(mock.MagicMock(), "data") is True
