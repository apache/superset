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

from superset.commands.chart.importers.v1.utils import migrate_chart


def test_migrate_chart_area() -> None:
    """
    Test the ``migrate_chart`` command when importing an area chart.

    This is currently a no-op since the migration is not complete.
    """
    chart_config = {
        "slice_name": "Birth names by state",
        "description": None,
        "certified_by": None,
        "certification_details": None,
        "viz_type": "echarts_area",
        "query_context": None,
        "params": json.dumps(
            {
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "subject": "ds",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                    }
                ],
                "annotation_layers": [],
                "x_axis_title_margin": "auto",
                "color_scheme": "supersetColors",
                "comparison_type": "values",
                "dashboards": [],
                "datasource": "21__table",
                "extra_form_data": {},
                "granularity_sqla": "ds",
                "groupby": ["state"],
                "line_interpolation": "linear",
                "metrics": ["count"],
                "order_desc": True,
                "rich_tooltip": True,
                "rolling_type": "None",
                "row_limit": 10000,
                "show_brush": "auto",
                "show_legend": True,
                "stacked_style": "stack",
                "time_grain_sqla": "P1D",
                "time_range": "No filter",
                "viz_type": "area",
                "x_axis_format": "smart_date",
                "x_ticks_layout": "auto",
                "y_axis_bounds": [None, None],
                "y_axis_format": "SMART_NUMBER",
            }
        ),
        "cache_timeout": None,
        "uuid": "ffd15af2-2188-425c-b6b4-df28aac45872",
        "version": "1.0.0",
        "dataset_uuid": "a18b9cb0-b8d3-42ed-bd33-0f0fadbf0f6d",
    }

    new_config = migrate_chart(chart_config)
    assert new_config == chart_config


def test_migrate_pivot_table() -> None:
    """
    Test the ``migrate_chart`` command when importing an old pivot table.
    """
    chart_config = {
        "slice_name": "Pivot Table",
        "description": None,
        "certified_by": None,
        "certification_details": None,
        "viz_type": "pivot_table",
        "params": json.dumps(
            {
                "columns": ["state"],
                "compare_lag": "10",
                "compare_suffix": "o10Y",
                "granularity_sqla": "ds",
                "groupby": ["name"],
                "limit": "25",
                "markup_type": "markdown",
                "metrics": [
                    {
                        "aggregate": "SUM",
                        "column": {
                            "column_name": "num",
                            "type": "BIGINT",
                        },
                        "expressionType": "SIMPLE",
                        "label": "Births",
                        "optionName": "metric_11",
                    },
                ],
                "row_limit": 50000,
                "since": "100 years ago",
                "time_range": "No filter",
                "time_range_endpoints": ["inclusive", "exclusive"],
                "until": "now",
                "viz_type": "pivot_table",
            },
        ),
        "cache_timeout": None,
        "uuid": "ffd15af2-2188-425c-b6b4-df28aac45872",
        "version": "1.0.0",
        "dataset_uuid": "a18b9cb0-b8d3-42ed-bd33-0f0fadbf0f6d",
    }

    new_config = migrate_chart(chart_config)
    assert new_config == {
        "slice_name": "Pivot Table",
        "description": None,
        "certified_by": None,
        "certification_details": None,
        "viz_type": "pivot_table_v2",
        "params": json.dumps(
            {
                "groupbyColumns": ["state"],
                "compare_lag": "10",
                "compare_suffix": "o10Y",
                "groupbyRows": ["name"],
                "limit": "25",
                "markup_type": "markdown",
                "metrics": [
                    {
                        "aggregate": "SUM",
                        "column": {"column_name": "num", "type": "BIGINT"},
                        "expressionType": "SIMPLE",
                        "label": "Births",
                        "optionName": "metric_11",
                    }
                ],
                "series_limit": 50000,
                "since": "100 years ago",
                "time_range_endpoints": ["inclusive", "exclusive"],
                "until": "now",
                "viz_type": "pivot_table_v2",
                "rowOrder": "value_z_to_a",
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "subject": "ds",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                    }
                ],
            }
        ),
        "cache_timeout": None,
        "uuid": "ffd15af2-2188-425c-b6b4-df28aac45872",
        "version": "1.0.0",
        "dataset_uuid": "a18b9cb0-b8d3-42ed-bd33-0f0fadbf0f6d",
    }
