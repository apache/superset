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
"""Tests for :mod:`superset.common.cross_database_merger`."""

from __future__ import annotations

import pytest
import pandas as pd

from superset.common.cross_database_merger import (
    CrossDatabaseMerger,
    CrossDatabaseMergeError,
    CrossDatabaseMergeMemoryError,
    MergeResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def orders_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "order_id": [1, 2, 3, 4],
            "customer_id": [10, 20, 30, 40],
            "amount": [100.0, 200.0, 300.0, 400.0],
        }
    )


@pytest.fixture
def customers_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "id": [10, 20, 50],
            "name": ["Alice", "Bob", "Eve"],
            "country": ["US", "UK", "FR"],
        }
    )


@pytest.fixture
def merger() -> CrossDatabaseMerger:
    return CrossDatabaseMerger(max_rows=100_000, timeout_seconds=30)


# ---------------------------------------------------------------------------
# Tests — join types
# ---------------------------------------------------------------------------


class TestMergeJoinTypes:
    """Verify that each join type produces the expected row count."""

    def test_inner_join(
        self,
        merger: CrossDatabaseMerger,
        orders_df: pd.DataFrame,
        customers_df: pd.DataFrame,
    ) -> None:
        result = merger.merge_dataframes(
            source_df=orders_df,
            target_df=customers_df,
            column_pairs=[("customer_id", "id")],
            join_type="INNER",
        )
        assert isinstance(result, MergeResult)
        # Only customer_ids 10 and 20 match
        assert result.row_count == 2
        assert result.join_type == "INNER"
        assert set(result.df["name"]) == {"Alice", "Bob"}

    def test_left_join(
        self,
        merger: CrossDatabaseMerger,
        orders_df: pd.DataFrame,
        customers_df: pd.DataFrame,
    ) -> None:
        result = merger.merge_dataframes(
            source_df=orders_df,
            target_df=customers_df,
            column_pairs=[("customer_id", "id")],
            join_type="LEFT",
        )
        # All 4 orders preserved; unmatched get NaN
        assert result.row_count == 4
        assert result.df["name"].isna().sum() == 2

    def test_right_join(
        self,
        merger: CrossDatabaseMerger,
        orders_df: pd.DataFrame,
        customers_df: pd.DataFrame,
    ) -> None:
        result = merger.merge_dataframes(
            source_df=orders_df,
            target_df=customers_df,
            column_pairs=[("customer_id", "id")],
            join_type="RIGHT",
        )
        # All 3 customers preserved; Eve has no orders
        assert result.row_count == 3

    def test_full_join(
        self,
        merger: CrossDatabaseMerger,
        orders_df: pd.DataFrame,
        customers_df: pd.DataFrame,
    ) -> None:
        result = merger.merge_dataframes(
            source_df=orders_df,
            target_df=customers_df,
            column_pairs=[("customer_id", "id")],
            join_type="FULL",
        )
        # 2 matched + 2 unmatched orders + 1 unmatched customer = 5
        assert result.row_count == 5

    def test_cross_join(
        self,
        merger: CrossDatabaseMerger,
    ) -> None:
        left = pd.DataFrame({"a": [1, 2]})
        right = pd.DataFrame({"b": [10, 20, 30]})
        # Need a high max_rows for cross join
        m = CrossDatabaseMerger(max_rows=100, timeout_seconds=10)
        result = m.merge_dataframes(
            source_df=left,
            target_df=right,
            column_pairs=[],
            join_type="CROSS",
        )
        assert result.row_count == 6  # 2 × 3


# ---------------------------------------------------------------------------
# Tests — validation and error handling
# ---------------------------------------------------------------------------


class TestMergeValidation:
    """Verify that invalid inputs raise appropriate exceptions."""

    def test_invalid_join_type(self, merger: CrossDatabaseMerger) -> None:
        with pytest.raises(CrossDatabaseMergeError, match="Unsupported join type"):
            merger.merge_dataframes(
                source_df=pd.DataFrame({"a": [1]}),
                target_df=pd.DataFrame({"b": [1]}),
                column_pairs=[("a", "b")],
                join_type="NATURAL",
            )

    def test_missing_source_column(self, merger: CrossDatabaseMerger) -> None:
        with pytest.raises(CrossDatabaseMergeError, match="Source column"):
            merger.merge_dataframes(
                source_df=pd.DataFrame({"a": [1]}),
                target_df=pd.DataFrame({"b": [1]}),
                column_pairs=[("missing", "b")],
                join_type="INNER",
            )

    def test_missing_target_column(self, merger: CrossDatabaseMerger) -> None:
        with pytest.raises(CrossDatabaseMergeError, match="Target column"):
            merger.merge_dataframes(
                source_df=pd.DataFrame({"a": [1]}),
                target_df=pd.DataFrame({"b": [1]}),
                column_pairs=[("a", "missing")],
                join_type="INNER",
            )

    def test_no_column_pairs_non_cross(self, merger: CrossDatabaseMerger) -> None:
        with pytest.raises(CrossDatabaseMergeError, match="At least one column pair"):
            merger.merge_dataframes(
                source_df=pd.DataFrame({"a": [1]}),
                target_df=pd.DataFrame({"b": [1]}),
                column_pairs=[],
                join_type="INNER",
            )


# ---------------------------------------------------------------------------
# Tests — memory protection
# ---------------------------------------------------------------------------


