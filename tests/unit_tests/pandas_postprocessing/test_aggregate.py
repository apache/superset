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
