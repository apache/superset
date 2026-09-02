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
Unit tests for MCP service response utilities.
"""

from typing import Any

import pytest

from superset.mcp_service.utils.response_utils import (
    data_column_stats_row_limit,
    format_data_columns,
    format_data_quality,
    STATS_ROW_CAP,
    STATS_TOTAL_WORK_CAP,
)
from superset.utils.core import GenericDataType


class TestFormatDataColumns:
    """Test format_data_columns function."""

    def test_infers_numeric_type(self) -> None:
        """Should infer numeric data_type from sample values."""
        data: list[dict[str, Any]] = [
            {"revenue": 100},
            {"revenue": 200},
            {"revenue": None},
        ]
        columns = format_data_columns(data, ["revenue"])

        assert len(columns) == 1
        assert columns[0].name == "revenue"
        assert columns[0].data_type == "numeric"
        assert columns[0].null_count == 1
        assert columns[0].unique_count == 2

    def test_infers_boolean_type(self) -> None:
        """Should infer boolean data_type from sample values."""
        data: list[dict[str, Any]] = [{"is_active": True}, {"is_active": False}]
        columns = format_data_columns(data, ["is_active"])

        assert columns[0].data_type == "boolean"

    def test_infers_string_type_by_default(self) -> None:
        """Should default to string data_type when values aren't numeric/boolean."""
        data: list[dict[str, Any]] = [{"region": "west"}, {"region": "east"}]
        columns = format_data_columns(data, ["region"])

        assert columns[0].data_type == "string"

    def test_string_type_when_no_sample_values(self) -> None:
        """Should default to string data_type when all sampled values are null."""
        data: list[dict[str, Any]] = [{"region": None}]
        columns = format_data_columns(data, ["region"])

        assert columns[0].data_type == "string"

    def test_sample_values_capped_at_three(self) -> None:
        """Should only take the first 3 non-null values as samples."""
        data: list[dict[str, Any]] = [{"region": f"r{i}"} for i in range(10)]
        columns = format_data_columns(data, ["region"])

        assert columns[0].sample_values == ["r0", "r1", "r2"]

    def test_late_non_null_samples_share_the_bounded_statistics_pass(self) -> None:
        data: list[dict[str, Any]] = [
            {"amount": None, "enabled": None} for _ in range(10)
        ] + [
            {"amount": 1, "enabled": True},
            {"amount": 2.0, "enabled": False},
            {"amount": 3, "enabled": True},
        ]

        columns = format_data_columns(data, ["amount", "enabled"])

        assert columns[0].data_type == "numeric"
        assert columns[0].sample_values == [1, 2.0, 3]
        assert columns[1].data_type == "boolean"
        assert columns[1].sample_values == [True, False, True]

    def test_unique_count_uses_typed_numeric_identity_without_stringification(
        self,
    ) -> None:
        class HostileValue:
            def __str__(self) -> str:
                raise AssertionError("value string hook executed")

        hostile = HostileValue()
        data: list[dict[str, Any]] = [
            {"value": 1},
            {"value": 1.0},
            {"value": "1"},
            {"value": hostile},
            {"value": hostile},
        ]

        column = format_data_columns(data, ["value"])[0]

        assert column.unique_count == 3

    def test_authoritative_coltypes_apply_to_empty_data(self) -> None:
        columns = format_data_columns(
            [],
            ["event_time", "enabled", "amount", "label"],
            [
                GenericDataType.TEMPORAL,
                GenericDataType.BOOLEAN,
                GenericDataType.NUMERIC,
                GenericDataType.STRING,
            ],
        )

        assert [column.data_type for column in columns] == [
            "temporal",
            "boolean",
            "numeric",
            "string",
        ]
        assert all(column.sample_values == [] for column in columns)

    def test_null_and_unique_counts_reflect_full_small_dataset(self) -> None:
        """Should count nulls/uniques across all rows when under the cap."""
        data: list[dict[str, Any]] = [
            {"region": "west"},
            {"region": "west"},
            {"region": "east"},
            {"region": None},
        ]
        columns = format_data_columns(data, ["region"])

        assert columns[0].null_count == 1
        assert columns[0].unique_count == 2
        assert columns[0].statistics is None

    def test_stats_marked_as_sampled_beyond_row_cap(self) -> None:
        """Should mark statistics as sampled when data exceeds STATS_ROW_CAP.

        Regression test: null_count/unique_count are computed on a capped
        sample for performance, but were previously returned as if they were
        exact full-dataset totals with no indication of sampling.
        """
        data: list[dict[str, Any]] = [{"id": i} for i in range(STATS_ROW_CAP + 10)]
        columns = format_data_columns(data, ["id"])

        assert columns[0].statistics == {"sampled_rows": STATS_ROW_CAP}
        assert columns[0].null_count == 0
        assert columns[0].unique_count == STATS_ROW_CAP

    def test_multiple_columns(self) -> None:
        """Should build metadata for every requested column."""
        data = [{"region": "west", "revenue": 100}]
        columns = format_data_columns(data, ["region", "revenue"])

        assert [c.name for c in columns] == ["region", "revenue"]

    def test_wide_sparse_metadata_uses_shared_row_column_work_budget(self) -> None:
        row_count = 50_000
        column_count = 4096
        rows: list[dict[str, Any]] = [{} for _ in range(row_count)]
        raw_columns = [f"column_{index}" for index in range(column_count)]

        columns = format_data_columns(rows, raw_columns)

        sampled_rows = data_column_stats_row_limit(row_count, column_count)
        assert sampled_rows == STATS_TOTAL_WORK_CAP // column_count
        assert len(columns) == column_count
        assert columns[0].statistics == {"sampled_rows": sampled_rows}
        assert columns[-1].statistics == {"sampled_rows": sampled_rows}
        assert columns[0].null_count == sampled_rows
        assert columns[-1].null_count == sampled_rows
        assert format_data_quality(columns, row_count) == {
            "completeness": 0.0,
            "completeness_is_approximate": True,
            "sampled_rows": sampled_rows,
        }

    def test_shared_acyclic_nested_values_are_profiled_by_value(self) -> None:
        shared = [1, {"nested": 2}]
        columns = format_data_columns(
            [{"left": shared, "right": shared}], ["left", "right"]
        )

        assert columns[0].unique_count == 1
        assert columns[1].unique_count == 1
        assert columns[0].sample_values == columns[1].sample_values

    def test_nested_identity_consumes_the_shared_iterative_budget(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            "superset.mcp_service.utils.response_utils.STATS_TOTAL_WORK_CAP", 5
        )
        rows: list[dict[str, Any]] = [
            {"value": [1, 2, 3, 4]},
            {"value": "unreached"},
        ]

        column = format_data_columns(rows, ["value"])[0]

        assert column.sample_values == []
        assert column.unique_count == 0
        assert column.statistics == {"sampled_rows": 0}
