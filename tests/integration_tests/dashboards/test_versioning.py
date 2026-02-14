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
"""Integration tests for dashboard version snapshot and restore.

Uses the same fixture pattern as other dashboard integration tests
(tabbed_dashboard, etc.): app_context, login_as_admin, get_user, create_user,
and a fixture that creates dashboard + slice via superset_factory_util.

Which database do integration tests use?
  The app is created from tests.integration_tests.test_app, which loads
  tests.integration_tests.superset_test_config. That config sets:
  - SQLALCHEMY_DATABASE_URI to a SQLite file at
    <DATA_DIR>/unittests.integration_tests.db by default (DATA_DIR is
    SUPERSET_HOME or ~/.superset).
  - If SUPERSET__SQLALCHEMY_DATABASE_URI is set in the environment, that
    is used instead (e.g. CI uses PostgreSQL via scripts/tests/run.sh).
  If you get "Cannot connect to database" or password errors, unset
  SUPERSET__SQLALCHEMY_DATABASE_URI so the default SQLite DB is used.

To avoid failures (missing tables, wrong schema), use the same DB and run
migrations before pytest:

  unset SUPERSET__SQLALCHEMY_DATABASE_URI   # use default SQLite
  export SUPERSET_CONFIG=tests.integration_tests.superset_test_config
  superset db upgrade
  pytest tests/integration_tests/dashboards/test_versioning.py -v -s
"""

import logging
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset import db, security_manager
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.daos.dashboard_version import DashboardVersionDAO
from superset.utils import json
from tests.integration_tests.dashboards.dashboard_test_utils import random_str
from tests.integration_tests.dashboards.superset_factory_util import (
    create_dashboard_to_db,
    create_datasource_table_to_db,
    create_slice_to_db,
    delete_all_inserted_objects,
)
from tests.integration_tests.test_app import app

logger = logging.getLogger(__name__)


@pytest.fixture(autouse=True, scope="module")
def _log_integration_test_db():
    """Log which database URI integration tests use (same as test_app + config)."""
    with app.app_context():
        uri = app.config.get("SQLALCHEMY_DATABASE_URI", "NOT_SET")
        logger.info("Integration tests DB (test_versioning): %s", uri)
        # So it's visible when running: pytest .../test_versioning.py -v -s
        print(f"\n[test_versioning] SQLALCHEMY_DATABASE_URI = {uri}\n")
    return


def _layout_with_chart(slice_id: int, slice_uuid: str) -> dict[str, Any]:
    """Layout containing one CHART component."""
    chart_key = "CHART-versioning-test"
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["ROW-1"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Versioning test"},
            "type": "HEADER",
        },
        "ROW-1": {
            "children": [chart_key],
            "id": "ROW-1",
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
        chart_key: {
            "children": [],
            "id": chart_key,
            "meta": {
                "chartId": slice_id,
                "height": 50,
                "sliceName": "Versioning chart",
                "uuid": slice_uuid,
                "width": 4,
            },
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "type": "CHART",
        },
    }


