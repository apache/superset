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

from tests.dashboards.dashboard_test_utils import *
from tests.dashboards.security.base_case import BaseTestDashboardSecurity
from tests.dashboards.superset_factory_util import (
    create_dashboard_to_db,
    create_database_to_db,
    create_datasource_table_to_db,
    create_slice_to_db,
)

USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS = "gamma"
ROLE_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS = "Gamma"


class TestDashboardRoleBasedSecurity(BaseTestDashboardSecurity):
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
        owner = self.get_user(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)
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

        self.login(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response, 2, owned_dashboards, not_owned_dashboards
        )

    def test_get_dashboards_list__user_without_any_permissions_get_empty_list(self):
        create_dashboard_to_db(published=True)
        self.login(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(response, 0)

    def test_get_dashboards_list__user_get_only_published_permitted_dashboards(self):
        # arrange
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        not_published_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]

        for dash in published_dashboards + not_published_dashboards:
            self.grant_access_to_dashboard(
                dash, ROLE_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS
            )

        self.login(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response,
            len(published_dashboards),
            published_dashboards,
            not_published_dashboards,
        )

        # post
        for dash in published_dashboards + not_published_dashboards:
            self.revoke_access_to_dashboard(
                dash, ROLE_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS
            )

    def test_get_dashboards_list__public_user_without_any_permissions_get_empty_list(
        self,
    ):
        create_dashboard_to_db(published=True)

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(response, 0)

    def test_get_dashboards_list__public_user_get_only_published_permitted_dashboards(
        self,
    ):
        # arrange
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        not_published_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]

        for dash in published_dashboards + not_published_dashboards:
            self.grant_access_to_dashboard(dash, "Public")

        # act
        response = self.get_dashboards_list_response()

        # assert
        self.assert_dashboards_list_view_response(
            response,
            len(published_dashboards),
            published_dashboards,
            not_published_dashboards,
        )

        # post
        for dash in published_dashboards + not_published_dashboards:
            self.revoke_access_to_dashboard(dash, "Public")

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
        username = random_str()
        new_role = f"role_{random_str()}"
        owner = self.create_user_with_roles(username, [new_role])
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

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response, 2, owned_dashboards, not_owned_dashboards
        )

    def test_get_dashboards_api__user_without_any_permissions_get_empty_list(self):
        create_dashboard_to_db(published=True)
        self.login(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, 0)

    def test_get_dashboards_api__user_get_only_published_permitted_dashboards(self):
        # arrange
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        not_published_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]

        for dash in published_dashboards + not_published_dashboards:
            self.grant_access_to_dashboard(
                dash, ROLE_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS
            )

        self.login(USER_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response,
            len(published_dashboards),
            published_dashboards,
            not_published_dashboards,
        )

        # post
        for dash in published_dashboards + not_published_dashboards:
            self.revoke_access_to_dashboard(
                dash, ROLE_WITHOUT_DASHBOARDS_ACCESS_PERMISSIONS
            )

    def test_get_dashboards_api__public_user_without_any_permissions_get_empty_list(
        self,
    ):
        create_dashboard_to_db(published=True)

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(response, 0)

    def test_get_dashboards_api__public_user_get_only_published_permitted_dashboards(
        self,
    ):
        # arrange
        published_dashboards = [
            create_dashboard_to_db(published=True),
            create_dashboard_to_db(published=True),
        ]
        not_published_dashboards = [
            create_dashboard_to_db(published=False),
            create_dashboard_to_db(published=False),
        ]

        for dash in published_dashboards + not_published_dashboards:
            self.grant_access_to_dashboard(dash, "Public")

        # act
        response = self.get_dashboards_api_response()

        # assert
        self.assert_dashboards_api_response(
            response,
            len(published_dashboards),
            published_dashboards,
            not_published_dashboards,
        )

        # post
        for dash in published_dashboards + not_published_dashboards:
            self.revoke_access_to_dashboard(dash, "Public")

    @staticmethod
    def __add_dashboard_mode_params(dashboard_url):
        full_url = dashboard_url
        if dashboard_url.find("?") == -1:
            full_url += "?"
        else:
            full_url += "&"
        return full_url + "edit=true&standalone=true"
