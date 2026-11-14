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

from datetime import datetime
from typing import Any

import pytest

from superset.mcp_service.common.temporal_filter_values import (
    invalid_temporal_filter_value,
)


@pytest.mark.parametrize(
    "value",
    [
        "2000-01-01",
        "2000-01-01T00:00:00",
        "2000-01-01 00:00:00",
        "2000-01-01T00:00:00Z",
        "2000-01-01T00:00:00+02:00",
        946684800000,
        946684800000.5,
        -1000,
        datetime(2000, 1, 1),
        ["2000-01-01", 946684800000],
    ],
)
def test_valid_temporal_comparators_are_accepted(value: Any) -> None:
    assert invalid_temporal_filter_value(">=", value) is None


@pytest.mark.parametrize(
    "value",
    [
        "2000",
        "20000101",
        "946684800000",
        "-5",
        "not-a-date",
        "06/07/2026",
        "",
        "2000-13-45",
    ],
)
def test_unparseable_or_ambiguous_strings_are_rejected(value: str) -> None:
    assert invalid_temporal_filter_value(">=", value) is not None


@pytest.mark.parametrize("value", [True, False, {"a": 1}])
def test_non_date_types_are_rejected(value: Any) -> None:
    assert invalid_temporal_filter_value("=", value) is not None


@pytest.mark.parametrize("operator", ["IN", "NOT IN"])
def test_every_list_member_is_checked(operator: str) -> None:
    assert invalid_temporal_filter_value(operator, ["2000-01-01", "2001"]) is not None
    assert invalid_temporal_filter_value(operator, ["2000-01-01", "2001-01-01"]) is None


@pytest.mark.parametrize(
    "operator", ["LIKE", "ILIKE", "NOT LIKE", "IS NULL", "IS NOT NULL"]
)
def test_operators_without_a_point_in_time_are_not_checked(operator: str) -> None:
    assert invalid_temporal_filter_value(operator, "2000%") is None
    assert invalid_temporal_filter_value(operator, None) is None


@pytest.mark.parametrize("operator", ["IN", "NOT IN"])
def test_null_membership_values_are_preserved(operator: str) -> None:
    """SQL membership supports null entries alongside temporal values."""
    assert invalid_temporal_filter_value(operator, ["2000-01-01", None]) is None


@pytest.mark.parametrize(
    "value",
    [
        "2000-01-01😀12:30:00",
        "2000-01-01T12:00:00+00:99",
        "2000-01-01T12:00:00+24:00",
        "2000-01-01T12:00:00+15:00",
        "2000-W01-1",
        "2000-01-01T123000",
        " 2000-01-01 ",
        float("inf"),
        float("-inf"),
        float("nan"),
        10**30,
        -(10**30),
        253402300800000,
        -62135596800001,
    ],
)
def test_unusable_sql_temporal_values_are_rejected(value: Any) -> None:
    """Python parsing success alone does not make a usable SQL literal."""
    assert invalid_temporal_filter_value(">=", value) is not None


@pytest.mark.parametrize("operator", ["IN", "NOT IN", "==", "!="])
@pytest.mark.parametrize("sentinel", ["<NULL>", "<empty string>", "\t<NULL>\n"])
@pytest.mark.parametrize("storage_format", [None, "%Y%m%d", "epoch_s"])
def test_temporal_sentinels_bypass_date_parsing(
    operator: str, sentinel: str, storage_format: str | None
) -> None:
    """Sentinels are converted before the shared handler interprets dates."""
    value = [sentinel] if operator in {"IN", "NOT IN"} else sentinel
    assert (
        invalid_temporal_filter_value(
            operator, value, python_date_format=storage_format
        )
        is None
    )


@pytest.mark.parametrize(
    "sentinel", [" <NULL>", "<NULL> ", "<null>", " <empty string>"]
)
def test_temporal_sentinel_matching_is_exact(sentinel: str) -> None:
    """Spaces and case variants must not acquire sentinel semantics."""
    assert invalid_temporal_filter_value("==", sentinel) is not None


