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
from pandas import DataFrame, Series, Timestamp
from pandas.testing import assert_frame_equal
from pytest import fixture, mark, raises  # noqa: PT013

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.connectors.sqla.models import BaseDatasource, TableColumn
from superset.constants import TimeGrain
from superset.exceptions import QueryObjectValidationError
from superset.models.helpers import (
    _get_temporal_physical_column_metadata,
    ExploreMixin,
)
from superset.utils.core import GenericDataType

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


def test_join_offset_dfs_no_time_grain_aligns_temporal_string_axis() -> None:
    """A physical temporal x-axis is aligned even when its values are strings."""
    df = DataFrame({"displayed_ds": ["2021-01-01T12:00:00"], "D": [1]})
    offset_df = DataFrame({"displayed_ds": ["2020-01-01T12:00:00"], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["displayed_ds"],
        x_axis_label="displayed_ds",
        x_axis_is_temporal=True,
    )

    assert result["displayed_ds"].tolist() == ["2021-01-01T12:00:00"]
    assert result["B"].tolist() == [5]


def test_join_offset_dfs_rejects_unparseable_temporal_string_axis() -> None:
    """Invalid values on a declared temporal x-axis fail instead of self-joining."""
    df = DataFrame({"ds": ["not-a-date"], "D": [1]})
    offset_df = DataFrame({"ds": ["not-a-date"], "B": [5]})
    with raises(
        QueryObjectValidationError,
        match="contains values that cannot be parsed as datetimes",
    ):
        query_context_processor.join_offset_dfs(
            df,
            {"1 year ago": offset_df},
            time_grain=None,
            join_keys=["ds"],
            x_axis_label="ds",
            x_axis_is_temporal=True,
        )


def test_join_offset_dfs_no_time_grain_preserves_categorical_string_axis() -> None:
    """Categorical x-axes retain the raw-key join used without a time grain."""
    df = DataFrame({"category": ["alpha"], "D": [1]})
    offset_df = DataFrame({"category": ["alpha"], "B": [5]})
    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["category"],
        x_axis_label="category",
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_aligns_mixed_offset_temporal_strings() -> None:
    """Mixed UTC offsets are compared by their parsed local wall clocks."""
    df = DataFrame(
        {
            "ds": [
                "2021-03-20T12:00:00-04:00",
                "2021-12-01T12:00:00-05:00",
            ],
            "D": [1, 2],
        }
    )
    offset_df = DataFrame(
        {
            "ds": [
                "2020-03-20T12:00:00-04:00",
                "2020-12-01T12:00:00-05:00",
            ],
            "B": [5, 6],
        }
    )
    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["ds"],
        x_axis_label="ds",
        x_axis_is_temporal=True,
    )

    assert result["B"].tolist() == [5, 6]


def test_temporal_physical_column_honors_explicit_false(monkeypatch) -> None:
    """Explicit non-temporal metadata takes precedence over inferred type."""
    columns = [
        {
            "is_dttm": False,
            "type_generic": GenericDataType.TEMPORAL,
        },
        TableColumn(column_name="ds", type="TIMESTAMP", is_dttm=False),
    ]

    for column in columns:
        monkeypatch.setattr(
            query_context_processor,
            "get_column",
            lambda column_name, column=column: column,
        )
        metadata = _get_temporal_physical_column_metadata(query_context_processor, "ds")
        assert not metadata.is_temporal


def test_temporal_physical_column_strips_expression(monkeypatch) -> None:
    """Metadata lookup normalizes whitespace like SQL column resolution."""
    looked_up: list[str] = []

    def get_column(column_name: str) -> dict[str, bool | str]:
        looked_up.append(column_name)
        return {"is_dttm": True, "python_date_format": "epoch_s"}

    monkeypatch.setattr(query_context_processor, "get_column", get_column)

    metadata = _get_temporal_physical_column_metadata(query_context_processor, " ds ")

    assert metadata.is_temporal
    assert metadata.python_date_format == "epoch_s"
    assert looked_up == ["ds"]


