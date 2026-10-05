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
    timeseries_with_gap_df,
)
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_cum_should_not_side_effect():
    _timeseries_df = timeseries_df.copy()
    pp.cum(
        df=timeseries_df,
        columns={"y": "y2"},
        operator="sum",
    )
    assert _timeseries_df.equals(timeseries_df)


def test_cum():
    # create new column (cumsum)
    post_df = pp.cum(
        df=timeseries_df,
        columns={"y": "y2"},
        operator="sum",
    )
    assert post_df.columns.tolist() == ["label", "y", "y2"]
    assert series_to_list(post_df["label"]) == ["x", "y", "z", "q"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 3.0, 4.0]
    assert series_to_list(post_df["y2"]) == [1.0, 3.0, 6.0, 10.0]

    # overwrite column (cumprod)
    post_df = pp.cum(
        df=timeseries_df,
        columns={"y": "y"},
        operator="prod",
    )
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, 6.0, 24.0]

    # overwrite column (cummin)
    post_df = pp.cum(
        df=timeseries_df,
        columns={"y": "y"},
        operator="min",
    )
    assert post_df.columns.tolist() == ["label", "y"]
    assert series_to_list(post_df["y"]) == [1.0, 1.0, 1.0, 1.0]

    # invalid operator
    with pytest.raises(InvalidPostProcessingError):
        pp.cum(
            df=timeseries_df,
            columns={"y": "y"},
            operator="abc",
        )


def test_cum_with_gap():
    # create new column (cumsum)
    post_df = pp.cum(
        df=timeseries_with_gap_df,
        columns={"y": "y2"},
        operator="sum",
    )
    assert post_df.columns.tolist() == ["label", "y", "y2"]
    assert series_to_list(post_df["label"]) == ["x", "y", "z", "q"]
    assert series_to_list(post_df["y"]) == [1.0, 2.0, None, 4.0]
    assert series_to_list(post_df["y2"]) == [1.0, 3.0, 3.0, 7.0]


def test_cum_with_gap_non_additive_operators():
    """A gap must not be treated as 0 for operators where 0 is not the identity.

    ``fillna(0)`` is only correct for ``sum``. For ``prod`` a single gap zeroes
    the rest of the series, and for ``min``/``max`` it makes 0 the running
    extreme even though 0 never appears in the data. The last cumulative value
    is carried across the gap instead.
    """
    gapped = pd.DataFrame({"y": [2.0, None, 3.0, 4.0]})
    assert series_to_list(
        pp.cum(df=gapped, columns={"y": "y"}, operator="prod")["y"]
    ) == [2.0, 2.0, 6.0, 24.0]

    gapped = pd.DataFrame({"y": [5.0, None, 3.0, 7.0]})
    assert series_to_list(
        pp.cum(df=gapped, columns={"y": "y"}, operator="min")["y"]
    ) == [5.0, 5.0, 3.0, 3.0]

    gapped = pd.DataFrame({"y": [-5.0, None, -3.0, -9.0]})
    assert series_to_list(
        pp.cum(df=gapped, columns={"y": "y"}, operator="max")["y"]
    ) == [-5.0, -5.0, -3.0, -3.0]


def test_cum_with_leading_gap():
    """A leading gap has no cumulative value to carry, so it stays empty.

    Reporting 0 there would put a data point on the chart before the series
    has any data.
    """
    leading = pd.DataFrame({"y": [None, 1.0, 2.0]})
    post_df = pp.cum(df=leading, columns={"y": "y"}, operator="sum")
    assert series_to_list(post_df["y"]) == [None, 1.0, 3.0]


def test_cum_after_pivot_with_single_metric():
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
    cum_df = pp.cum(df=pivot_df, operator="sum", columns={"sum_metric": "sum_metric"})
    """
               sum_metric
    country            UK  US
    dttm
    2019-01-01          5   6
    2019-01-02         12  14
    """
    cum_and_flat_df = pp.flatten(cum_df)
    """
                dttm  sum_metric, UK  sum_metric, US
    0 2019-01-01               5               6
    1 2019-01-02              12              14
    """
    assert cum_and_flat_df.equals(
        pd.DataFrame(
            {
                "dttm": pd.to_datetime(["2019-01-01", "2019-01-02"]),
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "UK"]): [5, 12],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "US"]): [6, 14],
            }
        )
    )


def test_cum_after_pivot_with_multiple_metrics():
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
    cum_df = pp.cum(
        df=pivot_df,
        operator="sum",
        columns={"sum_metric": "sum_metric", "count_metric": "count_metric"},
    )
    """
               count_metric    sum_metric
    country              UK US         UK  US
    dttm
    2019-01-01            1  2          5   6
    2019-01-02            4  6         12  14
    """
    flat_df = pp.flatten(cum_df)
    """
            dttm  count_metric, UK  count_metric, US  sum_metric, UK  sum_metric, US
    0 2019-01-01                 1                 2               5               6
    1 2019-01-02                 4                 6              12              14
    """
    assert flat_df.equals(
        pd.DataFrame(
            {
                "dttm": pd.to_datetime(["2019-01-01", "2019-01-02"]),
                FLAT_COLUMN_SEPARATOR.join(["count_metric", "UK"]): [1, 4],
                FLAT_COLUMN_SEPARATOR.join(["count_metric", "US"]): [2, 6],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "UK"]): [5, 12],
                FLAT_COLUMN_SEPARATOR.join(["sum_metric", "US"]): [6, 14],
            }
        )
    )
