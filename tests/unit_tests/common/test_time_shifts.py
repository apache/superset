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
import logging

from pandas import DataFrame, Series, Timestamp
from pandas.testing import assert_frame_equal
from pytest import fixture, LogCaptureFixture, mark  # noqa: PT013

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import TimeGrain
from superset.models.helpers import ExploreMixin

# Create processor and bind ExploreMixin methods to datasource
processor = QueryContextProcessor(
    QueryContext(
        datasource=BaseDatasource(),
        queries=[],
        result_type=ChartDataResultType.COLUMNS,
        form_data={},
        slice_=None,
        result_format=ChartDataResultFormat.CSV,
        cache_values={},
    )
)

# Bind ExploreMixin methods to datasource for testing
# Type annotation needed because _qc_datasource is typed as Explorable in protocol
_datasource: BaseDatasource = processor._qc_datasource  # type: ignore
_datasource.add_offset_join_column = ExploreMixin.add_offset_join_column.__get__(
    _datasource
)
_datasource.join_offset_dfs = ExploreMixin.join_offset_dfs.__get__(_datasource)
_datasource.is_valid_date_range = ExploreMixin.is_valid_date_range.__get__(_datasource)
_datasource._determine_join_keys = ExploreMixin._determine_join_keys.__get__(
    _datasource
)
_datasource._align_offset_without_time_grain = (
    ExploreMixin._align_offset_without_time_grain.__get__(_datasource)
)
_datasource._perform_join = ExploreMixin._perform_join.__get__(_datasource)
_datasource._apply_cleanup_logic = ExploreMixin._apply_cleanup_logic.__get__(
    _datasource
)
_datasource._coalesce_offset_index = ExploreMixin._coalesce_offset_index.__get__(
    _datasource
)
# Static methods don't need binding - assign directly
_datasource.generate_join_column = ExploreMixin.generate_join_column
_datasource.is_valid_date_range_static = ExploreMixin.is_valid_date_range_static

# Convenience reference for backward compatibility in tests
query_context_processor = _datasource


@fixture
def make_join_column_producer():
    def join_column_producer(row: Series, column_index: int) -> str:
        return "CUSTOM_FORMAT"

    return join_column_producer


@mark.parametrize(
    ("time_grain", "expected"),
    [
        (TimeGrain.WEEK, "2020-W01"),
        (TimeGrain.MONTH, "2020-01"),
        (TimeGrain.QUARTER, "2020-Q1"),
        (TimeGrain.YEAR, "2020"),
    ],
)
def test_join_column(time_grain: str, expected: str):
    df = DataFrame({"ds": [Timestamp("2020-01-07")]})
    column_name = "join_column"
    query_context_processor.add_offset_join_column(df, column_name, time_grain)
    result = DataFrame({"ds": [Timestamp("2020-01-07")], column_name: [expected]})
    assert_frame_equal(df, result)


def test_join_column_producer(make_join_column_producer):
    df = DataFrame({"ds": [Timestamp("2020-01-07")]})
    column_name = "join_column"
    query_context_processor.add_offset_join_column(
        df, column_name, TimeGrain.YEAR, None, make_join_column_producer
    )
    result = DataFrame(
        {"ds": [Timestamp("2020-01-07")], column_name: ["CUSTOM_FORMAT"]}
    )
    assert_frame_equal(df, result)


def test_join_offset_dfs_no_offsets():
    df = DataFrame({"A": ["2021-01-01", "2021-02-01", "2021-03-01"]})
    offset_dfs = {}
    time_grain = "YEAR"
    join_keys = ["A"]

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys
    )

    assert_frame_equal(df, result)


