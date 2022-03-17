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
from pandas import DataFrame, to_datetime

from superset.exceptions import QueryObjectValidationError
from superset.utils.pandas_postprocessing import resample
from tests.unit_tests.fixtures.dataframes import timeseries_df


def test_resample():
    df = timeseries_df.copy()
    df.index.name = "time_column"
    df.reset_index(inplace=True)

    post_df = resample(df=df, rule="1D", method="ffill", time_column="time_column",)
    assert post_df["label"].tolist() == ["x", "y", "y", "y", "z", "z", "q"]

    assert post_df["y"].tolist() == [1.0, 2.0, 2.0, 2.0, 3.0, 3.0, 4.0]

    post_df = resample(
        df=df, rule="1D", method="asfreq", time_column="time_column", fill_value=0,
    )
    assert post_df["label"].tolist() == ["x", "y", 0, 0, "z", 0, "q"]
    assert post_df["y"].tolist() == [1.0, 2.0, 0, 0, 3.0, 0, 4.0]


def test_resample_with_groupby():
    """
The Dataframe contains a timestamp column, a string column and a numeric column.
__timestamp     city  val
0  2022-01-13  Chicago  6.0
1  2022-01-13       LA  5.0
2  2022-01-13       NY  4.0
3  2022-01-11  Chicago  3.0
4  2022-01-11       LA  2.0
5  2022-01-11       NY  1.0
    """
    df = DataFrame(
        {
            "__timestamp": to_datetime(
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
    post_df = resample(
        df=df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_column="__timestamp",
        groupby_columns=("city",),
    )
    assert list(post_df.columns) == [
        "__timestamp",
        "city",
        "val",
    ]
    assert [str(dt.date()) for dt in post_df["__timestamp"]] == (
        ["2022-01-11"] * 3 + ["2022-01-12"] * 3 + ["2022-01-13"] * 3
    )
    assert list(post_df["val"]) == [3.0, 2.0, 1.0, 0, 0, 0, 6.0, 5.0, 4.0]

    # should raise error when get a non-existent column
    with pytest.raises(QueryObjectValidationError):
        resample(
            df=df,
            rule="1D",
            method="asfreq",
            fill_value=0,
            time_column="__timestamp",
            groupby_columns=("city", "unkonw_column",),
        )

    # should raise error when get a None value in groupby list
    with pytest.raises(QueryObjectValidationError):
        resample(
            df=df,
            rule="1D",
            method="asfreq",
            fill_value=0,
            time_column="__timestamp",
            groupby_columns=("city", None,),
        )
