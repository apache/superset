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
"""Tests for datetime format detection and warning suppression."""

import warnings

import pandas as pd
import pytest

from superset.utils.core import DateColumn, normalize_dttm_col
from superset.utils.pandas import detect_datetime_format


def capture_warnings(func, *args, **kwargs):
    """Execute function and return any format inference warnings."""
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        result = func(*args, **kwargs)
        format_warnings = [
            str(warning.message)
            for warning in w
            if "Could not infer format" in str(warning.message)
        ]
        return result, format_warnings


def test_detect_datetime_format():
    """Test format detection for common datetime patterns."""
    test_cases = [
        (["2023-01-01", "2023-01-02"], "%Y-%m-%d"),
        (["2023-01-01 12:00:00", "2023-01-02 13:00:00"], "%Y-%m-%d %H:%M:%S"),
        (["01/15/2023", "02/20/2023"], "%m/%d/%Y"),
        (["2023-01-01", "01/02/2023"], None),  # Mixed formats
        ([], None),  # Empty
        ([None, None], None),  # All nulls
    ]

    for data, expected in test_cases:
        assert detect_datetime_format(pd.Series(data)) == expected


def test_no_warnings_with_consistent_formats():
    """Verify no warnings are produced for consistent date formats."""
    df = pd.DataFrame(
        {
            "date": ["2023-01-01", "2023-01-02", "2023-01-03"],
            "datetime": [
                "2023-01-01 12:00:00",
                "2023-01-02 13:00:00",
                "2023-01-03 14:00:00",
            ],
        }
    )

    date_cols = (
        DateColumn(col_label="date"),
        DateColumn(col_label="datetime"),
    )

    _, warnings_list = capture_warnings(normalize_dttm_col, df, date_cols)
    assert len(warnings_list) == 0

    # Verify parsing worked
    assert pd.api.types.is_datetime64_any_dtype(df["date"])
    assert pd.api.types.is_datetime64_any_dtype(df["datetime"])
    assert df["date"].iloc[0] == pd.Timestamp("2023-01-01")


def test_explicit_format_respected():
    """Verify explicit formats are still used when provided."""
    df = pd.DataFrame({"date": ["01/15/2023", "02/20/2023"]})
    date_cols = (DateColumn(col_label="date", timestamp_format="%m/%d/%Y"),)

    normalize_dttm_col(df, date_cols)

    assert pd.api.types.is_datetime64_any_dtype(df["date"])
    assert df["date"].iloc[0] == pd.Timestamp("2023-01-15")


def test_mixed_formats_suppressed():
    """Verify warnings are suppressed for mixed format data."""
    df = pd.DataFrame(
        {
            "mixed": ["2023-01-01", "01/02/2023", "2023-03-01 12:00:00"],
        }
    )

    date_cols = (DateColumn(col_label="mixed"),)
    _, warnings_list = capture_warnings(normalize_dttm_col, df, date_cols)

    assert len(warnings_list) == 0
    assert pd.api.types.is_datetime64_any_dtype(df["mixed"])


def test_epoch_format():
    """Verify epoch timestamp handling works correctly."""
    df = pd.DataFrame({"epoch": [1672531200, 1672617600]})  # 2023-01-01, 2023-01-02
    date_cols = (DateColumn(col_label="epoch", timestamp_format="epoch_s"),)

    normalize_dttm_col(df, date_cols)

    assert pd.api.types.is_datetime64_any_dtype(df["epoch"])
    assert df["epoch"].iloc[0] == pd.Timestamp("2023-01-01")


def test_epoch_format_invalid_values(caplog):
    """Test epoch format with invalid values triggers warning."""
    # Test with non-numeric values that can't be converted to epoch
    df = pd.DataFrame({"epoch": ["not_a_number", "invalid", "abc"]})
    date_cols = (DateColumn(col_label="epoch", timestamp_format="epoch_s"),)

    # Clear any existing log records
    caplog.clear()

    # Run the function - should log a warning
    with caplog.at_level("WARNING"):
        normalize_dttm_col(df, date_cols)

    # Verify warning was logged
    assert "Unable to convert column epoch to datetime, ignoring" in caplog.text

    # The column should remain unchanged when conversion fails
    assert df["epoch"].dtype == object
    assert df["epoch"].iloc[0] == "not_a_number"


