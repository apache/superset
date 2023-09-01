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


class MigrateAreaChart(MigrateViz):
    """
    Migrate area charts.

    This migration is incomplete, see https://github.com/apache/superset/pull/24703#discussion_r1265222611
    for more details. If you fix this migration, please update the ``migrate_chart``
    function in ``superset/charts/commands/importers/v1/utils.py`` so that it gets
    applied in chart imports.
    """

    source_viz_type = "area"
    target_viz_type = "echarts_area"
    remove_keys = {"contribution", "stacked_style", "x_axis_label"}

    def _pre_action(self) -> None:
        if self.data.get("contribution"):
            self.data["contributionMode"] = "row"

        if stacked := self.data.get("stacked_style"):
            stacked_map = {
                "expand": "Expand",
                "stack": "Stack",
            }
            self.data["show_extra_controls"] = True
            self.data["stack"] = stacked_map.get(stacked)

        if x_axis := self.data.get("granularity_sqla"):
            self.data["x_axis"] = x_axis

        if x_axis_label := self.data.get("x_axis_label"):
            self.data["x_axis_title"] = x_axis_label
            self.data["x_axis_title_margin"] = 30


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
