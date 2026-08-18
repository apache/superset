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


def test_build_context_sets_granularity_without_active_time_range() -> None:
    # `granularity` also drives time-grain bucketing of a selected column, not just
    # the time filter, so it is set whenever form data carries one — matching
    # extractExtras.ts, which sets it unconditionally.
    form_data = {"metrics": ["count"], "granularity_sqla": "ds"}
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["granularity"] == "ds"


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


def test_aggregate_mode_ignores_stale_order_by_cols() -> None:
    # order_by_cols is a raw-mode-only control (resetOnHide: false), so it isn't
    # reset when switching to aggregate mode. The rebuild must ignore a stale value
    # and order by the metric like the chart does, or a row_limit would return a
    # different top-N than the chart shows.
    form_data = {
        "metrics": ["count"],
        "groupby": ["c"],
        "order_by_cols": ['["a", true]'],
        "row_limit": 10,
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["orderby"] == [["count", False]]


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


def test_table_carries_time_grain() -> None:
    # ``time_grain_sqla`` is passed through in ``extras`` so a temporal dimension
    # is bucketed as the chart does. (Charts with percent_metrics are skipped
    # upstream in the export, not rebuilt — see the export task tests.)
    form_data = {
        "groupby": ["c"],
        "metrics": ["count"],
        "time_grain_sqla": "P1M",
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["metrics"] == ["count"]
    assert query["extras"]["time_grain_sqla"] == "P1M"


def test_table_groupby_time_column_without_time_range_is_bucketed() -> None:
    # Verified against a live export (dashboard Excel export, PR #42284): a table
    # chart grouped by its own time column, with a time grain but no active
    # time_range ("all-time totals by month" — a very ordinary configuration),
    # must still bucket that column by its time grain. Confirmed live: the same
    # chart with an explicit time_range instead of "No filter" correctly returns
    # one row per year; with "No filter" it instead returns one row per *raw*
    # timestamp (e.g. one per individual order date) — i.e. completely
    # unaggregated data, not merely "the full history" the granularity comment
    # in build_query_context_from_form_data anticipates. Gating ``granularity``
    # on ``time_range != "No filter"`` conflates "should we apply a WHERE time
    # filter" (legitimately time_range-dependent) with "should this selected
    # column be truncated to its time grain" (not time_range-dependent at all —
    # the real frontend's extractExtras.ts sets `granularity` unconditionally
    # whenever granularity_sqla/granularity is present).
    form_data = {
        "groupby": ["order_date"],
        "metrics": ["count"],
        "granularity_sqla": "order_date",
        "time_grain_sqla": "P1Y",
        "time_range": "No filter",
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["columns"] == ["order_date"]
    assert query["extras"]["time_grain_sqla"] == "P1Y"
    assert query["granularity"] == "order_date"


def test_simple_having_filter_converted_by_default_but_not_where_only() -> None:
    # Default: all SIMPLE filters convert (the behavior MCP relies on).
    # where_only=True: SIMPLE HAVING is dropped (matching the chart), which the
    # export uses so it doesn't filter on a clause the chart ignores.
    adhoc = [
        {
            "expressionType": "SIMPLE",
            "clause": "HAVING",
            "subject": "count",
            "operator": ">",
            "comparator": 5,
        }
    ]
    assert adhoc_filters_to_query_filters(adhoc) == [
        {"col": "count", "op": ">", "val": 5}
    ]
    assert adhoc_filters_to_query_filters(adhoc, where_only=True) == []


def test_build_context_ignores_simple_having_filter() -> None:
    # The export must not apply a SIMPLE HAVING filter the chart itself ignores.
    form_data = {
        "groupby": ["c"],
        "metrics": ["count"],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "HAVING",
                "subject": "count",
                "operator": ">",
                "comparator": 5,
            },
            {
                "expressionType": "SIMPLE",
                "subject": "region",
                "operator": "==",
                "comparator": "EMEA",
            },
        ],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]


def test_big_number_trendline_sets_granularity_without_time_range() -> None:
    # A Big Number trendline groups by its time column; granularity must be set so
    # time_grain_sqla buckets it even when there's no active time range.
    form_data = {
        "metric": "count",
        "granularity_sqla": "ds",
        "time_grain_sqla": "P1M",
    }
    query = build_query_context_from_form_data(
        form_data, DATASOURCE, viz_type="big_number"
    )["queries"][0]
    assert query["columns"] == ["ds"]
    assert query["granularity"] == "ds"
    assert query["extras"]["time_grain_sqla"] == "P1M"


def test_time_range_falls_back_to_since_until() -> None:
    # Older charts store the range as separate since/until rather than time_range.
    form_data = {"metrics": ["count"], "since": "2020-01-01", "until": "2020-12-31"}
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["time_range"] == "2020-01-01 : 2020-12-31"


def test_raw_mode_ignores_stale_metrics_and_groupby() -> None:
    # Raw-mode form data can carry stale metrics/groupby (the controls aren't
    # reset when hidden); the rebuild must ignore them like the chart does, or it
    # would aggregate/group and re-order by a stale metric.
    form_data = {
        "query_mode": "raw",
        "all_columns": ["name", "sales"],
        "metrics": ["count"],
        "groupby": ["genre"],
        "timeseries_limit_metric": "count",
        "row_limit": 10,
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["columns"] == ["name", "sales"]
    assert query["metrics"] == []
    # No order_by_cols and no metrics → no metric-based ordering.
    assert query["orderby"] == []


def test_raw_mode_inferred_from_all_columns_without_query_mode() -> None:
    # No explicit query_mode, but all_columns present → raw (mirrors getQueryMode).
    form_data = {"all_columns": ["a", "b"], "groupby": ["c"], "metrics": ["m"]}
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["columns"] == ["a", "b"]
    assert query["metrics"] == []


def test_orderby_table_sort_metric_defaults_ascending() -> None:
    # Table defaults order_desc to False → ascending (matching the chart), so a row
    # limit keeps the chart's bottom-N rather than flipping it to top-N.
    form_data = {
        "metrics": ["count"],
        "groupby": ["c"],
        "timeseries_limit_metric": "revenue",
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["orderby"] == [["revenue", True]]


def test_orderby_unwraps_list_valued_sort_metric() -> None:
    # The drag-and-drop "sort by" control persists timeseries_limit_metric as a
    # list; the frontend unwraps it with ensureIsArray(...)[0]. Read raw, the
    # nested list produces an orderby the query runner rejects, so the chart
    # lands in the general error bucket instead of exporting.
    form_data = {
        "metrics": ["count"],
        "groupby": ["c"],
        "timeseries_limit_metric": ["revenue"],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["orderby"] == [["revenue", True]]


def test_orderby_empty_list_sort_metric_falls_back_to_first_metric() -> None:
    # An emptied sort-by control leaves `[]` behind; treat it as unset.
    form_data = {"metrics": ["count"], "groupby": ["c"], "timeseries_limit_metric": []}
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["orderby"] == [["count", False]]


def test_orderby_adhoc_sort_metric_is_not_unwrapped() -> None:
    # An adhoc metric is a dict, not a list: it must pass through whole rather
    # than being reduced to one of its keys.
    adhoc_metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
        "label": "SUM(sales)",
    }
    form_data = {
        "metrics": ["count"],
        "groupby": ["c"],
        "timeseries_limit_metric": adhoc_metric,
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert query["orderby"] == [[adhoc_metric, True]]


def test_raw_mode_order_by_cols_drops_non_pair_entries() -> None:
    # order_by_cols entries that parse but aren't [col, asc] pairs (a stray null,
    # a bare column, an over-long tuple) would append junk to orderby and fail the
    # query; only well-formed pairs survive.
    form_data = {
        "query_mode": "raw",
        "all_columns": ["a"],
        "order_by_cols": ["null", '["a"]', '["b", true, 1]', '["c", false]', 5],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["orderby"] == [["c", False]]


def test_freeform_where_clause_with_sql_comment_is_newline_terminated() -> None:
    # A free-form SQL filter ending in a `--` comment would otherwise comment out
    # the closing paren and every predicate joined after it, so the export fails
    # on a chart that renders fine. Mirrors sanitizeClause in processFilters.ts.
    form_data = {
        "groupby": ["c"],
        "adhoc_filters": [
            {
                "expressionType": "SQL",
                "clause": "WHERE",
                "sqlExpression": "sales > 0 -- note",
            },
            {"expressionType": "SQL", "clause": "WHERE", "sqlExpression": "qty > 1"},
        ],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["extras"]["where"] == "(sales > 0 -- note\n) AND (qty > 1)"


def test_freeform_having_clause_with_sql_comment_is_newline_terminated() -> None:
    form_data = {
        "groupby": ["c"],
        "adhoc_filters": [
            {
                "expressionType": "SQL",
                "clause": "HAVING",
                "sqlExpression": "SUM(x) > 5 -- note",
            },
        ],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE)["queries"][0]
    assert query["extras"]["having"] == "(SUM(x) > 5 -- note\n)"


def test_pie_carries_contribution_post_processing() -> None:
    # Pie's buildQuery attaches the contribution operator unconditionally and its
    # transformProps reads the renamed column, so a rebuilt pie sheet must carry
    # the same percentage column a saved-context pie sheet has.
    form_data = {"metric": "count", "groupby": ["c"]}
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="pie")[
        "queries"
    ][0]
    assert query["post_processing"] == [
        {
            "operation": "contribution",
            "options": {
                "columns": ["count"],
                "rename_columns": ["count__contribution"],
            },
        }
    ]


def test_pie_contribution_uses_adhoc_metric_label() -> None:
    # getMetricLabel resolves an adhoc metric to its label; the renamed column
    # must match what the chart produces for the same metric.
    form_data = {
        "metric": {
            "expressionType": "SIMPLE",
            "column": {"column_name": "sales"},
            "aggregate": "SUM",
            "label": "Total sales",
        },
        "groupby": ["c"],
    }
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="pie")[
        "queries"
    ][0]
    assert query["post_processing"][0]["options"] == {
        "columns": ["Total sales"],
        "rename_columns": ["Total sales__contribution"],
    }


def test_non_pie_carries_no_post_processing() -> None:
    form_data = {"metrics": ["count"], "groupby": ["c"]}
    query = build_query_context_from_form_data(form_data, DATASOURCE, viz_type="table")[
        "queries"
    ][0]
    assert "post_processing" not in query
