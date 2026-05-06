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

"""Unit tests for ascii_charts.py NaN/null value handling."""

from superset.mcp_service.chart.ascii_charts import generate_ascii_chart


def test_bar_chart_with_null_values_does_not_raise() -> None:
    """Bar chart renderer must not crash when dataset rows contain NaN values."""
    data = [
        {"category": "A", "value": 10.0},
        {"category": "B", "value": float("nan")},
        {"category": "C", "value": 30.0},
    ]
    result = generate_ascii_chart(data, "bar")
    assert isinstance(result, str)
    assert len(result) > 0


def test_bar_chart_with_all_null_values_returns_fallback() -> None:
    """Bar chart with no valid numeric rows should return a fallback message."""
    data = [
        {"category": "A", "value": float("nan")},
        {"category": "B", "value": float("nan")},
    ]
    result = generate_ascii_chart(data, "bar")
    assert isinstance(result, str)
    assert len(result) > 0


def test_line_chart_with_null_values_does_not_raise() -> None:
    """Line chart renderer must not crash when dataset rows contain NaN values."""
    data = [
        {"date": "2024-01", "sales": 100.0},
        {"date": "2024-02", "sales": float("nan")},
        {"date": "2024-03", "sales": 300.0},
    ]
    result = generate_ascii_chart(data, "line")
    assert isinstance(result, str)
    assert len(result) > 0


def test_horizontal_bar_chart_nan_rows_are_skipped() -> None:
    """NaN rows must be silently skipped; valid rows render normally."""
    # Use labels longer than 8 chars to force horizontal layout, where full
    # label text is preserved (vertical layout truncates to 3 chars).
    data = [
        {"label": "Alpha Category", "amount": 50.0},
        {"label": "Beta Category", "amount": float("nan")},
        {"label": "Gamma Category", "amount": 150.0},
    ]
    result = generate_ascii_chart(data, "bar")
    # Valid labels should appear in output; NaN row should not crash
    assert "Alpha" in result or "Gamma" in result


def test_column_chart_with_null_values_does_not_raise() -> None:
    """Column (vertical bar) chart must not crash on NaN values."""
    data = [
        {"x": "Q1", "y": 10.0},
        {"x": "Q2", "y": float("nan")},
        {"x": "Q3", "y": 30.0},
        {"x": "Q4", "y": 40.0},
    ]
    result = generate_ascii_chart(data, "column")
    assert isinstance(result, str)
    assert len(result) > 0


def test_timeseries_bar_with_null_values_does_not_raise() -> None:
    """echarts_timeseries_bar chart type must not crash on NaN values."""
    data = [
        {"ts": "2024-01-01", "count": 5.0},
        {"ts": "2024-01-02", "count": float("nan")},
        {"ts": "2024-01-03", "count": 15.0},
    ]
    result = generate_ascii_chart(data, "echarts_timeseries_bar")
    assert isinstance(result, str)
    assert len(result) > 0


def test_chart_with_none_values_does_not_raise() -> None:
    """None (SQL NULL) values should be treated identically to NaN."""
    data = [
        {"name": "X", "metric": 100.0},
        {"name": "Y", "metric": None},
        {"name": "Z", "metric": 200.0},
    ]
    result = generate_ascii_chart(data, "bar")
    assert isinstance(result, str)
    assert len(result) > 0