def _layout_without_chart() -> dict[str, Any]:
    """Layout with no CHART (only ROOT, GRID, HEADER, ROW)."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["ROW-1"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Versioning test"},
            "type": "HEADER",
        },
        "ROW-1": {
            "children": [],
            "id": "ROW-1",
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
    }


def _chart_component_ids(position: dict[str, Any]) -> list[str]:
    """Return component ids that are CHART type."""
    return [
        comp_id
        for comp_id, comp in position.items()
        if isinstance(comp, dict) and comp.get("type") == "CHART"
    ]


@pytest.fixture
def versioning_dashboard_and_slice(app_context, get_user, create_user):
    """Dashboard + slice for versioning tests (same pattern as tabbed_dashboard)."""
    admin = get_user("admin")
    if not admin:
        admin = create_user("admin", "Admin", "general")
    # Unique name to avoid UNIQUE constraint on dbs.database_name when reusing
    # the same integration test DB (e.g. SQLite) across runs.
    table = create_datasource_table_to_db(name=f"versioning_test_table_{random_str()}")
    slice_obj = create_slice_to_db(
        name="versioning_test_chart",
        datasource_id=table.id,
        owners=[admin],
    )
    dashboard = create_dashboard_to_db(
        dashboard_title="Versioning test dashboard",
        slug="versioning-test-dashboard",
        position_json="{}",
        json_metadata="{}",
        owners=[admin],
        slices=[slice_obj],
    )
    yield dashboard, slice_obj
    delete_all_inserted_objects()


def test_restore_version_with_chart_removed_syncs_slices(
    versioning_dashboard_and_slice,
    login_as_admin,
):
    """Restoring a version that had a chart removed must clear dashboard_slices."""
    dashboard, slice_obj = versioning_dashboard_and_slice
    user = security_manager.get_user_by_username("admin")
    dashboard_id = dashboard.id
    slice_id = slice_obj.id
    slice_uuid = str(slice_obj.uuid)

    with patch("flask.g", MagicMock(user=user)):
        layout_v1 = _layout_with_chart(slice_id, slice_uuid)
        UpdateDashboardCommand(
            dashboard_id,
            {
                "position_json": json.dumps(layout_v1),
                "json_metadata": "{}",
                "owners": [user.id],
                "roles": [],
            },
        ).run()
    db.session.commit()

    versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
    assert len(versions) >= 1
    version_1 = versions[0]
    assert _chart_component_ids(json.loads(version_1.position_json or "{}"))

    with patch("flask.g", MagicMock(user=user)):
        layout_v2 = _layout_without_chart()
        UpdateDashboardCommand(
            dashboard_id,
            {
                "position_json": json.dumps(layout_v2),
                "json_metadata": "{}",
                "owners": [user.id],
                "roles": [],
            },
        ).run()
    db.session.commit()

    versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
    assert len(versions) >= 2
    version_2 = next(v for v in versions if v.version_number == 2)

    RestoreDashboardVersionCommand(dashboard_id, version_2.id).run()
    db.session.refresh(dashboard)

    assert len(dashboard.slices) == 0
    position = json.loads(dashboard.position_json or "{}")
    assert not _chart_component_ids(position)

    RestoreDashboardVersionCommand(dashboard_id, version_1.id).run()
    db.session.refresh(dashboard)

    assert len(dashboard.slices) == 1
    assert dashboard.slices[0].id == slice_id
    position = json.loads(dashboard.position_json or "{}")
    assert _chart_component_ids(position)


def test_restore_version_with_chart_present_syncs_slices(
    versioning_dashboard_and_slice,
    login_as_admin,
):
    """Restoring a version that had a chart must restore dashboard_slices."""
    dashboard, slice_obj = versioning_dashboard_and_slice
    user = security_manager.get_user_by_username("admin")
    dashboard_id = dashboard.id
    slice_id = slice_obj.id
    slice_uuid = str(slice_obj.uuid)

    with patch("flask.g", MagicMock(user=user)):
        layout_v1 = _layout_with_chart(slice_id, slice_uuid)
        UpdateDashboardCommand(
            dashboard_id,
            {
                "position_json": json.dumps(layout_v1),
                "json_metadata": "{}",
                "owners": [user.id],
                "roles": [],
            },
        ).run()
    db.session.commit()

    versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
    assert len(versions) >= 1
    version_1 = versions[0]

    RestoreDashboardVersionCommand(dashboard_id, version_1.id).run()
    db.session.refresh(dashboard)

    assert len(dashboard.slices) == 1
    assert dashboard.slices[0].id == slice_id
    position = json.loads(dashboard.position_json or "{}")
    assert _chart_component_ids(position)


def test_update_version_description_via_api(
    versioning_dashboard_and_slice,
    test_client,
    login_as,
):
    """PUT dashboard version updates the description and returns 200."""
    dashboard, slice_obj = versioning_dashboard_and_slice
    user = security_manager.get_user_by_username("admin")
    dashboard_id = dashboard.id
    slice_id = slice_obj.id
    slice_uuid = str(slice_obj.uuid)

    # Create a version with initial description via UpdateDashboardCommand.
    # Use a request context with g.user set so DAO/security_manager see the user.
    with app.test_request_context():
        from flask import g

        g.user = user
        layout = _layout_with_chart(slice_id, slice_uuid)
        UpdateDashboardCommand(
            dashboard_id,
            {
                "position_json": json.dumps(layout),
                "json_metadata": "{}",
                "owners": [user.id],
                "roles": [],
                "version_description": "Initial description",
            },
        ).run()
    db.session.commit()

    versions = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
    assert len(versions) >= 1
    version_1 = versions[0]
    assert version_1.description == "Initial description"

    # Log in then update description via API.
    # Patch has_access so the API accepts the request (fixture admin may not have
    # can_write on Dashboard if the test DB has not run full migrations).
    login_as("admin")
    uri = f"/api/v1/dashboard/{dashboard_id}/versions/{version_1.id}"
    with patch.object(security_manager, "has_access", return_value=True):
        rv = test_client.put(uri, json={"description": "Updated description"})
    assert rv.status_code == 200

    # Verify version description was updated
    db.session.expire_all()
    versions_after = DashboardVersionDAO.get_versions_for_dashboard(dashboard_id)
    version_after = next(v for v in versions_after if v.id == version_1.id)
    assert version_after.description == "Updated description"
