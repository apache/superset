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
import time
from datetime import datetime
from unittest import mock

import pytest

from superset.common.utils.time_range_utils import (
    get_axis_temporal_columns,
    get_since_until_from_query_object,
    get_since_until_from_temporal_filter,
    get_since_until_from_time_range,
    get_time_range_from_filters,
)
from superset.constants import NO_TIME_RANGE
from superset.exceptions import QueryObjectValidationError
from superset.superset_typing import AdhocColumn


@pytest.mark.parametrize("invalid_value", [None, 42, True, [], ["2001 : 2002"], {}])
def test_time_range_selection_ignores_non_string_values(invalid_value: object) -> None:
    """Malformed temporal values cannot replace a valid range or reach parsing."""
    filters: list[dict[str, object]] = [
        {"col": "dttm", "op": "TEMPORAL_RANGE", "val": invalid_value},
    ]
    assert get_time_range_from_filters(None, filters, ["dttm"]) == NO_TIME_RANGE
    filters.append({"col": "other", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"})
    selected: str = get_time_range_from_filters(None, filters, ["dttm"])
    assert get_since_until_from_time_range(selected) == (
        datetime(2001, 1, 1),
        datetime(2002, 1, 1),
    )


@pytest.mark.parametrize(
    "time_range",
    [
        "a : b",
        "last 0 days",
        "2024-02-01 : 2024-01-01",
        "DATEADD(DATETIME('today'), 7, bogus) : today",
        "DATETRUNC(DATETIME('today'), bogus) : today",
        "LASTDAY(DATETIME('today'), bogus) : today",
        "HOLIDAY('Nonexistent Holiday', DATETIME('today'))",
    ],
)
def test_temporal_filter_range_failure_is_a_bad_request(
    app_context: None, time_range: str
) -> None:
    """
    A range that cannot be parsed is a bad request however it fails, whether as
    a marshmallow ``ValidationError`` or as a bare ``ValueError``.
    """
    with pytest.raises(QueryObjectValidationError) as excinfo:
        get_since_until_from_temporal_filter(time_range, column="other_ds")

    # The column is named, because the range reaching this helper belongs to a
    # filter the response would otherwise not identify.
    assert "other_ds" in excinfo.value.message


def test_temporal_filter_range_parses_like_the_plain_helper(app_context: None) -> None:
    """A usable range is parsed, and the bounds are the plain helper's."""
    assert get_since_until_from_temporal_filter(
        "2001 : 2002", column="ds"
    ) == get_since_until_from_time_range("2001 : 2002")


def test_time_range_selection_ignores_missing_value() -> None:
    """An omitted temporal value has the same selection semantics as None."""
    assert (
        get_time_range_from_filters(
            None, [{"col": "dttm", "op": "TEMPORAL_RANGE"}], ["dttm"]
        )
        == NO_TIME_RANGE
    )


def test_time_range_selection_ignores_other_columns_for_axis() -> None:
    """A temporal x-axis without its own range does not borrow another column's."""
    axis: AdhocColumn = {
        "columnType": "BASE_AXIS",
        "label": "ds",
        "sqlExpression": "ds",
    }
    filters: list[dict[str, object]] = [
        {"col": "created_at", "op": "TEMPORAL_RANGE", "val": "2000 : 2001"},
    ]
    assert get_time_range_from_filters(None, filters, [axis]) == NO_TIME_RANGE


def test_time_range_selection_matches_axis_expression() -> None:
    """A filter on the axis expression selects it when none targets the label."""
    axis: AdhocColumn = {
        "columnType": "BASE_AXIS",
        "label": "dttm2",
        "sqlExpression": "dttm",
    }
    filters: list[dict[str, object]] = [
        {"col": "other", "op": "TEMPORAL_RANGE", "val": "2000 : 2001"},
        {"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"},
    ]
    assert get_time_range_from_filters(None, filters, [axis]) == "2001 : 2002"


def test_time_range_selection_matches_adhoc_filter_column() -> None:
    """An adhoc column subject is matched by its label or expression."""
    axis: AdhocColumn = {
        "columnType": "BASE_AXIS",
        "label": "ds",
        "sqlExpression": "ds",
    }
    filters: list[dict[str, object]] = [
        {"col": "other", "op": "TEMPORAL_RANGE", "val": "2000 : 2001"},
        {
            "col": {"label": "ds", "sqlExpression": "ds"},
            "op": "TEMPORAL_RANGE",
            "val": "2001 : 2002",
        },
    ]
    assert get_time_range_from_filters(None, filters, [axis]) == "2001 : 2002"


def test_time_range_selection_matches_the_column_a_custom_sql_axis_reads() -> None:
    """A Custom SQL x-axis takes the range on the datetime column it reads."""
    axis: AdhocColumn = {
        "columnType": "BASE_AXIS",
        "label": "day",
        "sqlExpression": 'DATE("created_at")',
    }
    filters: list[dict[str, object]] = [
        {"col": "ds", "op": "TEMPORAL_RANGE", "val": "2000 : 2001"},
        {"col": "created_at", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"},
    ]
    temporal_columns: set[str] = {"ds", "created_at"}
    assert (
        get_time_range_from_filters(None, filters, [axis], temporal_columns)
        == "2001 : 2002"
    )
    assert (
        get_time_range_from_filters(None, filters[:1], [axis], temporal_columns)
        == NO_TIME_RANGE
    )


def test__get_since_until_from_time_range():
    assert get_since_until_from_time_range(time_range="2001 : 2002") == (
        datetime(2001, 1, 1),
        datetime(2002, 1, 1),
    )
    assert get_since_until_from_time_range(
        time_range="2001 : 2002", time_shift="8 hours ago"
    ) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Last year",
                extras={
                    "relative_end": "2100",
                },
            )
        )[1] == datetime(2100, 1, 1, 0, 0)
    with mock.patch(
        "superset.utils.date_parser.EvalDateTruncFunc.eval",
        return_value=datetime(2000, 1, 1, 0, 0, 0),
    ):
        assert (
            get_since_until_from_time_range(
                time_range="Next year",
                extras={
                    "relative_start": "2000",
                },
            )
        )[0] == datetime(2000, 1, 1, 0, 0)


@pytest.mark.query_object(
    {
        "time_range": "2001 : 2002",
        "time_shift": "8 hours ago",
    }
)
def test__since_until_from_time_range(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2000, 12, 31, 16, 0, 0),
        datetime(2001, 12, 31, 16, 0, 0),
    )


