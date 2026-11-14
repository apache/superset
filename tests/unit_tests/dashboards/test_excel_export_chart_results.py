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
"""Tests for the per-chart export steps shared by Excel and extension exports."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from superset_core.exports.types import (
    ChartQueryResult,
    ChartResult,
    GenericDataType,
    SkipReason,
)

from superset.dashboards.excel_export.chart_results import (
    chart_result,
    iter_dashboard_chart_results,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

MODULE = "superset.dashboards.excel_export.chart_results"


def _chart(chart_id: int, name: str) -> mock.MagicMock:
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = name
    chart.viz_type = "table"
    return chart


@pytest.fixture
def mocks(app_context: None) -> Iterator[dict[str, Any]]:
    with mock.patch.multiple(
        MODULE,
        run_query_context=mock.DEFAULT,
        get_dashboard_filter_context=mock.DEFAULT,
        apply_dashboard_filter_context=mock.DEFAULT,
        resolve_query_context=mock.DEFAULT,
        get_charts_in_layout_order=mock.DEFAULT,
        DashboardDAO=mock.DEFAULT,
    ) as patched:
        patched["get_dashboard_filter_context"].return_value.extra_form_data = {}
        patched["resolve_query_context"].return_value = {"queries": [{}]}
        patched["run_query_context"].return_value = []
        yield patched


def test_chart_result_runs_prepared_context(mocks: dict[str, Any]) -> None:
    mocks["run_query_context"].return_value = [
        ChartQueryResult(["a"], [GenericDataType.NUMERIC], [{"a": 1}])
    ]
    result = chart_result(_chart(7, "Sales"), 1, {}, {"queries": [{}], "force": True})
    body = mocks["run_query_context"].call_args.args[0]
    assert body["result_format"] == "json"
    assert body["result_type"] == "full"
    assert "force" not in body
    assert body["form_data"]["dashboardId"] == 1
    assert result == ChartResult(
        7, "Sales", mocks["run_query_context"].return_value, None
    )


def test_save_as_chart_slice_id_is_restamped(mocks: dict[str, Any]) -> None:
    chart_result(
        _chart(7, "Copy"), 1, {}, {"queries": [{}], "form_data": {"slice_id": 3}}
    )
    assert mocks["run_query_context"].call_args.args[0]["form_data"]["slice_id"] == 7


def test_given_query_context_skips_resolution(mocks: dict[str, Any]) -> None:
    chart_result(_chart(7, "x"), 1, {}, {"queries": [{}]})
    mocks["resolve_query_context"].assert_not_called()


def test_missing_query_context_resolves(mocks: dict[str, Any]) -> None:
    chart_result(_chart(7, "x"), 1, {})
    mocks["resolve_query_context"].assert_called_once()


def test_none_context_is_no_query_context_skip(mocks: dict[str, Any]) -> None:
    result = chart_result(_chart(7, "x"), 1, {}, None)
    assert result.skipped_reason is SkipReason.NO_QUERY_CONTEXT
    mocks["run_query_context"].assert_not_called()


def test_access_denied_is_general_skip(mocks: dict[str, Any]) -> None:
    error = SupersetError(
        message="denied",
        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )
    mocks["run_query_context"].side_effect = SupersetSecurityException(error)
    result = chart_result(_chart(7, "x"), 1, {}, {"queries": [{}]})
    assert result.skipped_reason is SkipReason.GENERAL


def test_timeout_propagates(mocks: dict[str, Any]) -> None:
    mocks["run_query_context"].side_effect = SoftTimeLimitExceeded()
    with pytest.raises(SoftTimeLimitExceeded):
        chart_result(_chart(7, "x"), 1, {}, {"queries": [{}]})


def test_filters_applied_per_chart(mocks: dict[str, Any]) -> None:
    mocks["get_dashboard_filter_context"].return_value.extra_form_data = {
        "filters": [1]
    }
    chart_result(_chart(7, "x"), 1, {"F1": {}}, {"queries": [{}]})
    mocks["get_dashboard_filter_context"].assert_called_once_with(
        dashboard_id=1, chart_id=7, active_data_mask={"F1": {}}
    )
    mocks["apply_dashboard_filter_context"].assert_called_once()


def test_iterator_yields_every_chart_in_layout_order_and_continues_after_a_skip(
    mocks: dict[str, Any],
) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(1, "a"), _chart(2, "b")]
    mocks["run_query_context"].side_effect = [ValueError("boom"), []]
    results = list(iter_dashboard_chart_results(9, {}))
    assert [(r.chart_id, r.skipped_reason) for r in results] == [
        (1, SkipReason.GENERAL),
        (2, None),
    ]


def test_iterator_yields_earlier_results_then_propagates_a_timeout(
    mocks: dict[str, Any],
) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(1, "a"), _chart(2, "b")]
    mocks["run_query_context"].side_effect = [[], SoftTimeLimitExceeded()]
    results = iter_dashboard_chart_results(9, {})

    assert next(results) == ChartResult(1, "a", [], None)
    with pytest.raises(SoftTimeLimitExceeded):
        next(results)


def test_iterator_yields_nothing_for_a_missing_dashboard(
    mocks: dict[str, Any],
) -> None:
    mocks["DashboardDAO"].find_by_id.return_value = None
    assert list(iter_dashboard_chart_results(9, {})) == []
    mocks["get_charts_in_layout_order"].assert_not_called()


def test_resolution_failure_is_general_skip(mocks: dict[str, Any]) -> None:
    mocks["resolve_query_context"].side_effect = ValueError("bad params")
    result = chart_result(_chart(7, "x"), 1, {})
    assert result == ChartResult(7, "x", [], SkipReason.GENERAL)
    mocks["run_query_context"].assert_not_called()
