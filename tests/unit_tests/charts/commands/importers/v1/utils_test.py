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

from superset.charts.commands.importers.v1.utils import migrate_chart


def test_migrate_chart() -> None:
    """
    Test the ``migrate_chart`` command when importing a chart.
    """
    chart_config = {
        "slice_name": "Birth names by state",
        "description": None,
        "certified_by": None,
        "certification_details": None,
        "viz_type": "area",
        "params": json.dumps(
            {
                "datasource": "21__table",
                "viz_type": "area",
                "granularity_sqla": "ds",
                "time_grain_sqla": "P1D",
                "time_range": "No filter",
                "metrics": ["count"],
                "adhoc_filters": [],
                "groupby": ["state"],
                "order_desc": True,
                "row_limit": 10000,
                "show_brush": "auto",
                "show_legend": True,
                "line_interpolation": "linear",
                "stacked_style": "stack",
                "color_scheme": "supersetColors",
                "rich_tooltip": True,
                "bottom_margin": "auto",
                "x_ticks_layout": "auto",
                "x_axis_format": "smart_date",
                "y_axis_format": "SMART_NUMBER",
                "y_axis_bounds": [None, None],
                "rolling_type": "None",
                "comparison_type": "values",
                "annotation_layers": [],
                "extra_form_data": {},
                "dashboards": [],
            }
        ),
        "cache_timeout": None,
        "uuid": "ffd15af2-2188-425c-b6b4-df28aac45872",
        "version": "1.0.0",
        "dataset_uuid": "a18b9cb0-b8d3-42ed-bd33-0f0fadbf0f6d",
    }

    new_config = migrate_chart(chart_config)
    assert new_config == {
        "slice_name": "Birth names by state",
        "description": None,
        "certified_by": None,
        "certification_details": None,
        "viz_type": "echarts_area",
        "params": json.dumps(
            {
                "datasource": "21__table",
                "viz_type": "echarts_area",
                "time_grain_sqla": "P1D",
                "metrics": ["count"],
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "subject": "ds",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                    }
                ],
                "groupby": ["state"],
                "order_desc": True,
                "row_limit": 10000,
                "show_brush": "auto",
                "show_legend": True,
                "line_interpolation": "linear",
                "color_scheme": "supersetColors",
                "rich_tooltip": True,
                "bottom_margin": "auto",
                "x_ticks_layout": "auto",
                "x_axis_format": "smart_date",
                "y_axis_format": "SMART_NUMBER",
                "y_axis_bounds": [None, None],
                "rolling_type": "None",
                "comparison_type": "values",
                "annotation_layers": [],
                "extra_form_data": {},
                "dashboards": [],
                "show_extra_controls": True,
                "stack": "Stack",
                "x_axis": "ds",
            }
        ),
        "cache_timeout": None,
        "uuid": "ffd15af2-2188-425c-b6b4-df28aac45872",
        "version": "1.0.0",
        "dataset_uuid": "a18b9cb0-b8d3-42ed-bd33-0f0fadbf0f6d",
    }