def test_join_offset_dfs_no_time_grain_aligns_epoch_seconds_axis() -> None:
    """A declared epoch-seconds temporal axis uses its metadata format."""
    df = DataFrame({"ds": [1012780800], "D": [1]})
    offset_df = DataFrame({"ds": [981244800], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["ds"],
        x_axis_label="ds",
        x_axis_is_temporal=True,
        x_axis_datetime_format="epoch_s",
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_aligns_out_of_bounds_dates() -> None:
    """Valid dates outside nanosecond bounds align at second resolution."""
    df = DataFrame({"ds": ["2002-01-01", "9999-12-31"], "D": [1, 2]})
    offset_df = DataFrame({"ds": ["2001-01-01", "9998-12-31"], "B": [5, 6]})

    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["ds"],
        x_axis_label="ds",
        x_axis_is_temporal=True,
    )

    assert result["B"].tolist() == [5, 6]


def test_join_offset_dfs_no_time_grain_out_of_bounds_respects_format() -> None:
    """A wider-resolution retry preserves the declared strftime format."""
    df = DataFrame({"ds": ["03/04/2022", "31/12/9999"], "D": [1, 2]})
    offset_df = DataFrame({"ds": ["03/03/2022", "30/11/9999"], "B": [5, 6]})

    result = query_context_processor.join_offset_dfs(
        df,
        {"1 month ago": offset_df},
        time_grain=None,
        join_keys=["ds"],
        x_axis_label="ds",
        x_axis_is_temporal=True,
        x_axis_datetime_format="%d/%m/%Y",
    )

    assert result["B"].tolist() == [5, 6]


def test_join_offset_dfs_numeric_temporal_without_format_uses_raw_key() -> None:
    """An uninterpretable numeric temporal axis retains raw-key behavior."""
    df = DataFrame({"ds": [1012780800], "D": [1]})
    offset_df = DataFrame({"ds": [1012780800], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df,
        {"1 year ago": offset_df},
        time_grain=None,
        join_keys=["ds"],
        x_axis_label="ds",
        x_axis_is_temporal=True,
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_wraps_datetime_parser_value_error(
    monkeypatch,
) -> None:
    """A pandas parser-policy change remains a user-facing validation error."""
    df = DataFrame({"ds": ["2021-01-01"], "D": [1]})
    offset_df = DataFrame({"ds": ["2020-01-01"], "B": [5]})

    def fail_to_parse(*args, **kwargs):
        raise ValueError("mixed time zones require utc=True")

    monkeypatch.setattr("superset.models.helpers.pd.to_datetime", fail_to_parse)

    with raises(
        QueryObjectValidationError,
        match="contains values that cannot be parsed as datetimes",
    ):
        query_context_processor.join_offset_dfs(
            df,
            {"1 year ago": offset_df},
            time_grain=None,
            join_keys=["ds"],
            x_axis_label="ds",
            x_axis_is_temporal=True,
        )


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
    An offset that no parser can interpret cannot be aligned without a time
    grain, and fails with the error that points at the missing grain rather
    than silently producing an unshifted or empty comparison.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-01-01")], "B": [5]})
    offset_dfs = {"not a real offset": offset_df}

    with raises(QueryObjectValidationError, match="Time Grain must be"):
        query_context_processor.join_offset_dfs(
            df, offset_dfs, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_no_time_grain_uninterpretable_offset_subsecond() -> None:
    """
    Sub-second timestamps must not mask an uninterpretable offset:
    unparseability is detected from the parser's parse flag, not by
    comparing shifted values, so value precision cannot fake a
    successful parse.
    """
    df = DataFrame({"ds": [Timestamp("2021-01-01 00:00:00.123456")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-01-01 00:00:00.123456")], "B": [5]})
    offset_dfs = {"not a real offset": offset_df}

    with raises(QueryObjectValidationError, match="Time Grain must be"):
        query_context_processor.join_offset_dfs(
            df, offset_dfs, time_grain=None, join_keys=["ds"]
        )


@mark.parametrize("offset", ["yesterday", "last month", "friday", "june"])
def test_join_offset_dfs_no_time_grain_anchor_offset(offset: str) -> None:
    """
    Phrases that parsedatetime resolves to a fixed point rather than a shift
    are rejected. Applied per row they would move each timestamp by a
    different amount -- parsedatetime anchors both of these rows onto the same
    09:00 timestamp -- collapsing distinct buckets onto one join key.
    """
    df = DataFrame(
        {
            "ds": [Timestamp("2021-06-15 03:00"), Timestamp("2021-06-15 21:00")],
            "D": [1, 2],
        }
    )
    offset_df = DataFrame({"ds": [Timestamp("2021-06-14 03:00")], "B": [5]})

    with raises(QueryObjectValidationError, match="Time Grain must be"):
        query_context_processor.join_offset_dfs(
            df, {offset: offset_df}, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_no_time_grain_free_form_delta_offset() -> None:
    """
    Free-form phrasing that does denote a fixed shift still aligns: it misses
    the normalize_time_delta grammar but shifts every row equally, which is
    all the join needs.
    """
    df = DataFrame({"ds": [Timestamp("2021-06-15 03:00")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2020-06-15 03:00")], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df, {"one year ago": offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_dst_nonexistent_hour() -> None:
    """
    A shift landing on a local hour that DST skips must not raise: 02:30 never
    occurs on 2021-03-14 in US/Eastern, so no row can carry that reading and
    the comparison is simply empty. Shifting the tz-aware timestamp directly
    raised NonExistentTimeError out of pandas instead.
    """
    df = DataFrame({"ds": [Timestamp("2021-04-14 02:30", tz="US/Eastern")], "D": [1]})
    offset_df = DataFrame(
        {"ds": [Timestamp("2021-03-15 02:30", tz="US/Eastern")], "B": [5]}
    )

    result = query_context_processor.join_offset_dfs(
        df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].isna().all()


def test_join_offset_dfs_no_time_grain_dst_ambiguous_hour() -> None:
    """One reading of a repeated local hour still aligns by wall clock."""
    df = DataFrame({"ds": [Timestamp("2021-12-07 01:30", tz="US/Eastern")], "D": [1]})
    offset_df = DataFrame(
        {
            "ds": [
                Timestamp("2021-11-07 01:30").tz_localize("US/Eastern", ambiguous=True)
            ],
            "B": [5],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].tolist() == [5]


def test_join_offset_dfs_no_time_grain_rejects_both_dst_fold_readings() -> None:
    """
    When the offset query returns both readings of a repeated local hour,
    dropping their UTC offsets would give both rows the same merge key and
    expand the main series. Reject the ambiguous alignment instead.
    """
    df = DataFrame({"ds": [Timestamp("2021-12-07 01:30", tz="US/Eastern")], "D": [1]})
    offset_df = DataFrame(
        {
            "ds": [
                Timestamp("2021-11-07 01:30").tz_localize("US/Eastern", ambiguous=True),
                Timestamp("2021-11-07 01:30").tz_localize(
                    "US/Eastern", ambiguous=False
                ),
            ],
            "B": [5, 6],
        }
    )

    with raises(
        QueryObjectValidationError,
        match="ambiguous daylight-saving fold",
    ):
        query_context_processor.join_offset_dfs(
            df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_no_time_grain_rejects_naive_normalization_collision() -> None:
    """Distinct naive values that normalize alike cannot expand the result."""
    df = DataFrame({"ds": ["2021-02-01"], "D": [1]})
    offset_df = DataFrame(
        {
            "ds": ["2021-01-01", "2021-01-01 00:00:00"],
            "B": [5, 6],
        }
    )

    with raises(
        QueryObjectValidationError,
        match="normalize to the same instant",
    ):
        query_context_processor.join_offset_dfs(
            df,
            {"1 month ago": offset_df},
            time_grain=None,
            join_keys=["ds"],
            x_axis_label="ds",
            x_axis_is_temporal=True,
        )


def test_join_offset_dfs_no_time_grain_rejects_dst_fold_with_raw_duplicate() -> None:
    """A raw duplicate does not mask a DST fold in the same normalized group."""
    df = DataFrame({"ds": [Timestamp("2021-12-07 01:30", tz="US/Eastern")], "D": [1]})
    first_fold = Timestamp("2021-11-07 01:30").tz_localize("US/Eastern", ambiguous=True)
    second_fold = Timestamp("2021-11-07 01:30").tz_localize(
        "US/Eastern", ambiguous=False
    )
    offset_df = DataFrame(
        {
            "ds": [first_fold, first_fold, second_fold],
            "B": [5, 6, 7],
        }
    )

    with raises(
        QueryObjectValidationError,
        match="ambiguous daylight-saving fold",
    ):
        query_context_processor.join_offset_dfs(
            df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_no_time_grain_preserves_raw_duplicate_offsets() -> None:
    """Pre-existing naive duplicate keys are not diagnosed as a DST fold."""
    df = DataFrame({"ds": [Timestamp("2021-02-01")], "D": [1]})
    offset_df = DataFrame(
        {
            "ds": [Timestamp("2021-01-01"), Timestamp("2021-01-01")],
            "B": [5, 6],
        }
    )

    result = query_context_processor.join_offset_dfs(
        df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].tolist() == [5, 6]


def test_join_offset_dfs_no_time_grain_all_null_anchor_still_raises() -> None:
    """An all-null temporal axis does not bypass anchor validation."""
    df = DataFrame({"ds": Series([None], dtype="datetime64[ns]"), "D": [1]})
    offset_df = DataFrame({"ds": [float("nan")], "B": [float("nan")]})

    with raises(QueryObjectValidationError, match="Time Grain must be"):
        query_context_processor.join_offset_dfs(
            df, {"friday": offset_df}, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_no_time_grain_allows_month_end_clamp_on_left() -> None:
    """Multiple main dates may intentionally shift to one month-end key."""
    df = DataFrame(
        {
            "ds": [Timestamp("2021-03-30"), Timestamp("2021-03-31")],
            "D": [1, 2],
        }
    )
    offset_df = DataFrame({"ds": [Timestamp("2021-02-28")], "B": [5]})

    result = query_context_processor.join_offset_dfs(
        df, {"1 month ago": offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert len(result) == len(df)
    assert result["B"].tolist() == [5, 5]


@mark.parametrize(
    "offset",
    [
        # shifts via DateOffset
        "2 weeks ago",
        # misses the normalize_time_delta grammar, shifts via the parser
        "two weeks ago",
    ],
)
def test_join_offset_dfs_no_time_grain_tz_aware_preserves_wall_clock(
    offset: str,
) -> None:
    """
    A tz-aware shift crossing a DST boundary matches the same wall clock on
    the other side, rather than drifting by the hour the UTC offset changed.
    The offset query's own time range is shifted with naive arithmetic, so its
    rows carry the source wall clock and only a wall-clock join finds them.
    Both shift paths have to agree on that.
    """
    df = DataFrame({"ds": [Timestamp("2021-03-20 12:00", tz="US/Eastern")], "D": [1]})
    # Two weeks before 2021-03-20 EDT is 2021-03-06 EST: same 12:00 wall
    # clock, one hour further from UTC.
    offset_df = DataFrame(
        {"ds": [Timestamp("2021-03-06 12:00", tz="US/Eastern")], "B": [5]}
    )

    result = query_context_processor.join_offset_dfs(
        df, {offset: offset_df}, time_grain=None, join_keys=["ds"]
    )

    assert result["B"].tolist() == [5]


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
