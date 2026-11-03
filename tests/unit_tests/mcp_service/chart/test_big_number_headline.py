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

"""Unit tests for the Big Number headline computation.

The expected values follow the frontend: `aggregationChoices` and the
BigNumber transformProps.
"""

from datetime import datetime, timezone
from decimal import Decimal
from itertools import permutations
from types import SimpleNamespace
from typing import Any

import pytest

from superset.mcp_service.chart.big_number_headline import (
    compute_big_number_headline,
    executed_query_facts,
    is_big_number_viz_type,
)

METRIC = "SUM(ytd_sales)"
WEEK_MS = 7 * 24 * 3600 * 1000


def _trend_rows(
    values: list[Any], x_label: str = "__timestamp"
) -> list[dict[str, Any]]:
    """Chronological weekly rows."""
    return [
        {x_label: index * WEEK_MS, METRIC: value} for index, value in enumerate(values)
    ]


def _form_data(**overrides: Any) -> dict[str, Any]:
    return {"viz_type": "big_number", "metric": METRIC, **overrides}


def _headline(
    rows: list[dict[str, Any]],
    *,
    overall: list[dict[str, Any]] | None = None,
    row_limit: int | None = None,
    operations: tuple[str, ...] = (),
    rowcount: int | None = None,
    viz_type: str = "big_number",
    **form_data: Any,
):
    first: dict[str, Any] = {"data": rows}
    if rowcount is not None:
        first["rowcount"] = rowcount
    queries = [first] + ([{"data": overall}] if overall is not None else [])
    return compute_big_number_headline(
        viz_type,
        _form_data(**form_data),
        queries,
        row_limit=row_limit,
        post_processing_operations=operations,
    )


@pytest.mark.parametrize(
    ("aggregation", "expected"),
    [
        (None, 40),
        ("", 40),
        ("LAST_VALUE", 40),
        ("sum", 100),
        ("mean", 25),
        ("min", 10),
        ("max", 40),
        ("median", 25),
    ],
)
def test_aggregation_over_the_whole_series(aggregation: Any, expected: float) -> None:
    headline = _headline(_trend_rows([10, 20, 30, 40]), aggregation=aggregation)

    assert headline is not None
    assert headline.value == expected
    assert headline.reason is None
    assert headline.rows_used == 4


def test_every_row_counts_not_just_the_first_ten() -> None:
    # 19 weekly values, as in a year-to-date weekly chart: the sum covers all of
    # them, not the ten a sample would carry.
    values = list(range(1, 20))
    headline = _headline(_trend_rows(values), aggregation="sum")

    assert headline is not None
    assert headline.value == sum(values) == 190
    assert headline.rows_used == 19


def test_median_of_odd_count_is_the_middle_value() -> None:
    headline = _headline(_trend_rows([9, 1, 5]), aggregation="median")

    assert headline is not None
    assert headline.value == 5


@pytest.mark.parametrize(
    ("aggregation", "expected_key"),
    [
        ("SUM", "sum"),
        ("Mean", "mean"),
        ("last_value", "LAST_VALUE"),
        ("MAX", "max"),
        ("not_an_aggregation", "LAST_VALUE"),
    ],
)
def test_aggregation_lookup_is_case_insensitive_with_last_value_fallback(
    aggregation: str, expected_key: str
) -> None:
    headline = _headline(_trend_rows([10, 20, 30]), aggregation=aggregation)

    assert headline is not None
    assert headline.aggregation == expected_key


def test_last_value_is_the_newest_row_regardless_of_row_order() -> None:
    rows = [
        {"__timestamp": 3 * WEEK_MS, METRIC: 4},
        {"__timestamp": 1 * WEEK_MS, METRIC: 2},
        {"__timestamp": 2 * WEEK_MS, METRIC: 3},
    ]

    headline = _headline(rows, aggregation="LAST_VALUE")

    assert headline is not None
    assert headline.value == 4


