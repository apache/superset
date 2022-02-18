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
import pytest
from pandas import to_datetime

from superset.exceptions import QueryObjectValidationError
from superset.utils.pandas_postprocessing import pivot, rolling
from tests.unit_tests.fixtures.dataframes import (
    multiple_metrics_df,
    single_metric_df,
    timeseries_df,
)
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_rolling():
    # sum rolling type
    post_df = rolling(
        df=timeseries_df,
        columns={"y": "y"},
        rolling_type="sum",
        window=2,
        min_periods=0,
    )

    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 3.0, 5.0, 7.0]

    # mean rolling type with alias
    post_df = rolling(
        df=timeseries_df,
        rolling_type="mean",
        columns={"y": "y_mean"},
        window=10,
        min_periods=0,
    )
    assert post_df.columns.tolist() == ["label", "y", "y_mean"]
    assert series_to_list(post_df["y_mean"]) == [1.0, 1.5, 2.0, 2.5]

    # count rolling type
    post_df = rolling(
        df=timeseries_df,
        rolling_type="count",
        columns={"y": "y"},
        window=10,
        min_periods=0,
    )
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 3.0, 4.0]

    # quantile rolling type
    post_df = rolling(
        df=timeseries_df,
        columns={"y": "q1"},
        rolling_type="quantile",
        rolling_type_options={"quantile": 0.25},
        window=10,
        min_periods=0,
    )
    assert post_df.columns.tolist() == ["label", "y", "q1"]
    assert series_to_list(post_df["q1"]) == [1.0, 1.25, 1.5, 1.75]

    # incorrect rolling type
    with pytest.raises(QueryObjectValidationError):
        rolling(
            df=timeseries_df, columns={"y": "y"}, rolling_type="abc", window=2,
        )

    # incorrect rolling type options
    with pytest.raises(QueryObjectValidationError):
        rolling(
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="quantile",
            rolling_type_options={"abc": 123},
            window=2,
        )


def test_rolling_with_pivot_df_and_single_metric():
    pivot_df = pivot(
        df=single_metric_df,
        index=["dttm"],
        columns=["country"],
        aggregates={"sum_metric": {"operator": "sum"}},
        flatten_columns=False,
        reset_index=False,
    )
    rolling_df = rolling(
        df=pivot_df, rolling_type="sum", window=2, min_periods=0, is_pivot_df=True,
    )
    #         dttm  UK  US
    # 0 2019-01-01   5   6
    # 1 2019-01-02  12  14
    assert rolling_df["UK"].to_list() == [5.0, 12.0]
    assert rolling_df["US"].to_list() == [6.0, 14.0]
    assert (
        rolling_df["dttm"].to_list()
        == to_datetime(["2019-01-01", "2019-01-02"]).to_list()
    )

    rolling_df = rolling(
        df=pivot_df, rolling_type="sum", window=2, min_periods=2, is_pivot_df=True,
    )
    assert rolling_df.empty is True


def test_rolling_with_pivot_df_and_multiple_metrics():
    pivot_df = pivot(
        df=multiple_metrics_df,
        index=["dttm"],
        columns=["country"],
        aggregates={
            "sum_metric": {"operator": "sum"},
            "count_metric": {"operator": "sum"},
        },
        flatten_columns=False,
        reset_index=False,
    )
    rolling_df = rolling(
        df=pivot_df, rolling_type="sum", window=2, min_periods=0, is_pivot_df=True,
    )
    #         dttm  count_metric, UK  count_metric, US  sum_metric, UK  sum_metric, US
    # 0 2019-01-01               1.0               2.0             5.0             6.0
    # 1 2019-01-02               4.0               6.0            12.0            14.0
    assert rolling_df["count_metric, UK"].to_list() == [1.0, 4.0]
    assert rolling_df["count_metric, US"].to_list() == [2.0, 6.0]
    assert rolling_df["sum_metric, UK"].to_list() == [5.0, 12.0]
    assert rolling_df["sum_metric, US"].to_list() == [6.0, 14.0]
    assert (
        rolling_df["dttm"].to_list()
        == to_datetime(["2019-01-01", "2019-01-02",]).to_list()
    )
