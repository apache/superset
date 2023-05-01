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
from .base import MigrateViz


class MigrateTreeMap(MigrateViz):
    source_viz_type = "treemap"
    target_viz_type = "treemap_v2"
    remove_keys = {"metrics"}

    def _pre_action(self) -> None:
        if (
            "metrics" in self.data
            and isinstance(self.data["metrics"], list)
            and len(self.data["metrics"]) > 0
        ):
            self.data["metric"] = self.data["metrics"][0]


class MigrateAreaChart(MigrateViz):
    source_viz_type = "area"
    target_viz_type = "echarts_area"
    remove_keys = {"contribution", "stacked_style", "x_axis_label"}
    rename_keys = {
        "x_axis_label": "x_axis_title",
        "x_axis_format": "x_axis_time_format",
        "x_ticks_layout": "xAxisLabelRotation",
        "bottom_margin": "x_axis_title_margin",
        "y_log_scale": "logAxis",
    }

    def _pre_action(self) -> None:
        if self.data.get("contribution"):
            self.data["contributionMode"] = "row"

        if stacked := self.data.get("stacked_style"):
            stacked_map = {
                "expand": "Expand",
                "stack": "Stack",
                "stream": "Stream",
            }
            self.data["show_extra_controls"] = True
            self.data["stack"] = stacked_map.get(stacked)

        x_ticks_layout = self.data.get("x_ticks_layout")
        if x_ticks_layout:
            self.data["x_ticks_layout"] = 45 if x_ticks_layout == "45°" else 0

        x_axis_label = self.data.get("x_axis_label")
        bottom_margin = self.data.get("bottom_margin")
        if x_axis_label and (not bottom_margin or bottom_margin == "auto"):
            self.data["bottom_margin"] = 30

        self.data["opacity"] = 0.7
