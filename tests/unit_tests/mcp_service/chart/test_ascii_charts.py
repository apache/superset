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

"""Unit tests for ASCII chart trend analysis with temporal vs categorical data."""

from superset.mcp_service.chart.ascii_charts import (
    _analyze_trend,
    _extract_time_series_data,
)


def test_analyze_trend_temporal_upward():
    values = [100.0, 110.0, 120.0, 130.0, 150.0]
    result = _analyze_trend(values, is_temporal=True)
    trend_line = result[0]
    assert "upward trend" in trend_line.lower()
    assert "categorical" not in trend_line.lower()


def test_analyze_trend_temporal_downward():
    values = [200.0, 180.0, 150.0, 120.0, 100.0]
    result = _analyze_trend(values, is_temporal=True)
    trend_line = result[0]
    assert "downward trend" in trend_line.lower()


def test_analyze_trend_temporal_stable():
    values = [100.0, 101.0, 100.5, 100.2, 100.8]
    result = _analyze_trend(values, is_temporal=True)
    trend_line = result[0]
    assert "stable" in trend_line.lower()


def test_analyze_trend_categorical_skips_direction():
    values = [200.0, 180.0, 150.0, 120.0, 100.0]
    result = _analyze_trend(values, is_temporal=False)
    trend_line = result[0]
    assert "categorical" in trend_line.lower()
    assert "downward" not in trend_line.lower()
    assert "upward" not in trend_line.lower()


def test_analyze_trend_categorical_keeps_range_and_volatility():
    values = [200.0, 180.0, 150.0, 120.0, 100.0]
    result = _analyze_trend(values, is_temporal=False)
    full_text = "\n".join(result)
    assert "Range:" in full_text
    assert "Volatility:" in full_text


def test_analyze_trend_defaults_to_temporal():
    values = [100.0, 150.0, 200.0]
    result = _analyze_trend(values)
    trend_line = result[0]
    assert "categorical" not in trend_line.lower()
    assert "upward trend" in trend_line.lower()


def test_extract_time_series_data_temporal_column():
    data = [
        {"date": "2024-01-01", "value": 100},
        {"date": "2024-02-01", "value": 200},
    ]
    values, labels, is_temporal = _extract_time_series_data(data)
    assert values == [100, 200]
    assert is_temporal is True


def test_extract_time_series_data_categorical_column():
    data = [
        {"country": "Argentina", "value": 500},
        {"country": "Brazil", "value": 300},
    ]
    values, labels, is_temporal = _extract_time_series_data(data)
    assert values == [500, 300]
    assert is_temporal is False


def test_extract_time_series_data_time_keyword_variants():
    for key in ["timestamp", "created_time", "month_name", "day_of_week", "year_end"]:
        data = [{key: "val", "metric": 42}]
        _, _, is_temporal = _extract_time_series_data(data)
        assert is_temporal is True, f"Expected temporal for column '{key}'"
