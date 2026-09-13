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
from pandas.testing import assert_frame_equal

from superset.utils.pandas_postprocessing import aggregate
from tests.unit_tests.fixtures.dataframes import categories_df
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_aggregate():
    aggregates = {
        "asc sum": {"column": "asc_idx", "operator": "sum"},
        "asc q2": {
            "column": "asc_idx",
            "operator": "percentile",
            "options": {"q": 75},
        },
        "desc q1": {
            "column": "desc_idx",
            "operator": "percentile",
            "options": {"q": 25},
        },
    }
    df = aggregate(df=categories_df, groupby=["constant"], aggregates=aggregates)
    assert df.columns.tolist() == ["constant", "asc sum", "asc q2", "desc q1"]
    assert series_to_list(df["asc sum"])[0] == 5050
    assert series_to_list(df["asc q2"])[0] == 75
    assert series_to_list(df["desc q1"])[0] == 25


def test_aggregate_string_operators():
    """mean, median, and other operators in _PANDAS_STRING_AGGREGATORS use the
    pandas string path; verify results match expected values on asc_idx [0..100]."""
    aggregates = {
        "asc mean": {"column": "asc_idx", "operator": "mean"},
        "asc median": {"column": "asc_idx", "operator": "median"},
        "asc max": {"column": "asc_idx", "operator": "max"},
        "asc min": {"column": "asc_idx", "operator": "min"},
    }
    df = aggregate(df=categories_df, groupby=["constant"], aggregates=aggregates)
    assert series_to_list(df["asc mean"])[0] == 50.0
    assert series_to_list(df["asc median"])[0] == 50.0
    assert series_to_list(df["asc max"])[0] == 100
    assert series_to_list(df["asc min"])[0] == 0


def test_aggregate_count_includes_nulls():
    """'count' operator uses np.ma.count, which counts all rows including NaN.
    It is intentionally excluded from _PANDAS_STRING_AGGREGATORS to preserve this
    behavior (pandas SeriesGroupBy.count excludes NaN)."""
    aggregates = {
        "null_count": {"column": "idx_nulls", "operator": "count"},
    }
    df = aggregate(df=categories_df, groupby=["constant"], aggregates=aggregates)
    # idx_nulls has 101 rows total; np.ma.count returns all 101 (NaN included)
    assert series_to_list(df["null_count"])[0] == 101


def test_aggregate_preserves_null_groups() -> None:
    """Missing group keys form one group without changing metric aggregation."""
    df = pd.DataFrame(
        {
            "category": ["alpha", None, np.nan, pd.NA, "beta"],
            "value": [1, 2, 3, None, 5],
        }
    )

    result = aggregate(
        df,
        groupby=["category"],
        aggregates={
            "total": {"column": "value", "operator": "sum"},
            "mean": {"column": "value", "operator": "mean"},
            "count": {"column": "value", "operator": "count"},
        },
    )

    assert_frame_equal(
        result,
        pd.DataFrame(
            {
                "category": ["alpha", "beta", np.nan],
                "total": [1.0, 5.0, 5.0],
                "mean": [1.0, 5.0, 2.5],
                "count": [1, 1, 3],
            }
        ),
    )


def test_aggregate_preserves_null_keys_in_multiple_grouping_columns() -> None:
    """NULL in either grouping column retains the distinct key combination."""
    df = pd.DataFrame(
        {
            "category": ["alpha", "alpha", None, None, "alpha", None],
            "region": ["east", None, "east", None, None, None],
            "value": [1, 2, 3, 4, None, 6],
        }
    )

    result = aggregate(
        df,
        groupby=["category", "region"],
        aggregates={"total": {"column": "value", "operator": "sum"}},
    )

    assert_frame_equal(
        result,
        pd.DataFrame(
            {
                "category": ["alpha", "alpha", np.nan, np.nan],
                "region": ["east", np.nan, "east", np.nan],
                "total": [1.0, 2.0, 3.0, 10.0],
            }
        ),
    )


def test_aggregate_with_only_null_group_keys() -> None:
    """An entirely missing grouping column still produces its aggregate."""
    result = aggregate(
        pd.DataFrame({"category": [None, np.nan, pd.NA], "value": [1, None, 3]}),
        groupby=["category"],
        aggregates={"mean": {"column": "value", "operator": "mean"}},
    )

    assert len(result) == 1
    assert pd.isna(result.loc[0, "category"])
    assert result.loc[0, "mean"] == 2.0


def test_aggregate_without_grouping_columns() -> None:
    """Ungrouped aggregation still combines every row into one result."""
    result = aggregate(
        pd.DataFrame({"category": ["alpha", None], "value": [1, 3]}),
        groupby=[],
        aggregates={"total": {"column": "value", "operator": "sum"}},
    )

    assert_frame_equal(result, pd.DataFrame({"total": [4]}))