class TestMemoryProtection:
    """Verify that the memory guard prevents oversized merges."""

    def test_cross_join_exceeds_limit(self) -> None:
        m = CrossDatabaseMerger(max_rows=5, timeout_seconds=10)
        left = pd.DataFrame({"a": range(3)})
        right = pd.DataFrame({"b": range(3)})
        with pytest.raises(CrossDatabaseMergeMemoryError, match="exceeds"):
            m.merge_dataframes(
                source_df=left,
                target_df=right,
                column_pairs=[],
                join_type="CROSS",
            )

    def test_post_merge_truncation(self) -> None:
        """When the actual result is larger than max_rows, truncate."""
        # Use a many-to-many scenario that produces more rows than expected
        m = CrossDatabaseMerger(max_rows=3, timeout_seconds=10)
        left = pd.DataFrame({"key": [1, 1, 1]})
        right = pd.DataFrame({"key": [1, 1]})
        result = m.merge_dataframes(
            source_df=left,
            target_df=right,
            column_pairs=[("key", "key")],
            join_type="INNER",
        )
        # 3×2 = 6 rows from merge, but truncated to 3
        assert result.row_count <= 3


# ---------------------------------------------------------------------------
# Tests — column conflict resolution
# ---------------------------------------------------------------------------


class TestColumnConflicts:
    """Verify suffix-based column-name conflict resolution."""

    def test_overlapping_columns_get_suffixes(
        self, merger: CrossDatabaseMerger
    ) -> None:
        left = pd.DataFrame({"key": [1], "value": [10]})
        right = pd.DataFrame({"key": [1], "value": [20]})
        result = merger.merge_dataframes(
            source_df=left,
            target_df=right,
            column_pairs=[("key", "key")],
            join_type="INNER",
        )
        cols = list(result.df.columns)
        # The 'value' column should have suffixes
        assert "value_source" in cols or "value_target" in cols

    def test_custom_prefixes(self, merger: CrossDatabaseMerger) -> None:
        left = pd.DataFrame({"key": [1], "value": [10]})
        right = pd.DataFrame({"key": [1], "value": [20]})
        result = merger.merge_dataframes(
            source_df=left,
            target_df=right,
            column_pairs=[("key", "key")],
            join_type="INNER",
            source_prefix="orders",
            target_prefix="customers",
        )
        cols = list(result.df.columns)
        assert "value_orders" in cols
        assert "value_customers" in cols


# ---------------------------------------------------------------------------
# Tests — MergeResult metadata
# ---------------------------------------------------------------------------


class TestMergeResultMetadata:
    """Verify that MergeResult carries correct metadata."""

    def test_metadata_populated(
        self,
        merger: CrossDatabaseMerger,
        orders_df: pd.DataFrame,
        customers_df: pd.DataFrame,
    ) -> None:
        result = merger.merge_dataframes(
            source_df=orders_df,
            target_df=customers_df,
            column_pairs=[("customer_id", "id")],
            join_type="LEFT",
        )
        assert result.source_rows == 4
        assert result.target_rows == 3
        assert result.duration_ms > 0
        assert result.column_pairs == [("customer_id", "id")]

    def test_type_cast_int32_int64(self, merger: CrossDatabaseMerger) -> None:
        """Regression test for B9: int32 and int64 join columns are
        promoted to float64 silently."""
        import pandas as pd

        src = pd.DataFrame({"id": pd.array([1, 2, 3], dtype="int32"), "val": [10, 20, 30]})
        tgt = pd.DataFrame({"id": pd.array([2, 3, 4], dtype="int64"), "name": ["a", "b", "c"]})

        result = merger.merge_dataframes(
            src, tgt, [("id", "id")], "INNER"
        )
        assert result.df is not None
        assert len(result.df) == 2
        # Both should have been cast to float64
        assert result.df["id"].dtype == "float64"

    def test_type_string_numeric_converts(self, merger: CrossDatabaseMerger) -> None:
        """Regression test for B9: when one side is object (string
        numeric) and the other is numeric, conversion is attempted."""
        import pandas as pd

        src = pd.DataFrame(
            {"id": ["1", "2", "3"], "val": [10, 20, 30]}
        )
        tgt = pd.DataFrame(
            {"id": [2, 3, 4], "name": ["a", "b", "c"]}
        )

        result = merger.merge_dataframes(
            src, tgt, [("id", "id")], "INNER"
        )
        assert result.df is not None
        assert len(result.df) == 2

    def test_type_mismatch_emits_warning(self) -> None:
        """Regression test for B9: _validate_dtypes emits a warning
        when types cannot be safely converted."""
        import pandas as pd

        src = pd.DataFrame(
            {"id": ["one", "two", "three"], "val": [10, 20, 30]}
        )
        tgt = pd.DataFrame(
            {"id": [2, 3, 4], "name": ["a", "b", "c"]}
        )

        from superset.common.cross_database_merger import CrossDatabaseMerger

        from unittest.mock import patch
        import logging

        with patch.object(logging.getLogger("superset.common.cross_database_merger"), "warning") as mock_warn:
            CrossDatabaseMerger._validate_dtypes(
                src, tgt, [("id", "id")]
            )
            assert mock_warn.called
            call_args = mock_warn.call_args[0] if mock_warn.call_args else ""
            formatted = call_args[0] % call_args[1:] if len(call_args) > 1 else str(call_args)
            assert "cannot be safely cast" in str(formatted) or "Type mismatch" in str(formatted)
