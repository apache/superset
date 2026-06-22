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

import numpy as np
import pandas as pd
import pytest
from pandas import DataFrame, to_datetime

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import flatten, pivot
from tests.unit_tests.fixtures.dataframes import categories_df
from tests.unit_tests.pandas_postprocessing.utils import AGGREGATES_SINGLE


def test_pivot_without_columns():
    """
    Make sure pivot without columns returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == ["idx_nulls"]
    assert len(df) == 101
    assert df["idx_nulls"].sum() == 1050


def test_pivot_with_single_column():
    """
    Make sure pivot with single column returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == [
        ("idx_nulls", "cat0"),
        ("idx_nulls", "cat1"),
        ("idx_nulls", "cat2"),
    ]
    assert len(df) == 101
    assert df["idx_nulls"]["cat0"].sum() == 315

    df = pivot(
        df=categories_df,
        index=["dept"],
        columns=["category"],
        aggregates=AGGREGATES_SINGLE,
    )
    assert df.columns.tolist() == [
        ("idx_nulls", "cat0"),
        ("idx_nulls", "cat1"),
        ("idx_nulls", "cat2"),
    ]
    assert len(df) == 5


def test_pivot_with_multiple_columns():
    """
    Make sure pivot with multiple columns returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category", "dept"],
        aggregates=AGGREGATES_SINGLE,
    )
    df = flatten(df)
    assert len(df.columns) == 1 + 3 * 5  # index + possible permutations


def test_pivot_fill_values():
    """
    Make sure pivot with fill values returns correct DataFrame
    """
    df = pivot(
        df=categories_df,
        index=["name"],
        columns=["category"],
        metric_fill_value=1,
        aggregates={"idx_nulls": {"operator": "sum"}},
    )
    assert df["idx_nulls"]["cat0"].sum() == 382


def test_pivot_fill_column_values():
    """
    Make sure pivot with null column names returns correct DataFrame
    """
    df_copy = categories_df.copy()
    df_copy["category"] = None
    df = pivot(
        df=df_copy,
        index=["name"],
        columns=["category"],
        aggregates={"idx_nulls": {"operator": "sum"}},
    )
    assert len(df) == 101
    assert df.columns.tolist() == [("idx_nulls", "<NULL>")]


def test_pivot_exceptions():
    """
    Make sure pivot raises correct Exceptions
    """
    # Missing index
    with pytest.raises(TypeError):
        pivot(df=categories_df, columns=["dept"], aggregates=AGGREGATES_SINGLE)

    # invalid index reference
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["abc"],
            columns=["dept"],
            aggregates=AGGREGATES_SINGLE,
        )

    # invalid column reference
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["dept"],
            columns=["abc"],
            aggregates=AGGREGATES_SINGLE,
        )

    # invalid aggregate options
    with pytest.raises(InvalidPostProcessingError):
        pivot(
            df=categories_df,
            index=["name"],
            columns=["category"],
            aggregates={"idx_nulls": {}},
        )


def test_pivot_eliminate_cartesian_product_columns():
    # single metric
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "a": [0, 1],
            "b": [0, 1],
            "metric": [9, np.NAN],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["a", "b"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=False,
    )
    df = flatten(df)
    assert list(df.columns) == ["dttm", "metric, 0, 0", "metric, 1, 1"]
    assert np.isnan(df["metric, 1, 1"][0])

    # multiple metrics
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "a": [0, 1],
            "b": [0, 1],
            "metric": [9, np.NAN],
            "metric2": [10, 11],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["a", "b"],
        aggregates={
            "metric": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=False,
    )
    df = flatten(df)
    assert list(df.columns) == [
        "dttm",
        "metric, 0, 0",
        "metric, 1, 1",
        "metric2, 0, 0",
        "metric2, 1, 1",
    ]
    assert np.isnan(df["metric, 1, 1"][0])


def test_pivot_preserves_all_nan_metric_flat():
    """
    Pivot with drop_missing_columns=True must not drop metric columns whose entries
    are all NaN. This prevents downstream post-processing (e.g. rename) from failing
    with "Referenced columns not available in DataFrame" when a Jinja metric
    expression evaluates to NULL for every row (SC-100398).
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-02", "2019-01-03"]),
            "metric": [np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert "metric" in df.columns
    assert df["metric"].isna().all()


def test_pivot_preserves_all_nan_metric_with_columns():
    """
    Pivot with groupby columns and drop_missing_columns=True must restore the
    exact (metric, category_val) MultiIndex keys when all values for that metric
    are NaN. The restored keys must use the actual category values from the input
    data so that downstream rename/rolling validation and flatten produce the
    correct column names.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric": [np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert isinstance(df.columns, pd.MultiIndex)
    assert "metric" in df.columns.get_level_values(0)
    # Exact keys must reflect the real category values, not placeholders.
    assert ("metric", "A") in df.columns
    assert ("metric", "B") in df.columns

    df = flatten(df)
    assert "metric, A" in df.columns
    assert "metric, B" in df.columns
    assert df["metric, A"].isna().all()
    assert df["metric, B"].isna().all()


def test_pivot_preserves_all_nan_metric_multi_column():
    """
    Pivot with multiple groupby columns and an all-NaN metric restores the full
    multi-level (metric, col_val_1, col_val_2) key, not a truncated or placeholder
    version. Exercises the case where columns=["country", "category"].
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(
                ["2019-01-01", "2019-01-01", "2019-01-01", "2019-01-01"]
            ),
            "country": ["US", "US", "EU", "EU"],
            "category": ["A", "B", "A", "B"],
            "metric": [np.nan, np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["country", "category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    assert isinstance(df.columns, pd.MultiIndex)
    assert "metric" in df.columns.get_level_values(0)
    # All four combinations must be restored with correct full tuple keys.
    assert ("metric", "US", "A") in df.columns
    assert ("metric", "US", "B") in df.columns
    assert ("metric", "EU", "A") in df.columns
    assert ("metric", "EU", "B") in df.columns

    df = flatten(df)
    assert "metric, US, A" in df.columns
    assert "metric, EU, B" in df.columns
    assert df["metric, US, A"].isna().all()


def test_pivot_restored_nan_metric_column_order_is_deterministic():
    """
    Restored all-NaN metric columns must appear in data-insertion order, not
    in nondeterministic hash-set iteration order. This prevents column ordering
    from varying across Python processes (which randomize hash seeds by default).
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01", "2019-01-01"]),
            "category": ["C", "A", "B"],
            "metric": [np.nan, np.nan, np.nan],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={"metric": {"operator": "mean"}},
        drop_missing_columns=True,
    )

    # Columns restored in data-insertion order: C, A, B (not alphabetical or random).
    assert list(df.columns.get_level_values(1)) == ["C", "A", "B"]


def test_pivot_preserves_all_nan_metric_combine_value_with_metric():
    """
    When combine_value_with_metric=True, a stack()/unstack() is applied after
    column restoration. stack() drops all-NaN rows by default, which would remove
    the restored metric before downstream post-processing can reference it.
    Using dropna=False on stack() ensures restored all-NaN metrics survive.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric": [np.nan, np.nan],
            "metric2": [1.0, 2.0],
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=True,
        combine_value_with_metric=True,
    )

    # After stack()/unstack(), columns are (category_val, metric_name) tuples.
    # The all-NaN metric must appear in level 1 alongside metric2.
    assert isinstance(df.columns, pd.MultiIndex)
    metric_names = df.columns.get_level_values(1).tolist()
    assert "metric" in metric_names
    assert "metric2" in metric_names


def test_pivot_combine_sparse_metrics_no_spurious_extra_columns():
    """
    With drop_missing_columns=True and combine_value_with_metric=True, using
    stack(dropna=False) to preserve restored all-NaN metrics must not alter output
    shape for sparse-but-not-all-NaN metric/category pairs. stack(dropna=False) only
    changes behaviour for rows that are entirely NaN (a restored metric); sparse rows
    with at least one non-NaN value are unaffected — same result as dropna=True.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric1": [1.0, np.nan],  # data only for category A
            "metric2": [np.nan, 2.0],  # data only for category B
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric1": {"operator": "mean"},
            "metric2": {"operator": "mean"},
        },
        drop_missing_columns=True,
        combine_value_with_metric=True,
    )

    # After combine, columns are (category_val, metric_name) tuples.
    # Neither metric is entirely absent after pivoting, so _restore adds nothing.
    # stack(dropna=False) does not change results for sparse rows with mixed NaN/data.
    assert isinstance(df.columns, pd.MultiIndex)
    assert sorted(df.columns.get_level_values(0).unique()) == ["A", "B"]
    assert sorted(df.columns.get_level_values(1).unique()) == ["metric1", "metric2"]
    # Sparse NaN cells are present but the data cells must retain their values.
    assert df[("A", "metric1")].iloc[0] == 1.0
    assert df[("B", "metric2")].iloc[0] == 2.0


def test_pivot_only_entirely_absent_metrics_are_restored():
    """
    Only metrics with zero surviving columns after pivoting are restored.
    A metric with partial NaN — data for some categories but not all — must not
    be touched: its present columns are unchanged and its absent sparse combinations
    remain dropped. This makes the restoration invariant explicit.
    """
    mock_df = DataFrame(
        {
            "dttm": to_datetime(["2019-01-01", "2019-01-01"]),
            "category": ["A", "B"],
            "metric_all_nan": [np.nan, np.nan],  # entirely absent → restored
            "metric_partial": [1.0, np.nan],  # partially present → not restored
        }
    )

    df = pivot(
        df=mock_df,
        index=["dttm"],
        columns=["category"],
        aggregates={
            "metric_all_nan": {"operator": "mean"},
            "metric_partial": {"operator": "mean"},
        },
        drop_missing_columns=True,
    )

    # metric_all_nan was entirely absent: both category columns are restored as NaN.
    assert ("metric_all_nan", "A") in df.columns
    assert ("metric_all_nan", "B") in df.columns
    assert df[("metric_all_nan", "A")].isna().all()
    assert df[("metric_all_nan", "B")].isna().all()

    # metric_partial has data for A: present column is unchanged, sparse B dropped.
    assert ("metric_partial", "A") in df.columns
    assert ("metric_partial", "B") not in df.columns
    assert df[("metric_partial", "A")].iloc[0] == 1.0
