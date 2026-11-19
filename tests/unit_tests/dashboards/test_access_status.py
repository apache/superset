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

"""Distinguish missing dashboards from dashboards the caller cannot access."""

from datetime import datetime
from importlib.resources import files
from inspect import unwrap
from uuid import UUID

import pytest
from flask import Flask
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import Role
from jinja2 import FileSystemLoader
from pytest_mock import MockerFixture
from sqlalchemy import false
from sqlalchemy.orm import Query, Session
from werkzeug.exceptions import Forbidden, NotFound

from superset import security_manager
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.daos.dashboard import DashboardDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard

DASHBOARD_UUID = "00000000-0000-0000-0000-000000000001"
IDENTIFIERS: list[int | str] = [1, "restricted-dashboard", DASHBOARD_UUID]


@pytest.fixture
def dashboard(session: Session) -> Dashboard:
    """Create a dashboard in the isolated unit-test database."""
    Dashboard.metadata.create_all(session.get_bind())
    result = Dashboard(
        id=1,
        slug="restricted-dashboard",
        uuid=UUID(DASHBOARD_UUID),
        dashboard_title="Restricted dashboard",
        published=True,
    )
    session.add(result)
    session.flush()
    return result


@pytest.fixture
def denied_filter(mocker: MockerFixture) -> None:
    """Hide dashboards through the same DAO access-filter boundary as the API."""

    def apply(query: Query, value: object) -> Query:
        """Apply an empty authorization scope to the query."""
        return query.filter(false())

    mocker.patch.object(
        DashboardDAO, "base_filter"
    ).return_value.apply.side_effect = apply


