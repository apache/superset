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

"""Shape insights should only speak up when a reader could act on them."""

from superset.mcp_service.chart.constants import (
    LARGE_RESULT_ROW_THRESHOLD,
    WIDE_RESULT_COLUMN_THRESHOLD,
)
from superset.mcp_service.chart.tool.get_chart_data import build_shape_insights


def test_an_ordinary_chart_result_gets_no_advice() -> None:
    # Regression: a two-year daily series is ~700 rows and a saved chart used
    # here returns 252. The old threshold of 100 warned about every one of
    # them, which read as the tool struggling on a perfectly normal chart.
    assert build_shape_insights(252, 2) == []
    assert build_shape_insights(700, 2) == []


def test_a_genuinely_large_result_is_called_out_with_its_size() -> None:
    insights = build_shape_insights(LARGE_RESULT_ROW_THRESHOLD + 1, 2)

    assert len(insights) == 1
    # The count belongs in the message: "large" without a number gives the
    # reader nothing to judge.
    assert f"{LARGE_RESULT_ROW_THRESHOLD + 1:,}" in insights[0]


def test_the_row_threshold_is_exclusive() -> None:
    assert build_shape_insights(LARGE_RESULT_ROW_THRESHOLD, 2) == []


def test_a_wide_result_is_called_out_separately() -> None:
    insights = build_shape_insights(10, WIDE_RESULT_COLUMN_THRESHOLD + 1)

    assert insights == ["Many columns available - focus on key metrics"]


def test_both_conditions_can_fire_together() -> None:
    insights = build_shape_insights(
        LARGE_RESULT_ROW_THRESHOLD + 1, WIDE_RESULT_COLUMN_THRESHOLD + 1
    )

    assert len(insights) == 2
