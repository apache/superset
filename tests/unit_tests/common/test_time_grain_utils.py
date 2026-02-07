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
"""Unit tests for time grain value identification utility."""
from superset.common.query_context_processor import QueryContextProcessor


def test_is_time_grain_value_basic_patterns():
    """Test basic time grain patterns are correctly identified."""
    # ISO 8601 duration formats
    assert QueryContextProcessor._is_time_grain_value("P1D")
    assert QueryContextProcessor._is_time_grain_value("P1M")
    assert QueryContextProcessor._is_time_grain_value("P1Y")
    assert QueryContextProcessor._is_time_grain_value("P1W")
    assert QueryContextProcessor._is_time_grain_value("P3M")
    assert QueryContextProcessor._is_time_grain_value("P0.25Y")


def test_is_time_grain_value_time_patterns():
    """Test time-based grain patterns with PT prefix."""
    assert QueryContextProcessor._is_time_grain_value("PT1H")
    assert QueryContextProcessor._is_time_grain_value("PT30M")
    assert QueryContextProcessor._is_time_grain_value("PT1S")
    assert QueryContextProcessor._is_time_grain_value("PT5S")
    assert QueryContextProcessor._is_time_grain_value("PT0.5H")


def test_is_time_grain_value_week_epoch_formats():
    """Test complex week epoch formats used by Superset."""
    assert QueryContextProcessor._is_time_grain_value("1969-12-28T00:00:00Z/P1W")
    assert QueryContextProcessor._is_time_grain_value("1969-12-29T00:00:00Z/P1W")
    assert QueryContextProcessor._is_time_grain_value("P1W/1970-01-03T00:00:00Z")
    assert QueryContextProcessor._is_time_grain_value("P1W/1970-01-04T00:00:00Z")


def test_is_time_grain_value_rejects_normal_columns():
    """Test that normal column names are not identified as time grains."""
    assert not QueryContextProcessor._is_time_grain_value("country")
    assert not QueryContextProcessor._is_time_grain_value("__time")
    assert not QueryContextProcessor._is_time_grain_value("created_at")
    assert not QueryContextProcessor._is_time_grain_value("user_id")
    assert not QueryContextProcessor._is_time_grain_value("")


def test_is_time_grain_value_rejects_invalid_formats():
    """Test that invalid time grain formats are rejected."""
    assert not QueryContextProcessor._is_time_grain_value("P")  # Incomplete
    assert not QueryContextProcessor._is_time_grain_value("1D")  # Missing P
    assert not QueryContextProcessor._is_time_grain_value("PD1")  # Wrong order
    assert not QueryContextProcessor._is_time_grain_value("D1")  # Invalid format


def test_is_time_grain_value_rejects_non_strings():
    """Test that non-string values are rejected."""
    assert not QueryContextProcessor._is_time_grain_value(None)
    assert not QueryContextProcessor._is_time_grain_value(123)
    assert not QueryContextProcessor._is_time_grain_value(["P1D"])
    assert not QueryContextProcessor._is_time_grain_value({"grain": "P1D"})


if __name__ == "__main__":
    # Run tests manually for quick validation
    test_is_time_grain_value_basic_patterns()
    test_is_time_grain_value_time_patterns()
    test_is_time_grain_value_week_epoch_formats()
    test_is_time_grain_value_rejects_normal_columns()
    test_is_time_grain_value_rejects_invalid_formats()
    test_is_time_grain_value_rejects_non_strings()
    print("✅ All unit tests passed!")
