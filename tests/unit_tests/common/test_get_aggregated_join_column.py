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
from pytest import fixture, mark

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import (
    AGGREGATED_JOIN_COLUMN,
    QueryContextProcessor,
)
from superset.connectors.base.models import BaseDatasource
from superset.constants import TimeGrain

query_context_processor = QueryContextProcessor(
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
def test_aggregated_join_column(time_grain: str, expected: str):
    df = DataFrame({"ds": [Timestamp("2020-01-07")]})
    query_context_processor.add_aggregated_join_column(df, time_grain)
    result = DataFrame(
        {"ds": [Timestamp("2020-01-07")], AGGREGATED_JOIN_COLUMN: [expected]}
    )
    assert_frame_equal(df, result)


def test_aggregated_join_column_producer(make_join_column_producer):
    df = DataFrame({"ds": [Timestamp("2020-01-07")]})
    query_context_processor.add_aggregated_join_column(
        df, TimeGrain.YEAR, make_join_column_producer
    )
    result = DataFrame(
        {"ds": [Timestamp("2020-01-07")], AGGREGATED_JOIN_COLUMN: ["CUSTOM_FORMAT"]}
    )
    assert_frame_equal(df, result)
