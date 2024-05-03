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
import json
from typing import Any

from superset.migrations.shared.migrate_viz import MigrateViz

TIMESERIES_SOURCE_FORM_DATA: dict[str, Any] = {
    "bottom_margin": 20,
    "comparison_type": "absolute",
    "contribution": True,
    "left_margin": 20,
    "rich_tooltip": True,
    "rolling_type": "sum",
    "show_brush": "yes",
    "show_controls": True,
    "show_legend": True,
    "show_markers": True,
    "time_compare": "1 year",
    "x_axis_label": "x",
    "x_axis_format": "SMART_DATE",
    "x_ticks_layout": "45°",
    "y_axis_bounds": [0, 100],
    "y_axis_format": "SMART_NUMBER",
    "y_axis_label": "y",
    "y_axis_showminmax": True,
    "y_log_scale": True,
}

TIMESERIES_TARGET_FORM_DATA: dict[str, Any] = {
    "comparison_type": "difference",
    "contributionMode": "row",
    "logAxis": True,
    "markerEnabled": True,
    "rich_tooltip": True,
    "rolling_type": "sum",
    "show_extra_controls": True,
    "show_legend": True,
    "time_compare": ["1 year ago"],
    "truncateYAxis": True,
    "x_axis_title_margin": 20,
    "y_axis_title_margin": 20,
    "x_axis_title": "x",
    "x_axis_time_format": "SMART_DATE",
    "xAxisLabelRotation": 45,
    "y_axis_bounds": [0, 100],
    "y_axis_format": "SMART_NUMBER",
    "y_axis_title": "y",
    "zoomable": True,
}


def migrate_and_assert(
    cls: type[MigrateViz], source: dict[str, Any], target: dict[str, Any]
) -> None:
    from superset.models.slice import Slice

    dumped_form_data = json.dumps(source)

    slc = Slice(
        viz_type=cls.source_viz_type,
        datasource_type="table",
        params=dumped_form_data,
        query_context=f'{{"form_data": {dumped_form_data}}}',
    )

    # upgrade
    cls.upgrade_slice(slc)

    # verify form_data
    new_form_data = json.loads(slc.params)
    assert new_form_data == target
    assert new_form_data["form_data_bak"] == source

    # verify query_context
    new_query_context = json.loads(slc.query_context)
    assert new_query_context["form_data"]["viz_type"] == cls.target_viz_type

    # downgrade
    cls.downgrade_slice(slc)
    assert slc.viz_type == cls.source_viz_type
    assert json.loads(slc.params) == source
