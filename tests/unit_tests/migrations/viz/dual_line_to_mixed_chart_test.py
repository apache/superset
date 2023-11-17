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

from superset.migrations.shared.migrate_viz import MigrateDualLine
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

ADHOC_FILTERS = [
    {
        "clause": "WHERE",
        "comparator": ["CA", "FL"],
        "expressionType": "SIMPLE",
        "operator": "IN",
        "subject": "state",
    }
]

SOURCE_FORM_DATA: dict[str, Any] = {
    "metric": "num_boys",
    "y_axis_format": ",d",
    "y_axis_bounds": [50, 100],
    "metric_2": "num_girls",
    "y_axis_2_format": ",d",
    "y_axis_2_bounds": [75, 150],
    "viz_type": "dual_line",
    "adhoc_filters": ADHOC_FILTERS,
    "x_axis_format": "smart_date",
    "color_scheme": "bnbColors",
    "yAxisIndex": 0,
}

TARGET_FORM_DATA: dict[str, Any] = {
    "metrics": ["num_boys"],
    "y_axis_format": ",d",
    "y_axis_bounds": [50, 100],
    "y_axis_bounds_secondary": [75, 150],
    "metrics_b": ["num_girls"],
    "y_axis_format_secondary": ",d",
    "viz_type": "mixed_timeseries",
    "adhoc_filters": ADHOC_FILTERS,
    "adhoc_filters_b": ADHOC_FILTERS,
    "x_axis_time_format": "smart_date",
    "color_scheme": "bnbColors",
    "form_data_bak": SOURCE_FORM_DATA,
    "yAxisIndex": 0,
    "yAxisIndexB": 1,
    "truncateYAxis": True,
}


def test_migration() -> None:
    source = SOURCE_FORM_DATA.copy()
    target = TARGET_FORM_DATA.copy()
    migrate_and_assert(MigrateDualLine, source, target)
