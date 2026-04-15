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
# pylint: disable=invalid-name, use-implicit-booleaness-not-comparison

import copy
from typing import Any

from superset.legacy import update_time_range
from tests.unit_tests.conftest import with_feature_flags  # noqa: F401

original_form_data = {
    "granularity_sqla": "order_date",
    "datasource": "22__table",
    "viz_type": "table",
    "query_mode": "raw",
    "groupby": [],
    "time_grain_sqla": "P1D",
    "temporal_columns_lookup": {"order_date": True},
    "all_columns": ["order_date", "state", "product_code"],
    "percent_metrics": [],
    "adhoc_filters": [
        {
            "clause": "WHERE",
            "subject": "order_date",
            "operator": "TEMPORAL_RANGE",
            "comparator": "No filter",
            "expressionType": "SIMPLE",
        }
    ],
    "order_by_cols": [],
    "row_limit": 1000,
    "server_page_length": 10,
    "order_desc": True,
    "table_timestamp_format": "smart_date",
    "show_cell_bars": True,
    "color_pn": True,
    "extra_form_data": {},
    "dashboards": [19],
    "force": False,
    "result_format": "json",
    "result_type": "full",
    "include_time": False,
}


def test_update_time_range_since_until() -> None:
    """
    Tests for the old `since` and `until` parameters.
    """
    form_data: dict[str, Any]

    form_data = {}
    update_time_range(form_data)
    assert form_data == {}

    form_data = {"since": "yesterday"}
    update_time_range(form_data)
    assert form_data == {"time_range": "yesterday : "}

    form_data = {"until": "tomorrow"}
    update_time_range(form_data)
    assert form_data == {"time_range": " : tomorrow"}

    form_data = {"since": "yesterday", "until": "tomorrow"}
    update_time_range(form_data)
    assert form_data == {"time_range": "yesterday : tomorrow"}


def test_update_time_range_granularity_sqla_with_feature_flag() -> None:
    """
    Tests for the unfiltered `granularity_sqla`.
    """
    form_data = copy.deepcopy(original_form_data)
    update_time_range(form_data)
    assert form_data["time_range"] == "No filter"
