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
from pandas import to_datetime

from superset.exceptions import InvalidPostProcessingError
from superset.utils import pandas_postprocessing as pp
from tests.unit_tests.fixtures.dataframes import (
    categories_df,
    timeseries_df,
    timeseries_with_gap_df,
)


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


def test_resample_ffill_with_gaps():
    post_df = pp.resample(df=timeseries_with_gap_df, rule="1D", method="ffill")
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
                "y": [1.0, 2.0, 2.0, 2.0, 2.0, 2.0, 4.0],
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


def test_resample_zero_fill_with_gaps():
    post_df = pp.resample(
        df=timeseries_with_gap_df, rule="1D", method="asfreq", fill_value=0
    )
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
                "y": [1.0, 2.0, 0, 0, 0, 0, 4.0],
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
        aggregates={
            "val": {"operator": "sum"},
        },
    )
    """
                    val
    city        Chicago   LA   NY
    __timestamp
    2022-01-11      3.0  2.0  1.0
    2022-01-13      6.0  5.0  4.0
    """
    resample_df = pp.resample(
        df=pivot_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
    )
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
            df=categories_df,
            rule="1D",
            method="asfreq",
        )

    with pytest.raises(InvalidPostProcessingError):
        pp.resample(
            df=timeseries_df,
            rule="1D",
            method="foobar",
        )