def test_last_value_orders_datetime_x_axis_values() -> None:
    rows = [
        {"order_date": datetime(2026, 3, 1), METRIC: 3},
        {"order_date": datetime(2026, 1, 1), METRIC: 1},
        {"order_date": datetime(2026, 2, 1, tzinfo=timezone.utc), METRIC: 2},
    ]

    headline = _headline(rows, x_axis="order_date")

    assert headline is not None
    assert headline.value == 3


def test_last_value_orders_rows_keyed_by_granularity_column() -> None:
    """Without an x-axis, the MCP query selects `granularity_sqla` by name."""
    rows = [
        {"ds": 3000, METRIC: 30},
        {"ds": 1000, METRIC: 10},
        {"ds": 2000, METRIC: 20},
    ]

    headline = _headline(rows, granularity_sqla="ds")

    assert headline is not None
    assert headline.value == 30
    assert headline.reason is None


def test_x_axis_takes_precedence_over_granularity_column() -> None:
    rows = [
        {"order_date": 2000, "ds": 1000, METRIC: 20},
        {"order_date": 1000, "ds": 2000, METRIC: 10},
    ]

    headline = _headline(rows, x_axis="order_date", granularity_sqla="ds")

    assert headline is not None
    assert headline.value == 20


def test_last_value_skips_a_null_latest_value() -> None:
    headline = _headline(_trend_rows([10, 20, None]), aggregation="LAST_VALUE")

    assert headline is not None
    assert headline.value == 20
    assert headline.rows_used == 2


@pytest.mark.parametrize(
    ("aggregation", "expected"),
    [("sum", 30), ("mean", 15), ("min", 10), ("max", 20), ("median", 15)],
)
def test_nulls_are_dropped_before_aggregating(
    aggregation: str, expected: float
) -> None:
    headline = _headline(_trend_rows([10, None, 20, None]), aggregation=aggregation)

    assert headline is not None
    assert headline.value == expected
    assert headline.rows_used == 2


