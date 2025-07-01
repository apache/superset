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
from typing import Any

from superset.migrations.shared.migrate_viz.query_functions import (
    build_query_context,
    contribution_operator,
    ensure_is_array,
    extract_extra_metrics,
    flatten_operator,
    get_column_label,
    get_metric_label,
    get_x_axis_column,
    histogram_operator,
    is_physical_column,
    is_time_comparison,
    is_x_axis_set,
    normalize_order_by,
    pivot_operator,
    prophet_operator,
    rank_operator,
    remove_form_data_suffix,
    rename_operator,
    resample_operator,
    retain_form_data_suffix,
    rolling_window_operator,
    sort_operator,
    time_compare_operator,
    time_compare_pivot_operator,
)
from superset.utils.core import as_list

from .base import MigrateViz


class MigrateTreeMap(MigrateViz):
    source_viz_type = "treemap"
    target_viz_type = "treemap_v2"
    remove_keys = {"metrics"}
    rename_keys = {"order_desc": "sort_by_metric"}

    def _pre_action(self) -> None:
        if (
            "metrics" in self.data
            and isinstance(self.data["metrics"], list)
            and len(self.data["metrics"]) > 0
        ):
            self.data["metric"] = self.data["metrics"][0]

    def _build_query(self) -> dict[str, Any]:
        metric = self.data.get("metric")
        sort_by_metric = self.data.get("sort_by_metric")

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            new_query_object = base_query_object.copy()

            if sort_by_metric:
                new_query_object["orderby"] = [[metric, False]]
            return [new_query_object]

        return build_query_context(self.data, process)


class MigratePivotTable(MigrateViz):
    source_viz_type = "pivot_table"
    target_viz_type = "pivot_table_v2"
    remove_keys = {"pivot_margins"}
    rename_keys = {
        "columns": "groupbyColumns",
        "combine_metric": "combineMetric",
        "groupby": "groupbyRows",
        "number_format": "valueFormat",
        "pandas_aggfunc": "aggregateFunction",
        "row_limit": "series_limit",
        "timeseries_limit_metric": "series_limit_metric",
        "transpose_pivot": "transposePivot",
    }
    aggregation_mapping = {
        "sum": "Sum",
        "mean": "Average",
        "median": "Median",
        "min": "Minimum",
        "max": "Maximum",
        "std": "Sample Standard Deviation",
        "var": "Sample Variance",
    }

    def _pre_action(self) -> None:
        if pivot_margins := self.data.get("pivot_margins"):
            self.data["colTotals"] = pivot_margins
            self.data["colSubTotals"] = pivot_margins

        if pandas_aggfunc := self.data.get("pandas_aggfunc"):
            self.data["pandas_aggfunc"] = self.aggregation_mapping[pandas_aggfunc]

        self.data["rowOrder"] = "value_z_to_a"

    def _build_query(self) -> dict[str, Any]:
        groupby_columns = self.data.get("groupbyColumns", [])
        groupby_rows = self.data.get("groupbyRows", [])
        extra_form_data = self.data.get("extra_form_data", {})
        time_grain_sqla = extra_form_data.get("time_grain_sqla") or self.data.get(
            "time_grain_sqla"
        )

        unique_columns = ensure_is_array(groupby_columns) + ensure_is_array(
            groupby_rows
        )

        columns = []
        for col in unique_columns:
            if (
                is_physical_column(col)
                and time_grain_sqla
                and (
                    self.data.get("temporal_columns_lookup", {}).get(col)
                    or self.data.get("granularity_sqla") == col
                )
            ):
                col_dict = {
                    "timeGrain": time_grain_sqla,
                    "columnType": "BASE_AXIS",
                    "sqlExpression": col,
                    "label": col,
                    "expressionType": "SQL",
                }
                if col_dict not in columns:
                    columns.append(col_dict)
            else:
                if col not in columns:
                    columns.append(col)

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            series_limit_metric = base_query_object.get("series_limit_metric")
            metrics = base_query_object.get("metrics")
            order_desc = base_query_object.get("order_desc")
            orderby = None
            if series_limit_metric:
                orderby = [[series_limit_metric, not order_desc]]
            elif isinstance(metrics, list) and metrics and metrics[0]:
                orderby = [[metrics[0], not order_desc]]
            new_query_object = base_query_object.copy()
            if orderby is not None:
                new_query_object["orderby"] = orderby
            new_query_object["columns"] = columns
            return [new_query_object]

        return build_query_context(self.data, process)


