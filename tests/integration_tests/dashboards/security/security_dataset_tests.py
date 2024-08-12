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

import prison
import pytest
from flask import escape  # noqa: F401

from superset import app
from superset.daos.dashboard import DashboardDAO
from superset.utils import json
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME
from tests.integration_tests.dashboards.base_case import DashboardTestCase
from tests.integration_tests.dashboards.consts import *  # noqa: F403
from tests.integration_tests.dashboards.dashboard_test_utils import *  # noqa: F403
from tests.integration_tests.dashboards.superset_factory_util import *  # noqa: F403
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)


class TestDashboardDatasetSecurity(DashboardTestCase):
    @pytest.fixture
    def load_dashboard(self):
        with app.app_context():
            table = (
                db.session.query(SqlaTable).filter_by(table_name="energy_usage").one()  # noqa: F405
            )
            # get a slice from the allowed table
            slice = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()  # noqa: F405

            self.grant_public_access_to_table(table)

            pytest.hidden_dash_slug = f"hidden_dash_{random_slug()}"  # noqa: F405
            pytest.published_dash_slug = f"published_dash_{random_slug()}"  # noqa: F405

            # Create a published and hidden dashboard and add them to the database
            published_dash = Dashboard()  # noqa: F405
            published_dash.dashboard_title = "Published Dashboard"
            published_dash.slug = pytest.published_dash_slug
            published_dash.slices = [slice]
            published_dash.published = True

            hidden_dash = Dashboard()  # noqa: F405
            hidden_dash.dashboard_title = "Hidden Dashboard"
            hidden_dash.slug = pytest.hidden_dash_slug
            hidden_dash.slices = [slice]
            hidden_dash.published = False

            db.session.add(published_dash)  # noqa: F405
            db.session.add(hidden_dash)  # noqa: F405
            yield db.session.commit()  # noqa: F405

            self.revoke_public_access_to_table(table)
            db.session.delete(published_dash)  # noqa: F405
            db.session.delete(hidden_dash)  # noqa: F405
            db.session.commit()  # noqa: F405

    def test_dashboard_access__admin_can_access_all(self):
        # arrange
        self.login(ADMIN_USERNAME)
        dashboard_title_by_url = {
            dash.url: dash.dashboard_title
            for dash in get_all_dashboards()  # noqa: F405
        }

        # act
        responses_by_url = {
            url: self.client.get(url) for url in dashboard_title_by_url.keys()
        }

        # assert
        for dashboard_url, get_dashboard_response in responses_by_url.items():
            self.assert200(get_dashboard_response)

    def test_get_dashboards__users_are_dashboards_owners(self):
        # arrange
        username = "gamma"
        user = security_manager.find_user(username)  # noqa: F405
        my_owned_dashboard = create_dashboard_to_db(  # noqa: F405
            dashboard_title="My Dashboard",
            published=False,
            owners=[user],
        )

        not_my_owned_dashboard = create_dashboard_to_db(  # noqa: F405
            dashboard_title="Not My Dashboard",
            published=False,
        )

        self.login(user.username)

        # act
        get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)  # noqa: F405

        # assert
        self.assertIn(my_owned_dashboard.url, get_dashboards_response)
        self.assertNotIn(not_my_owned_dashboard.url, get_dashboards_response)

    def test_get_dashboards__owners_can_view_empty_dashboard(self):
        # arrange
        dash = create_dashboard_to_db("Empty Dashboard", slug="empty_dashboard")  # noqa: F405
        dashboard_url = dash.url
        gamma_user = security_manager.find_user("gamma")  # noqa: F405
        self.login(gamma_user.username)

        # act
        get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)  # noqa: F405

        # assert
        self.assertNotIn(dashboard_url, get_dashboards_response)

    def test_get_dashboards__user_can_not_view_unpublished_dash(self):
        # arrange
        admin_user = security_manager.find_user(ADMIN_USERNAME)  # noqa: F405
        gamma_user = security_manager.find_user(GAMMA_USERNAME)  # noqa: F405
        admin_and_draft_dashboard = create_dashboard_to_db(  # noqa: F405
            dashboard_title="admin_owned_unpublished_dash", owners=[admin_user]
        )

        self.login(gamma_user.username)

        # act - list dashboards as a gamma user
        get_dashboards_response_as_gamma = self.get_resp(DASHBOARDS_API_URL)  # noqa: F405

        # assert
        self.assertNotIn(
            admin_and_draft_dashboard.url, get_dashboards_response_as_gamma
        )

    @pytest.mark.usefixtures("load_energy_table_with_slice", "load_dashboard")
    def test_get_dashboards__users_can_view_permitted_dashboard(self):
        # arrange
        username = random_str()  # noqa: F405
        new_role = f"role_{random_str()}"  # noqa: F405
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        accessed_table = get_sql_table_by_name("energy_usage")  # noqa: F405
        self.grant_role_access_to_table(accessed_table, new_role)
        # get a slice from the allowed table
        slice_to_add_to_dashboards = get_slice_by_name("Energy Sankey")  # noqa: F405
        # Create a published and hidden dashboard and add them to the database
        first_dash = create_dashboard_to_db(  # noqa: F405
            dashboard_title="Published Dashboard",
            published=True,
            slices=[slice_to_add_to_dashboards],
        )

        second_dash = create_dashboard_to_db(  # noqa: F405
            dashboard_title="Hidden Dashboard",
            published=True,
            slices=[slice_to_add_to_dashboards],
        )

        try:
            self.login(username)
            # act
            get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)  # noqa: F405

            # assert
            self.assertIn(second_dash.url, get_dashboards_response)
            self.assertIn(first_dash.url, get_dashboards_response)
        finally:
            self.revoke_public_access_to_table(accessed_table)

    def test_get_dashboards_api_no_data_access(self):
        """
        Dashboard API: Test get dashboards no data access
        """
        admin = self.get_user("admin")
        title = f"title{random_str()}"  # noqa: F405
        dashboard = create_dashboard_to_db(title, "slug1", owners=[admin])  # noqa: F405

        self.login(GAMMA_USERNAME)
        arguments = {
            "filters": [{"col": "dashboard_title", "opr": "sw", "value": title[0:8]}]
        }
        uri = DASHBOARDS_API_URL_WITH_QUERY_FORMAT.format(prison.dumps(arguments))  # noqa: F405
        rv = self.client.get(uri)
        self.assert200(rv)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(0, data["count"])
        DashboardDAO.delete([dashboard])
