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

from copy import deepcopy

import pytest

from superset.common.form_data_query_context import (
    build_query_objects_from_form_data,
)

SIMPLE_REVENUE = {
    "expressionType": "SIMPLE",
    "column": {"column_name": "revenue"},
    "aggregate": "SUM",
    "label": "Revenue",
    "hasCustomLabel": True,
    "optionName": "metric_revenue",
    "sqlExpression": None,
}
SQL_MARGIN = {
    "expressionType": "SQL",
    "column": None,
    "aggregate": None,
    "sqlExpression": "SUM(profit) / SUM(revenue)",
    "label": "Margin",
    "hasCustomLabel": True,
    "optionName": "metric_margin",
}


@pytest.mark.parametrize(
    ("metric", "label"),
    [
        ("saved_revenue", "saved_revenue"),
        (SIMPLE_REVENUE, "Revenue"),
        (SQL_MARGIN, "Margin"),
    ],
    ids=["saved", "simple", "sql"],
)
def test_big_number_legacy_axis_matches_frontend_for_every_metric_shape(
    metric: object, label: str
) -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "big_number",
            "metric": deepcopy(metric),
            "granularity_sqla": "event_time",
            "time_grain_sqla": "P1D",
            "time_range": "Last month",
        }
    )[0]

    assert query["columns"] == []
    assert query["metrics"] == [metric]
    assert query["is_timeseries"] is True
    assert query["granularity"] == "event_time"
    assert query["extras"]["time_grain_sqla"] == "P1D"
    assert query["time_range"] == "Last month"
    assert query["post_processing"][0] == {
        "operation": "pivot",
        "options": {
            "index": ["__timestamp"],
            "columns": [],
            "aggregates": {label: {"operator": "mean"}},
            "drop_missing_columns": True,
        },
    }


@pytest.mark.parametrize(
    ("x_axis", "expected_label"),
    [
        ("event_time", "event_time"),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "DATE_TRUNC('month', event_time)",
                "label": "Event month",
            },
            "Event month",
        ),
    ],
    ids=["physical", "adhoc"],
)
def test_big_number_explicit_x_axis_remains_a_query_column(
    x_axis: str | dict[str, object], expected_label: str
) -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "big_number",
            "metric": "saved_revenue",
            "x_axis": x_axis,
            "granularity_sqla": "legacy_time",
        }
    )[0]

    expected_axis = (
        {
            "columnType": "BASE_AXIS",
            "sqlExpression": x_axis,
            "label": x_axis,
            "expressionType": "SQL",
            "isColumnReference": True,
        }
        if isinstance(x_axis, str)
        else {"columnType": "BASE_AXIS", **x_axis}
    )
    assert query["columns"] == [expected_axis]
    assert "is_timeseries" not in query
    assert query["post_processing"][0]["options"]["index"] == [expected_label]


def test_big_number_raw_overall_query_is_non_timeseries_and_unprocessed() -> None:
    trend, overall = build_query_objects_from_form_data(
        {
            "viz_type": "big_number",
            "metric": deepcopy(SIMPLE_REVENUE),
            "granularity_sqla": "event_time",
            "aggregation": "raw",
            "resample_method": "zerofill",
            "resample_rule": "1D",
            "rolling_type": "mean",
            "rolling_periods": 7,
            "min_periods": 1,
        }
    )

    assert [rule["operation"] for rule in trend["post_processing"]] == [
        "pivot",
        "resample",
        "rolling",
        "flatten",
    ]
    assert overall["columns"] == []
    assert overall["is_timeseries"] is False
    assert overall["post_processing"] == []


def test_aggregate_table_promotes_only_first_lookup_temporal_groupby() -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["region", "event_time", "created_at"],
            "metrics": [deepcopy(SIMPLE_REVENUE)],
            "time_grain_sqla": "P1M",
            "temporal_columns_lookup": {
                "event_time": True,
                "created_at": True,
            },
            "row_limit": 25,
            "order_desc": True,
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "EMEA",
                }
            ],
        }
    )[0]

    assert query["columns"] == [
        {
            "timeGrain": "P1M",
            "columnType": "BASE_AXIS",
            "sqlExpression": "event_time",
            "label": "event_time",
            "expressionType": "SQL",
        },
        "region",
        "created_at",
    ]
    assert query["row_limit"] == 25
    assert query["orderby"] == [[SIMPLE_REVENUE, False]]
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]


@pytest.mark.parametrize(
    "form_data",
    [
        {"time_grain_sqla": "P1D", "temporal_columns_lookup": {}},
        {"temporal_columns_lookup": {"event_time": True}},
        {
            "time_grain_sqla": "P1D",
            "granularity_sqla": "event_time",
            "temporal_columns_lookup": {"event_time": False},
        },
    ],
)
def test_aggregate_table_does_not_invent_a_temporal_axis(
    form_data: dict[str, object],
) -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["event_time", "region"],
            "metrics": ["saved_revenue"],
            **form_data,
        }
    )[0]
    assert query["columns"] == ["event_time", "region"]


