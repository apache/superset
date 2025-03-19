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
from copy import deepcopy
from importlib import import_module
from typing import Any

migrate_time_comparison_to_new_format = import_module(
    "superset.migrations.versions."
    "2024-05-10_18-02_f84fde59123a_update_charts_with_old_time_comparison",
)
downgrade_comparison_params = (
    migrate_time_comparison_to_new_format.downgrade_comparison_params
)
upgrade_comparison_params = (
    migrate_time_comparison_to_new_format.upgrade_comparison_params
)

# Base object containing common properties
base_params: dict[str, Any] = {
    "datasource": "2__table",
    "viz_type": "pop_kpi",
    "metric": {
        "expressionType": "SIMPLE",
        "column": {
            "advanced_data_type": None,
            "certification_details": None,
            "certified_by": None,
            "column_name": "num_boys",
            "description": None,
            "expression": None,
            "filterable": True,
            "groupby": True,
            "id": 334,
            "is_certified": False,
            "is_dttm": False,
            "python_date_format": None,
            "type": "BIGINT",
            "type_generic": 0,
            "verbose_name": None,
            "warning_markdown": None,
        },
        "aggregate": "SUM",
        "sqlExpression": None,
        "datasourceWarning": False,
        "hasCustomLabel": False,
        "label": "SUM(num_boys)",
    },
    "adhoc_filters": [
        {
            "expressionType": "SIMPLE",
            "subject": "ds",
            "operator": "TEMPORAL_RANGE",
            "comparator": "1984 : 2000",
            "clause": "WHERE",
            "sqlExpression": None,
            "isExtra": False,
            "isNew": False,
            "datasourceWarning": False,
        }
    ],
    "row_limit": 10000,
    "y_axis_format": "SMART_NUMBER",
    "percentDifferenceFormat": "SMART_NUMBER",
    "header_font_size": 0.2,
    "subheader_font_size": 0.125,
    "comparison_color_scheme": "Green",
    "extra_form_data": {},
    "dashboards": [],
}

# Specific parameter objects overriding only the differing properties
params_v1_with_custom: dict[str, Any] = {
    **base_params,
    "metric": {
        **base_params["metric"],
        "optionName": "metric_o6rj1h6jty_3t6mrruogfv",
    },
    "adhoc_filters": [
        {
            **base_params["adhoc_filters"][0],
            "comparator": "1984 : 1986",
            "filterOptionName": "filter_p50i4xw50d_8x8e4ypwjs8",
        }
    ],
    "time_comparison": "c",
    "enable_time_comparison": True,
    "adhoc_custom": [
        {
            "expressionType": "SIMPLE",
            "subject": "ds",
            "operator": "TEMPORAL_RANGE",
            "comparator": "1981-01-01 : 1983-01-01",
            "clause": "WHERE",
            "sqlExpression": None,
            "isExtra": False,
            "isNew": False,
            "datasourceWarning": False,
        }
    ],
}

params_v1_other_than_custom: dict[str, Any] = {
    **base_params,
    "metric": {
        **base_params["metric"],
        "optionName": "metric_96s7b8iypsr_4wrlgm0i7il",
    },
    "time_comparison": "r",
    "enable_time_comparison": True,
    "adhoc_custom": [
        {
            "clause": "WHERE",
            "subject": "ds",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
            "expressionType": "SIMPLE",
        }
    ],
}

params_v1_other_than_custom_false: dict[str, Any] = {
    **params_v1_other_than_custom,
    "enable_time_comparison": False,
}

params_v2_with_custom: dict[str, Any] = {
    **base_params,
    "metric": {
        **base_params["metric"],
        "optionName": "metric_o6rj1h6jty_3t6mrruogfv",
    },
    "adhoc_filters": [
        {
            **base_params["adhoc_filters"][0],
            "comparator": "1984 : 1986",
            "filterOptionName": "filter_p50i4xw50d_8x8e4ypwjs8",
        }
    ],
    "time_compare": ["custom"],
    "comparison_type": "values",
    "start_date_offset": "1981-01-01",
}

params_v2_other_than_custom: dict[str, Any] = {
    **base_params,
    "metric": {
        **base_params["metric"],
        "optionName": "metric_96s7b8iypsr_4wrlgm0i7il",
    },
    "time_compare": ["inherit"],
    "comparison_type": "values",
}

params_v2_other_than_custom_false: dict[str, Any] = {
    **params_v2_other_than_custom,
    "time_compare": [],
}


def test_upgrade_chart_params_with_custom():
    """
    ensure that the new time comparison params are added
    """
    original_params = deepcopy(params_v1_with_custom)
    upgraded_params = upgrade_comparison_params(original_params)
    assert upgraded_params == params_v2_with_custom


def test_downgrade_chart_params_with_custom():
    """
    ensure that the params downgrade operation produces an almost identical dict
    as the original value
    """
    original_params = deepcopy(params_v2_with_custom)
    downgraded_params = downgrade_comparison_params(original_params)
    # Ignore any property called filterOptionName simce that uses a random hash
    for adhoc_custom in downgraded_params["adhoc_custom"]:
        adhoc_custom.pop("filterOptionName", None)
    assert downgraded_params == params_v1_with_custom


def test_upgrade_chart_params_other_than_custom():
    """
    ensure that the new time comparison params are added
    """
    original_params = deepcopy(params_v1_other_than_custom)
    upgraded_params = upgrade_comparison_params(original_params)
    assert upgraded_params == params_v2_other_than_custom


def test_downgrade_chart_params_other_than_custom():
    """
    ensure that the params downgrade operation produces an almost identical dict
    as the original value
    """
    original_params = deepcopy(params_v2_other_than_custom)
    downgraded_params = downgrade_comparison_params(original_params)
    assert downgraded_params == params_v1_other_than_custom


def test_upgrade_chart_params_other_than_custom_false():
    """
    ensure that the new time comparison params are added
    """
    original_params = deepcopy(params_v1_other_than_custom_false)
    upgraded_params = upgrade_comparison_params(original_params)
    assert upgraded_params == params_v2_other_than_custom_false


def test_downgrade_chart_params_other_than_custom_false():
    """
    ensure that the params downgrade operation produces an almost identical dict
    as the original value
    """
    original_params = deepcopy(params_v2_other_than_custom_false)
    downgraded_params = downgrade_comparison_params(original_params)
    assert downgraded_params == params_v1_other_than_custom_false