@pytest.mark.parametrize(
    ("storage_format", "value"),
    [
        ("%Y-%m-%d", "2000-1-1"),
        ("%Y-%m-%d", "2000-1-01"),
        ("%Y-%m-%d", "2000-01-1"),
        ("%Y%m%d", "200011"),
        ("%Y-%m-%d %H:%M:%S", "2000-01-01 1:2:3"),
    ],
)
@pytest.mark.parametrize("operator", ["=", "IN", "NOT IN"])
def test_stored_temporal_formats_reject_unpadded_fields(
    storage_format: str, value: str, operator: str
) -> None:
    """Parseable spellings must also match the stored string representation."""
    comparator = [value] if operator in {"IN", "NOT IN"} else value
    reason = invalid_temporal_filter_value(
        operator, comparator, python_date_format=storage_format
    )
    assert reason is not None
    assert "stored date format" in reason


@pytest.mark.parametrize(
    ("storage_format", "value"),
    [
        ("%Y-%m-%d", "2000-01-01"),
        ("%Y%m%d", "20000101"),
        ("%Y-%m-%d %H:%M:%S", "2000-01-01 01:02:03"),
        ("%Y-%m-%d", "\t2000-01-01\n"),
        ("%d-%b-%Y", "01-Jan-2000"),
        ("%d-%B-%Y", "01-January-2000"),
        ("%Y-%m-%d %I:%M %p", "2000-01-01 01:00 PM"),
        ("%A %Y-%m-%d", "Saturday 2000-01-01"),
        ("%a %Y-%m-%d", "Sat 2000-01-01"),
        ("%p", "PM"),
        ("%A", "Saturday"),
        ("%a", "Sat"),
        ("%Y-%m-%dT%H:%M:%S.%fZ", "2000-01-01T00:00:00.000Z"),
        ("%Y-%m-%dT%H:%M:%S%z", "2000-01-01T00:00:00+00:00"),
        ("%Y-%m-%dT%H:%M:%S%z", "2000-01-01T00:00:00Z"),
        ("%Y-%m-%d %% %H:%M:%S.%f%z", "2000-01-01 % 01:02:03.123+00:00"),
    ],
)
@pytest.mark.parametrize("operator", ["=", "IN", "NOT IN"])
def test_stored_temporal_formats_accept_exact_spellings(
    storage_format: str, value: str, operator: str
) -> None:
    """Exact stored spellings retain the shared tab/newline handling."""
    assert (
        invalid_temporal_filter_value(
            operator,
            [value] if operator in {"IN", "NOT IN"} else value,
            python_date_format=storage_format,
        )
        is None
    )


@pytest.mark.parametrize("storage_format", ["epoch_s", "epoch_ms"])
@pytest.mark.parametrize("value", ["2000-01-01", float("inf"), True])
def test_epoch_errors_recommend_column_units(storage_format: str, value: Any) -> None:
    """Rejected epoch comparators should receive actionable storage-unit guidance."""
    reason = invalid_temporal_filter_value(
        "=", value, python_date_format=storage_format
    )
    assert reason is not None
    assert f"Use a number in the column's {storage_format!r} units." in reason
    assert "ISO" not in reason
    assert "epoch milliseconds" not in reason


@pytest.mark.parametrize(
    ("storage_format", "value"),
    [
        ("%d-%b-%Y", "01-JAN-2000"),
        ("%d-%b-%Y", "01-jan-2000"),
        ("%d-%B-%Y", "01-JANUARY-2000"),
        ("%d-%B-%Y", "01-january-2000"),
        ("%Y-%m-%d %I:%M %p", "2000-01-01 01:00 pm"),
        ("%A %Y-%m-%d", "SATURDAY 2000-01-01"),
        ("%a %Y-%m-%d", "sat 2000-01-01"),
    ],
)
@pytest.mark.parametrize("operator", ["=", "IN", "NOT IN"])
def test_stored_temporal_formats_reject_case_mismatches(
    storage_format: str, value: str, operator: str
) -> None:
    """Case-insensitive parsing must not accept a different stored spelling."""
    reason = invalid_temporal_filter_value(
        operator,
        [value] if operator in {"IN", "NOT IN"} else value,
        python_date_format=storage_format,
    )
    assert reason is not None
    assert "stored date format" in reason
