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

from superset.migrations.shared.migrate_viz import MigrateHistogramChart
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

SOURCE_FORM_DATA: dict[str, Any] = {
    "all_columns_x": ["category"],
    "adhoc_filters": [],
    "cumulative": True,
    "linear_color_scheme": "blue",
    "link_length": "5",
    "normalized": True,
    "row_limit": 100,
    "viz_type": "histogram",
    "x_axis_label": "X",
    "y_axis_label": "Y",
}

TARGET_FORM_DATA: dict[str, Any] = {
    "adhoc_filters": [],
    "bins": 5,
    "column": "category",
    "cumulative": True,
    "form_data_bak": SOURCE_FORM_DATA,
    "groupby": [],
    "linear_color_scheme": "blue",
    "normalize": True,
    "row_limit": 100,
    "viz_type": "histogram_v2",
    "x_axis_title": "X",
    "y_axis_title": "Y",
}


def test_migration() -> None:
    migrate_and_assert(MigrateHistogramChart, SOURCE_FORM_DATA, TARGET_FORM_DATA)