def test_non_finite_and_boolean_values_count_as_null() -> None:
    headline = _headline(
        _trend_rows([10, float("nan"), float("inf"), True, 20]), aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 30


def test_decimal_values_are_summed() -> None:
    headline = _headline(
        _trend_rows([Decimal("1.5"), Decimal("2.5")]), aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 4.0


def test_all_null_series_has_no_headline() -> None:
    headline = _headline(_trend_rows([None, None]), aggregation="sum")

    assert headline is not None
    assert headline.value is None
    assert headline.reason


def test_empty_result_has_no_headline() -> None:
    headline = _headline([], aggregation="sum")

    assert headline is not None
    assert headline.value is None
    assert "no rows" in (headline.reason or "")


def test_missing_metric_column_has_no_headline() -> None:
    headline = _headline([{"__timestamp": 0, "other": 1}], aggregation="sum")

    assert headline is not None
    assert headline.value is None
    assert "metric column" in (headline.reason or "")


def test_adhoc_metric_is_resolved_by_label() -> None:
    rows = [{"__timestamp": 0, "Total Sales": 7}]

    headline = compute_big_number_headline(
        "big_number",
        {
            "metric": {"label": "Total Sales", "expressionType": "SQL"},
            "aggregation": "sum",
        },
        [{"data": rows}],
    )

    assert headline is not None
    assert headline.value == 7


def test_truncated_by_row_limit_has_no_headline() -> None:
    headline = _headline(_trend_rows([1, 2, 3]), row_limit=3, aggregation="sum")

    assert headline is not None
    assert headline.value is None
    assert "truncated" in (headline.reason or "")


def test_truncated_by_larger_source_total_has_no_headline() -> None:
    headline = _headline(
        _trend_rows([1, 2, 3]), row_limit=100, rowcount=250, aggregation="sum"
    )

    assert headline is not None
    assert headline.value is None
    assert "truncated" in (headline.reason or "")


def test_fetch_below_row_limit_is_complete() -> None:
    headline = _headline(
        _trend_rows([1, 2, 3]), row_limit=4, rowcount=3, aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 6


def test_raw_uses_the_overall_value_layer() -> None:
    headline = _headline(
        _trend_rows([10, 20, 30]),
        overall=[{METRIC: 123.5}],
        aggregation="raw",
    )

    assert headline is not None
    assert headline.value == 123.5
    assert headline.aggregation == "raw"
    assert headline.reason is None


def test_raw_falls_back_to_the_first_numeric_column_of_the_layer() -> None:
    headline = _headline(
        _trend_rows([10, 20]),
        overall=[{"__timestamp": 5, "renamed": 9}],
        aggregation="raw",
    )

    assert headline is not None
    assert headline.value == 9


def test_raw_ignores_truncation_of_the_trend_layer() -> None:
    headline = _headline(
        _trend_rows([10, 20, 30]),
        overall=[{METRIC: 60}],
        row_limit=3,
        aggregation="raw",
    )

    assert headline is not None
    assert headline.value == 60


@pytest.mark.parametrize("overall", [None, [], [{METRIC: None}]])
def test_raw_without_an_overall_value_has_no_headline(overall: Any) -> None:
    headline = _headline(_trend_rows([10, 20, 30]), overall=overall, aggregation="raw")

    assert headline is not None
    assert headline.value is None
    assert headline.aggregation == "raw"
    assert "raw" in (headline.reason or "")


def test_only_exact_raw_selects_the_overall_value_layer() -> None:
    # The frontend adds the second query only for the exact string "raw"; any
    # other casing is a client-side lookup of the raw choice, i.e. the latest value.
    headline = _headline(_trend_rows([10, 20, 30]), aggregation="RAW")

    assert headline is not None
    assert headline.value == 30
    assert headline.aggregation == "raw"


@pytest.mark.parametrize(
    ("rolling_type", "operation"),
    [("sum", "rolling"), ("mean", "rolling"), ("std", "rolling"), ("cumsum", "cum")],
)
def test_rolling_window_not_in_the_rows_has_no_headline(
    rolling_type: str, operation: str
) -> None:
    headline = _headline(
        _trend_rows([1, 2, 3]), rolling_type=rolling_type, aggregation="sum"
    )

    assert headline is not None
    assert headline.value is None
    assert "rolling window" in (headline.reason or "")

    reflected = _headline(
        _trend_rows([1, 2, 3]),
        rolling_type=rolling_type,
        aggregation="sum",
        operations=("pivot", operation, "flatten"),
    )
    assert reflected is not None
    assert reflected.value == 6


@pytest.mark.parametrize("rolling_type", [None, "None", ""])
def test_no_rolling_window_needs_no_post_processing(rolling_type: Any) -> None:
    headline = _headline(
        _trend_rows([1, 2, 3]), rolling_type=rolling_type, aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 6


@pytest.mark.parametrize(
    "resample",
    [
        {"resample_rule": "1D", "resample_method": "zerofill"},
        {"resample_rule": "1D", "resample_method": "asfreq"},
        {"resample_rule": "1W", "resample_method": "ffill"},
    ],
)
@pytest.mark.parametrize("aggregation", ["LAST_VALUE", "sum", "mean", "min", "median"])
def test_resample_not_in_the_rows_has_no_headline(
    resample: dict[str, Any], aggregation: str
) -> None:
    """Resampling changes the series, so unresampled rows give no headline."""
    headline = _headline(
        _trend_rows([70, 70, 70, 70]), aggregation=aggregation, **resample
    )

    assert headline is not None
    assert headline.value is None
    assert "resamples" in (headline.reason or "")

    reflected = _headline(
        _trend_rows([70, 70, 70, 70]),
        aggregation=aggregation,
        operations=("pivot", "resample", "flatten"),
        **resample,
    )
    assert reflected is not None
    assert reflected.value is not None


@pytest.mark.parametrize(
    "resample",
    [
        {"resample_rule": "1D"},
        {"resample_method": "zerofill"},
        {"resample_rule": None, "resample_method": "asfreq"},
        {"resample_rule": "1D", "resample_method": ""},
    ],
)
def test_incomplete_resample_needs_no_post_processing(
    resample: dict[str, Any],
) -> None:
    """Like the frontend, resampling needs both a rule and a method."""
    headline = _headline(_trend_rows([1, 2, 3]), aggregation="sum", **resample)

    assert headline is not None
    assert headline.value == 6


@pytest.mark.parametrize("timestamp", [None, "invalid", float("nan"), float("inf")])
@pytest.mark.parametrize("undated_metric", [1, None])
@pytest.mark.parametrize("aggregation", ["LAST_VALUE", "RAW"])
@pytest.mark.parametrize("row_order", list(permutations(range(3))))
def test_latest_value_with_an_undated_row_has_no_headline(
    timestamp: str | float | None,
    undated_metric: int | None,
    aggregation: str,
    row_order: tuple[int, ...],
) -> None:
    """The frontend comparator treats an undated row as equal to every row, so
    the value it renders depends on input order; no latest value is exact."""
    rows: list[dict[str, Any]] = [
        {"__timestamp": timestamp, METRIC: undated_metric},
        {"__timestamp": 5, METRIC: 2},
        {"__timestamp": 3, METRIC: 3},
    ]

    headline = _headline([rows[index] for index in row_order], aggregation=aggregation)

    assert headline is not None
    assert headline.value is None
    assert "timestamp" in (headline.reason or "")


def test_latest_value_does_not_diverge_from_the_rendered_chart() -> None:
    """For these rows the frontend sort leaves the order unchanged and the
    chart shows 10, not the newest dated 30."""
    headline = _headline(
        [
            {"__timestamp": 1000, METRIC: 10},
            {"__timestamp": None, METRIC: 99},
            {"__timestamp": 3000, METRIC: 30},
        ]
    )

    assert headline is not None
    assert headline.value is None


@pytest.mark.parametrize("aggregation", ["LAST_VALUE", "RAW"])
@pytest.mark.parametrize("has_dated_null", [False, True])
def test_latest_value_requires_dated_rows(
    aggregation: str, has_dated_null: bool
) -> None:
    """Missing timestamps cannot supply a latest value."""
    rows: list[dict[str, Any]] = [{METRIC: 1}, {"__timestamp": None, METRIC: 3}]
    if has_dated_null:
        rows.append({"__timestamp": 5, METRIC: None})

    headline = _headline(rows, aggregation=aggregation)

    assert headline is not None
    assert headline.value is None
    assert headline.reason


@pytest.mark.parametrize("row_order", list(permutations(range(3))))
def test_latest_value_with_an_undated_row_and_one_distinct_value(
    row_order: tuple[int, ...],
) -> None:
    """When every non-null metric is equal, row order cannot change the value."""
    rows: list[dict[str, Any]] = [
        {"__timestamp": None, METRIC: 7},
        {"__timestamp": 5, METRIC: 7},
        {"__timestamp": 3, METRIC: None},
    ]

    headline = _headline([rows[index] for index in row_order])

    assert headline is not None
    assert headline.value == 7
    assert headline.rows_used == 2


def test_latest_value_preserves_input_order_for_equal_timestamps() -> None:
    """Equal dated timestamps use the first non-null metric in input order."""
    headline = _headline(
        [
            {"__timestamp": 5, METRIC: None},
            {"__timestamp": 5, METRIC: 2},
            {"__timestamp": 5, METRIC: 3},
        ]
    )

    assert headline is not None
    assert headline.value == 2
    assert headline.rows_used == 2


def test_order_independent_aggregations_need_no_times() -> None:
    rows = [{"__timestamp": None, METRIC: 1}, {"__timestamp": None, METRIC: 2}]

    headline = _headline(rows, aggregation="sum")

    assert headline is not None
    assert headline.value == 3


def test_big_number_total_is_the_single_metric_value() -> None:
    headline = _headline(
        [{METRIC: 4321.5}], viz_type="big_number_total", aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 4321.5
    assert headline.aggregation == "total"
    assert headline.rows_used == 1
    assert headline.reason is None


def test_big_number_total_ignores_trend_aggregation_and_row_limit() -> None:
    headline = _headline(
        [{METRIC: 5}], viz_type="big_number_total", row_limit=1, aggregation="sum"
    )

    assert headline is not None
    assert headline.value == 5


def test_big_number_total_keeps_a_text_value() -> None:
    headline = _headline([{METRIC: "N/A"}], viz_type="big_number_total")

    assert headline is not None
    assert headline.value == "N/A"


@pytest.mark.parametrize(
    "rows", [[], [{METRIC: None}], [{"other": 1}]], ids=["empty", "null", "no-metric"]
)
def test_big_number_total_without_a_value_has_no_headline(
    rows: list[dict[str, Any]],
) -> None:
    headline = _headline(rows, viz_type="big_number_total")

    assert headline is not None
    assert headline.value is None
    assert headline.reason


@pytest.mark.parametrize(
    "viz_type", ["table", "pop_kpi", "echarts_timeseries_line", None]
)
def test_other_chart_types_have_no_headline(viz_type: Any) -> None:
    assert _headline(_trend_rows([1, 2]), viz_type=viz_type) is None


def test_executed_query_facts_reads_limit_and_operations() -> None:
    query_context = SimpleNamespace(
        queries=[
            SimpleNamespace(
                row_limit=1000,
                post_processing=[
                    {"operation": "pivot"},
                    {},
                    {"operation": "rolling"},
                    "not-a-step",
                ],
            )
        ]
    )

    assert executed_query_facts(query_context) == (1000, ["pivot", "rolling"])


@pytest.mark.parametrize(
    "query_context",
    [
        SimpleNamespace(queries=[]),
        SimpleNamespace(queries=[SimpleNamespace()]),
        SimpleNamespace(),
    ],
)
def test_executed_query_facts_tolerates_missing_attributes(query_context: Any) -> None:
    assert executed_query_facts(query_context) == (None, [])


@pytest.mark.parametrize("viz_type", ["big_number", "big_number_total"])
@pytest.mark.parametrize(
    "column",
    [
        {"columnName": "ytd_sales"},
        {"column_name": "ytd_sales"},
        {"columnName": "ytd_sales", "column_name": "other"},
    ],
)
def test_simple_adhoc_metric_column_aliases(
    viz_type: str, column: dict[str, str]
) -> None:
    """Simple adhoc labels accept both aliases, preferring camelCase."""
    metric = {"expressionType": "SIMPLE", "aggregate": "SUM", "column": column}
    headline = compute_big_number_headline(
        viz_type, {"metric": metric}, [{"data": [{"__timestamp": 0, METRIC: 7}]}]
    )

    assert headline is not None
    assert headline.value == 7
    assert metric["column"] == column


@pytest.mark.parametrize("viz_type", ["big_number", "big_number_total"])
@pytest.mark.parametrize("value", [10**400, -(10**400)])
def test_huge_integer_metric_is_unavailable(viz_type: str, value: int) -> None:
    """Integers beyond float range return a null headline without crashing."""
    headline = _headline(_trend_rows([value]), viz_type=viz_type)

    assert headline is not None
    assert headline.value is None
    assert headline.reason


@pytest.mark.parametrize("viz_type", ["big_number", "big_number_total"])
def test_empty_form_data_is_safe(viz_type: str) -> None:
    """Empty form data lacks a metric but remains a valid mapping."""
    headline = compute_big_number_headline(viz_type, {}, [{"data": [{METRIC: 7}]}])

    assert headline is not None
    assert headline.value is None
    assert "metric column" in (headline.reason or "")


@pytest.mark.parametrize(
    ("viz_type", "expected"),
    [("big_number", True), ("big_number_total", True), ("table", False), (None, False)],
)
def test_is_big_number_viz_type(viz_type: str | None, expected: bool) -> None:
    """Only the two Big Number visualization types have a headline."""
    assert is_big_number_viz_type(viz_type) is expected
