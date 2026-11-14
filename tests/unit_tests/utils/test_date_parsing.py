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
from datetime import datetime

import pandas as pd
import pytest
import pytz
from pytest_mock import MockerFixture

from superset.utils.core import DateColumn, normalize_dttm_col
from superset.utils.dates import datetime_to_epoch
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


@pytest.mark.parametrize("reverse", [False, True])
def test_mixed_formats_suppressed(reverse: bool) -> None:
    """Mixed formats preserve every timestamp regardless of the first row."""
    values = ["2023-01-01", "01/02/2023", "2023-03-01 12:00:00"]
    expected = [
        pd.Timestamp("2023-01-01"),
        pd.Timestamp("2023-01-02"),
        pd.Timestamp("2023-03-01 12:00:00"),
    ]
    if reverse:
        values.reverse()
        expected.reverse()
    df = pd.DataFrame(
        {
            "mixed": values,
        }
    )

    date_cols = (DateColumn(col_label="mixed"),)
    _, warnings_list = capture_warnings(normalize_dttm_col, df, date_cols)

    assert len(warnings_list) == 0
    assert pd.api.types.is_datetime64_any_dtype(df["mixed"])
    assert df["mixed"].tolist() == expected


def test_mixed_formats_with_missing_and_invalid_values() -> None:
    """Only missing or invalid values become NaT in the mixed-format fallback."""
    df = pd.DataFrame(
        {
            "date": [
                None,
                "2023-01-01",
                "invalid",
                "01/15/2023",
                "2023-03-01 12:34:56.123456",
            ],
        }
    )

    normalize_dttm_col(df, (DateColumn(col_label="date"),))

    pd.testing.assert_series_equal(
        df["date"],
        pd.Series(
            [
                pd.NaT,
                pd.Timestamp("2023-01-01"),
                pd.NaT,
                pd.Timestamp("2023-01-15"),
                pd.Timestamp("2023-03-01 12:34:56.123456"),
            ],
            name="date",
            dtype=df["date"].dtype,
        ),
    )


def test_mixed_formats_with_timezone() -> None:
    """A consistent source offset is retained before dataset timezone conversion."""
    df = pd.DataFrame(
        {
            "date": ["2023-01-01 12:00:00+02:00", "2023-01-02T13:30:00+02:00"],
        }
    )

    normalize_dttm_col(df, (DateColumn(col_label="date", timezone="America/New_York"),))

    assert df["date"].tolist() == [
        pd.Timestamp("2023-01-01 05:00:00"),
        pd.Timestamp("2023-01-02 06:30:00"),
    ]


@pytest.mark.parametrize("suffix", ["", "+02:00"])
def test_mixed_formats_preserve_homogeneous_timezone(suffix: str) -> None:
    """Naive values stay naive and a consistent source offset is preserved."""
    values = [f"2023-01-01 12:00:00{suffix}", f"2023-01-02T13:30:00{suffix}"]
    df = pd.DataFrame({"date": values})
    expected = [pd.Timestamp(value) for value in values]

    normalize_dttm_col(df, (DateColumn(col_label="date"),))

    assert df["date"].tolist() == expected
    assert df["date"].dt.tz == expected[0].tzinfo


@pytest.mark.parametrize(
    "second_value",
    [
        "2023-11-05 01:30:00-05:00",
        "2023-11-05T01:30:00-05:00",
        "2023-11-05T06:30:00",
    ],
    ids=["mixed-offsets", "mixed-offsets-and-formats", "mixed-aware-and-naive"],
)
@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize(
    "timezone,offset,time_shift,expected",
    [
        (None, None, None, ["2023-11-05 05:30:00Z", "2023-11-05 06:30:00Z"]),
        ("Asia/Tokyo", None, None, ["2023-11-05 14:30:00", "2023-11-05 15:30:00"]),
        (None, 3, "1 hour", ["2023-11-05 09:30:00Z", "2023-11-05 10:30:00Z"]),
        ("Asia/Tokyo", 3, "1 hour", ["2023-11-05 15:30:00", "2023-11-05 16:30:00"]),
        ("Not/AZone", 3, "1 hour", ["2023-11-05 09:30:00Z", "2023-11-05 10:30:00Z"]),
    ],
    ids=["utc", "named-zone", "offset-and-shift", "zone-and-shift", "invalid-zone"],
)
def test_mixed_formats_with_mixed_timezones(
    second_value: str,
    reverse: bool,
    timezone: str | None,
    offset: int | None,
    time_shift: str | None,
    expected: list[str],
) -> None:
    """Mixed zones use UTC before display conversion; naive values mean UTC."""
    values = ["2023-11-05 01:30:00-04:00", second_value, None, "invalid"]
    expected_values = [pd.Timestamp(value) for value in expected] + [pd.NaT, pd.NaT]
    if reverse:
        values.reverse()
        expected_values.reverse()
    df = pd.DataFrame({"date": values})

    normalize_dttm_col(
        df,
        (DateColumn("date", timezone=timezone, offset=offset, time_shift=time_shift),),
    )

    assert pd.api.types.is_datetime64_any_dtype(df["date"])
    if timezone == "Asia/Tokyo":
        assert df["date"].dt.tz is None
    else:
        assert str(df["date"].dt.tz) == "UTC"
    pd.testing.assert_series_equal(
        df["date"], pd.Series(expected_values, name="date", dtype=df["date"].dtype)
    )


def test_mixed_formats_propagate_unrelated_value_error(mocker: MockerFixture) -> None:
    """Only the mixed-timezone error triggers a UTC retry."""
    df = pd.DataFrame({"date": ["2023-01-01", "01/02/2023"]})
    mocker.patch("superset.utils.core.detect_datetime_format", return_value=None)
    convert = mocker.patch(
        "superset.utils.core.pd.to_datetime", side_effect=ValueError("unrelated error")
    )

    with pytest.raises(ValueError, match="unrelated error"):
        normalize_dttm_col(df, (DateColumn(col_label="date"),))

    convert.assert_called_once()


