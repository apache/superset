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


def test_warning_suppression():
    """Verify our implementation suppresses warnings for mixed formats."""
    df = pd.DataFrame({"date": ["2023-01-01", "01/02/2023", "March 3, 2023"]})

    # Our approach should suppress warnings
    _, warnings_list = capture_warnings(
        normalize_dttm_col, df, (DateColumn(col_label="date"),)
    )

    assert len(warnings_list) == 0  # Should suppress all format inference warnings
    assert pd.api.types.is_datetime64_any_dtype(df["date"])  # Should still parse dates
