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
from pandas import DataFrame, Series, Timestamp
from pandas.testing import assert_frame_equal
from pytest import fixture, mark  # noqa: PT013

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import TimeGrain
from superset.exceptions import QueryObjectValidationError
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
_datasource._perform_join = ExploreMixin._perform_join.__get__(_datasource)
_datasource._apply_cleanup_logic = ExploreMixin._apply_cleanup_logic.__get__(
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


def test_join_offset_dfs_raises_without_time_grain():
    """Time comparison with relative offsets requires a time grain."""
    df = DataFrame({"ds": [Timestamp("2021-01-01")], "D": [1]})
    offset_df = DataFrame({"ds": [Timestamp("2021-02-01")], "B": [5]})
    offset_dfs = {"1 year ago": offset_df}

    with pytest.raises(
        QueryObjectValidationError, match="Time Grain must be specified"
    ):
        query_context_processor.join_offset_dfs(
            df, offset_dfs, time_grain=None, join_keys=["ds"]
        )


def test_join_offset_dfs_allows_non_temporal_join_without_time_grain():
    """Time comparison without time grain is valid when join keys are non-temporal."""
    df = DataFrame({"country": ["US", "UK"], "metric": [10, 20]})
    offset_df = DataFrame({"country": ["US", "UK"], "metric__1 year ago": [8, 15]})
    offset_dfs = {"1 year ago": offset_df}

    result = query_context_processor.join_offset_dfs(
        df, offset_dfs, time_grain=None, join_keys=["country"]
    )
    assert "metric__1 year ago" in result.columns


def test_join_offset_dfs_raises_when_temporal_key_not_first():
    """Temporal join key detection works even when it's not the first key."""
    df = DataFrame(
        {"country": ["US", "UK"], "ds": [Timestamp("2021-01-01"), Timestamp("2021-02-01")], "D": [1, 2]}
    )
    offset_df = DataFrame(
        {"country": ["US", "UK"], "ds": [Timestamp("2021-03-01"), Timestamp("2021-04-01")], "B": [5, 6]}
    )
    offset_dfs = {"1 year ago": offset_df}

    with pytest.raises(
        QueryObjectValidationError, match="Time Grain must be specified"
    ):
        query_context_processor.join_offset_dfs(
            df, offset_dfs, time_grain=None, join_keys=["country", "ds"]
        )
