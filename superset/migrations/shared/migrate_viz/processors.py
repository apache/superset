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

    def _pre_action(self) -> None:
        if self.data.get("contribution"):
            self.data["contributionMode"] = "row"

        stacked = self.data.get("stacked_style")
        if stacked:
            stacked_map = {
                "expand": "Expand",
                "stack": "Stack",
            }
            self.data["show_extra_controls"] = True
            self.data["stack"] = stacked_map.get(stacked)

        x_axis_label = self.data.get("x_axis_label")
        if x_axis_label:
            self.data["x_axis_title"] = x_axis_label
            self.data["x_axis_title_margin"] = 30