def test_resample_zero_fill_full_time_range_single_point():
    # Only one data point in the queried range; zero-fill should still
    # produce a bucket for every hour in [start, end).
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 05:00:00"]),
        data={"y": [7.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    expected_index = pd.date_range(
        start="2026-07-01 00:00:00", end="2026-07-02 00:00:00", freq="1h"
    )[:-1]
    assert post_df.index.equals(expected_index)
    assert len(post_df) == 24
    expected_y = [0.0] * 24
    expected_y[5] = 7.0
    assert post_df["y"].tolist() == expected_y


def test_resample_zero_fill_full_time_range_missing_at_start():
    # First data point occurs partway through the range; earlier buckets
    # should be filled with zero instead of being omitted.
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 10:00:00", "2026-07-01 15:00:00"]),
        data={"y": [1.0, 2.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    assert len(post_df) == 24
    assert post_df["y"].iloc[:10].tolist() == [0.0] * 10
    assert post_df["y"].iloc[10] == 1.0
    assert post_df["y"].iloc[15] == 2.0


def test_resample_zero_fill_full_time_range_missing_at_end():
    # Last data point occurs before the end of the range; trailing buckets
    # should be filled with zero instead of being omitted.
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 02:00:00", "2026-07-01 08:00:00"]),
        data={"y": [1.0, 2.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    assert len(post_df) == 24
    assert post_df["y"].iloc[2] == 1.0
    assert post_df["y"].iloc[8] == 2.0
    assert post_df["y"].iloc[9:].tolist() == [0.0] * (24 - 9)


def test_resample_zero_fill_full_time_range_missing_throughout():
    # Sparse data points scattered across the range; every other bucket
    # should be filled with zero across the full queried range.
    df = pd.DataFrame(
        index=to_datetime(
            ["2026-07-01 01:00:00", "2026-07-01 11:00:00", "2026-07-01 22:00:00"]
        ),
        data={"y": [1.0, 2.0, 3.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    expected_y = [0.0] * 24
    expected_y[1] = 1.0
    expected_y[11] = 2.0
    expected_y[22] = 3.0
    assert len(post_df) == 24
    assert post_df["y"].tolist() == expected_y


def test_resample_zero_fill_without_time_range_keeps_existing_behavior():
    # When the query time range isn't supplied, behavior must match the
    # pre-existing (data-bounded) resampling.
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


def test_resample_zero_fill_tz_aware_index_naive_time_range():
    # The DataFrame index can be timezone-aware (e.g. a `timestamptz` source
    # column), while `time_range_start`/`time_range_end` (QueryObject's
    # resolved `from_dttm`/`to_dttm`) are always naive. Combining the two
    # must not raise pandas' "must have the same timezone" error, and the
    # real data point must be preserved alongside the zero-filled buckets.
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 05:00:00"]).tz_localize("America/New_York"),
        data={"y": [7.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    assert post_df.index.tz is not None
    assert len(post_df) == 24
    expected_y = [0.0] * 24
    expected_y[5] = 7.0
    assert post_df["y"].tolist() == expected_y


def test_resample_zero_fill_tz_naive_index_and_time_range():
    # The common case: both the DataFrame index and the time range bounds
    # are naive. Must behave identically to before the timezone-alignment
    # fix (no tz_localize/tz_convert should be applied).
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 05:00:00"]),
        data={"y": [7.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-01 00:00:00"),
        time_range_end=to_datetime("2026-07-02 00:00:00"),
    )
    assert post_df.index.tz is None
    assert len(post_df) == 24
    expected_y = [0.0] * 24
    expected_y[5] = 7.0
    assert post_df["y"].tolist() == expected_y


def test_resample_zero_fill_dst_spring_forward():
    # US Eastern loses the 02:00 wall-clock hour on 2026-03-08 (spring
    # forward), so an hourly grid across that day has only 23 buckets.
    # Zero-filling must follow the same tz-aware arithmetic as the real
    # data rather than assuming a fixed 24-hour day.
    df = pd.DataFrame(
        index=to_datetime(["2026-03-08 01:00:00"]).tz_localize("America/New_York"),
        data={"y": [3.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1h",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-03-08 00:00:00"),
        time_range_end=to_datetime("2026-03-09 00:00:00"),
    )
    assert len(post_df) == 23
    assert post_df["y"].iloc[0] == 0.0
    assert post_df["y"].iloc[1] == 3.0


def test_resample_zero_fill_month_start_rule_preserves_out_of_range_bucket():
    # For calendar-anchored rules (month/quarter/year start), pandas'
    # Resampler ignores the `origin` kwarg entirely and always bins to
    # calendar boundaries, while `pd.date_range(start=...)` rolls forward
    # from `start`. A row that lands in the calendar month *containing*
    # `time_range_start` (but starting before it, e.g. the query range
    # begins mid-month) must not be dropped just because its bucket label
    # falls outside the generated full-range grid.
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01", "2026-08-01"]),
        data={"y": [9.0, 4.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="MS",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-07-15"),
        time_range_end=to_datetime("2026-10-15"),
    )
    assert post_df.loc[to_datetime("2026-07-01"), "y"] == 9.0
    assert post_df.loc[to_datetime("2026-08-01"), "y"] == 4.0
    assert post_df.loc[to_datetime("2026-09-01"), "y"] == 0.0
    assert post_df.loc[to_datetime("2026-10-01"), "y"] == 0.0
    assert len(post_df) == 4


def test_resample_zero_fill_quarter_start_rule():
    df = pd.DataFrame(
        index=to_datetime(["2026-01-01", "2026-04-01"]),
        data={"y": [1.0, 2.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="QS",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-02-15"),
        time_range_end=to_datetime("2026-11-01"),
    )
    assert post_df["y"].tolist() == [1.0, 2.0, 0.0, 0.0]
    assert list(post_df.index) == list(
        to_datetime(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"])
    )


def test_resample_zero_fill_year_start_rule():
    df = pd.DataFrame(
        index=to_datetime(["2026-01-01"]),
        data={"y": [5.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="YS",
        method="asfreq",
        fill_value=0,
        time_range_start=to_datetime("2026-06-01"),
        time_range_end=to_datetime("2029-06-01"),
    )
    assert post_df["y"].tolist() == [5.0, 0.0, 0.0, 0.0]
    assert list(post_df.index) == list(
        to_datetime(["2026-01-01", "2027-01-01", "2028-01-01", "2029-01-01"])
    )


def test_resample_linear():
    df = pd.DataFrame(
        index=to_datetime(["2019-01-01", "2019-01-05", "2019-01-08"]),
        data={"label": ["a", "e", "j"], "y": [1.0, 5.0, 8.0]},
    )
    post_df = pp.resample(df=df, rule="1D", method="linear")
    """
               label    y
    2019-01-01     a  1.0
    2019-01-02   NaN  2.0
    2019-01-03   NaN  3.0
    2019-01-04   NaN  4.0
    2019-01-05     e  5.0
    2019-01-06   NaN  6.0
    2019-01-07   NaN  7.0
    2019-01-08     j  8.0
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
                    "2019-01-08",
                ]
            ),
            data={
                "label": ["a", np.NaN, np.NaN, np.NaN, "e", np.NaN, np.NaN, "j"],
                "y": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
            },
        )
    )
