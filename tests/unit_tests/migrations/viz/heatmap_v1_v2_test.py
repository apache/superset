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

from superset.migrations.shared.migrate_viz import MigrateHeatmapChart
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

SOURCE_FORM_DATA: dict[str, Any] = {
    "any_other_key": "untouched",
    "all_columns_x": ["category"],
    "all_columns_y": ["product"],
    "metric": ["sales"],
    "adhoc_filters": [],
    "row_limit": 100,
    "sort_by_metric": True,
    "linear_color_scheme": "blue",
    "xscale_interval": 2,
    "yscale_interval": 2,
    "canvas_image_rendering": "auto",
    "normalize_across": "x",
    "left_margin": 50,
    "bottom_margin": 50,
    "y_axis_bounds": [0, 100],
    "y_axis_format": "SMART_NUMBER",
    "currency_format": "USD",
    "sort_x_axis": "alpha_asc",
    "sort_y_axis": "alpha_asc",
    "show_legend": True,
    "show_perc": True,
    "show_values": True,
    "normalized": True,
    "viz_type": "heatmap",
}

TARGET_FORM_DATA: dict[str, Any] = {
    "any_other_key": "untouched",
    "x_axis": ["category"],
    "groupby": ["product"],
    "metric": ["sales"],
    "adhoc_filters": [],
    "row_limit": 100,
    "legend_type": "continuous",
    "linear_color_scheme": "blue",
    "xscale_interval": 2,
    "yscale_interval": 2,
    "normalize_across": "x",
    "left_margin": 50,
    "bottom_margin": 50,
    "value_bounds": [0, 100],
    "y_axis_format": "SMART_NUMBER",
    "currency_format": "USD",
    "sort_x_axis": "alpha_asc",
    "sort_y_axis": "alpha_asc",
    "show_legend": True,
    "show_percentage": True,
    "show_values": True,
    "normalized": True,
    "viz_type": "heatmap_v2",
    "form_data_bak": SOURCE_FORM_DATA,
}


def test_migration() -> None:
    migrate_and_assert(MigrateHeatmapChart, SOURCE_FORM_DATA, TARGET_FORM_DATA)
