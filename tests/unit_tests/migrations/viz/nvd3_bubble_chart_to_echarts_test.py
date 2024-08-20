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

from superset.migrations.shared.migrate_viz import MigrateBubbleChart
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

SOURCE_FORM_DATA: dict[str, Any] = {
    "adhoc_filters": [],
    "bottom_margin": 20,
    "color_scheme": "default",
    "entity": "count",
    "left_margin": 20,
    "limit": 100,
    "max_bubble_size": 50,
    "series": ["region"],
    "show_legend": True,
    "size": 75,
    "viz_type": "bubble",
    "x": "year",
    "x_axis_format": "SMART_DATE",
    "x_axis_label": "Year",
    "x_axis_showminmax": True,
    "x_log_scale": True,
    "x_ticks_layout": "45°",
    "y": "country",
    "y_axis_bounds": [0, 100],
    "y_axis_format": "SMART_DATE",
    "y_axis_label": "Year",
    "y_axis_showminmax": False,
    "y_log_scale": True,
}

TARGET_FORM_DATA: dict[str, Any] = {
    "adhoc_filters": [],
    "color_scheme": "default",
    "entity": "count",
    "form_data_bak": SOURCE_FORM_DATA,
    "logXAxis": True,
    "logYAxis": True,
    "max_bubble_size": 50,
    "row_limit": 100,
    "series": ["region"],
    "show_legend": True,
    "size": 75,
    "truncateYAxis": True,
    "viz_type": "bubble_v2",
    "x": "year",
    "xAxisFormat": "SMART_DATE",
    "xAxisLabelRotation": 45,
    "x_axis_label": "Year",
    "x_axis_title_margin": 20,
    "y": "country",
    "y_axis_bounds": [0, 100],
    "y_axis_format": "SMART_DATE",
    "y_axis_label": "Year",
    "y_axis_title_margin": 20,
}


def test_migration() -> None:
    migrate_and_assert(MigrateBubbleChart, SOURCE_FORM_DATA, TARGET_FORM_DATA)
