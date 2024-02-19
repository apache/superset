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


class MigrateSunburst(MigrateViz):
    source_viz_type = "sunburst"
    target_viz_type = "sunburst_v2"
    rename_keys = {"groupby": "columns"}


class TimeseriesChart(MigrateViz):
    has_x_axis_control = True
    rename_keys = {
        "bottom_margin": "x_axis_title_margin",
        "left_margin": "y_axis_title_margin",
        "show_controls": "show_extra_controls",
        "x_axis_label": "x_axis_title",
        "x_axis_format": "x_axis_time_format",
        "x_ticks_layout": "xAxisLabelRotation",
        "y_axis_label": "y_axis_title",
        "y_axis_showminmax": "truncateYAxis",
        "y_log_scale": "logAxis",
    }
    remove_keys = {"contribution", "show_brush", "show_markers"}

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

        if (rolling_type := self.data.get("rolling_type")) and rolling_type != "None":
            self.data["rolling_type"] = rolling_type

        if time_compare := self.data.get("time_compare"):
            self.data["time_compare"] = [
                value + " ago" for value in as_list(time_compare) if value
            ]

        comparison_type = self.data.get("comparison_type") or "values"
        self.data["comparison_type"] = (
            "difference" if comparison_type == "absolute" else comparison_type
        )

        if x_ticks_layout := self.data.get("x_ticks_layout"):
            self.data["x_ticks_layout"] = 45 if x_ticks_layout == "45°" else 0


class MigrateLineChart(TimeseriesChart):
    source_viz_type = "line"
    target_viz_type = "echarts_timeseries_line"

    def _pre_action(self) -> None:
        super()._pre_action()

        self.remove_keys.add("line_interpolation")

        line_interpolation = self.data.get("line_interpolation")
        if line_interpolation == "cardinal":
            self.target_viz_type = "echarts_timeseries_smooth"
        elif line_interpolation == "step-before":
            self.target_viz_type = "echarts_timeseries_step"
            self.data["seriesType"] = "start"
        elif line_interpolation == "step-after":
            self.target_viz_type = "echarts_timeseries_step"
            self.data["seriesType"] = "end"


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