class MigrateDualLine(MigrateViz):
    has_x_axis_control = True
    source_viz_type = "dual_line"
    target_viz_type = "mixed_timeseries"
    rename_keys = {
        "x_axis_format": "x_axis_time_format",
        "y_axis_2_format": "y_axis_format_secondary",
        "y_axis_2_bounds": "y_axis_bounds_secondary",
    }
    remove_keys = {"metric", "metric_2"}

    def _pre_action(self) -> None:
        self.data["yAxisIndex"] = 0
        self.data["yAxisIndexB"] = 1
        self.data["adhoc_filters_b"] = self.data.get("adhoc_filters")
        self.data["truncateYAxis"] = True
        self.data["metrics"] = [self.data.get("metric")]
        self.data["metrics_b"] = [self.data.get("metric_2")]

    def _migrate_temporal_filter(self, rv_data: dict[str, Any]) -> None:
        super()._migrate_temporal_filter(rv_data)
        rv_data["adhoc_filters_b"] = rv_data.get("adhoc_filters") or []

    def _build_query(self) -> dict[str, Any]:
        base_form_data = self.data.copy()
        form_data1 = remove_form_data_suffix(base_form_data, "_b")
        form_data2 = retain_form_data_suffix(base_form_data, "_b")

        def process_fn(fd: dict[str, Any]) -> dict[str, Any]:
            def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
                query_object = base_query_object.copy()
                query_object["columns"] = (
                    ensure_is_array(get_x_axis_column(self.data))
                    if is_x_axis_set(self.data)
                    else []
                ) + ensure_is_array(fd.get("groupby"))
                query_object["series_columns"] = fd.get("groupby")
                if not is_x_axis_set(self.data):
                    query_object["is_timeseries"] = True
                pivot_operator_runtime = (
                    time_compare_pivot_operator(fd, query_object)
                    if is_time_comparison(fd, query_object)
                    else pivot_operator(fd, query_object)
                )
                tmp_query_object = query_object.copy()
                tmp_query_object["time_offsets"] = (
                    fd.get("time_compare")
                    if is_time_comparison(fd, query_object)
                    else []
                )
                tmp_query_object["post_processing"] = [
                    pivot_operator_runtime,
                    rolling_window_operator(fd, query_object),
                    time_compare_operator(fd, query_object),
                    resample_operator(fd, query_object),
                    rename_operator(fd, query_object),
                    flatten_operator(fd, query_object),
                ]

                if tmp_query_object["series_columns"] is None:
                    tmp_query_object.pop("series_columns")
                return [normalize_order_by(tmp_query_object)]

            return build_query_context(fd, process)

        query_contexts = [process_fn(form_data1), process_fn(form_data2)]
        qc0 = query_contexts[0]
        qc1 = query_contexts[1]
        merged = qc0.copy()
        merged["queries"] = qc0.get("queries", []) + qc1.get("queries", [])
        return merged


class MigrateSunburst(MigrateViz):
    source_viz_type = "sunburst"
    target_viz_type = "sunburst_v2"
    rename_keys = {"groupby": "columns"}

    def _build_query(self) -> dict[str, Any]:
        metric = self.data.get("metric")
        sort_by_metric = self.data.get("sort_by_metric")

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            result = base_query_object.copy()
            if sort_by_metric:
                result["orderby"] = [[metric, False]]
            return [result]

        return build_query_context(self.data, process)


