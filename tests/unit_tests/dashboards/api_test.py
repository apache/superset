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
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.dashboards.schemas import DashboardGetResponseSchema
from superset.utils import json


@pytest.fixture
def mock_dashboard() -> MagicMock:
    dash = MagicMock()
    # Real Dashboard objects are not subscriptable. Without this, marshmallow's
    # get_value reads ``dash["changed_on"]`` (which a MagicMock happily returns
    # as another mock) instead of the attribute, and marshmallow 4's DateTime
    # field then fails serializing the mock via datetime.isoformat().
    dash.__getitem__.side_effect = TypeError
    dash.id = 1
    dash.slug = "test-slug"
    dash.url = "/superset/dashboard/test-slug/"
    dash.dashboard_title = "Test Dashboard"
    dash.thumbnail_url = "http://example.com/thumb.png"
    dash.published = True
    dash.css = ""
    dash.theme = None
    dash.json_metadata = "{}"
    dash.position_json = "{}"
    dash.certified_by = None
    dash.certification_details = None
    dash.changed_by_name = "admin"
    dash.changed_by = MagicMock(id=1, first_name="admin", last_name="user")
    dash.changed_on = None
    dash.changed_on_humanized = "2 days ago"
    dash.created_by = MagicMock(id=1, first_name="admin", last_name="user")
    dash.created_on_humanized = "5 days ago"
    dash.charts = []
    dash.editors = []
    dash.viewers = []
    dash.tags = []
    dash.custom_tags = []
    dash.is_managed_externally = False
    dash.uuid = None
    return dash


def test_schema_column_selection_excludes_thumbnail(
    mock_dashboard: MagicMock,
) -> None:
    schema = DashboardGetResponseSchema(only=["id", "dashboard_title"])
    result = schema.dump(mock_dashboard)
    assert "id" in result
    assert "dashboard_title" in result
    assert "thumbnail_url" not in result
    assert "slug" not in result


def test_schema_column_selection_with_data_key(
    mock_dashboard: MagicMock,
) -> None:
    """Fields with data_key should work when using the internal field name."""
    schema = DashboardGetResponseSchema(only=["id", "changed_on_humanized"])
    result = schema.dump(mock_dashboard)
    assert "id" in result
    assert "changed_on_delta_humanized" in result
    assert "dashboard_title" not in result


def test_schema_full_response_includes_thumbnail(
    mock_dashboard: MagicMock,
) -> None:
    schema = DashboardGetResponseSchema()
    result = schema.dump(mock_dashboard)
    assert "thumbnail_url" in result
    assert "id" in result
    assert "dashboard_title" in result


def test_data_key_mapping_logic() -> None:
    """The key_to_name mapping used in the API correctly maps data_key to field name."""
    schema = DashboardGetResponseSchema()
    key_to_name = {
        field.data_key or name: name for name, field in schema.fields.items()
    }
    # changed_on_delta_humanized is the data_key for changed_on_humanized
    assert key_to_name["changed_on_delta_humanized"] == "changed_on_humanized"
    assert key_to_name["created_on_delta_humanized"] == "created_on_humanized"
    # fields without data_key map to themselves
    assert key_to_name["id"] == "id"
    assert key_to_name["thumbnail_url"] == "thumbnail_url"


def test_schema_strips_sensitive_fields_for_guest_user(
    mock_dashboard: MagicMock,
) -> None:
    """Guest users should not see editors, viewers, or changed_by."""
    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.security_manager") as mock_sm:
        mock_sm.is_guest_user = MagicMock(return_value=True)
        result = schema.dump(mock_dashboard)

    assert "editors" not in result
    assert "viewers" not in result
    assert "changed_by_name" not in result
    assert "changed_by" not in result
    assert "id" in result
    assert "dashboard_title" in result


def test_schema_includes_all_fields_for_regular_user(
    mock_dashboard: MagicMock,
) -> None:
    """Regular users should see editors, viewers, and changed_by."""
    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.security_manager") as mock_sm:
        mock_sm.is_guest_user = MagicMock(return_value=False)
        result = schema.dump(mock_dashboard)

    assert "editors" in result
    assert "viewers" in result
    assert "changed_by_name" in result
    assert "changed_by" in result


ROOT = {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}
GRID = {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]}
TAB_1 = {"id": "TAB-1", "type": "TAB", "meta": {"text": "Kept"}, "children": []}


def _layout(tabs_children: list[str]) -> dict[str, Any]:
    return {
        "ROOT_ID": ROOT,
        "GRID_ID": GRID,
        "TABS-1": {"id": "TABS-1", "type": "TABS", "children": tabs_children},
        "TAB-1": TAB_1,
    }


def _store_dashboard(position_json: str) -> int:
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())
    dashboard = Dashboard(
        dashboard_title="broken layout",
        position_json=position_json,
        json_metadata="{}",
    )
    db.session.add(dashboard)
    db.session.flush()
    return dashboard.id


