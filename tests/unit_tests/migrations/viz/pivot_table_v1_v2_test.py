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

from superset.migrations.shared.migrate_viz import MigratePivotTable
from tests.unit_tests.migrations.viz.utils import migrate_and_assert

SOURCE_FORM_DATA: dict[str, Any] = {
    "any_other_key": "untouched",
    "columns": ["state"],
    "combine_metric": True,
    "groupby": ["name"],
    "number_format": "SMART_NUMBER",
    "pandas_aggfunc": "sum",
    "pivot_margins": True,
    "timeseries_limit_metric": "count",
    "transpose_pivot": True,
    "viz_type": "pivot_table",
}

TARGET_FORM_DATA: dict[str, Any] = {
    "any_other_key": "untouched",
    "aggregateFunction": "Sum",
    "colTotals": True,
    "colSubTotals": True,
    "combineMetric": True,
    "form_data_bak": SOURCE_FORM_DATA,
    "groupbyColumns": ["state"],
    "groupbyRows": ["name"],
    "rowOrder": "value_z_to_a",
    "series_limit_metric": "count",
    "transposePivot": True,
    "valueFormat": "SMART_NUMBER",
    "viz_type": "pivot_table_v2",
}


def test_migration() -> None:
    migrate_and_assert(MigratePivotTable, SOURCE_FORM_DATA, TARGET_FORM_DATA)
