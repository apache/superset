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

from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from superset import db
from superset.commands.chart.restore import RestoreChartCommand
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.mcp_service.dashboard.tool.duplicate_dashboard import _build_copy_payload
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


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
    empty_node: dict[str, object] = {
        "id": "CHART-empty",
        "type": "CHART",
        "children": [],
        "meta": {"chartId": None, "width": 4, "height": 50},
    }
    positions["CHART-empty"] = empty_node
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
    assert result.position["CHART-empty"] == {
        **empty_node,
        "type": "MARKDOWN",
        "meta": {"width": 4, "height": 50, "code": "This chart no longer exists."},
    }
    assert source.position_json == source_layout


@pytest.mark.parametrize("fresh_collection", [False, True])
@pytest.mark.parametrize("duplicate_slices", [False, True])
@pytest.mark.parametrize("mcp_payload", [False, True])
@with_feature_flags(SOFT_DELETE=True)
def test_copy_archived_slot_policy_and_restore(
    session: Session, fresh_collection: bool, duplicate_slices: bool, mcp_payload: bool
) -> None:
    """Archived originals reattach to the source, never to a chart-cloning copy."""
    Dashboard.metadata.create_all(session.get_bind())
    dataset: SqlaTable = SqlaTable(
        table_name="archive_copy",
        database=Database(database_name="archive_copy", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    live: Slice = Slice(
        slice_name="live", datasource_type="table", datasource_id=dataset.id
    )
    archived: Slice = Slice(
        slice_name="archived",
        datasource_type="table",
        datasource_id=dataset.id,
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    source: Dashboard = Dashboard(dashboard_title="source", slices=[live, archived])
    db.session.add(source)
    db.session.flush()
    positions: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "children": ["ROW"]},
        "ROW": {"type": "ROW", "children": ["LIVE", "ARCHIVED"]},
        "LIVE": {"type": "CHART", "meta": {"chartId": live.id}},
        "ARCHIVED": {
            "id": "ARCHIVED",
            "type": "CHART",
            "parents": ["ROOT", "ROW"],
            "children": [],
            "meta": {
                "chartId": str(archived.id),
                "uuid": str(archived.uuid),
                "width": 6,
                "height": 42,
            },
        },
    }
    source.position_json = json.dumps(positions)
    source.json_metadata = json.dumps({"color_scheme": "supersetColors"})
    source_layout: str = source.position_json
    source_metadata: str = source.json_metadata
    source_ids: set[int] = {live.id, archived.id}
    db.session.flush()
    if fresh_collection:
        db.session.expire(source, ["slices"])
    payload: dict[str, Any] = {
        "dashboard_title": "copy",
        "duplicate_slices": duplicate_slices,
        "json_metadata": json.dumps({"positions": positions}),
    }
    if mcp_payload:
        payload, _ = _build_copy_payload(source, "copy", duplicate_slices)
    with (
        patch("superset.daos.dashboard.security_manager.is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied: Dashboard = DashboardDAO.copy_dashboard(
            source,
            payload,
        )
    copy_layout: str = copied.position_json
    node: dict[str, Any] = copied.position["ARCHIVED"]
    if duplicate_slices:
        assert node == {
            "id": "ARCHIVED",
            "type": "MARKDOWN",
            "parents": ["ROOT_ID", "ROW"] if mcp_payload else ["ROOT", "ROW"],
            "children": [],
            "meta": {
                "width": 6,
                "height": 42,
                "code": "This archived chart was not copied.",
            },
        }
        assert copied.position["ROW"]["children"] == positions["ROW"]["children"]
        assert len(copied.slices) == 1
        assert copied.slices[0].id not in source_ids
        assert copied.position["LIVE"]["meta"]["chartId"] == copied.slices[0].id
        assert copied.position["LIVE"]["meta"]["uuid"] == str(copied.slices[0].uuid)
    else:
        assert node["type"] == "CHART"
        assert {chart.id for chart in copied.slices} == source_ids
    if mcp_payload:
        assert copied.position["ROW"]["parents"] == ["ROOT_ID"]
        assert copied.position["LIVE"]["parents"] == ["ROOT_ID", "ROW"]
        assert node["parents"] == ["ROOT_ID", "ROW"]
    else:
        assert copied.position["ROW"] == positions["ROW"]
    assert source.position_json == source_layout
    assert source.json_metadata == source_metadata

    # Exercise the actual restore command, not a simulated relationship edit.
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        RestoreChartCommand(str(archived.uuid)).run()
    db.session.expire_all()
    assert archived.deleted_at is None
    assert {chart.id for chart in source.slices} == source_ids
    assert source.position_json == source_layout
    assert source.json_metadata == source_metadata
    assert copied.position_json == copy_layout
    if duplicate_slices:
        assert archived.id not in {chart.id for chart in copied.slices}
        assert copied.id not in {dashboard.id for dashboard in archived.dashboards}
        # Saving the copy again must not reconstruct a hidden archived link.
        DashboardDAO.set_dash_metadata(copied, {"positions": copied.position})
        db.session.flush()
        assert archived.id not in {chart.id for chart in copied.slices}
    else:
        assert {chart.id for chart in copied.slices} == source_ids
