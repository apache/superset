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
"""Copy remapping must use the same legacy-ID normalization as validation."""

from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from superset import db
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json


@pytest.mark.parametrize("legacy_form", ["string", "float"])
def test_copy_normalizes_legacy_chart_ids(session: Session, legacy_form: str) -> None:
    """A valid legacy ID must reference its clone instead of becoming None."""
    Dashboard.metadata.create_all(session.get_bind())
    dataset: SqlaTable = SqlaTable(
        table_name="copy_legacy",
        database=Database(database_name="copy_legacy", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    chart: Slice = Slice(
        slice_name="source chart", datasource_type="table", datasource_id=dataset.id
    )
    source: Dashboard = Dashboard(dashboard_title="source", slices=[chart])
    db.session.add(source)
    db.session.flush()
    legacy_id: str | float = (
        str(chart.id) if legacy_form == "string" else float(chart.id)
    )
    positions: dict[str, Any] = {
        "CHART-source": {"type": "CHART", "meta": {"chartId": legacy_id}},
    }
    source.position_json = json.dumps(positions)
    source_layout: str = source.position_json
    with (
        patch("superset.daos.dashboard.security_manager.is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        result: Dashboard = DashboardDAO.copy_dashboard(
            source,
            {
                "dashboard_title": "copy",
                "json_metadata": json.dumps({"positions": positions}),
                "duplicate_slices": True,
            },
        )
    assert result.id is not None
    assert len(result.slices) == 1
    clone: Slice = result.slices[0]
    assert clone.id != chart.id
    assert result.position["CHART-source"]["meta"]["chartId"] == clone.id
    assert result.position["CHART-source"]["meta"]["uuid"] == str(clone.uuid)
    assert source.position_json == source_layout
