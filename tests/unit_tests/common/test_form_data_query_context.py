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
from superset.common.form_data_query_context import (
    adhoc_filters_to_query_filters,
    build_query_context_from_form_data,
    columns_from_form_data,
)

DATASOURCE = {"id": 7, "type": "table"}


def test_adhoc_filters_converts_simple_and_drops_custom_sql() -> None:
    adhoc = [
        {
            "expressionType": "SIMPLE",
            "subject": "country",
            "operator": "==",
            "comparator": "US",
        },
        {"expressionType": "SQL", "sqlExpression": "1 = 1"},
    ]
    assert adhoc_filters_to_query_filters(adhoc) == [
        {"col": "country", "op": "==", "val": "US"}
    ]
    assert adhoc_filters_to_query_filters([]) == []


def test_columns_prefers_groupby_and_x_axis() -> None:
    form_data = {"groupby": ["region"], "x_axis": "ds"}
    assert columns_from_form_data(form_data) == ["ds", "region"]


def test_columns_raw_mode_uses_all_columns() -> None:
    form_data = {"query_mode": "raw", "all_columns": ["a", "b"]}
    assert columns_from_form_data(form_data) == ["a", "b"]


def test_columns_x_axis_as_adhoc_dict() -> None:
    # An x_axis stored as an adhoc column dict contributes its column_name,
    # prepended ahead of the groupby dimensions.
    form_data = {"groupby": ["region"], "x_axis": {"column_name": "ds"}}
    assert columns_from_form_data(form_data) == ["ds", "region"]


def test_columns_x_axis_dict_without_column_name_is_ignored() -> None:
    form_data = {
        "groupby": ["region"],
        "x_axis": {"label": "custom", "sqlExpression": "a+b"},
    }
    assert columns_from_form_data(form_data) == ["region"]


def test_columns_empty_columns_key_does_not_shadow_groupby() -> None:
    # A stale, explicitly-present-but-empty ``columns`` key must not drop the
    # group-by dimensions (which would silently change the aggregation).
    form_data = {"groupby": ["country"], "columns": []}
    assert columns_from_form_data(form_data) == ["country"]


def test_build_context_maps_groupby_metrics_and_filters() -> None:
    form_data = {
        "groupby": ["country"],
        "metrics": ["count"],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "year",
                "operator": ">",
                "comparator": 2000,
            },
        ],
        "time_range": "Last year",
        "row_limit": 500,
    }

    ctx = build_query_context_from_form_data(form_data, DATASOURCE)

    assert ctx["datasource"] == DATASOURCE
    assert ctx["form_data"] == form_data
    assert len(ctx["queries"]) == 1
    query = ctx["queries"][0]
    assert query["columns"] == ["country"]
    assert query["metrics"] == ["count"]
    assert query["filters"] == [{"col": "year", "op": ">", "val": 2000}]
    assert query["time_range"] == "Last year"
    assert query["row_limit"] == 500


def test_build_context_big_number_singular_metric_and_default_time_range() -> None:
    form_data = {"metric": "sum__sales"}

    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]

    assert query["metrics"] == ["sum__sales"]
    assert query["time_range"] == "No filter"
    # No row_limit in form data → not forced into the query.
    assert "row_limit" not in query


def test_build_context_merges_legacy_and_adhoc_filters() -> None:
    # Legacy charts store simple filters directly under ``filters`` (already in
    # QueryObject shape); they are honored alongside adhoc_filters, and malformed
    # entries are dropped.
    form_data = {
        "groupby": ["country"],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "year",
                "operator": ">",
                "comparator": 2000,
            },
        ],
        "filters": [
            {"col": "region", "op": "==", "val": "EMEA"},
            {"not_a_filter": True},
        ],
    }

    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]

    assert query["filters"] == [
        {"col": "year", "op": ">", "val": 2000},
        {"col": "region", "op": "==", "val": "EMEA"},
    ]


