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

"""Tests for the chart type registry."""

import pytest

from superset.charts.chart_types import (
    CHART_TYPE_NAMES,
    get_chart_type_display_name,
)


def test_registry_is_non_empty() -> None:
    assert len(CHART_TYPE_NAMES) > 0


def test_all_entries_have_non_empty_names() -> None:
    for viz_type, display_name in CHART_TYPE_NAMES.items():
        assert viz_type, "Empty viz_type key found"
        assert display_name, f"Empty display name for {viz_type}"


@pytest.mark.parametrize(
    ("viz_type", "expected"),
    [
        # Legacy charts
        ("bubble", "Bubble Chart"),
        ("cal_heatmap", "Calendar Heatmap"),
        ("world_map", "World Map"),
        ("deck_arc", "Deck.gl - Arc"),
        ("line", "Time Series - Line Chart"),
        ("rose", "Nightingale Rose Chart"),
        # Modern ECharts plugins
        ("echarts_timeseries_line", "Line Chart"),
        ("echarts_timeseries_bar", "Bar Chart"),
        ("pie", "Pie Chart"),
        ("funnel", "Funnel Chart"),
        ("mixed_timeseries", "Mixed Chart"),
        # Big Number
        ("big_number", "Big Number"),
        ("big_number_total", "Big Number"),
        # Tables
        ("table", "Table"),
        ("pivot_table_v2", "Pivot Table"),
        ("ag-grid-table", "Table V2"),
    ],
)
def test_known_types_return_expected_name(viz_type: str, expected: str) -> None:
    assert get_chart_type_display_name(viz_type) == expected


def test_unknown_type_falls_back_to_title_case() -> None:
    assert get_chart_type_display_name("my_custom_viz") == "My Custom Viz"


def test_unknown_type_with_hyphens() -> None:
    assert get_chart_type_display_name("my-chart") == "My Chart"


def test_none_returns_none() -> None:
    assert get_chart_type_display_name(None) is None


def test_empty_string_returns_none() -> None:
    assert get_chart_type_display_name("") is None