def test_join_offset_dfs_with_offsets():
    df = DataFrame({"A": ["2021-01-01", "2021-02-01", "2021-03-01"]})
    offset_df = DataFrame(
        {"A": ["2021-02-01", "2021-03-01", "2021-04-01"], "B": [5, 6, 7]}
    )
    offset_dfs = {"1_YEAR": offset_df}
    time_grain = "YEAR"
    join_keys = ["A"]

    expected = DataFrame(
        {"A": ["2021-01-01", "2021-02-01", "2021-03-01"], "B": [None, 5, 6]}
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_with_multiple_offsets():
    df = DataFrame({"A": ["2021-01-01", "2021-02-01", "2021-03-01"]})
    offset_df1 = DataFrame(
        {"A": ["2021-02-01", "2021-03-01", "2021-04-01"], "B": [5, 6, 7]}
    )
    offset_df2 = DataFrame(
        {"A": ["2021-03-01", "2021-04-01", "2021-05-01"], "C": [8, 9, 10]}
    )
    offset_dfs = {"1_YEAR": offset_df1, "2_YEAR": offset_df2}
    time_grain = "YEAR"
    join_keys = ["A"]

    expected = DataFrame(
        {
            "A": ["2021-01-01", "2021-02-01", "2021-03-01"],
            "B": [None, 5, 6],
            "C": [None, None, 8],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_with_month_granularity():
    df = DataFrame(
        {
            "A": [
                "2021-01-01",
                "2021-01-15",
                "2021-02-01",
                "2021-02-15",
                "2021-03-01",
                "2021-03-15",
            ],
            "D": [1, 2, 3, 4, 5, 6],
        }
    )
    offset_df = DataFrame(
        {
            "A": [
                "2021-02-01",
                "2021-02-15",
                "2021-03-01",
                "2021-03-15",
                "2021-04-01",
                "2021-04-15",
            ],
            "B": [5, 6, 7, 8, 9, 10],
        }
    )
    offset_dfs = {"1_MONTH": offset_df}
    time_grain = "MONTH"
    join_keys = ["A"]

    expected = DataFrame(
        {
            "A": [
                "2021-01-01",
                "2021-01-15",
                "2021-02-01",
                "2021-02-15",
                "2021-03-01",
                "2021-03-15",
            ],
            "D": [1, 2, 3, 4, 5, 6],
            "B": [None, None, 5, 6, 7, 8],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_full_range_keeps_historical_tail():
    """
    With full_range=True the offset (historical) series keeps its full time range
    even when the main series ends earlier.

    Simulates "today so far" (main, ends at 01:00) compared against "1 day ago"
    (a complete prior day, runs to 02:00). The 02:00 historical point must survive
    and be aligned onto today's axis, with the main metric left null there.
    """
    # Main series: today, only two hours of data so far.
    df = DataFrame(
        {
            "A": [Timestamp("2021-01-02 00:00"), Timestamp("2021-01-02 01:00")],
            "V": [1.0, 2.0],
        }
    )
    # Offset series: the full prior day (already renamed metric column "B").
    offset_df = DataFrame(
        {
            "A": [
                Timestamp("2021-01-01 00:00"),
                Timestamp("2021-01-01 01:00"),
                Timestamp("2021-01-01 02:00"),
            ],
            "B": [10.0, 20.0, 30.0],
        }
    )
    offset_dfs = {"1 day ago": offset_df}
    time_grain = TimeGrain.HOUR
    join_keys = ["A"]

    expected = DataFrame(
        {
            "A": [
                Timestamp("2021-01-02 00:00"),
                Timestamp("2021-01-02 01:00"),
                Timestamp("2021-01-02 02:00"),
            ],
            "V": [1.0, 2.0, None],
            "B": [10.0, 20.0, 30.0],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys, full_range=True
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_full_range_disabled_truncates_historical():
    """The default (full_range=False) left join drops the historical 02:00 point."""
    df = DataFrame(
        {
            "A": [Timestamp("2021-01-02 00:00"), Timestamp("2021-01-02 01:00")],
            "V": [1.0, 2.0],
        }
    )
    offset_df = DataFrame(
        {
            "A": [
                Timestamp("2021-01-01 00:00"),
                Timestamp("2021-01-01 01:00"),
                Timestamp("2021-01-01 02:00"),
            ],
            "B": [10.0, 20.0, 30.0],
        }
    )
    offset_dfs = {"1 day ago": offset_df}

    expected = DataFrame(
        {
            "A": [Timestamp("2021-01-02 00:00"), Timestamp("2021-01-02 01:00")],
            "V": [1.0, 2.0],
            "B": [10.0, 20.0],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, TimeGrain.HOUR, ["A"], full_range=False
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_totals_query_no_dimensions():
    """
    Test time offset join for totals query with no dimension columns.

    This simulates a table chart totals query where:
    - columns=[] (no dimensions, only metrics)
    - time_offsets=["1 month ago"]
    - The dataframes only contain metric columns (no datetime column)

    The join should use the __temp_join_key__ fallback mechanism
    to properly join the offset data.
    """
    # Main totals query result - only has metric column, no datetime
    df = DataFrame({"Total Cost": [54211.76]})

    # Offset query result - renamed metric column
    offset_df = DataFrame({"Total Cost__1 month ago": [48000.50]})

    offset_dfs = {"1 month ago": offset_df}
    time_grain = "P1D"  # Daily grain from extras
    join_keys = []  # No dimension columns for totals query

    expected = DataFrame(
        {"Total Cost": [54211.76], "Total Cost__1 month ago": [48000.50]}
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain, join_keys
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_no_time_grain_aligns_relative_offset() -> None:
    """
    Without a time grain, a relative offset joins on the exact shifted
    timestamps instead of raising, so saved charts without a grain render
    with a correctly aligned comparison series.
    """
    df = DataFrame(
        {
            "ds": [Timestamp("2021-01-01"), Timestamp("2021-02-01")],
            "D": [1, 2],
        }
    )
    offset_df = DataFrame(
        {
            "ds": [Timestamp("2020-01-01"), Timestamp("2020-02-01")],
            "B": [5, 6],
        }
    )
    offset_dfs = {"1 year ago": offset_df}

    expected = DataFrame(
        {
            "ds": [Timestamp("2021-01-01"), Timestamp("2021-02-01")],
            "D": [1, 2],
            "B": [5, 6],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_no_time_grain_unmatched_timestamps_yield_nulls() -> None:
    """
    Without a time grain, offset timestamps that have no exact shifted
    counterpart in the main series produce nulls instead of raising.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-06-15")], "B": [5]})
    offset_dfs = {"1 year ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert "B" in result.columns
    assert result["B"].isna().all()


def test_join_offset_dfs_no_time_grain_multiple_offsets() -> None:
    """
    Multiple relative offsets without a time grain each align on their own
    shifted timestamps, and no synthetic join columns leak into the result.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-29")], "D": [1]})
    offset_df1 = DataFrame({"ds": [Timestamp("2021-01-01")], "B": [5]})
    offset_df2 = DataFrame({"ds": [Timestamp("2020-01-29")], "C": [7]})
    offset_dfs = {"28 days ago": offset_df1, "1 year ago": offset_df2}

    expected = DataFrame(
        {
            "ds": [Timestamp("2021-01-29")],
            "D": [1],
            "B": [5],
            "C": [7],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_no_time_grain_empty_offset_df() -> None:
    """
    An empty offset series materializes its join keys as NaN floats; the
    grain-less join must not crash on the dtype mismatch.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [float("nan")], "B": [float("nan")]})
    offset_dfs = {"1 year ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert "B" in result.columns
    assert result["B"].isna().all()


def test_join_offset_dfs_no_time_grain_quarter_offset() -> None:
    """
    Quarter offsets align without a time grain (normalize_time_delta converts
    quarters to months, since pd.DateOffset has no quarters argument).
    """
    df = DataFrame({"ds": [Timestamp("2021-04-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2021-01-01")], "B": [5]})
    offset_dfs = {"1 quarter ago": offset_df}

    expected = DataFrame({"ds": [Timestamp("2021-04-01")], "D": [1], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_no_time_grain_free_form_offset() -> None:
    """
    Offsets outside the normalize_time_delta grammar (e.g. "one year ago")
    are aligned with the same parser that shifted the offset query's range.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-01-01")], "B": [5]})
    offset_dfs = {"one year ago": offset_df}

    expected = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert_frame_equal(expected, result)


def test_join_offset_dfs_no_time_grain_free_form_offset_tz_microseconds() -> None:
    """
    Free-form offsets align timezone-aware, sub-second timestamps: each row's
    shift is computed from a naive second-truncated copy and applied to the
    original value, so the join keys keep their timezone and precision.
    """
    df = DataFrame(
        {"ds": [Timestamp("2021-03-04 05:06:07.890123", tz="UTC")], "D": [1]}
    )
    offset_df = DataFrame(
        {"ds": [Timestamp("2020-03-04 05:06:07.890123", tz="UTC")], "B": [5]}
    )
    offset_dfs = {"one year ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_uninterpretable_offset() -> None:
    """
    An offset that no parser can interpret falls back to joining on the raw
    keys (an empty comparison series) instead of crashing.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-01-01")], "B": [5]})
    offset_dfs = {"not a real offset": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["ds"]
    )

    assert "B" in result.columns
    assert result["B"].isna().all()


def test_join_offset_dfs_no_time_grain_uninterpretable_offset_subsecond(
    caplog: LogCaptureFixture,
) -> None:
    """
    The unparseable-offset probe compares against a truncated copy of the
    probed timestamp; sub-second values must not mask an uninterpretable
    offset (the parser echoes a truncated time, which would look like a
    successful parse and silently join truncated keys).
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01 00:00:00.123456")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-01-01 00:00:00.123456")], "B": [5]})
    offset_dfs = {"not a real offset": offset_df}

    with caplog.at_level(logging.WARNING, logger="superset.models.helpers"):
        result = query_context_processor.join_offset_dfs(
            df, offset_dfs, time_grain=None, join_keys=["ds"]
        )

    assert "Cannot interpret time offset" in caplog.text
    assert result["B"].isna().all()


def test_join_offset_dfs_no_time_grain_prefers_x_axis_label() -> None:
    """
    With multiple datetime join keys, the query's x-axis is the one shifted
    for alignment, not whichever datetime column happens to come first.
    """
    df = DataFrame(
        {
            "birth_date": [Timestamp("1990-05-05")],
            "ds": [Timestamp("2021-02-01")],
            "D": [1],
        }
    )
    offset_df = DataFrame(
        {
            "birth_date": [Timestamp("1990-05-05")],
            "ds": [Timestamp("2021-01-01")],
            "B": [5],
        }
    )
    offset_dfs = {"1 month ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df,
        offset_dfs,
        time_grain=None,
        join_keys=["birth_date", "ds"],
        x_axis_label="ds",
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_preserves_column_order() -> None:
    """
    A join key following the temporal key must not change the result's
    column order (chart payloads and CSV exports derive order from columns).
    """
    df = DataFrame(
        {
            "country": ["US"],
            "ds": [Timestamp("2021-02-01")],
            "category": ["a"],
            "D": [1],
        }
    )
    offset_df = DataFrame(
        {
            "country": ["US"],
            "ds": [Timestamp("2021-01-01")],
            "category": ["a"],
            "B": [5],
        }
    )
    offset_dfs = {"1 month ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["country", "ds", "category"]
    )

    assert result.columns.tolist() == ["country", "ds", "category", "D", "B"]
    assert result["B"].tolist() == [5]


def test_join_offset_dfs_allows_non_temporal_join_without_time_grain():
    """Time comparison without time grain is valid when join keys are non-temporal."""
    df = DataFrame({"country": ["US", "UK"], "metric": [10, 20]})
    offset_df = DataFrame({"country": ["US", "UK"], "metric__1 year ago": [8, 15]})
    offset_dfs = {"1 year ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["country"]
    )
    assert "metric__1 year ago" in result.columns


def test_join_offset_dfs_no_time_grain_temporal_key_not_first() -> None:
    """
    The temporal join key is aligned by shifting even when it is not the
    first join key; remaining keys still participate in the join.
    """
    df = DataFrame(
        {
            "country": ["US", "UK"],
            "ds": [Timestamp("2021-02-01"), Timestamp("2021-02-01")],
            "D": [1, 2],
        }
    )
    offset_df = DataFrame(
        {
            "country": ["US", "UK"],
            "ds": [Timestamp("2021-01-01"), Timestamp("2021-01-01")],
            "B": [5, 6],
        }
    )
    offset_dfs = {"1 month ago": offset_df}

    expected = DataFrame(
        {
            "country": ["US", "UK"],
            "ds": [Timestamp("2021-02-01"), Timestamp("2021-02-01")],
            "D": [1, 2],
            "B": [5, 6],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["country", "ds"]
    )

    assert_frame_equal(expected, result)
