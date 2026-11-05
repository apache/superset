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

"""Regression tests for the Explore bootstrap endpoint (#46003).

With dashboard RBAC, a role assigned to a dashboard implicitly grants read
access to the dashboard's charts and their datasources. Opening one of those
charts in Explore must therefore succeed for a user who holds that dashboard
role but no dataset permission, while a user with neither dashboard access
nor dataset permission must still be denied (the per-datasource check added
for CVE-2025-55675).
"""

import pytest
from flask_appbuilder.security.sqla.models import Role, User

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json
from tests.integration_tests.test_app import app, login

ROLE_NAME = "ExploreDashboardRbacRole"
VIEWER_USERNAME = "explore_rbac_viewer"
OUTSIDER_USERNAME = "explore_rbac_outsider"
USER_PASSWORD = "general"  # noqa: S105


def _seed_role_permissions(role: Role) -> None:
    """Give a fresh role the Gamma permission set minus data grants.

    Dashboard RBAC roles in a real deployment are built on a base role
    such as Gamma; the copy keeps every route permission while dropping
    database/schema/datasource access, which is the grant under test.
    """
    data_perms = {
        "database_access",
        "schema_access",
        "datasource_access",
        "all_database_access",
        "all_datasource_access",
    }
    gamma = security_manager.find_role("Gamma")
    for pvm in gamma.permissions:
        if pvm.permission.name not in data_perms:
            security_manager.add_permission_role(role, pvm)
    db.session.commit()


def _get_or_create_role(name: str) -> Role:
    role = security_manager.find_role(name)
    if role is None:
        role = security_manager.add_role(name)
    if not role.permissions:
        _seed_role_permissions(role)
    return role


def _get_or_create_user(username: str, role: Role) -> User:
    user = security_manager.find_user(username)
    if user is None:
        user = security_manager.add_user(
            username,
            "first",
            "last",
            f"{username}@example.com",
            role,
            password=USER_PASSWORD,
        )
    return user


@pytest.fixture(scope="module")
def explore_rbac_fixtures():
    """Dataset + chart + published dashboard, with the test role as viewer."""
    with app.app_context():
        role = _get_or_create_role(ROLE_NAME)
        viewer = _get_or_create_user(VIEWER_USERNAME, role)
        outsider = _get_or_create_user(
            OUTSIDER_USERNAME, _get_or_create_role("ExploreRbacOutsiderRole")
        )

        database = db.session.query(Database).filter_by(database_name="examples").one()
        existing = (
            db.session.query(SqlaTable)
            .filter_by(table_name="explore_rbac_dataset", database_id=database.id)
            .one_or_none()
        )
        dataset = existing or SqlaTable(
            table_name="explore_rbac_dataset",
            database=database,
            schema=None,
            catalog=None,
        )
        if existing is None:
            db.session.add(dataset)
        db.session.flush()

        existing_chart = (
            db.session.query(Slice)
            .filter_by(slice_name="Explore RBAC chart")
            .one_or_none()
        )
        chart = existing_chart or Slice(
            slice_name="Explore RBAC chart",
            datasource_type="table",
            datasource_id=dataset.id,
            viz_type="table",
            params=json.dumps({"datasource": f"{dataset.id}__table"}),
        )
        if existing_chart is None:
            db.session.add(chart)
        db.session.flush()

        existing_dashboard = (
            db.session.query(Dashboard)
            .filter_by(slug="explore-rbac-dashboard")
            .one_or_none()
        )
        dashboard = existing_dashboard or Dashboard(
            dashboard_title="Explore RBAC dashboard",
            slug="explore-rbac-dashboard",
            published=True,
        )
        dashboard.slices = [chart]
        if existing_dashboard is None:
            db.session.add(dashboard)
        db.session.flush()

        # Dashboard RBAC: the role is a viewer subject of the dashboard.
        role_subject = (
            db.session.query(Subject)
            .filter_by(role_id=role.id, type=SubjectType.ROLE)
            .one()
        )
        dashboard.viewers = [role_subject]
        db.session.commit()

        ids = {
            "created_dataset": existing is None,
            "dataset_id": dataset.id,
            "chart_id": chart.id,
            "dashboard_id": dashboard.id,
        }
        yield ids

        db.session.delete(dashboard)
        db.session.delete(chart)
        if ids["created_dataset"]:
            db.session.delete(dataset)
        for user in (viewer, outsider):
            if user is not None:
                db.session.delete(user)
        db.session.commit()


@pytest.mark.usefixtures("explore_rbac_fixtures")
def test_explore_command_denies_user_without_access(
    explore_rbac_fixtures,
):
    """CVE-2025-55675 guard at the command layer: the outsider holds
    neither dashboard access nor dataset permission, so the Explore
    bootstrap authorization must raise. (Asserted on GetExploreCommand
    rather than the HTTP status: views/utils.get_form_data drops the
    chart for users who cannot access it and the endpoint then serves
    an empty bootstrap shell, so the denial lives in the command.)"""
    from flask import g
    from flask_login import login_user

    from superset.commands.explore.get import GetExploreCommand
    from superset.commands.explore.parameters import CommandParameters
    from superset.exceptions import SupersetSecurityException

    with app.test_request_context():
        outsider = security_manager.find_user(OUTSIDER_USERNAME)
        login_user(outsider)
        g.user = outsider
        command = GetExploreCommand(
            CommandParameters(
                permalink_key=None,
                form_data_key=None,
                datasource_id=explore_rbac_fixtures["dataset_id"],
                datasource_type="table",
                slice_id=explore_rbac_fixtures["chart_id"],
            )
        )
        with pytest.raises(SupersetSecurityException):
            command.run()


@pytest.mark.usefixtures("explore_rbac_fixtures")
def test_explore_http_denies_dataset_only_request_from_outsider(
    explore_rbac_fixtures, test_client
):
    """A direct dataset-only Explore request from a user with neither
    dashboard access nor dataset permission is denied with 403 -- the
    CVE-2025-55675 check itself, exercised over HTTP."""
    login(test_client, username=OUTSIDER_USERNAME, password=USER_PASSWORD)
    resp = test_client.get(
        f"api/v1/explore/?datasource_id={explore_rbac_fixtures['dataset_id']}"
        "&datasource_type=table"
    )
    assert resp.status_code == 403


@pytest.mark.usefixtures("explore_rbac_fixtures")
def test_explore_allows_dashboard_rbac_viewer(test_client):
    """A dashboard-role viewer can open a member chart in Explore."""
    with app.app_context():
        chart_id = (
            db.session.query(Slice).filter_by(slice_name="Explore RBAC chart").one().id
        )
        dataset_id = (
            db.session.query(SqlaTable)
            .filter_by(table_name="explore_rbac_dataset")
            .one()
            .id
        )
    login(test_client, username=VIEWER_USERNAME, password=USER_PASSWORD)
    resp = test_client.get(f"api/v1/explore/?slice_id={chart_id}")
    assert resp.status_code == 200
    data = json.loads(resp.data.decode("utf-8"))
    assert data["result"]["form_data"]["datasource"] == f"{dataset_id}__table"
    assert data["result"]["slice"]["slice_id"] == chart_id
