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
import json

import prison
import pytest
from flask import escape

from superset import app
from superset.models import core as models
from tests.integration_tests.dashboards.base_case import DashboardTestCase
from tests.integration_tests.dashboards.consts import *
from tests.integration_tests.dashboards.dashboard_test_utils import *
from tests.integration_tests.dashboards.superset_factory_util import *
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,
    load_energy_table_with_slice,
)


class TestDashboardDatasetSecurity(DashboardTestCase):
    @pytest.fixture
    def load_dashboard(self):
        with app.app_context():
            table = (
                db.session.query(SqlaTable).filter_by(table_name="energy_usage").one()
            )
            # get a slice from the allowed table
            slice = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()

            self.grant_public_access_to_table(table)

            pytest.hidden_dash_slug = f"hidden_dash_{random_slug()}"
            pytest.published_dash_slug = f"published_dash_{random_slug()}"

            # Create a published and hidden dashboard and add them to the database
            published_dash = Dashboard()
            published_dash.dashboard_title = "Published Dashboard"
            published_dash.slug = pytest.published_dash_slug
            published_dash.slices = [slice]
            published_dash.published = True

            hidden_dash = Dashboard()
            hidden_dash.dashboard_title = "Hidden Dashboard"
            hidden_dash.slug = pytest.hidden_dash_slug
            hidden_dash.slices = [slice]
            hidden_dash.published = False

            db.session.merge(published_dash)
            db.session.merge(hidden_dash)
            yield db.session.commit()

            self.revoke_public_access_to_table(table)
            db.session.delete(published_dash)
            db.session.delete(hidden_dash)
            db.session.commit()

    def test_dashboard_access__admin_can_access_all(self):
        # arrange
        self.login(username=ADMIN_USERNAME)
        dashboard_title_by_url = {
            dash.url: dash.dashboard_title for dash in get_all_dashboards()
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
        user = security_manager.find_user(username)
        my_owned_dashboard = create_dashboard_to_db(
            dashboard_title="My Dashboard", published=False, owners=[user],
        )

        not_my_owned_dashboard = create_dashboard_to_db(
            dashboard_title="Not My Dashboard", published=False,
        )

        self.login(user.username)

        # act
        get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)

        # assert
        self.assertIn(my_owned_dashboard.url, get_dashboards_response)
        self.assertNotIn(not_my_owned_dashboard.url, get_dashboards_response)

    def test_get_dashboards__owners_can_view_empty_dashboard(self):
        # arrange
        dash = create_dashboard_to_db("Empty Dashboard", slug="empty_dashboard")
        dashboard_url = dash.url
        gamma_user = security_manager.find_user("gamma")
        self.login(gamma_user.username)

        # act
        get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)

        # assert
        self.assertNotIn(dashboard_url, get_dashboards_response)

    def test_get_dashboards__users_can_view_favorites_dashboards(self):
        # arrange
        user = security_manager.find_user("gamma")
        fav_dash_slug = f"my_favorite_dash_{random_slug()}"
        regular_dash_slug = f"regular_dash_{random_slug()}"

        favorite_dash = Dashboard()
        favorite_dash.dashboard_title = "My Favorite Dashboard"
        favorite_dash.slug = fav_dash_slug

        regular_dash = Dashboard()
        regular_dash.dashboard_title = "A Plain Ol Dashboard"
        regular_dash.slug = regular_dash_slug

        db.session.merge(favorite_dash)
        db.session.merge(regular_dash)
        db.session.commit()

        dash = db.session.query(Dashboard).filter_by(slug=fav_dash_slug).first()

        favorites = models.FavStar()
        favorites.obj_id = dash.id
        favorites.class_name = "Dashboard"
        favorites.user_id = user.id

        db.session.merge(favorites)
        db.session.commit()

        self.login(user.username)

        # act
        get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)

        # assert
        self.assertIn(f"/superset/dashboard/{fav_dash_slug}/", get_dashboards_response)

    def test_get_dashboards__user_can_not_view_unpublished_dash(self):
        # arrange
        admin_user = security_manager.find_user(ADMIN_USERNAME)
        gamma_user = security_manager.find_user(GAMMA_USERNAME)
        admin_and_draft_dashboard = create_dashboard_to_db(
            dashboard_title="admin_owned_unpublished_dash", owners=[admin_user]
        )

        self.login(gamma_user.username)

        # act - list dashboards as a gamma user
        get_dashboards_response_as_gamma = self.get_resp(DASHBOARDS_API_URL)

        # assert
        self.assertNotIn(
            admin_and_draft_dashboard.url, get_dashboards_response_as_gamma
        )

    @pytest.mark.usefixtures("load_energy_table_with_slice", "load_dashboard")
    def test_get_dashboards__users_can_view_permitted_dashboard(self):
        # arrange
        username = random_str()
        new_role = f"role_{random_str()}"
        self.create_user_with_roles(username, [new_role], should_create_roles=True)
        accessed_table = get_sql_table_by_name("energy_usage")
        self.grant_role_access_to_table(accessed_table, new_role)
        # get a slice from the allowed table
        slice_to_add_to_dashboards = get_slice_by_name("Energy Sankey")
        # Create a published and hidden dashboard and add them to the database
        first_dash = create_dashboard_to_db(
            dashboard_title="Published Dashboard",
            published=True,
            slices=[slice_to_add_to_dashboards],
        )

        second_dash = create_dashboard_to_db(
            dashboard_title="Hidden Dashboard",
            published=True,
            slices=[slice_to_add_to_dashboards],
        )

        try:
            self.login(username)
            # act
            get_dashboards_response = self.get_resp(DASHBOARDS_API_URL)

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
        title = f"title{random_str()}"
        create_dashboard_to_db(title, "slug1", owners=[admin])

        self.login(username="gamma")
        arguments = {
            "filters": [{"col": "dashboard_title", "opr": "sw", "value": title[0:8]}]
        }
        uri = DASHBOARDS_API_URL_WITH_QUERY_FORMAT.format(prison.dumps(arguments))
        rv = self.client.get(uri)
        self.assert200(rv)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(0, data["count"])