@pytest.fixture
def access_error() -> SupersetSecurityException:
    """Construct the error raised by the dashboard object-level gate."""
    return SupersetSecurityException(
        SupersetError(
            message="You don't have access to this dashboard.",
            error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )


@pytest.mark.parametrize("identifier", IDENTIFIERS[:2])
def test_filtered_existing_dashboard_is_forbidden(
    dashboard: Dashboard,
    denied_filter: None,
    identifier: int | str,
) -> None:
    """An existing dashboard hidden by access filters is denied, not missing."""
    with pytest.raises(DashboardAccessDeniedError):
        DashboardDAO.get_by_id_or_slug(identifier)


@pytest.mark.parametrize("identifier", IDENTIFIERS)
def test_dashboard_object_gate_is_enforced(
    dashboard: Dashboard,
    mocker: MockerFixture,
    access_error: SupersetSecurityException,
    identifier: int | str,
) -> None:
    """ID, slug, and UUID lookups retain object-level permission enforcement."""
    mocker.patch.object(DashboardDAO, "base_filter").return_value.apply.side_effect = (
        lambda query, value: query
    )
    gate = mocker.patch.object(Dashboard, "raise_for_access", side_effect=access_error)
    with pytest.raises(DashboardAccessDeniedError):
        DashboardDAO.get_by_id_or_slug(identifier)
    gate.assert_called_once()


@pytest.mark.parametrize("identifier", IDENTIFIERS)
def test_allowed_dashboard_is_returned(
    dashboard: Dashboard, mocker: MockerFixture, identifier: int | str
) -> None:
    """An allowed dashboard remains readable through every identifier type."""
    mocker.patch.object(DashboardDAO, "base_filter").return_value.apply.side_effect = (
        lambda query, value: query
    )
    gate = mocker.patch.object(Dashboard, "raise_for_access")
    assert DashboardDAO.get_by_id_or_slug(identifier) is dashboard
    gate.assert_called_once()


@pytest.mark.parametrize("identifier", IDENTIFIERS)
def test_dashboard_withheld_by_exclusion_hook_is_not_found(
    dashboard: Dashboard,
    mocker: MockerFixture,
    denied_filter: None,
    identifier: int | str,
) -> None:
    """Exclusion-hook dashboards stay indistinguishable from missing ones."""
    mocker.patch(
        "superset.daos.dashboard.is_excluded_by_extra_access", return_value=True
    )
    with pytest.raises(DashboardNotFoundError):
        DashboardDAO.get_by_id_or_slug(identifier)


@pytest.mark.parametrize("identifier", IDENTIFIERS[:2])
def test_filtered_dashboard_is_not_found_for_embedded_guest(
    dashboard: Dashboard,
    mocker: MockerFixture,
    denied_filter: None,
    identifier: int | str,
) -> None:
    """Guest tokens cannot tell other existing dashboards from missing ones."""
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    with pytest.raises(DashboardNotFoundError):
        DashboardDAO.get_by_id_or_slug(identifier)


@pytest.mark.parametrize("deleted", [False, True])
@pytest.mark.parametrize("identifier", IDENTIFIERS)
def test_missing_or_deleted_dashboard_is_not_found(
    dashboard: Dashboard,
    session: Session,
    mocker: MockerFixture,
    denied_filter: None,
    identifier: int | str,
    deleted: bool,
) -> None:
    """Missing and soft-deleted rows remain 404, including the existence check."""
    mocker.patch("superset.models.helpers.is_feature_enabled", return_value=True)
    if deleted:
        dashboard.deleted_at = datetime(2026, 1, 1)
    else:
        session.delete(dashboard)
    session.flush()
    with pytest.raises(DashboardNotFoundError):
        DashboardDAO.get_by_id_or_slug(identifier)


@pytest.mark.parametrize("exists, expected_status", [(True, 403), (False, 404)])
@pytest.mark.parametrize(
    "path, method, payload",
    [
        ("", "GET", None),
        ("/charts", "GET", None),
        ("/datasets", "GET", None),
        ("/tabs", "GET", None),
        ("/filter_state/unused", "GET", None),
        ("/filter_state", "POST", {"value": "{}"}),
        ("/filter_state/unused", "PUT", {"value": "{}"}),
        ("/filter_state/unused", "DELETE", None),
    ],
)
def test_dashboard_api_access_status(
    dashboard: Dashboard,
    session: Session,
    denied_filter: None,
    full_api_access: None,
    client: FlaskClient,
    exists: bool,
    expected_status: int,
    path: str,
    method: str,
    payload: dict[str, str] | None,
) -> None:
    """The dashboard API returns distinct HTTP statuses without exposing data."""
    if not exists:
        session.delete(dashboard)
        session.flush()
    response = client.open(f"/api/v1/dashboard/1{path}", method=method, json=payload)
    assert response.status_code == expected_status
    assert "result" not in response.json


def test_legacy_dashboard_permission_failure_is_forbidden(
    app: Flask,
    mocker: MockerFixture,
    access_error: SupersetSecurityException,
) -> None:
    """The legacy HTML entry returns 403 for an authenticated denied caller."""
    from superset.views.core import Superset

    item = mocker.patch("superset.views.core.Dashboard.get").return_value
    item.raise_for_access.side_effect = access_error
    mocker.patch("superset.views.core.get_current_user", return_value=object())
    with app.test_request_context(), pytest.raises(Forbidden):
        unwrap(Superset.dashboard)(Superset(), "1")


def test_legacy_dashboard_withheld_by_exclusion_hook_is_not_found(
    app: Flask,
    mocker: MockerFixture,
    access_error: SupersetSecurityException,
) -> None:
    """Exclusion-hook dashboards get 404 on the legacy entry, as from the API."""
    from superset.views.core import Superset

    item = mocker.patch("superset.views.core.Dashboard.get").return_value
    item.raise_for_access.side_effect = access_error
    mocker.patch("superset.views.core.get_current_user", return_value=object())
    mocker.patch(
        "superset.utils.filters.is_excluded_by_extra_access", return_value=True
    )
    with app.test_request_context(), pytest.raises(NotFound):
        unwrap(Superset.dashboard)(Superset(), "1")


@pytest.mark.parametrize("status, identifier", [(403, "1"), (404, "missing")])
@pytest.mark.parametrize("debug", [False, True])
@pytest.mark.parametrize("accept", ["text/html", "application/json"])
def test_direct_dashboard_navigation_error_format(
    dashboard: Dashboard,
    mocker: MockerFixture,
    client: FlaskClient,
    app: Flask,
    full_api_access: None,
    access_error: SupersetSecurityException,
    status: int,
    identifier: str,
    debug: bool,
    accept: str,
) -> None:
    """Browser navigation renders the SPA; JSON clients retain structured errors."""
    mocker.patch.dict(app.config, {"DEBUG": debug})
    mocker.patch.object(
        app, "jinja_loader", FileSystemLoader(str(files("superset") / "templates"))
    )
    mocker.patch("superset.views.core.get_current_user", return_value=object())
    mocker.patch.object(
        security_manager, "get_public_role", return_value=Role(id=0, name="Public")
    )
    mocker.patch.object(Dashboard, "raise_for_access", side_effect=access_error)

    response = client.get(
        f"/dashboard/{identifier}/?standalone=2", headers={"Accept": accept}
    )

    assert response.status_code == status
    if accept == "text/html":
        assert response.content_type.startswith("text/html")
        html = response.get_data(as_text=True)
        assert "data-bootstrap" in html
        assert dashboard.dashboard_title not in html
        assert "Forbidden" in html if status == 403 else "Page not found" in html
    else:
        assert response.is_json
        assert "errors" in response.json