@pytest.mark.parametrize("use_format_map", [False, True])
def test_mixed_formats_respect_configured_format(use_format_map: bool) -> None:
    """A declared format still controls ambiguous dates and rejects mismatches."""
    df = pd.DataFrame({"date": ["01/02/2023", "March 3, 2023"]})
    date_column = DateColumn(
        col_label="date",
        timestamp_format=None if use_format_map else "%d/%m/%Y",
    )

    normalize_dttm_col(
        df,
        (date_column,),
        format_map={"date": "%d/%m/%Y"} if use_format_map else None,
    )

    assert df["date"].iloc[0] == pd.Timestamp("2023-02-01")
    assert pd.isna(df["date"].iloc[1])


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
    assert df["epoch"].dtype == "str"
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


# ============================================================================
# NEW TESTS FOR datetime_to_epoch() - Edge case coverage
# ============================================================================


def test_datetime_to_epoch_naive_at_epoch():
    """Test naive datetime exactly at epoch returns 0.0"""
    # Edge case: Datetime at epoch boundary
    epoch_dt = datetime(1970, 1, 1, 0, 0, 0)
    result = datetime_to_epoch(epoch_dt)
    assert result == 0.0, f"Epoch datetime should be 0.0, got {result}"


def test_datetime_to_epoch_naive_one_second_after():
    """Test naive datetime 1 second after epoch"""
    dt = datetime(1970, 1, 1, 0, 0, 1)
    result = datetime_to_epoch(dt)
    expected = 1000.0  # 1 second * 1000 ms
    assert result == expected, f"Expected {expected}ms, got {result}ms"


def test_datetime_to_epoch_timezone_aware_utc():
    """Test timezone-aware datetime in UTC"""
    # Create UTC datetime
    utc_tz = pytz.UTC
    dt_utc = utc_tz.localize(datetime(1970, 1, 1, 0, 0, 1))
    result = datetime_to_epoch(dt_utc)
    expected = 1000.0  # 1 second * 1000 ms
    assert result == expected, f"UTC datetime should convert correctly, got {result}ms"


def test_datetime_to_epoch_timezone_aware_different_tz():
    """Test timezone-aware datetime in different timezone converts to UTC correctly"""
    # Create datetime in EST (UTC-5 in January)
    est = pytz.timezone("US/Eastern")
    # 1970-01-01 05:00:00 EST = 1970-01-01 10:00:00 UTC (5 hours offset)
    dt_est = est.localize(datetime(1970, 1, 1, 5, 0, 0))
    result = datetime_to_epoch(dt_est)
    expected = 10 * 60 * 60 * 1000  # 10 hours in milliseconds
    assert result == expected, (
        f"EST datetime should convert to UTC correctly, got {result}ms"
    )


def test_datetime_to_epoch_dst_transition():
    """Test datetime during DST transition is handled correctly"""
    # Use a known DST transition date in US/Eastern
    # 2023-03-12: Spring forward (2 AM becomes 3 AM, gap of 1 hour)
    eastern = pytz.timezone("US/Eastern")

    # Create datetime before DST transition (still EST, standard time)
    dt_before_dst = eastern.localize(datetime(2023, 3, 12, 1, 59, 59), is_dst=False)
    result_before = datetime_to_epoch(dt_before_dst)

    # Create datetime after DST transition (now EDT, daylight time)
    dt_after_dst = eastern.localize(datetime(2023, 3, 12, 3, 0, 1), is_dst=True)
    result_after = datetime_to_epoch(dt_after_dst)

    # The difference should be exactly 2 seconds, not 1 hour + 2 seconds
    # (because of the DST jump, 1:59:59 EST -> 3:00:01 EDT)
    diff_ms = result_after - result_before
    expected_diff = 2000  # 2 seconds
    assert diff_ms == expected_diff, (
        f"DST transition handled incorrectly. Diff: {diff_ms}ms"
    )


def test_datetime_to_epoch_microsecond_precision():
    """Test that microseconds are handled correctly"""
    dt = datetime(1970, 1, 1, 0, 0, 1, 500000)  # 1.5 seconds
    result = datetime_to_epoch(dt)
    expected = 1500.0  # 1.5 seconds * 1000 ms
    assert result == expected, (
        f"Microseconds should contribute to result, got {result}ms"
    )


def test_datetime_to_epoch_far_future():
    """Test datetime far in the future"""
    # 2050-01-01 should work without errors
    dt = datetime(2050, 1, 1, 0, 0, 0)
    result = datetime_to_epoch(dt)
    # Just verify it's a reasonable large number (no crashes, reasonable value)
    assert isinstance(result, float), "Should return float"
    assert result > 0, "Far future date should have positive epoch"
    assert result == 2524608000000.0, "2050-01-01 should be specific epoch value"


@pytest.mark.parametrize(
    "timestamp, expected",
    [
        (pd.Timestamp("2024-01-02 03:04:05.123456789"), 1704164645123.456),
        (pd.Timestamp("2024-01-02 03:04:05.123456789", tz="UTC"), 1704164645123.456),
        (pd.Timestamp("1969-12-31 23:59:59.999999999"), -0.0010000000000287557),
    ],
)
def test_datetime_to_epoch_pandas_timestamp_drops_sub_microsecond(
    timestamp: pd.Timestamp, expected: float
) -> None:
    """Nanosecond residuals do not change the epoch across pandas versions"""
    assert datetime_to_epoch(timestamp) == expected
