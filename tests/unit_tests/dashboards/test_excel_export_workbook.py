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
"""Tests for passing already-resolved query contexts into the workbook builder.

The builder's own behavior (sheet naming, skipped charts, filter application) is
covered through the Celery task in
``tests/unit_tests/tasks/test_export_dashboard_excel.py``.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest

from superset.dashboards.excel_export.workbook import build_workbook
from superset.utils import json

MODULE = "superset.dashboards.excel_export.workbook"


def _chart(chart_id: int, name: str) -> mock.MagicMock:
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = name
    chart.viz_type = "table"
    chart.query_context = json.dumps({"queries": [{"row_limit": 100}]})
    return chart


@pytest.fixture
def mocks() -> Iterator[dict[str, Any]]:
    """Patch the builder's collaborators; keep the real xlsx writer."""
    with mock.patch.multiple(
        MODULE,
        get_charts_in_layout_order=mock.DEFAULT,
        get_dashboard_filter_context=mock.DEFAULT,
        ChartDataQueryContextSchema=mock.DEFAULT,
        ChartDataCommand=mock.DEFAULT,
        resolve_query_context=mock.DEFAULT,
    ) as patched:
        patched["get_dashboard_filter_context"].return_value.extra_form_data = {}
        patched["ChartDataCommand"].return_value.run.return_value = {
            "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
        }
        yield patched


@pytest.fixture
def workbook_path() -> Iterator[str]:
    file_descriptor, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(file_descriptor)
    yield path
    if os.path.exists(path):
        os.remove(path)


def _build(path: str, **kwargs: Any) -> Any:
    dashboard = mock.MagicMock()
    dashboard.id = 1
    return build_workbook(
        path, dashboard, {}, "job-1", "data", mock.MagicMock(), **kwargs
    )


def test_provided_query_context_is_used_without_resolving_again(
    mocks: dict[str, Any], workbook_path: str
) -> None:
    # The context the caller measured its row budget against is the one that runs:
    # resolving a second time could yield a different query than was vouched for.
    chart = _chart(10, "First")
    mocks["get_charts_in_layout_order"].return_value = [chart]
    provided = {"queries": [{"row_limit": 7, "metrics": ["count"]}]}

    _build(workbook_path, query_contexts={10: provided})

    mocks["resolve_query_context"].assert_not_called()
    loaded = mocks["ChartDataQueryContextSchema"].return_value.load.call_args.args[0]
    assert loaded["queries"] == provided["queries"]


def test_a_chart_resolved_to_none_is_skipped_without_resolving_again(
    mocks: dict[str, Any], workbook_path: str
) -> None:
    # ``None`` in the map is an answer, not a gap: the caller already found this
    # chart unexportable, so the builder must not try to resolve it itself.
    chart = _chart(20, "Skipped")
    mocks["get_charts_in_layout_order"].return_value = [chart]

    errored = _build(workbook_path, query_contexts={20: None})

    mocks["resolve_query_context"].assert_not_called()
    mocks["ChartDataCommand"].return_value.run.assert_not_called()
    assert [label for labels in errored.values() for label in labels] == [
        "20 - Skipped"
    ]


def test_a_chart_missing_from_the_map_is_resolved_by_the_builder(
    mocks: dict[str, Any], workbook_path: str
) -> None:
    # The Celery path passes no map at all, and a partial map must not silently
    # drop the charts it does not mention.
    chart = _chart(30, "Unmapped")
    mocks["get_charts_in_layout_order"].return_value = [chart]
    mocks["resolve_query_context"].return_value = {"queries": [{"row_limit": 5}]}

    _build(workbook_path, query_contexts={})

    mocks["resolve_query_context"].assert_called_once_with(chart)
