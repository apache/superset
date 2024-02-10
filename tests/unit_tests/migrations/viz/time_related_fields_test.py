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
    "granularity_sqla": "ds",
    "time_range": "100 years ago : now",
    "viz_type": "pivot_table",
}

TARGET_FORM_DATA: dict[str, Any] = {
    "form_data_bak": SOURCE_FORM_DATA,
    "granularity_sqla": "ds",
    "rowOrder": "value_z_to_a",
    "time_range": "100 years ago : now",
    "viz_type": "pivot_table_v2",
}


def test_migration() -> None:
    source = SOURCE_FORM_DATA.copy()
    target = TARGET_FORM_DATA.copy()
    target["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": "100 years ago : now",
            "expressionType": "SIMPLE",
            "operator": "TEMPORAL_RANGE",
            "subject": "ds",
        }
    ]
    target.pop("granularity_sqla")
    target.pop("time_range")
    upgrade_downgrade(source, target)


def test_custom_sql_time_column() -> None:
    source = SOURCE_FORM_DATA.copy()
    source["granularity_sqla"] = {
        "expressionType": "SQL",
        "label": "ds",
        "sqlExpression": "sum(ds)",
    }
    target = TARGET_FORM_DATA.copy()
    target["adhoc_filters"] = [
        {
            "clause": "WHERE",
            "comparator": None,
            "expressionType": "SQL",
            "operator": "TEMPORAL_RANGE",
            "sqlExpression": "sum(ds)",
            "subject": "ds",
        }
    ]
    target["form_data_bak"] = source
    target.pop("granularity_sqla")
    target.pop("time_range")
    upgrade_downgrade(source, target)


def upgrade_downgrade(source, target) -> None:
    migrate_and_assert(MigratePivotTable, source, target)
