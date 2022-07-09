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
    Make sure pivot witn null column names returns correct DataFrame
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
