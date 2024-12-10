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
"""Unit tests for Superset"""

from unittest import mock
from unittest.mock import patch  # noqa: F401

import pytest

from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.daos.dashboard import DashboardDAO
from superset.utils import json
from superset.utils.core import backend, override_user
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    GAMMA_SQLLAB_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.dashboards.dashboard_test_utils import *  # noqa: F403
from tests.integration_tests.dashboards.security.base_case import (
    BaseTestDashboardSecurity,
)
from tests.integration_tests.dashboards.superset_factory_util import (
    create_dashboard_to_db,
    create_database_to_db,
    create_datasource_table_to_db,
    create_slice_to_db,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.public_role import (
    public_role_like_gamma,  # noqa: F401
)
from tests.integration_tests.fixtures.query_context import get_query_context
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)

CHART_DATA_URI = "api/v1/chart/data"


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    DASHBOARD_RBAC=True,
)
class TestDashboardRoleBasedSecurity(BaseTestDashboardSecurity):
    def test_get_dashboard_view__admin_can_access(self):
        # arrange
        dashboard_to_access = create_dashboard_to_db(
            owners=[], slices=[create_slice_to_db()], published=False
        )
        self.login(ADMIN_USERNAME)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

    def test_get_dashboard_view__owner_can_access(self):
        # arrange
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        owner = self.create_user_with_roles(
            username, [new_role], should_create_roles=True
        )
        dashboard_to_access = create_dashboard_to_db(
            owners=[owner], slices=[create_slice_to_db()], published=False
        )
        self.login(username)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dashboard_view__user_can_not_access_without_permission(self):
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        slice = (
            db.session.query(Slice)  # noqa: F405
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard_to_access = create_dashboard_to_db(published=True, slices=[slice])
        self.login(username)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)
        assert response.status_code == 302

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        assert rv.status_code == 403

    def test_get_dashboard_view__user_with_dashboard_permission_can_not_access_draft(
        self,
    ):
        # arrange
        dashboard_to_access = create_dashboard_to_db(published=False)
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        grant_access_to_dashboard(dashboard_to_access, new_role)  # noqa: F405
        self.login(username)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        assert response.status_code == 302

        # post
        revoke_access_to_dashboard(dashboard_to_access, new_role)  # noqa: F405

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dashboard_view__user_no_access_regular_rbac(self):
        if backend() == "hive":
            return

        slice = (
            db.session.query(Slice)  # noqa: F405
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard = create_dashboard_to_db(published=True, slices=[slice])
        self.login(GAMMA_USERNAME)

        # assert redirect on regular rbac access denied
        response = self.get_dashboard_view_response(dashboard)
        assert response.status_code == 302

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        assert rv.status_code == 403
        db.session.delete(dashboard)  # noqa: F405
        db.session.commit()  # noqa: F405

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dashboard_view__user_access_regular_rbac(self):
        if backend() == "hive":
            return

        slice = (
            db.session.query(Slice)  # noqa: F405
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard = create_dashboard_to_db(published=True, slices=[slice])
        self.login(GAMMA_SQLLAB_USERNAME)

        response = self.get_dashboard_view_response(dashboard)

        assert response.status_code == 200

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        assert rv.status_code == 200
        db.session.delete(dashboard)  # noqa: F405
        db.session.commit()  # noqa: F405

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dashboard_view__user_access_with_dashboard_permission(self):
        if backend() == "hive":
            return

        # arrange
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)

        slice = (
            db.session.query(Slice)  # noqa: F405
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard_to_access = create_dashboard_to_db(published=True, slices=[slice])
        self.login(username)
        grant_access_to_dashboard(dashboard_to_access, new_role)  # noqa: F405

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        assert rv.status_code == 403

        # post
        revoke_access_to_dashboard(dashboard_to_access, new_role)  # noqa: F405

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_can_not_access_without_permission(self):
        dashboard_to_access = create_dashboard_to_db(published=True)
        grant_access_to_dashboard(dashboard_to_access, "Alpha")  # noqa: F405

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        assert response.status_code == 302

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_with_dashboard_permission_can_not_access_draft(
        self,
    ):
        # arrange
        dashboard_to_access = create_dashboard_to_db(published=False)
        grant_access_to_dashboard(dashboard_to_access, "Public")  # noqa: F405
        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        assert response.status_code == 302

        # post
        revoke_access_to_dashboard(dashboard_to_access, "Public")  # noqa: F405

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_access_with_dashboard_permission(self):
        # arrange
        dashboard_to_access = create_dashboard_to_db(
            published=True, slices=[create_slice_to_db()]
        )
        grant_access_to_dashboard(dashboard_to_access, "Public")  # noqa: F405

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

        # post
        revoke_access_to_dashboard(dashboard_to_access, "Public")  # noqa: F405

    def _create_sample_dashboards_with_owner_access(self):
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        owner = self.create_user_with_roles(
            username, [new_role], should_create_roles=True
        )
        database = create_database_to_db()
        table = create_datasource_table_to_db(db_id=database.id, owners=[owner])
        first_dash = create_dashboard_to_db(
            owners=[owner], slices=[create_slice_to_db(datasource_id=table.id)]
        )
        second_dash = create_dashboard_to_db(
            owners=[owner], slices=[create_slice_to_db(datasource_id=table.id)]
        )
        owned_dashboards = [first_dash, second_dash]
        not_owned_dashboards = [
            create_dashboard_to_db(
                slices=[create_slice_to_db(datasource_id=table.id)], published=True
            )
        ]
        return username, not_owned_dashboards, owned_dashboards

    def _create_sample_only_published_dashboard_with_roles(self):
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        draft_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]
        for dash in published_dashboards + draft_dashboards:
            grant_access_to_dashboard(dash, new_role)  # noqa: F405
        return username, new_role, draft_dashboards, published_dashboards

    def test_get_dashboards_api__admin_get_all_dashboards(self):
        # arrange
        create_dashboard_to_db(
            owners=[], slices=[create_slice_to_db()], published=False
        )
        dashboard_counts = count_dashboards()  # noqa: F405

        self.login(ADMIN_USERNAME)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, dashboard_counts)

    def test_get_dashboards_api__owner_get_all_owned_dashboards(self):
        # arrange
        (
            username,
            not_owned_dashboards,
            owned_dashboards,
        ) = self._create_sample_dashboards_with_owner_access()

        self.login(username)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response, 2, owned_dashboards, not_owned_dashboards
        )

    def test_get_dashboards_api__user_without_any_permissions_get_empty_list(self):
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        create_dashboard_to_db(published=True)
        self.login(username)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, 0)

    def test_get_dashboards_api__user_get_only_published_permitted_dashboards(self):
        (
            username,
            new_role,
            draft_dashboards,
            published_dashboards,
        ) = self._create_sample_only_published_dashboard_with_roles()

        self.login(username)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response,
            len(published_dashboards),
            published_dashboards,
            draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, new_role)  # noqa: F405

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboards_api__public_user_without_any_permissions_get_empty_list(
        self,
    ):
        create_dashboard_to_db(published=True)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, 0)

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboards_api__public_user_get_only_published_permitted_dashboards(
        self,
    ):
        # arrange
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        draft_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]

        for dash in published_dashboards + draft_dashboards:
            grant_access_to_dashboard(dash, "Public")  # noqa: F405

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response,
            len(published_dashboards),
            published_dashboards,
            draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, "Public")  # noqa: F405

    def test_cannot_get_draft_dashboard_without_roles_by_uuid(self):
        """
        Dashboard API: Test get draft dashboard without roles by uuid
        """
        admin = self.get_user("admin")

        database = create_database_to_db(name="test_db_rbac")
        table = create_datasource_table_to_db(
            name="test_datasource_rbac", db_id=database.id, owners=[admin]
        )
        dashboard_to_access = create_dashboard_to_db(
            dashboard_title="test_dashboard_rbac",
            owners=[admin],
            slices=[create_slice_to_db(datasource_id=table.id)],
        )
        assert not dashboard_to_access.published
        assert dashboard_to_access.roles == []

        self.login(GAMMA_USERNAME)
        uri = f"api/v1/dashboard/{dashboard_to_access.uuid}"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    def test_cannot_get_draft_dashboard_with_roles_by_uuid(self):
        """
        Dashboard API: Test get dashboard by uuid
        """
        admin = self.get_user("admin")
        admin_role = self.get_role("Admin")
        dashboard = self.insert_dashboard(
            "title", "slug1", [admin.id], roles=[admin_role.id]
        )
        assert not dashboard.published
        assert dashboard.roles == [admin_role]

        self.login(GAMMA_USERNAME)
        uri = f"api/v1/dashboard/{dashboard.uuid}"
        rv = self.client.get(uri)
        assert rv.status_code == 403
        # rollback changes
        db.session.delete(dashboard)  # noqa: F405
        db.session.commit()  # noqa: F405

    @with_feature_flags(DASHBOARD_RBAC=True)
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_via_api(self):
        source = db.session.query(Dashboard).filter_by(slug="world_health").first()  # noqa: F405
        source.roles = [self.get_role("Gamma")]

        if not (published := source.published):
            source.published = True  # Required per the DashboardAccessFilter for RBAC.

        db.session.commit()  # noqa: F405

        uri = f"api/v1/dashboard/{source.id}/copy/"

        data = {
            "dashboard_title": "copied dash",
            "css": "<css>",
            "duplicate_slices": False,
            "json_metadata": json.dumps(
                {
                    "positions": source.position,
                    "color_namespace": "Color Namespace Test",
                    "color_scheme": "Color Scheme Test",
                }
            ),
        }

        self.login(GAMMA_USERNAME)
        rv = self.client.post(uri, json=data)
        assert rv.status_code == 403
        self.logout()

        self.login(ADMIN_USERNAME)
        rv = self.client.post(uri, json=data)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))

        target = (
            db.session.query(Dashboard)  # noqa: F405
            .filter(Dashboard.id == response["result"]["id"])  # noqa: F405
            .one()
        )

        db.session.delete(target)  # noqa: F405
        source.roles = []

        if not published:
            source.published = False

        db.session.commit()  # noqa: F405

    @with_feature_flags(DASHBOARD_RBAC=True)
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_via_dao(self):
        source = db.session.query(Dashboard).filter_by(slug="world_health").first()  # noqa: F405

        data = {
            "dashboard_title": "copied dash",
            "css": "<css>",
            "duplicate_slices": False,
            "json_metadata": json.dumps(
                {
                    "positions": source.position,
                    "color_namespace": "Color Namespace Test",
                    "color_scheme": "Color Scheme Test",
                }
            ),
        }

        with override_user(security_manager.find_user("gamma")):  # noqa: F405
            with pytest.raises(DashboardForbiddenError):
                DashboardDAO.copy_dashboard(source, data)

        with override_user(security_manager.find_user("admin")):  # noqa: F405
            target = DashboardDAO.copy_dashboard(source, data)
            db.session.delete(target)  # noqa: F405

        db.session.commit()  # noqa: F405