@pytest.mark.parametrize("totals_aggregate", ["SUM", "AVG"])
def test_table_totals_reaggregate_only_simple_metrics(
    totals_aggregate: str,
) -> None:
    metrics = [deepcopy(SIMPLE_REVENUE), "saved_revenue", deepcopy(SQL_MARGIN)]
    main, totals = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["region"],
            "metrics": metrics,
            "show_totals": True,
            "totals_aggregate": totals_aggregate,
        }
    )

    assert main["metrics"] == metrics
    assert main["orderby"] == [[SIMPLE_REVENUE, False]]
    assert totals["columns"] == []
    assert totals["metrics"] == [
        {**SIMPLE_REVENUE, "aggregate": totals_aggregate},
        "saved_revenue",
        SQL_MARGIN,
    ]
    assert "orderby" not in totals
    assert "order_desc" not in totals
    assert totals["row_limit"] == 0
    assert totals["row_offset"] == 0


def test_table_raw_mode_never_adds_totals_query() -> None:
    queries = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": ["event_time", "region"],
            "metrics": [deepcopy(SIMPLE_REVENUE)],
            "show_totals": True,
            "order_by_cols": ['["event_time", true]'],
            "row_limit": 50,
        }
    )
    assert len(queries) == 1
    assert queries[0]["columns"] == ["event_time", "region"]
    assert queries[0]["metrics"] == []
    assert queries[0]["orderby"] == [["event_time", True]]


@pytest.mark.parametrize("comparison_type", ["difference", "ratio", "percentage"])
def test_xy_derived_comparison_renames_every_metric_independent_of_truncation(
    comparison_type: str,
) -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "event_time",
            "groupby": ["region"],
            "metrics": [deepcopy(SIMPLE_REVENUE), deepcopy(SQL_MARGIN)],
            "time_compare": ["1 year ago", "2 years ago"],
            "comparison_type": comparison_type,
            "truncate_metric": False,
            "resample_method": "zerofill",
            "resample_rule": "1D",
            "rolling_type": "mean",
            "rolling_periods": 7,
        }
    )[0]

    assert [rule["operation"] for rule in query["post_processing"]] == [
        "pivot",
        "resample",
        "rolling",
        "compare",
        "rename",
        "flatten",
    ]
    rename = query["post_processing"][-2]["options"]["columns"]
    assert rename == {
        f"{comparison_type}__Revenue__Revenue__1 year ago": ("Revenue, 1 year ago"),
        f"{comparison_type}__Revenue__Revenue__2 years ago": ("Revenue, 2 years ago"),
        f"{comparison_type}__Margin__Margin__1 year ago": "Margin, 1 year ago",
        f"{comparison_type}__Margin__Margin__2 years ago": "Margin, 2 years ago",
    }


def test_xy_values_comparison_renames_saved_metric_offsets_on_legacy_axis() -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "echarts_timeseries_bar",
            "granularity_sqla": "event_time",
            "metrics": ["saved_revenue"],
            "time_compare": ["1 year ago", "11 year ago"],
            "comparison_type": "values",
            "truncate_metric": False,
        }
    )[0]

    assert query["columns"] == []
    assert query["is_timeseries"] is True
    assert query["post_processing"][0]["options"]["index"] == ["__timestamp"]
    assert [rule["operation"] for rule in query["post_processing"]] == [
        "pivot",
        "rename",
        "flatten",
    ]
    assert query["post_processing"][1]["options"]["columns"] == {
        "saved_revenue__1 year ago": "1 year ago",
        "saved_revenue__11 year ago": "11 year ago",
    }


def test_mixed_timeseries_renames_both_comparison_queries_independently() -> None:
    primary, secondary = build_query_objects_from_form_data(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "metrics": [deepcopy(SIMPLE_REVENUE)],
            "groupby": ["region"],
            "time_compare": ["1 year ago"],
            "comparison_type": "difference",
            "truncate_metric": False,
            "resample_method": "ffill",
            "resample_rule": "1D",
            "metrics_b": [deepcopy(SQL_MARGIN), "saved_orders"],
            "groupby_b": [],
            "time_compare_b": ["1 month ago"],
            "comparison_type_b": "ratio",
            "truncate_metric_b": False,
            "rolling_type_b": "sum",
            "rolling_periods_b": 3,
            "min_periods_b": 1,
        }
    )

    assert [rule["operation"] for rule in primary["post_processing"]] == [
        "pivot",
        "resample",
        "compare",
        "rename",
        "flatten",
    ]
    assert primary["post_processing"][3]["options"]["columns"] == {
        "difference__Revenue__Revenue__1 year ago": "1 year ago"
    }
    assert [rule["operation"] for rule in secondary["post_processing"]] == [
        "pivot",
        "resample",
        "rolling",
        "compare",
        "rename",
        "flatten",
    ]
    assert secondary["post_processing"][4]["options"]["columns"] == {
        "ratio__Margin__Margin__1 month ago": "Margin, 1 month ago",
        "ratio__saved_orders__saved_orders__1 month ago": ("saved_orders, 1 month ago"),
    }
