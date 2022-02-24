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
from superset.utils.pandas_postprocessing import cum, pivot
from tests.unit_tests.fixtures.dataframes import (
    multiple_metrics_df,
    single_metric_df,
    timeseries_df,
)
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_cum():
    # create new column (cumsum)
    post_df = cum(df=timeseries_df, columns={"y": "y2"}, operator="sum",)
    assert post_df.columns.tolist() == ["label", "y", "y2"]
    assert series_to_list(post_df["label"]) == ["x", "y", "z", "q"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 3.0, 4.0]
    assert series_to_list(post_df["y2"]) == [1.0, 3.0, 6.0, 10.0]

    # overwrite column (cumprod)
    post_df = cum(df=timeseries_df, columns={"y": "y"}, operator="prod",)
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 6.0, 24.0]

    # overwrite column (cummin)
    post_df = cum(df=timeseries_df, columns={"y": "y"}, operator="min",)
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 1.0, 1.0, 1.0]

    # invalid operator
    with pytest.raises(QueryObjectValidationError):
        cum(
            df=timeseries_df, columns={"y": "y"}, operator="abc",
        )


def test_cum_with_pivot_df_and_single_metric():
    pivot_df = pivot(
        df=single_metric_df,
        index=["dttm"],
        columns=["country"],
        aggregates={"sum_metric": {"operator": "sum"}},
        flatten_columns=False,
        reset_index=False,
    )
    cum_df = cum(df=pivot_df, operator="sum", is_pivot_df=True,)
    #         dttm  UK  US
    # 0 2019-01-01   5   6
    # 1 2019-01-02  12  14
    assert cum_df["UK"].to_list() == [5.0, 12.0]
    assert cum_df["US"].to_list() == [6.0, 14.0]
    assert (
        cum_df["dttm"].to_list() == to_datetime(["2019-01-01", "2019-01-02"]).to_list()
    )


def test_cum_with_pivot_df_and_multiple_metrics():
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
    cum_df = cum(df=pivot_df, operator="sum", is_pivot_df=True,)
    #         dttm  count_metric, UK  count_metric, US  sum_metric, UK  sum_metric, US
    # 0 2019-01-01                 1                 2               5               6
    # 1 2019-01-02                 4                 6              12              14
    assert cum_df["count_metric, UK"].to_list() == [1.0, 4.0]
    assert cum_df["count_metric, US"].to_list() == [2.0, 6.0]
    assert cum_df["sum_metric, UK"].to_list() == [5.0, 12.0]
    assert cum_df["sum_metric, US"].to_list() == [6.0, 14.0]
    assert (
        cum_df["dttm"].to_list() == to_datetime(["2019-01-01", "2019-01-02"]).to_list()
    )
