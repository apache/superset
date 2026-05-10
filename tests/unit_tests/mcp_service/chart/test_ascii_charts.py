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
    """Bar chart with no valid numeric rows should return the no-data fallback."""
    data = [
        {"category": "A", "value": float("nan")},
        {"category": "B", "value": float("nan")},
    ]
    result = generate_ascii_chart(data, "bar")
    assert isinstance(result, str)
    assert result == "No numeric data found for bar chart"


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
    # avg label length is 14 (> 8 threshold), so horizontal layout is chosen;
    # horizontal mode preserves full label text unlike vertical (3-char truncation).
    assert "Horizontal Bar Chart" in result
    # Both valid labels must appear in full; the NaN row (Beta) must be absent
    assert "Alpha" in result
    assert "Gamma" in result
    assert "Beta" not in result


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


def test_bar_chart_skips_boolean_columns() -> None:
    """Boolean fields must not be selected as the numeric metric.

    bool is a subclass of int, so isinstance(True, (int, float)) is True.
    Without an explicit bool guard the extractor would lock onto a boolean
    column (e.g. is_active=True -> 1) and ignore the real numeric metric.
    """
    data = [
        {"label": "Alpha Category", "is_active": True, "revenue": 500.0},
        {"label": "Beta Category", "is_active": False, "revenue": 1500.0},
        {"label": "Gamma Category", "is_active": True, "revenue": 1000.0},
    ]
    result = generate_ascii_chart(data, "bar")
    # If booleans are correctly skipped, revenue (500/1500/1000) drives the
    # bars. The max value is 1500, so we expect at least one K-formatted value.
    assert "1.5K" in result or "1500" in result or "1.0K" in result
    # The scale min/max would be "0.0" and "1.0" only if booleans were chosen;
    # with revenue selected the scale starts at 500 (never "Scale: 0.0").
    assert "Scale: 0.0" not in result


def test_line_chart_skips_boolean_columns() -> None:
    """Boolean fields must not be selected as numeric points in line charts."""
    data = [
        {"date": "2024-01", "is_active": True, "sales": 100.0},
        {"date": "2024-02", "is_active": False, "sales": 200.0},
        {"date": "2024-03", "is_active": True, "sales": 300.0},
    ]
    result = generate_ascii_chart(data, "line")
    assert isinstance(result, str)
    assert len(result) > 0
    # If booleans were selected, the range would be 0-1; if revenue is
    # selected the range includes values up to 300.
    assert "300" in result or "200" in result


def test_scatter_chart_with_nan_values_does_not_raise() -> None:
    """Scatter chart renderer must not crash when dataset rows contain NaN values."""
    data = [
        {"x": 1.0, "y": 2.0},
        {"x": float("nan"), "y": 4.0},
        {"x": 5.0, "y": float("nan")},
        {"x": 7.0, "y": 8.0},
    ]
    result = generate_ascii_chart(data, "scatter")
    assert isinstance(result, str)
    assert len(result) > 0


def test_scatter_chart_skips_boolean_columns() -> None:
    """Boolean fields must not be selected as X/Y axes in scatter charts."""
    data = [
        {"is_active": True, "x": 10.0, "y": 20.0},
        {"is_active": False, "x": 30.0, "y": 40.0},
        {"is_active": True, "x": 50.0, "y": 60.0},
    ]
    result = generate_ascii_chart(data, "scatter")
    # If booleans are correctly skipped, x/y (10-50 / 20-60) drive the axes;
    # boolean-driven axes would be confined to 0-1.
    assert isinstance(result, str)
    assert len(result) > 0
    assert "10" in result or "30" in result or "50" in result