class TimeseriesChart(MigrateViz):
    has_x_axis_control = True
    rename_keys = {
        "bottom_margin": "x_axis_title_margin",
        "left_margin": "y_axis_title_margin",
        "show_controls": "show_extra_controls",
        "x_axis_label": "x_axis_title",
        "x_axis_format": "x_axis_time_format",
        "x_axis_showminmax": "truncateXAxis",
        "x_ticks_layout": "xAxisLabelRotation",
        "y_axis_label": "y_axis_title",
        "y_axis_showminmax": "truncateYAxis",
        "y_log_scale": "logAxis",
    }
    remove_keys = {
        "contribution",
        "line_interpolation",
        "reduce_x_ticks",
        "show_brush",
        "show_markers",
    }

    def _pre_action(self) -> None:
        self.data["contributionMode"] = "row" if self.data.get("contribution") else None
        self.data["zoomable"] = self.data.get("show_brush") == "yes"
        self.data["markerEnabled"] = self.data.get("show_markers") or False
        self.data["y_axis_showminmax"] = True

        bottom_margin = self.data.get("bottom_margin")
        if self.data.get("x_axis_label") and (
            not bottom_margin or bottom_margin == "auto"
        ):
            self.data["bottom_margin"] = 30

        left_margin = self.data.get("left_margin")
        if self.data.get("y_axis_label") and (not left_margin or left_margin == "auto"):
            self.data["left_margin"] = 30

        if (rolling_type := self.data.get("rolling_type")) and rolling_type != "None":
            self.data["rolling_type"] = rolling_type

        if (time_compare := self.data.get("time_compare")) is not None:
            self.data["time_compare"] = [
                v if v.endswith(" ago") else v + " ago"
                for value in as_list(time_compare)
                if (v := value.strip())
            ]

        comparison_type = self.data.get("comparison_type") or "values"
        self.data["comparison_type"] = (
            "difference" if comparison_type == "absolute" else comparison_type
        )

        if x_ticks_layout := self.data.get("x_ticks_layout"):
            self.data["x_ticks_layout"] = 45 if x_ticks_layout == "45°" else 0

    def _build_query(self) -> dict[str, Any]:
        groupby = self.data.get("groupby")

        def query_builder(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            """
            The `pivot_operator_in_runtime` determines how to pivot the dataframe
              returned from the raw query.
            1. If it's a time compared query, there will return a pivoted
              dataframe that append time compared metrics.
            """
            extra_metrics = extract_extra_metrics(self.data)

            pivot_operator_in_runtime = (
                time_compare_pivot_operator(self.data, base_query_object)
                if is_time_comparison(self.data, base_query_object)
                else pivot_operator(self.data, base_query_object)
            )

            columns = (
                ensure_is_array(get_x_axis_column(self.data))
                if is_x_axis_set(self.data)
                else []
            ) + ensure_is_array(groupby)

            time_offsets = (
                self.data.get("time_compare")
                if is_time_comparison(self.data, base_query_object)
                else []
            )

            result = {
                **base_query_object,
                "metrics": (base_query_object.get("metrics") or []) + extra_metrics,
                "columns": columns,
                "series_columns": groupby,
                **({"is_timeseries": True} if not is_x_axis_set(self.data) else {}),
                # todo: move `normalize_order_by to extract_query_fields`
                "orderby": normalize_order_by(base_query_object).get("orderby"),
                "time_offsets": time_offsets,
                "post_processing": [
                    pivot_operator_in_runtime,
                    rolling_window_operator(self.data, base_query_object),
                    time_compare_operator(self.data, base_query_object),
                    resample_operator(self.data, base_query_object),
                    rename_operator(self.data, base_query_object),
                    contribution_operator(self.data, base_query_object, time_offsets),
                    sort_operator(self.data, base_query_object),
                    flatten_operator(self.data, base_query_object),
                    # todo: move prophet before flatten
                    prophet_operator(self.data, base_query_object),
                ],
            }

            return [result]

        return build_query_context(self.data, query_builder)


class MigrateLineChart(TimeseriesChart):
    source_viz_type = "line"
    target_viz_type = "echarts_timeseries_line"

    def _pre_action(self) -> None:
        super()._pre_action()

        line_interpolation = self.data.get("line_interpolation")
        if line_interpolation == "cardinal":
            self.target_viz_type = "echarts_timeseries_smooth"
        elif line_interpolation == "step-before":
            self.target_viz_type = "echarts_timeseries_step"
            self.data["seriesType"] = "start"
        elif line_interpolation == "step-after":
            self.target_viz_type = "echarts_timeseries_step"
            self.data["seriesType"] = "end"

    def _build_query(self) -> dict[str, Any]:
        return super()._build_query()


class MigrateAreaChart(TimeseriesChart):
    source_viz_type = "area"
    target_viz_type = "echarts_area"
    stacked_map = {
        "expand": "Expand",
        "stack": "Stack",
        "stream": "Stream",
    }

    def _pre_action(self) -> None:
        super()._pre_action()

        self.remove_keys.add("stacked_style")

        self.data["stack"] = self.stacked_map.get(
            self.data.get("stacked_style") or "stack"
        )

        self.data["opacity"] = 0.7

    def _build_query(self) -> dict[str, Any]:
        return super()._build_query()


class MigrateBarChart(TimeseriesChart):
    source_viz_type = "bar"
    target_viz_type = "echarts_timeseries_bar"

    def _pre_action(self) -> None:
        super()._pre_action()

        self.rename_keys["show_bar_value"] = "show_value"

        self.remove_keys.add("bar_stacked")

        self.data["stack"] = "Stack" if self.data.get("bar_stacked") else None

    def _build_query(self) -> dict[str, Any]:
        return super()._build_query()


class MigrateDistBarChart(TimeseriesChart):
    source_viz_type = "dist_bar"
    target_viz_type = "echarts_timeseries_bar"
    has_x_axis_control = False

    def _pre_action(self) -> None:
        super()._pre_action()

        groupby = self.data.get("groupby") or []
        columns = self.data.get("columns") or []
        if len(groupby) > 0:
            # x-axis supports only one value
            self.data["x_axis"] = groupby[0]

        self.data["groupby"] = []
        if len(groupby) > 1:
            # rest of groupby will go into dimensions
            self.data["groupby"] += groupby[1:]
        if len(columns) > 0:
            self.data["groupby"] += columns

        self.rename_keys["show_bar_value"] = "show_value"

        self.remove_keys.add("columns")
        self.remove_keys.add("bar_stacked")

        self.data["stack"] = "Stack" if self.data.get("bar_stacked") else None
        self.data["x_ticks_layout"] = 45

    def _build_query(self) -> dict[str, Any]:
        return super()._build_query()


class MigrateBubbleChart(MigrateViz):
    source_viz_type = "bubble"
    target_viz_type = "bubble_v2"
    rename_keys = {
        "bottom_margin": "x_axis_title_margin",
        "left_margin": "y_axis_title_margin",
        "limit": "row_limit",
        "x_axis_format": "xAxisFormat",
        "x_log_scale": "logXAxis",
        "x_ticks_layout": "xAxisLabelRotation",
        "y_axis_showminmax": "truncateYAxis",
        "y_log_scale": "logYAxis",
    }
    remove_keys = {"x_axis_showminmax"}

    def _pre_action(self) -> None:
        bottom_margin = self.data.get("bottom_margin")
        if self.data.get("x_axis_label") and (
            not bottom_margin or bottom_margin == "auto"
        ):
            self.data["bottom_margin"] = 30

        if x_ticks_layout := self.data.get("x_ticks_layout"):
            self.data["x_ticks_layout"] = 45 if x_ticks_layout == "45°" else 0

        # Truncate y-axis by default to preserve layout
        self.data["y_axis_showminmax"] = True

    def _build_query(self) -> dict[str, Any]:
        columns = ensure_is_array(self.data.get("entity")) + ensure_is_array(
            self.data.get("series")
        )

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            if base_query_object.get("orderby"):
                orderby = [
                    [
                        base_query_object["orderby"][0],
                        not base_query_object.get("order_desc", False),
                    ]
                ]
            else:
                orderby = None

            new_query_object = {**base_query_object, "columns": columns}
            if orderby is not None:
                new_query_object["orderby"] = orderby

            return [new_query_object]

        return build_query_context(self.data, process)


class MigrateHeatmapChart(MigrateViz):
    source_viz_type = "heatmap"
    target_viz_type = "heatmap_v2"
    rename_keys = {
        "all_columns_x": "x_axis",
        "all_columns_y": "groupby",
        "y_axis_bounds": "value_bounds",
        "show_perc": "show_percentage",
    }
    remove_keys = {"sort_by_metric", "canvas_image_rendering"}

    def _pre_action(self) -> None:
        self.data["legend_type"] = "continuous"

    def _build_query(self) -> dict[str, Any]:
        groupby = self.data.get("groupby")
        normalize_across = self.data.get("normalize_across")
        sort_x_axis = self.data.get("sort_x_axis")
        sort_y_axis = self.data.get("sort_y_axis")
        x_axis = self.data.get("x_axis")

        metric = get_metric_label(self.data.get("metric"))

        columns = ensure_is_array(get_x_axis_column(self.data)) + ensure_is_array(
            groupby
        )

        orderby = []
        if sort_x_axis:
            chosen = metric if "value" in sort_x_axis else columns[0]
            ascending = "asc" in sort_x_axis
            orderby.append([chosen, ascending])
        if sort_y_axis:
            chosen = metric if "value" in sort_y_axis else columns[1]
            ascending = "asc" in sort_y_axis
            orderby.append([chosen, ascending])

        if normalize_across == "x":
            group_by = get_column_label(x_axis)
        elif normalize_across == "y":
            group_by = get_column_label(groupby)
        else:
            group_by = None

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            new_query_object = base_query_object.copy()
            new_query_object["columns"] = columns
            if orderby:
                new_query_object["orderby"] = orderby
            new_query_object["post_processing"] = [
                rank_operator(
                    self.data,
                    base_query_object,
                    {"metric": metric, "group_by": group_by},
                )
            ]

            return [new_query_object]

        return build_query_context(self.data, process)


class MigrateHistogramChart(MigrateViz):
    source_viz_type = "histogram"
    target_viz_type = "histogram_v2"
    rename_keys = {
        "x_axis_label": "x_axis_title",
        "y_axis_label": "y_axis_title",
        "normalized": "normalize",
    }
    remove_keys = {"all_columns_x", "link_length", "queryFields"}

    def _pre_action(self) -> None:
        all_columns_x = self.data.get("all_columns_x")
        if all_columns_x and len(all_columns_x) > 0:
            self.data["column"] = all_columns_x[0]

        link_length = self.data.get("link_length")
        self.data["bins"] = int(link_length) if link_length else 5

        groupby = self.data.get("groupby")
        if not groupby:
            self.data["groupby"] = []

    def _build_query(self) -> dict[str, Any]:
        column = self.data.get("column")
        groupby = self.data.get("groupby", [])

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            result = base_query_object.copy()
            result["columns"] = groupby + [column]
            result["post_processing"] = [
                histogram_operator(self.data, base_query_object)
            ]
            if "metrics" in result.keys():
                result.pop("metrics", None)
            return [result]

        return build_query_context(self.data, process)


class MigrateSankey(MigrateViz):
    source_viz_type = "sankey"
    target_viz_type = "sankey_v2"
    remove_keys = {"groupby"}

    def _pre_action(self) -> None:
        groupby = self.data.get("groupby")
        if groupby and len(groupby) > 1:
            self.data["source"] = groupby[0]
            self.data["target"] = groupby[1]

    def _build_query(self) -> dict[str, Any]:
        metric = self.data.get("metric")
        sort_by_metric = self.data.get("sort_by_metric")
        source = self.data.get("source")
        target = self.data.get("target")
        groupby = [source, target]

        def process(base_query_object: dict[str, Any]) -> list[dict[str, Any]]:
            result = base_query_object.copy()
            result["groupby"] = groupby
            if sort_by_metric:
                result["orderby"] = [[metric, False]]
            return [result]

        return build_query_context(self.data, process)
