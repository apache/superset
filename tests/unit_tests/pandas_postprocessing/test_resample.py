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
from datetime import datetime

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


def test_resample_pads_to_time_range():
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2018, 12, 30),
        time_range_end=datetime(2019, 1, 10),
    )
    assert post_df.index.equals(
        pd.date_range("2018-12-30", "2019-01-09", freq="1D"),
    )
    assert post_df["y"].tolist() == [0, 0, 1.0, 2.0, 0, 0, 3.0, 0, 4.0, 0, 0]


def test_resample_pads_a_single_data_point_to_the_whole_period():
    """
    A single data point should still produce a bucket for every period of the
    queried time range, rather than collapsing into one wide bucket.
    """
    post_df = pp.resample(
        df=pd.DataFrame(index=to_datetime(["2026-07-01 09:00:00"]), data={"y": [5.0]}),
        rule="1H",
        method="asfreq",
        fill_value=0,
        time_range_start="2026-07-01 00:00:00",
        time_range_end="2026-07-02 00:00:00",
    )
    assert len(post_df) == 24
    assert post_df.index[0] == pd.Timestamp("2026-07-01 00:00:00")
    assert post_df.index[-1] == pd.Timestamp("2026-07-01 23:00:00")
    assert post_df["y"].sum() == 5.0


def test_resample_time_range_end_is_exclusive():
    """
    The upper bound of a Superset time range is exclusive, so a boundary that
    falls exactly on a bucket edge should not add a trailing bucket.
    """
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2019, 1, 1),
        time_range_end=datetime(2019, 1, 8),
    )
    assert post_df.index[-1] == pd.Timestamp("2019-01-07")


def test_resample_does_not_shrink_to_time_range():
    """
    Boundaries only pad the result; data outside of them is left untouched.
    """
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2019, 1, 3),
        time_range_end=datetime(2019, 1, 5),
    )
    assert post_df.index[0] == pd.Timestamp("2019-01-01")
    assert post_df.index[-1] == pd.Timestamp("2019-01-07")


def test_resample_pads_timezone_aware_index_with_naive_bounds():
    df = timeseries_df.tz_localize("UTC")
    post_df = pp.resample(
        df=df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2018, 12, 31),
        time_range_end=datetime(2019, 1, 9),
    )
    assert post_df.index[0] == pd.Timestamp("2018-12-31", tz="UTC")
    assert post_df.index[-1] == pd.Timestamp("2019-01-08", tz="UTC")


def test_resample_pads_with_bounds_in_a_different_timezone():
    """
    Boundaries are converted to the timezone of the index; mixing timezones
    would otherwise produce an object index that cannot be resampled.
    """
    post_df = pp.resample(
        df=timeseries_df.tz_localize("UTC"),
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=pd.Timestamp("2018-12-30 19:00", tz="America/New_York"),
    )
    assert isinstance(post_df.index, pd.DatetimeIndex)
    assert post_df.index[0] == pd.Timestamp("2018-12-31", tz="UTC")


def test_resample_pads_naive_index_with_aware_bounds():
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=pd.Timestamp("2018-12-30", tz="UTC"),
    )
    assert isinstance(post_df.index, pd.DatetimeIndex)
    assert post_df.index[0] == pd.Timestamp("2018-12-30")


def test_resample_pads_a_frame_with_duplicate_timestamps():
    """
    Charts pivot before resampling, but the API may be called with a frame that
    repeats timestamps; padding must not break the aggregation.
    """
    df = pd.DataFrame(
        index=to_datetime(["2019-01-02", "2019-01-02"]),
        data={"y": [1.0, 2.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1D",
        method="sum",
        time_range_start=datetime(2018, 12, 31),
        time_range_end=datetime(2019, 1, 4),
    )
    assert post_df.index.equals(pd.date_range("2018-12-31", "2019-01-03", freq="1D"))
    assert post_df["y"].tolist() == [0.0, 0.0, 3.0, 0.0]


def test_resample_pads_every_series_of_a_pivoted_frame():
    df = pd.DataFrame(
        data={
            "__timestamp": to_datetime(["2019-01-02", "2019-01-04"]),
            "country": ["FR", "DE"],
            "val": [1.0, 2.0],
        }
    )
    pivot_df = pp.pivot(
        df=df,
        index=["__timestamp"],
        columns=["country"],
        aggregates={"val": {"operator": "sum"}},
    )
    post_df = pp.resample(
        df=pivot_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2019, 1, 1),
        time_range_end=datetime(2019, 1, 6),
    )
    assert not post_df.isna().any().any()
    assert pp.flatten(post_df).to_dict(orient="list") == {
        "__timestamp": list(pd.date_range("2019-01-01", "2019-01-05", freq="1D")),
        "val, DE": [0.0, 0.0, 0.0, 2.0, 0.0],
        "val, FR": [0.0, 1.0, 0.0, 0.0, 0.0],
    }


def test_resample_without_time_range_is_unchanged():
    assert pp.resample(df=timeseries_df, rule="1D", method="ffill").equals(
        pp.resample(
            df=timeseries_df,
            rule="1D",
            method="ffill",
            time_range_start=None,
            time_range_end=None,
        )
    )


def test_resample_expands_empty_frame_across_time_range():
    """
    An empty result set with a DatetimeIndex should still produce zero-filled
    buckets for every period of the queried time range.
    """
    empty_df = pd.DataFrame(
        {"y": pd.Series(dtype="float64")},
        index=pd.DatetimeIndex([], name="__timestamp"),
    )
    post_df = pp.resample(
        df=empty_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range_start=datetime(2019, 1, 1),
        time_range_end=datetime(2019, 1, 5),
    )
    assert post_df.index.equals(pd.date_range("2019-01-01", "2019-01-04", freq="1D"))
    assert post_df.index.name == "__timestamp"
    assert post_df["y"].tolist() == [0.0, 0.0, 0.0, 0.0]


def test_resample_empty_frame_without_time_range_stays_empty():
    empty_df = pd.DataFrame(
        {"y": pd.Series(dtype="float64")},
        index=pd.DatetimeIndex([]),
    )
    post_df = pp.resample(df=empty_df, rule="1D", method="asfreq", fill_value=0)
    assert post_df.empty
    assert isinstance(post_df.index, pd.DatetimeIndex)


def test_resample_rejects_too_many_buckets():
    """
    A fine rule over a wide *bounded* range must fail before pandas materializes
    the frame. The cap only applies when time-range bounds expand the series.
    """
    df = pd.DataFrame(
        index=to_datetime(["2020-01-01"]),
        data={"y": [1.0]},
    )
    with pytest.raises(InvalidPostProcessingError, match="too many time buckets"):
        pp.resample(
            df=df,
            rule="1s",
            method="asfreq",
            fill_value=0,
            time_range_start=datetime(2020, 1, 1),
            time_range_end=datetime(2020, 1, 2),
        )


def test_resample_without_bounds_allows_large_historical_spans():
    """
    Unbounded resamples of existing data must not hit the padded-path bucket cap,
    so long historical charts keep working.
    """
    df = pd.DataFrame(
        index=to_datetime(["1990-01-01", "2020-01-01"]),
        data={"y": [1.0, 2.0]},
    )
    post_df = pp.resample(df=df, rule="1D", method="asfreq", fill_value=0)
    assert len(post_df) > 10_000
    assert post_df.index[0] == pd.Timestamp("1990-01-01")
    assert post_df.index[-1] == pd.Timestamp("2020-01-01")


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

    with pytest.raises(InvalidPostProcessingError):
        pp.resample(
            df=timeseries_df,
            rule="1D",
            method="asfreq",
            time_range_start="not a date",
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
