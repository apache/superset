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
import pytest
import json
from superset import security_manager, app
from superset.models.dashboard import Dashboard
from superset.extensions import cache_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.test_app import app
from sqlalchemy.orm import Session
from unittest.mock import patch
from superset.dashboards.commands.exceptions import DashboardAccessDeniedError
from superset.key_value.utils import cache_key

dashboardId = 985374
key = "test-key"
deleteKey = "delete-key"
value = "test"


class FilterStateTests(SupersetTestCase):
    @pytest.fixture(scope="session", autouse=True)
    def before_all(self):
        with app.app_context() as ctx:
            # init cache
            app.config["FILTER_STATE_CACHE_CONFIG"] = {"CACHE_TYPE": "SimpleCache"}
            cache_manager.init_app(app)
            cache_manager.filter_state_cache.set(cache_key(dashboardId, key), value)
            cache_manager.filter_state_cache.set(
                cache_key(dashboardId, deleteKey), value
            )

            # create dashboard
            session: Session = ctx.app.appbuilder.get_session
            dashboard = self.create_dashboard(session)
            yield dashboard

            # delete dashboard
            session.delete(dashboard)
            session.commit()

    def create_dashboard(self, session):
        admin = self.get_user("admin")
        user = session.query(security_manager.user_model).get(admin.id)
        dashboard = Dashboard(
            id=dashboardId,
            dashboard_title="test",
            slug=None,
            owners=[user],
            roles=[],
            position_json="",
            css="",
            json_metadata="",
            slices=[],
            published=False,
            created_by=None,
        )
        session.add(dashboard)
        session.commit()
        return dashboard

    def setUp(self):
        self.login(username="admin")

    def test_post(self):
        payload = {
            "value": value,
        }
        resp = self.client.post(
            f"api/v1/dashboard/{dashboardId}/filter_state", json=payload
        )
        assert resp.status_code == 201

    def test_post_bad_request(self):
        payload = {
            "value": 1234,
        }
        resp = self.client.put(
            f"api/v1/dashboard/{dashboardId}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 400

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_post_access_denied(self, mock_raise_for_dashboard_access):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        payload = {
            "value": value,
        }
        resp = self.client.post(
            f"api/v1/dashboard/{dashboardId}/filter_state", json=payload
        )
        assert resp.status_code == 403

    def test_put(self):
        payload = {
            "value": "new value",
        }
        resp = self.client.put(
            f"api/v1/dashboard/{dashboardId}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 200

    def test_put_bad_request(self):
        payload = {
            "value": 1234,
        }
        resp = self.client.put(
            f"api/v1/dashboard/{dashboardId}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 400

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_put_access_denied(self, mock_raise_for_dashboard_access):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        payload = {
            "value": "new value",
        }
        resp = self.client.put(
            f"api/v1/dashboard/{dashboardId}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 403

    def test_get_key_not_found(self):
        resp = self.client.get("unknown-key")
        assert resp.status_code == 404

    def test_get_dashboard_not_found(self):
        resp = self.client.get(f"api/v1/dashboard/{-1}/filter_state/{key}/")
        assert resp.status_code == 404

    def test_get(self):
        resp = self.client.get(f"api/v1/dashboard/{dashboardId}/filter_state/{key}/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        assert value == data.get("value")

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_get_access_denied(self, mock_raise_for_dashboard_access):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        resp = self.client.get(f"api/v1/dashboard/{dashboardId}/filter_state/{key}/")
        assert resp.status_code == 403

    def test_delete(self):
        resp = self.client.delete(
            f"api/v1/dashboard/{dashboardId}/filter_state/{deleteKey}/"
        )
        assert resp.status_code == 200

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_delete_access_denied(self, mock_raise_for_dashboard_access):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        resp = self.client.delete(
            f"api/v1/dashboard/{dashboardId}/filter_state/{deleteKey}/"
        )
        assert resp.status_code == 403