def test_big_number_trendline_promotes_granularity_sqla_column() -> None:
    # A Big Number *with a trendline* (viz_type "big_number") has no
    # groupby/columns; its time column (granularity_sqla) becomes the sole column.
    form_data = {"metric": "count", "granularity_sqla": "order_date"}

    query = build_query_context_from_form_data(
        form_data, DATASOURCE, viz_type="big_number"
    )["queries"][0]

    assert query["columns"] == ["order_date"]
    assert query["metrics"] == ["count"]


def test_big_number_total_does_not_promote_granularity_sqla_column() -> None:
    # big_number_total is a single aggregate; promoting granularity_sqla to a
    # column would turn one total into one row per timestamp.
    form_data = {"metric": "count", "granularity_sqla": "order_date"}

    query = build_query_context_from_form_data(
        form_data, DATASOURCE, viz_type="big_number_total"
    )["queries"][0]

    assert query["columns"] == []


def test_build_context_sets_granularity_for_time_filtering() -> None:
    # Without a `granularity`, the `time_range` is inert downstream, so a legacy
    # chart with granularity_sqla + time_range would export its full history.
    form_data = {
        "metrics": ["count"],
        "granularity_sqla": "ds",
        "time_range": "Last quarter",
    }

    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]

    assert query["granularity"] == "ds"
    assert query["time_range"] == "Last quarter"


def test_build_context_prefers_explicit_granularity_over_sqla() -> None:
    form_data = {
        "metrics": ["count"],
        "granularity": "event_time",
        "granularity_sqla": "ds",
        "time_range": "Last week",
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["granularity"] == "event_time"


def test_build_context_omits_granularity_without_active_time_range() -> None:
    # A numeric column saved as granularity_sqla with no active range must not be
    # forced through temporal bucketing (which would fail on non-temporal columns).
    form_data = {"metrics": ["count"], "granularity_sqla": "year"}
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert "granularity" not in query


def test_orderby_defaults_to_first_metric_descending() -> None:
    # With a row_limit, ordering must be deterministic so the export returns the
    # chart's top-N, not an arbitrary N.
    form_data = {"metrics": ["count"], "groupby": ["c"], "row_limit": 10}
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["orderby"] == [["count", False]]


def test_orderby_uses_timeseries_limit_metric_and_order_desc() -> None:
    form_data = {
        "metrics": ["count"],
        "groupby": ["c"],
        "timeseries_limit_metric": "revenue",
        "order_desc": False,
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["orderby"] == [["revenue", True]]


def test_orderby_pie_sort_by_metric() -> None:
    form_data = {"metric": "count", "groupby": ["c"], "sort_by_metric": True}
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="pie")[
        "queries"
    ][0]
    assert query["orderby"] == [["count", False]]


def test_orderby_raw_mode_parses_order_by_cols() -> None:
    form_data = {
        "query_mode": "raw",
        "all_columns": ["a"],
        # A malformed entry is skipped rather than raising.
        "order_by_cols": ['["a", true]', "not json", ["b", False]],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["orderby"] == [["a", True], ["b", False]]


def test_sql_filters_and_legacy_where_go_into_extras() -> None:
    form_data = {
        "groupby": ["c"],
        "where": "region = 'EMEA'",
        "adhoc_filters": [
            {"expressionType": "SQL", "clause": "WHERE", "sqlExpression": "sales > 0"},
            {
                "expressionType": "SQL",
                "clause": "HAVING",
                "sqlExpression": "SUM(x) > 5",
            },
        ],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["extras"]["where"] == "(region = 'EMEA') AND (sales > 0)"
    assert query["extras"]["having"] == "(SUM(x) > 5)"


def test_table_percent_metrics_and_time_grain_are_carried() -> None:
    form_data = {
        "groupby": ["c"],
        "metrics": ["count"],
        "percent_metrics": ["pct_total"],
        "time_grain_sqla": "P1M",
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["metrics"] == ["count", "pct_total"]
    assert query["extras"]["time_grain_sqla"] == "P1M"
