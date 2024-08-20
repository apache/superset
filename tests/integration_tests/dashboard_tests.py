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
# isort:skip_file
"""Unit tests for Superset"""

import re
import unittest
from random import random

import pytest
from flask import Response, escape, url_for
from sqlalchemy import func

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,  # noqa: F401
    load_energy_table_data,  # noqa: F401
)
from tests.integration_tests.fixtures.public_role import public_role_like_gamma  # noqa: F401
from tests.integration_tests.fixtures.unicode_dashboard import (
    load_unicode_dashboard_with_position,  # noqa: F401
    load_unicode_data,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)

from .base_tests import SupersetTestCase


class TestDashboard(SupersetTestCase):
    @pytest.fixture
    def load_dashboard(self):
        table = db.session.query(SqlaTable).filter_by(table_name="energy_usage").one()
        # get a slice from the allowed table
        slice = db.session.query(Slice).filter_by(slice_name="Energy Sankey").one()

        self.grant_public_access_to_table(table)

        pytest.hidden_dash_slug = f"hidden_dash_{random()}"
        pytest.published_dash_slug = f"published_dash_{random()}"

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

        db.session.add(published_dash)
        db.session.add(hidden_dash)
        yield db.session.commit()

        self.revoke_public_access_to_table(table)
        db.session.delete(published_dash)
        db.session.delete(hidden_dash)
        db.session.commit()

    def get_mock_positions(self, dash):
        positions = {"DASHBOARD_VERSION_KEY": "v2"}
        for i, slc in enumerate(dash.slices):
            id = f"DASHBOARD_CHART_TYPE-{i}"
            d = {
                "type": "CHART",
                "id": id,
                "children": [],
                "meta": {"width": 4, "height": 50, "chartId": slc.id},
            }
            positions[id] = d
        return positions

    def test_get_dashboard(self):
        for dash in db.session.query(Dashboard):
            assert escape(dash.dashboard_title) in self.client.get(dash.url).get_data(
                as_text=True
            )

    def test_superset_dashboard_url(self):
        url_for("Superset.dashboard", dashboard_id_or_slug=1)

    def test_new_dashboard(self):
        self.login(ADMIN_USERNAME)
        dash_count_before = db.session.query(func.count(Dashboard.id)).first()[0]
        url = "/dashboard/new/"
        response = self.client.get(url, follow_redirects=False)
        dash_count_after = db.session.query(func.count(Dashboard.id)).first()[0]
        self.assertEqual(dash_count_before + 1, dash_count_after)
        group = re.match(
            r"\/superset\/dashboard\/([0-9]*)\/\?edit=true",
            response.headers["Location"],
        )
        assert group is not None

        # Cleanup
        created_dashboard_id = int(group[1])
        created_dashboard = db.session.query(Dashboard).get(created_dashboard_id)
        db.session.delete(created_dashboard)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("public_role_like_gamma")
    def test_public_user_dashboard_access(self):
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()

        # Make the births dash published so it can be seen
        births_dash = db.session.query(Dashboard).filter_by(slug="births").one()
        births_dash.published = True
        db.session.commit()

        # Try access before adding appropriate permissions.
        self.revoke_public_access_to_table(table)
        self.logout()

        resp = self.get_resp("/api/v1/chart/")
        self.assertNotIn("birth_names", resp)

        resp = self.get_resp("/api/v1/dashboard/")
        self.assertNotIn("/superset/dashboard/births/", resp)

        self.grant_public_access_to_table(table)

        # Try access after adding appropriate permissions.
        self.assertIn("birth_names", self.get_resp("/api/v1/chart/"))

        resp = self.get_resp("/api/v1/dashboard/")
        self.assertIn("/superset/dashboard/births/", resp)

        # Confirm that public doesn't have access to other datasets.
        resp = self.get_resp("/api/v1/chart/")
        self.assertNotIn("wb_health_population", resp)

        resp = self.get_resp("/api/v1/dashboard/")
        self.assertNotIn("/superset/dashboard/world_health/", resp)

        # Cleanup
        self.revoke_public_access_to_table(table)

    @pytest.mark.usefixtures(
        "load_birth_names_dashboard_with_slices", "public_role_like_gamma"
    )
    def test_dashboard_with_created_by_can_be_accessed_by_public_users(self):
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        self.grant_public_access_to_table(table)

        dash = db.session.query(Dashboard).filter_by(slug="births").first()
        dash.owners = [security_manager.find_user("admin")]
        dash.created_by = security_manager.find_user("admin")
        db.session.commit()

        res: Response = self.client.get("/superset/dashboard/births/")
        assert res.status_code == 200

        # Cleanup
        self.revoke_public_access_to_table(table)

    @pytest.mark.usefixtures(
        "public_role_like_gamma",
        "load_energy_table_with_slice",
        "load_dashboard",
    )
    def test_users_can_list_published_dashboard(self):
        self.login(ALPHA_USERNAME)
        resp = self.get_resp("/api/v1/dashboard/")
        assert f"/superset/dashboard/{pytest.hidden_dash_slug}/" not in resp
        assert f"/superset/dashboard/{pytest.published_dash_slug}/" in resp

    def test_users_can_view_own_dashboard(self):
        user = security_manager.find_user("gamma")
        my_dash_slug = f"my_dash_{random()}"
        not_my_dash_slug = f"not_my_dash_{random()}"

        # Create one dashboard I own and another that I don't
        dash = Dashboard()
        dash.dashboard_title = "My Dashboard"
        dash.slug = my_dash_slug
        dash.owners = [user]

        hidden_dash = Dashboard()
        hidden_dash.dashboard_title = "Not My Dashboard"
        hidden_dash.slug = not_my_dash_slug

        db.session.add(dash)
        db.session.add(hidden_dash)
        db.session.commit()

        self.login(user.username)

        resp = self.get_resp("/api/v1/dashboard/")

        db.session.delete(dash)
        db.session.delete(hidden_dash)
        db.session.commit()

        self.assertIn(f"/superset/dashboard/{my_dash_slug}/", resp)
        self.assertNotIn(f"/superset/dashboard/{not_my_dash_slug}/", resp)

    def test_user_can_not_view_unpublished_dash(self):
        admin_user = security_manager.find_user("admin")
        slug = f"admin_owned_unpublished_dash_{random()}"

        # Create a dashboard owned by admin and unpublished
        dash = Dashboard()
        dash.dashboard_title = "My Dashboard"
        dash.slug = slug
        dash.owners = [admin_user]
        dash.published = False
        db.session.add(dash)
        db.session.commit()

        # list dashboards as a gamma user
        self.login(GAMMA_USERNAME)
        resp = self.get_resp("/api/v1/dashboard/")

        db.session.delete(dash)
        db.session.commit()

        self.assertNotIn(f"/superset/dashboard/{slug}/", resp)


if __name__ == "__main__":
    unittest.main()
