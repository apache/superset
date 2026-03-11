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

from superset.migrations.shared.migrate_viz import MigrateBarChart, MigrateDistBarChart
from tests.unit_tests.migrations.viz.utils import (
    migrate_and_assert,
    TIMESERIES_SOURCE_FORM_DATA,
    TIMESERIES_TARGET_FORM_DATA,
)


def test_bar_migration() -> None:
    source_form_data: dict[str, Any] = {
        "viz_type": "bar",
        "show_bar_value": True,
        "bar_stacked": True,
    }

    target_form_data: dict[str, Any] = {
        "form_data_bak": source_form_data,
        "viz_type": "echarts_timeseries_bar",
        "show_value": True,
        "stack": "Stack",
    }
    source_form_data.update(TIMESERIES_SOURCE_FORM_DATA)
    target_form_data.update(TIMESERIES_TARGET_FORM_DATA)
    migrate_and_assert(MigrateBarChart, source_form_data, target_form_data)


def test_dist_bar_migration() -> None:
    source_form_data: dict[str, Any] = {
        "viz_type": "dist_bar",
        "show_bar_value": True,
        "bar_stacked": True,
        "groupby": ["column_a", "column_b"],
        "columns": ["column_c", "column_d"],
    }

    target_form_data: dict[str, Any] = {
        "form_data_bak": source_form_data,
        "viz_type": "echarts_timeseries_bar",
        "show_value": True,
        "stack": "Stack",
        "x_axis": "column_a",
        "groupby": ["column_b", "column_c", "column_d"],
    }
    source_form_data.update(TIMESERIES_SOURCE_FORM_DATA)
    target_form_data.update(TIMESERIES_TARGET_FORM_DATA)
    migrate_and_assert(MigrateDistBarChart, source_form_data, target_form_data)
