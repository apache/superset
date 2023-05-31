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
from pandas import Timestamp

from superset.common.query_context_processor import QueryContextProcessor
from superset.constants import TimeGrain

get_aggregated_join_column = QueryContextProcessor.get_aggregated_join_column

row = [Timestamp("2020-01-07")]


def test_week_join_column():
    result = get_aggregated_join_column(
        row=row, column_index=0, time_grain=TimeGrain.WEEK
    )
    assert result == "2020-W01"


def test_month_join_column():
    result = get_aggregated_join_column(
        row=row, column_index=0, time_grain=TimeGrain.MONTH
    )
    assert result == "2020-01"


def test_quarter_join_column():
    result = get_aggregated_join_column(
        row=row, column_index=0, time_grain=TimeGrain.QUARTER
    )
    assert result == "2020-Q1"


def test_year_join_column():
    result = get_aggregated_join_column(
        row=row, column_index=0, time_grain=TimeGrain.YEAR
    )
    assert result == "2020"
