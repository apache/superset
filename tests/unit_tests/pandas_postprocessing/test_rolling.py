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
import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils import pandas_postprocessing as pp
from superset.utils.pandas_postprocessing.utils import FLAT_COLUMN_SEPARATOR
from tests.unit_tests.fixtures.dataframes import (
    multiple_metrics_df,
    single_metric_df,
    timeseries_df,
)
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_rolling_should_not_side_effect():
    _timeseries_df = timeseries_df.copy()
    pp.rolling(
        df=timeseries_df,
        columns={"y": "y"},
        rolling_type="sum",
        window=2,
        min_periods=0,
    )
    assert _timeseries_df.equals(timeseries_df)


def test_rolling():
    # sum rolling type
    post_df = pp.rolling(
        df=timeseries_df,
        columns={"y": "y"},
        rolling_type="sum",
        window=2,
        min_periods=0,
    )

    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 3.0, 5.0, 7.0]

    # mean rolling type with alias
    post_df = pp.rolling(
        df=timeseries_df,
        rolling_type="mean",
        columns={"y": "y_mean"},
        window=10,
        min_periods=0,
    )
    assert post_df.columns.tolist() == ["label", "y", "y_mean"]
    assert series_to_list(post_df["y_mean"]) == [1.0, 1.5, 2.0, 2.5]

    # count rolling type
    post_df = pp.rolling(
        df=timeseries_df,
        rolling_type="count",
        columns={"y": "y"},
        window=10,
        min_periods=0,
    )
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 3.0, 4.0]

    # quantile rolling type
    post_df = pp.rolling(
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
    with pytest.raises(InvalidPostProcessingError):
        pp.rolling(
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="abc",
            window=2,
        )

    # incorrect rolling type options
    with pytest.raises(InvalidPostProcessingError):
        pp.rolling(
            df=timeseries_df,
            columns={"y": "y"},
            rolling_type="quantile",
            rolling_type_options={"abc": 123},
            window=2,
        )


def test_rolling_min_periods_trims_correctly():
    pivot_df = pp.pivot(
        df=single_metric_df,
        index=["dttm"],
        columns=["country"],
        aggregates={"sum_metric": {"operator": "sum"}},
    )
    rolling_df = pp.rolling(
        df=pivot_df,
        rolling_type="sum",
        window=2,
        min_periods=2,
        columns={"sum_metric": "sum_metric"},
    )
    assert len(rolling_df) == 1


def test_rolling_after_pivot_with_single_metric():
    pivot_df = pp.pivot(
        df=single_metric_df,
        index=["dttm"],
        columns=["country"],
        aggregates={"sum_metric": {"operator": "sum"}},
    )
    """
                   sum_metric
    country            UK US
    dttm
    2019-01-01          5  6
    2019-01-02          7  8
    """
    rolling_df = pp.rolling(
        df=pivot_df,
        columns={"sum_metric": "sum_metric"},
        rolling_type="sum",
        window=2,
        min_periods=0,
    )
    """
               sum_metric
    country            UK    US
    dttm
    2019-01-01          5     6
    2019-01-02         12    14
    """
    flat_df = pp.flatten(rolling_df)
    """
            dttm  sum_metric, UK  sum_metric, US
    0 2019-01-01               5               6
    1 2019-01-02              12              14
    """
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "dttm": pd.to_datetime(["2019-01-01", "2019-01-02"]),
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "UK"]): [5, 12],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "US"]): [6, 14],
            }
        )
    )


def test_rolling_after_pivot_with_multiple_metrics():
    pivot_df = pp.pivot(
        df=multiple_metrics_df,
        index=["dttm"],
        columns=["country"],
        aggregates={
            "sum_metric": {"operator": "sum"},
            "count_metric": {"operator": "sum"},
        },
    )
    """
               count_metric    sum_metric
    country              UK US         UK US
    dttm
    2019-01-01            1  2          5  6
    2019-01-02            3  4          7  8
    """
    rolling_df = pp.rolling(
        df=pivot_df,
        columns={
            "count_metric": "count_metric",
            "sum_metric": "sum_metric",
        },
        rolling_type="sum",
        window=2,
        min_periods=0,
    )
    """
               count_metric      sum_metric
    country              UK   US         UK    US
    dttm
    2019-01-01            1    2          5     6
    2019-01-02            4    6         12    14
    """
    flat_df = pp.flatten(rolling_df)
    """
            dttm  count_metric, UK  count_metric, US  sum_metric, UK  sum_metric, US
    0 2019-01-01                 1                 2               5               6
    1 2019-01-02                 4                 6              12              14
    """
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "dttm": pd.to_datetime(["2019-01-01", "2019-01-02"]),
                FLAT_COLUMN_SEPARATOR.join(["count_metric", "UK"]): [1, 4],
                FLAT_COLUMN_SEPARATOR.join(["count_metric", "US"]): [2, 6],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "UK"]): [5, 12],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "US"]): [6, 14],
            }
        )
    )
