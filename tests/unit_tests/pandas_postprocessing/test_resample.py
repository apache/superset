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
from tests.unit_tests.fixtures.dataframes import categories_df, timeseries_df


def test_resample_should_not_side_effect():
    _timeseries_df = timeseries_df.copy()
    pp.resample(df=_timeseries_df, rule="1D", method="ffill")
    assert _timeseries_df.equals(timeseries_df)


def test_resample():
    post_df = pp.resample(df=timeseries_df, rule="1D", method="ffill")
    """
               label    y
    2019-01-01     x  1.0
    2019-01-02     y  2.0
    2019-01-03     y  2.0
    2019-01-04     y  2.0
    2019-01-05     z  3.0
    2019-01-06     z  3.0
    2019-01-07     q  4.0
    """
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", "y", "y", "z", "z", "q"],
                "y": [1.0, 2.0, 2.0, 2.0, 3.0, 3.0, 4.0],
            },
        )
    )


def test_resample_zero_fill():
    post_df = pp.resample(df=timeseries_df, rule="1D", method="asfreq", fill_value=0)
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", 0, 0, "z", 0, "q"],
                "y": [1.0, 2.0, 0, 0, 3.0, 0, 4.0],
            },
        )
    )


def test_resample_after_pivot():
    df = pd.DataFrame(
        data={
            "__timestamp": pd.to_datetime(
                [
                    "2022-01-13",
                    "2022-01-13",
                    "2022-01-13",
                    "2022-01-11",
                    "2022-01-11",
                    "2022-01-11",
                ]
            ),
            "city": ["Chicago", "LA", "NY", "Chicago", "LA", "NY"],
            "val": [6.0, 5.0, 4.0, 3.0, 2.0, 1.0],
        }
    )
    pivot_df = pp.pivot(
        df=df,
        index=["__timestamp"],
        columns=["city"],
        aggregates={"val": {"operator": "sum"},},
        flatten_columns=False,
        reset_index=False,
    )
    """
                    val
    city        Chicago   LA   NY
    __timestamp
    2022-01-11      3.0  2.0  1.0
    2022-01-13      6.0  5.0  4.0
    """
    resample_df = pp.resample(df=pivot_df, rule="1D", method="asfreq", fill_value=0,)
    """
                    val
    city        Chicago   LA   NY
    __timestamp
    2022-01-11      3.0  2.0  1.0
    2022-01-12      0.0  0.0  0.0
    2022-01-13      6.0  5.0  4.0
    """
    flat_df = pp.flatten(resample_df)
    """
      __timestamp  val, Chicago  val, LA  val, NY
    0  2022-01-11           3.0      2.0      1.0
    1  2022-01-12           0.0      0.0      0.0
    2  2022-01-13           6.0      5.0      4.0
    """
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "__timestamp": pd.to_datetime(
                    ["2022-01-11", "2022-01-12", "2022-01-13"]
                ),
                "val, Chicago": [3.0, 0, 6.0],
                "val, LA": [2.0, 0, 5.0],
                "val, NY": [1.0, 0, 4.0],
            }
        )
    )


def test_resample_should_raise_ex():
    with pytest.raises(InvalidPostProcessingError):
        pp.resample(
            df=categories_df, rule="1D", method="asfreq",
        )