@pytest.mark.parametrize(
    "data,expected_format",
    [
        (["2023-01-01", "2023-01-02"], "%Y-%m-%d"),
        (["01/15/2023", "02/20/2023"], "%m/%d/%Y"),
        (["2023-01-01T12:00:00Z", "2023-01-02T13:00:00Z"], "%Y-%m-%dT%H:%M:%SZ"),
        (
            ["2023-01-01T12:00:00.123Z", "2023-01-02T13:00:00.456Z"],
            "%Y-%m-%dT%H:%M:%S.%fZ",
        ),
    ],
)
def test_format_detection_patterns(data: list[str], expected_format: str):
    """Test detection of various datetime formats."""
    assert detect_datetime_format(pd.Series(data)) == expected_format


def test_edge_cases():
    """Test handling of edge cases."""
    edge_cases = [
        pd.DataFrame({"date": []}),  # Empty
        pd.DataFrame({"date": [None, None]}),  # All nulls
        pd.DataFrame({"date": ["2023-01-01"]}),  # Single value
        pd.DataFrame({"date": pd.to_datetime(["2023-01-01"])}),  # Already datetime
    ]

    for df in edge_cases:
        df_copy = df.copy()
        date_cols = (DateColumn(col_label="date"),)
        # Should not raise
        normalize_dttm_col(df_copy, date_cols)


def test_detect_datetime_format_empty_series():
    """Test detect_datetime_format returns None for empty series after dropping NaN."""
    # Test with all None values - covers lines 50-51 in pandas.py
    series_all_none = pd.Series([None, None, None])
    assert detect_datetime_format(series_all_none) is None

    # Test with all NaN values
    series_all_nan = pd.Series([pd.NaT, pd.NaT, pd.NaT])
    assert detect_datetime_format(series_all_nan) is None

    # Test with empty series
    series_empty = pd.Series([], dtype=object)
    assert detect_datetime_format(series_empty) is None


def test_datetime_conversion_value_error(caplog, monkeypatch):
    """Test ValueError during datetime conversion logs a warning.

    Covers core.py lines 1887-88.
    """
    # Create a DataFrame with string values representing dates that are
    # already datetime-like but when epoch_s format is specified and the
    # values are NOT numeric, it tries to convert them using pd.Timestamp
    # which can fail

    # Create a mock type that raises ValueError when pd.Timestamp is called on it
    class BadTimestampValue:
        def __init__(self, value):
            self.value = value

        def __repr__(self):
            return f"BadTimestamp({self.value})"

        def __bool__(self):
            return True

    # Create DataFrame with values that will fail pd.Timestamp conversion
    df = pd.DataFrame(
        {
            "date": [
                BadTimestampValue("2023-01-01"),
                BadTimestampValue("2023-01-02"),
                BadTimestampValue("2023-01-03"),
            ]
        }
    )

    # Store original Timestamp
    original_timestamp = pd.Timestamp

    def failing_timestamp(value):
        if isinstance(value, BadTimestampValue):
            raise ValueError(f"Cannot convert {value} to Timestamp")
        return original_timestamp(value)

    # Set to epoch format with non-numeric data to trigger the else branch
    # (lines 1881-1891 in core.py)
    date_cols = (DateColumn(col_label="date", timestamp_format="epoch_s"),)

    # Clear any existing log records
    caplog.clear()

    # Run the function with our patched Timestamp - should log a warning
    with caplog.at_level("WARNING"):
        # Use monkeypatch for cleaner patching
        monkeypatch.setattr(pd, "Timestamp", failing_timestamp)
        normalize_dttm_col(df, date_cols)

    # Verify warning was logged (covers lines 1887-88 in core.py)
    assert "Unable to convert column date to datetime, ignoring" in caplog.text


def test_warning_suppression():
    """Verify our implementation suppresses warnings for mixed formats."""
    df = pd.DataFrame({"date": ["2023-01-01", "01/02/2023", "March 3, 2023"]})

    # Our approach should suppress warnings
    _, warnings_list = capture_warnings(
        normalize_dttm_col, df, (DateColumn(col_label="date"),)
    )

    assert len(warnings_list) == 0  # Should suppress all format inference warnings
    assert pd.api.types.is_datetime64_any_dtype(df["date"])  # Should still parse dates
