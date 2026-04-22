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

"""Tests for MCP user-directory privacy filtering."""

import pytest

from superset.mcp_service.chart.schemas import ChartInfo
from superset.mcp_service.dashboard.schemas import DashboardInfo
from superset.mcp_service.database.schemas import DatabaseInfo
from superset.mcp_service.dataset.schemas import DatasetInfo


@pytest.mark.parametrize(
    "model",
    [
        ChartInfo(
            id=1,
            slice_name="Revenue",
            created_by="creator",
            changed_by="modifier",
            owners=[],
        ),
        DashboardInfo(
            id=1,
            dashboard_title="Executive Dashboard",
            created_by="creator",
            changed_by="modifier",
            owners=[],
            roles=[],
        ),
        DatasetInfo(
            id=1,
            table_name="sales",
            created_by="creator",
            changed_by="modifier",
            owners=[],
        ),
        DatabaseInfo(
            id=1,
            database_name="warehouse",
            created_by="creator",
            changed_by="modifier",
        ),
    ],
)
def test_user_directory_fields_removed_from_python_and_json_dumps(model):
    """Privacy fields are stripped regardless of Pydantic serialization mode."""
    for mode in (None, "json"):
        data = model.model_dump() if mode is None else model.model_dump(mode=mode)

        for field in ("created_by", "changed_by", "owners", "roles"):
            assert field not in data
