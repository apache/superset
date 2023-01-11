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

from superset.app import SupersetApp
from superset.migrations.shared.migrate_viz import MigrateAreaChart

area_form_data = """{
  "adhoc_filters": [],
  "annotation_layers": [],
  "bottom_margin": "auto",
  "color_scheme": "lyftColors",
  "comparison_type": "values",
  "contribution": true,
  "datasource": "2__table",
  "extra_form_data": {},
  "granularity_sqla": "ds",
  "groupby": [
    "gender"
  ],
  "line_interpolation": "linear",
  "metrics": [
    "sum__num"
  ],
  "order_desc": true,
  "rich_tooltip": true,
  "rolling_type": "None",
  "row_limit": 10000,
  "show_brush": "auto",
  "show_controls": true,
  "show_legend": true,
  "slice_id": 165,
  "stacked_style": "stack",
  "time_grain_sqla": "P1D",
  "time_range": "No filter",
  "viz_type": "area",
  "x_axis_format": "smart_date",
  "x_axis_label": "x asix label",
  "x_axis_showminmax": false,
  "x_ticks_layout": "auto",
  "y_axis_bounds": [
    null,
    null
  ],
  "y_axis_format": "SMART_NUMBER"
}
"""


def test_area_migrate(app_context: SupersetApp) -> None:
    from superset.models.slice import Slice

    slc = Slice(
        viz_type=MigrateAreaChart.source_viz_type,
        datasource_type="table",
        params=area_form_data,
        query_context=f'{{"form_data": {area_form_data}}}',
    )

    slc = MigrateAreaChart.upgrade_slice(slc)
    assert slc.viz_type == MigrateAreaChart.target_viz_type
    # verify form_data
    new_form_data = json.loads(slc.params)
    assert new_form_data["contributionMode"] == "row"
    assert "contribution" not in new_form_data
    assert new_form_data["show_extra_controls"] is True
    assert new_form_data["stack"] == "Stack"
    assert new_form_data["x_axis_title"] == "x asix label"
    assert new_form_data["x_axis_title_margin"] == 30
    assert json.dumps(new_form_data["form_data_bak"], sort_keys=True) == json.dumps(
        json.loads(area_form_data), sort_keys=True
    )

    # verify query_context
    new_query_context = json.loads(slc.query_context)
    assert (
        new_query_context["form_data"]["viz_type"] == MigrateAreaChart.target_viz_type
    )

    # downgrade
    slc = MigrateAreaChart.downgrade_slice(slc)
    assert slc.viz_type == MigrateAreaChart.source_viz_type
    assert json.dumps(json.loads(slc.params), sort_keys=True) == json.dumps(
        json.loads(area_form_data), sort_keys=True
    )
