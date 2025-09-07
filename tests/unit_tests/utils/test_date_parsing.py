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
"""
Tests for date parsing warning fix and format detection.
Includes both functional tests and comparison tests between old/new implementations.
"""

import time
import warnings
from typing import Any, List, Tuple

import pandas as pd
import pytest

from superset.utils.core import DateColumn, normalize_dttm_col
from superset.utils.pandas import detect_datetime_format


class DateParsingTester:
    """Helper class to test date parsing with and without the fix."""

    @staticmethod
    def parse_with_old_implementation(
        df: pd.DataFrame, col_name: str
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        Simulate the old implementation that always triggers warnings.
        This mimics what the code did before the fix.
        """
        warnings_caught = []
        df_copy = df.copy()

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            # Old way: always pass format=None, triggering inference warning
            df_copy[col_name] = pd.to_datetime(
                df_copy[col_name],
                utc=False,
                format=None,  # This triggers the warning
                errors="coerce",
                exact=False,
            )

            # Capture any warnings
            for warning in w:
                warnings_caught.append(str(warning.message))

        return df_copy, warnings_caught

    @staticmethod
    def parse_with_new_implementation(
        df: pd.DataFrame, col_name: str
    ) -> Tuple[pd.DataFrame, List[str]]:
        """
        Use the new implementation with format detection and warning suppression.
        """
        warnings_caught = []
        df_copy = df.copy()

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            # New way: use the actual normalize_dttm_col function
            date_cols = (DateColumn(col_label=col_name),)
            normalize_dttm_col(df_copy, date_cols)

            # Capture any warnings (should be none with the fix)
            for warning in w:
                if "Could not infer format" in str(warning.message):
                    warnings_caught.append(str(warning.message))

        return df_copy, warnings_caught


# Test data scenarios that are problematic
PROBLEMATIC_DATE_SCENARIOS = {
    "mixed_formats": {
        "data": ["2023-01-01", "01/02/2023", "2023-03-01 12:00:00", "March 4, 2023"],
        "description": "Mixed date formats that trigger inference",
    },
    "ambiguous_dates": {
        "data": ["01/02/2023", "02/01/2023", "12/11/2023", "11/12/2023"],
        "description": "Ambiguous MM/DD vs DD/MM formats",
    },
    "iso_with_timezone": {
        "data": [
            "2023-01-01T12:00:00Z",
            "2023-01-02T13:00:00+00:00",
            "2023-01-03T14:00:00-05:00",
        ],
        "description": "ISO dates with various timezone formats",
    },
    "partial_dates": {
        "data": ["2023-01", "2023-02-15", "2023", "2023-03-20 15:30"],
        "description": "Partial and incomplete date formats",
    },
    "real_world_logs": {
        "data": [
            "2024-01-15 08:30:45.123",
            "2024-01-15 08:30:46.456",
            "2024-01-15 08:30:47.789",
        ],
        "description": "Timestamp format from production logs",
    },
    "consistent_iso": {
        "data": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04"],
        "description": "Consistent ISO format (should be detected)",
    },
    "consistent_us": {
        "data": ["01/15/2023", "02/20/2023", "03/25/2023", "04/30/2023"],
        "description": "Consistent US format (should be detected)",
    },
}


# ============================================================================
# Core Functionality Tests
# ============================================================================


def test_detect_datetime_format():
    """Test the datetime format detection function."""
    # Test ISO date format
    series = pd.Series(["2023-01-01", "2023-01-02", "2023-01-03"])
    assert detect_datetime_format(series) == "%Y-%m-%d"

    # Test ISO datetime format
    series = pd.Series(["2023-01-01 12:00:00", "2023-01-02 13:00:00"])
    assert detect_datetime_format(series) == "%Y-%m-%d %H:%M:%S"

    # Test US date format
    series = pd.Series(["01/15/2023", "02/20/2023", "03/25/2023"])
    assert detect_datetime_format(series) == "%m/%d/%Y"

    # Test mixed formats (should return None)
    series = pd.Series(["2023-01-01", "01/02/2023", "March 3, 2023"])
    assert detect_datetime_format(series) is None

    # Test empty series
    series = pd.Series([])
    assert detect_datetime_format(series) is None

    # Test all NaT values
    series = pd.Series([None, None, None])
    assert detect_datetime_format(series) is None


def test_normalize_dttm_col_no_warning():
    """Test that datetime parsing doesn't produce warnings."""
    # Test data with consistent ISO format
    df = pd.DataFrame(
        {
            "date_col": ["2023-01-01", "2023-01-02", "2023-01-03"],
            "datetime_col": [
                "2023-01-01 12:00:00",
                "2023-01-02 13:00:00",
                "2023-01-03 14:00:00",
            ],
        }
    )

    # Test with no format specified (should auto-detect)
    date_cols = (
        DateColumn(col_label="date_col"),
        DateColumn(col_label="datetime_col"),
    )

    # Capture warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        normalize_dttm_col(df, date_cols)

        # Check no warnings about format inference
        format_warnings = [
            warning for warning in w if "Could not infer format" in str(warning.message)
        ]
        assert len(format_warnings) == 0, "Should not produce format inference warnings"

    # Verify columns were parsed correctly
    assert pd.api.types.is_datetime64_any_dtype(df["date_col"])
    assert pd.api.types.is_datetime64_any_dtype(df["datetime_col"])
    assert df["date_col"][0] == pd.Timestamp("2023-01-01")
    assert df["datetime_col"][0] == pd.Timestamp("2023-01-01 12:00:00")


def test_normalize_dttm_col_with_format():
    """Test that explicit format still works."""
    df = pd.DataFrame(
        {
            "us_date": ["01/15/2023", "02/20/2023", "03/25/2023"],
        }
    )

    # Test with explicit format
    date_cols = (DateColumn(col_label="us_date", timestamp_format="%m/%d/%Y"),)

    normalize_dttm_col(df, date_cols)

    # Verify column was parsed correctly
    assert pd.api.types.is_datetime64_any_dtype(df["us_date"])
    assert df["us_date"][0] == pd.Timestamp("2023-01-15")


def test_normalize_dttm_col_mixed_formats():
    """Test handling of mixed format columns (should fall back to inference)."""
    df = pd.DataFrame(
        {
            "mixed_col": ["2023-01-01", "01/02/2023", "2023-03-01 12:00:00"],
        }
    )

    date_cols = (DateColumn(col_label="mixed_col"),)

    # Should handle without errors and suppress warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        normalize_dttm_col(df, date_cols)

        # Check no warnings about format inference
        format_warnings = [
            warning for warning in w if "Could not infer format" in str(warning.message)
        ]
        assert len(format_warnings) == 0, "Should suppress format inference warnings"

    # Should still convert to datetime (some values may become NaT)
    assert pd.api.types.is_datetime64_any_dtype(df["mixed_col"])


def test_normalize_dttm_col_epoch_format():
    """Test that epoch formats still work correctly."""
    df = pd.DataFrame(
        {
            "epoch_s": [1672531200, 1672617600, 1672704000],  # Unix timestamps
        }
    )

    date_cols = (DateColumn(col_label="epoch_s", timestamp_format="epoch_s"),)

    normalize_dttm_col(df, date_cols)

    # Verify column was parsed correctly
    assert pd.api.types.is_datetime64_any_dtype(df["epoch_s"])
    # 1672531200 = 2023-01-01 00:00:00 UTC
    assert df["epoch_s"][0] == pd.Timestamp("2023-01-01")


# ============================================================================
# Comparison Tests (Old vs New Implementation)
# ============================================================================


@pytest.mark.parametrize("scenario_name,scenario", PROBLEMATIC_DATE_SCENARIOS.items())
def test_compare_date_parsing_implementations(
    scenario_name: str, scenario: dict[str, Any]
):
    """
    Compare old vs new implementation for each problematic scenario.
    This test shows which scenarios would produce warnings.
    """
    print(f"\n=== Testing: {scenario['description']} ===")

    df_old = pd.DataFrame({"date_col": scenario["data"]})
    df_new = pd.DataFrame({"date_col": scenario["data"]})

    tester = DateParsingTester()

    # Test old implementation
    df_old_result, old_warnings = tester.parse_with_old_implementation(
        df_old, "date_col"
    )

    # Test new implementation
    df_new_result, new_warnings = tester.parse_with_new_implementation(
        df_new, "date_col"
    )

    # Print results for comparison
    print(f"Scenario: {scenario_name}")
    print(f"  Old implementation warnings: {len(old_warnings)}")
    print(f"  New implementation warnings: {len(new_warnings)}")

    # Check format detection
    detected_format = detect_datetime_format(pd.Series(scenario["data"]))
    print(f"  Format detected: {detected_format}")

    # Both should parse dates correctly (functionality preserved)
    # Note: iso_with_timezone returns object dtype with timezone-aware timestamps
    if scenario_name != "iso_with_timezone":
        assert pd.api.types.is_datetime64_any_dtype(df_old_result["date_col"])
        assert pd.api.types.is_datetime64_any_dtype(df_new_result["date_col"])

    # Compare parsed results (should be identical where parseable)
    old_valid = ~df_old_result["date_col"].isna()
    new_valid = ~df_new_result["date_col"].isna()
    assert old_valid.equals(new_valid), "Parsing results should match"

    # Where both parsed successfully, values should match
    both_valid = old_valid & new_valid
    if both_valid.any() and scenario_name != "iso_with_timezone":
        # Skip value comparison for timezone-aware dates (different representation)
        assert df_old_result.loc[both_valid, "date_col"].equals(
            df_new_result.loc[both_valid, "date_col"]
        ), "Parsed values should match"


def test_format_detection_with_problematic_dates():
    """Test format detection on various problematic date patterns."""
    test_cases = [
        # (data, expected_format_or_none)
        (["2023-01-01", "2023-01-02", "2023-01-03"], "%Y-%m-%d"),
        (["01/15/2023", "02/20/2023", "03/25/2023"], "%m/%d/%Y"),
        (["2023-01-01 12:00:00", "2023-01-02 13:00:00"], "%Y-%m-%d %H:%M:%S"),
        (["2023-01-01", "01/02/2023", "March 3, 2023"], None),  # Mixed - no detection
        (["not", "a", "date"], None),  # Invalid dates
        ([], None),  # Empty
        ([None, None, None], None),  # All nulls
    ]

    for data, expected in test_cases:
        series = pd.Series(data)
        result = detect_datetime_format(series)
        assert result == expected, (
            f"Expected {expected} for {data[:2]}..., got {result}"
        )


def test_edge_cases():
    """Test edge cases that might break date parsing."""
    edge_cases = [
        # Empty DataFrame
        pd.DataFrame({"date_col": []}),
        # All None/NaN values
        pd.DataFrame({"date_col": [None, None, None]}),
        # Single value
        pd.DataFrame({"date_col": ["2023-01-01"]}),
        # Already datetime type
        pd.DataFrame({"date_col": pd.to_datetime(["2023-01-01", "2023-01-02"])}),
        # Numeric timestamps
        pd.DataFrame({"date_col": [1672531200, 1672617600]}),  # Unix timestamps
    ]

    for i, df in enumerate(edge_cases):
        print(f"\nTesting edge case {i + 1}")
        df_copy = df.copy()

        # Should handle without errors
        date_cols = (DateColumn(col_label="date_col"),)
        try:
            normalize_dttm_col(df_copy, date_cols)
            print(f"  ✓ Edge case {i + 1} handled successfully")
        except Exception as e:
            pytest.fail(f"Edge case {i + 1} failed: {e}")


def test_performance_comparison():
    """
    Compare performance of old vs new implementation.
    Format detection should be faster for consistent formats.
    """
    # Large dataset with consistent format (best case for new implementation)
    large_consistent = ["2023-01-01"] * 10000

    # Large dataset with mixed formats (worst case, but warning suppressed)
    large_mixed = ["2023-01-01", "01/02/2023"] * 5000

    scenarios = [
        ("Consistent format (10k rows)", large_consistent),
        ("Mixed format (10k rows)", large_mixed),
    ]

    tester = DateParsingTester()

    for name, data in scenarios:
        df_old = pd.DataFrame({"date_col": data})
        df_new = pd.DataFrame({"date_col": data})

        # Time old implementation
        start = time.time()
        tester.parse_with_old_implementation(df_old, "date_col")
        old_time = time.time() - start

        # Time new implementation
        start = time.time()
        tester.parse_with_new_implementation(df_new, "date_col")
        new_time = time.time() - start

        print(f"\n{name}:")
        print(f"  Old implementation: {old_time:.4f}s")
        print(f"  New implementation: {new_time:.4f}s")
        print(
            f"  Speedup: {old_time / new_time:.2f}x"
            if new_time > 0
            else "  Speedup: N/A"
        )