@pytest.mark.query_object(
    {
        "filters": [{"col": "dttm", "op": "TEMPORAL_RANGE", "val": "2001 : 2002"}],
        "columns": [
            {
                "columnType": "BASE_AXIS",
                "label": "dttm",
                "sqlExpression": "dttm",
            }
        ],
    }
)
def test__since_until_from_adhoc_filters(dummy_query_object):
    assert get_since_until_from_query_object(dummy_query_object) == (
        datetime(2001, 1, 1, 0, 0, 0),
        datetime(2002, 1, 1, 0, 0, 0),
    )


@pytest.mark.parametrize("opener", ['"', "`", "["])
def test_axis_columns_scan_an_unterminated_quote_in_linear_time(opener: str) -> None:
    """A client-supplied axis with unterminated quotes does not stall the scan."""
    axis: AdhocColumn = {"label": "day", "sqlExpression": opener * 40_000 + " ds"}
    started: float = time.perf_counter()
    assert get_axis_temporal_columns(axis, {"ds"}) == ("ds",)
    assert time.perf_counter() - started < 1


def test_axis_columns_read_quoted_names() -> None:
    """Quoted, backticked and bracketed names resolve to their datetime columns."""
    axis: AdhocColumn = {
        "label": "day",
        "sqlExpression": 'COALESCE("ds", `created_at`, [shipped at], country)',
    }
    assert get_axis_temporal_columns(axis, {"ds", "created_at", "shipped at"}) == (
        "ds",
        "created_at",
        "shipped at",
    )