@pytest.mark.parametrize(
    "stored",
    [
        # A tab bar pointing at a tab the layout does not hold. Walking it is
        # what used to raise, so the dashboard could not be written again.
        pytest.param(_layout(["TAB-1", "TAB-2"]), id="dangling child"),
        # A layout that reaches a node it has already reached. Walking it used
        # to never finish, so the request hung instead of failing.
        pytest.param({"ROOT_ID": {**ROOT, "children": ["ROOT_ID"]}}, id="cycle"),
    ],
)
def test_put_repairs_a_stored_layout_that_cannot_be_walked(
    stored: dict[str, Any],
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """A dashboard stored with an unwalkable layout can still be repaired.

    The layouts here are JSON-parseable, so they pass validation and reach the
    metadata database. Reading the tabs off them is what fails, and an update
    reads the stored tabs to find the deleted ones, so before this change the
    repair request itself failed and the dashboard stayed unwritable.
    """
    from superset.models.dashboard import Dashboard

    # ``full_api_access`` stops at the route decorators, so the row filter and
    # the editorship check still need a user the request does not have.
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    mocker.patch.object(security_manager, "raise_for_editorship")

    dashboard_id = _store_dashboard(json.dumps(stored))
    repaired = json.dumps(_layout(["TAB-1"]))

    response = client.put(
        f"/api/v1/dashboard/{dashboard_id}",
        json={"position_json": repaired},
    )

    assert response.status_code == 200
    assert json.loads(
        db.session.query(Dashboard).get(dashboard_id).position_json
    ) == json.loads(repaired)


def test_export_bundle_is_refused_without_a_user_id(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Enabling Excel export for guests or the Public role means granting
    ``can_export`` on Dashboard, which also authorizes this endpoint (and, for
    Public, lets FAB serve it unauthenticated). The bundle carries dataset SQL
    and database metadata a viewer never sees."""
    mocker.patch("superset.dashboards.api.get_user_id", return_value=None)

    response = client.get("/api/v1/dashboard/export/?q=!(1)")

    assert response.status_code == 403


def test_export_as_example_is_refused_without_a_user_id(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """``export_as_example`` carries ``@permission_name("export")``, so the same
    grant reaches it, and it emits dataset YAML plus Parquet rows."""
    mocker.patch("superset.dashboards.api.get_user_id", return_value=None)

    response = client.get("/api/v1/dashboard/1/export_as_example/")

    assert response.status_code == 403


def test_export_bundle_is_not_refused_for_logged_in_users(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    # 404 for the missing id, but the identity guard must not be what stops it.
    mocker.patch("superset.dashboards.api.get_user_id", return_value=1)

    response = client.get("/api/v1/dashboard/export/?q=!(1)")

    assert response.status_code != 403


def test_download_xlsx_is_never_cached(
    session: Session,
    client: Any,
    mocker: MockerFixture,
) -> None:
    """The login-free download URL is a bearer credential with a lifetime
    enforced by the link record; a shared cache must not outlive it."""
    from flask import current_app

    mocker.patch(
        "superset.dashboards.api.resolve_download_link",
        return_value=("bucket", "key", "unittest.mock.MagicMock"),
    )
    backend = MagicMock()
    backend.download.return_value = (2, iter([b"PK"]))
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(
            "/api/v1/dashboard/export_xlsx/download/00000000-0000-0000-0000-0000000000ab/"
        )

    assert response.status_code == 200
    cache_control = response.headers["Cache-Control"]
    assert "no-store" in cache_control
    assert "private" in cache_control
    assert response.headers["Pragma"] == "no-cache"


def test_download_xlsx_answers_head_without_a_body(
    session: Session,
    client: Any,
    mocker: MockerFixture,
) -> None:
    """The frontend confirms a link with HEAD before navigating to it, so an
    expired link becomes a toast rather than a navigation to an error page."""
    from flask import current_app

    mocker.patch(
        "superset.dashboards.api.resolve_download_link",
        return_value=("bucket", "key", "unittest.mock.MagicMock"),
    )
    backend = MagicMock()
    backend.download.return_value = (2, iter([b"PK"]))
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.head(
            "/api/v1/dashboard/export_xlsx/download/00000000-0000-0000-0000-0000000000ab/"
        )

    assert response.status_code == 200
    assert response.data == b""
    assert response.headers["Content-Length"] == "2"
    assert "attachment" in response.headers["Content-Disposition"]


def test_export_status_is_never_cached(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    # A cached "pending" would strand a poller on a stale answer.
    mocker.patch("superset.dashboards.api.get_export_status", return_value=None)

    response = client.get(
        "/api/v1/dashboard/export_xlsx/status/00000000-0000-0000-0000-0000000000ab/"
    )

    assert response.status_code == 200
    assert "no-store" in response.headers["Cache-Control"]
