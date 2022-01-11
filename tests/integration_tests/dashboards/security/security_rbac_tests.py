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

import pytest

from tests.integration_tests.dashboards.dashboard_test_utils import *
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
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.public_role import public_role_like_gamma
from tests.integration_tests.fixtures.query_context import get_query_context

CHART_DATA_URI = "api/v1/chart/data"


@mock.patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags", DASHBOARD_RBAC=True,
)
class TestDashboardRoleBasedSecurity(BaseTestDashboardSecurity):
    def test_get_dashboard_view__admin_can_access(self):
        # arrange
        dashboard_to_access = create_dashboard_to_db(
            owners=[], slices=[create_slice_to_db()], published=False
        )
        self.login("admin")

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

    def test_get_dashboard_view__owner_can_access(self):
        # arrange
        username = random_str()
        new_role = f"role_{random_str()}"
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
        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        slice = (
            db.session.query(Slice)
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard_to_access = create_dashboard_to_db(published=True, slices=[slice])
        self.login(username)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 401)

        # assert
        self.assert403(response)

    def test_get_dashboard_view__user_with_dashboard_permission_can_not_access_draft(
        self,
    ):
        # arrange
        dashboard_to_access = create_dashboard_to_db(published=False)
        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        grant_access_to_dashboard(dashboard_to_access, new_role)
        self.login(username)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert403(response)

        # post
        revoke_access_to_dashboard(dashboard_to_access, new_role)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dashboard_view__user_access_with_dashboard_permission(self):
        # arrange

        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)

        slice = (
            db.session.query(Slice)
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        dashboard_to_access = create_dashboard_to_db(published=True, slices=[slice])
        self.login(username)
        grant_access_to_dashboard(dashboard_to_access, new_role)

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

        # post
        revoke_access_to_dashboard(dashboard_to_access, new_role)

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_can_not_access_without_permission(self):
        dashboard_to_access = create_dashboard_to_db(published=True)
        self.logout()

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert403(response)

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_with_dashboard_permission_can_not_access_draft(
        self,
    ):
        # arrange
        dashboard_to_access = create_dashboard_to_db(published=False)
        grant_access_to_dashboard(dashboard_to_access, "Public")
        self.logout()
        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert403(response)

        # post
        revoke_access_to_dashboard(dashboard_to_access, "Public")

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboard_view__public_user_access_with_dashboard_permission(self):
        # arrange
        dashboard_to_access = create_dashboard_to_db(
            published=True, slices=[create_slice_to_db()]
        )
        grant_access_to_dashboard(dashboard_to_access, "Public")

        self.logout()

        # act
        response = self.get_dashboard_view_response(dashboard_to_access)

        # assert
        self.assert200(response)

        # post
        revoke_access_to_dashboard(dashboard_to_access, "Public")

    def test_get_dashboards_list__admin_get_all_dashboards(self):
        # arrange
        create_dashboard_to_db(
            owners=[], slices=[create_slice_to_db()], published=False
        )
        dashboard_counts = count_dashboards()

        self.login("admin")

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(response, dashboard_counts)

    def test_get_dashboards_list__owner_get_all_owned_dashboards(self):
        # arrange
        (
            not_owned_dashboards,
            owned_dashboards,
        ) = self._create_sample_dashboards_with_owner_access()

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response, 2, owned_dashboards, not_owned_dashboards
        )

    def _create_sample_dashboards_with_owner_access(self):
        username = random_str()
        new_role = f"role_{random_str()}"
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
        self.login(username)
        return not_owned_dashboards, owned_dashboards

    def test_get_dashboards_list__user_without_any_permissions_get_empty_list(self):

        # arrange
        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)

        create_dashboard_to_db(published=True)
        self.login(username)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(response, 0)

    def test_get_dashboards_list__user_get_only_published_permitted_dashboards(self):
        # arrange
        (
            new_role,
            draft_dashboards,
            published_dashboards,
        ) = self._create_sample_only_published_dashboard_with_roles()

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response, len(published_dashboards), published_dashboards, draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, new_role)

    def _create_sample_only_published_dashboard_with_roles(self):
        username = random_str()
        new_role = f"role_{random_str()}"
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
            grant_access_to_dashboard(dash, new_role)
        self.login(username)
        return new_role, draft_dashboards, published_dashboards

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboards_list__public_user_without_any_permissions_get_empty_list(
        self,
    ):
        create_dashboard_to_db(published=True)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(response, 0)

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboards_list__public_user_get_only_published_permitted_dashboards(
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
            grant_access_to_dashboard(dash, "Public")

        self.logout()

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response, len(published_dashboards), published_dashboards, draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, "Public")

    def test_get_dashboards_api__admin_get_all_dashboards(self):
        # arrange
        create_dashboard_to_db(
            owners=[], slices=[create_slice_to_db()], published=False
        )
        dashboard_counts = count_dashboards()

        self.login("admin")

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, dashboard_counts)

    def test_get_dashboards_api__owner_get_all_owned_dashboards(self):
        # arrange
        (
            not_owned_dashboards,
            owned_dashboards,
        ) = self._create_sample_dashboards_with_owner_access()

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response, 2, owned_dashboards, not_owned_dashboards
        )

    def test_get_dashboards_api__user_without_any_permissions_get_empty_list(self):
        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        create_dashboard_to_db(published=True)
        self.login(username)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, 0)

    def test_get_dashboards_api__user_get_only_published_permitted_dashboards(self):
        (
            new_role,
            draft_dashboards,
            published_dashboards,
        ) = self._create_sample_only_published_dashboard_with_roles()

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response, len(published_dashboards), published_dashboards, draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, new_role)

    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_get_dashboards_api__public_user_without_any_permissions_get_empty_list(
        self,
    ):
        create_dashboard_to_db(published=True)
        self.logout()

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
            grant_access_to_dashboard(dash, "Public")

        self.logout()

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response, len(published_dashboards), published_dashboards, draft_dashboards,
        )

        # post
        for dash in published_dashboards + draft_dashboards:
            revoke_access_to_dashboard(dash, "Public")
