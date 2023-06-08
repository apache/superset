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

from superset.migrations.shared.migrate_viz import MigrateDualLine

ADHOC_FILTERS = [
    {
        "clause": "WHERE",
        "comparator": ["CA", "FL"],
        "expressionType": "SIMPLE",
        "operator": "IN",
        "subject": "state",
    }
]

SOURCE_FORM_DATA = {
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

TARGET_FORM_DATA = {
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
    upgrade_downgrade(source, target)


def upgrade_downgrade(source, target) -> None:
    from superset.models.slice import Slice

    dumped_form_data = json.dumps(source)

    slc = Slice(
        viz_type=MigrateDualLine.source_viz_type,
        datasource_type="table",
        params=dumped_form_data,
        query_context=f'{{"form_data": {dumped_form_data}}}',
    )

    # upgrade
    slc = MigrateDualLine.upgrade_slice(slc)

    # verify form_data
    new_form_data = json.loads(slc.params)
    assert new_form_data == target
    assert new_form_data["form_data_bak"] == source

    # verify query_context
    new_query_context = json.loads(slc.query_context)
    assert new_query_context["form_data"]["viz_type"] == "mixed_timeseries"

    # downgrade
    slc = MigrateDualLine.downgrade_slice(slc)
    assert slc.viz_type == MigrateDualLine.source_viz_type
    assert json.loads(slc.params) == source
