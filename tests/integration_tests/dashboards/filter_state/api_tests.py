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
import json
from typing import Any
from unittest.mock import patch

import pytest
from flask.testing import FlaskClient
from sqlalchemy.orm import Session

from superset import app
from superset.dashboards.commands.exceptions import DashboardAccessDeniedError
from superset.extensions import cache_manager
from superset.key_value.utils import cache_key
from superset.models.dashboard import Dashboard
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
)
from tests.integration_tests.test_app import app

dashboardId = 985374
key = "test-key"
value = "test"


class FilterStateTests:
    @pytest.fixture
    def client(self):
        with app.test_client() as client:
            with app.app_context():
                yield client

    @pytest.fixture
    def dashboard_id(self, load_world_bank_dashboard_with_slices) -> int:
        with app.app_context() as ctx:
            session: Session = ctx.app.appbuilder.get_session
            dashboard = session.query(Dashboard).filter_by(slug="world_health").one()
            return dashboard.id

    @pytest.fixture
    def cache(self, dashboard_id):
        app.config["FILTER_STATE_CACHE_CONFIG"] = {"CACHE_TYPE": "SimpleCache"}
        cache_manager.init_app(app)
        cache_manager.filter_state_cache.set(cache_key(dashboard_id, key), value)

    def setUp(self):
        self.login(username="admin")

    def test_post(self, client, dashboard_id: int):
        payload = {
            "value": value,
        }
        resp = client.post(
            f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
        )
        assert resp.status_code == 201

    def test_post_bad_request(self, client, dashboard_id: int):
        payload = {
            "value": 1234,
        }
        resp = client.put(
            f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 400

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_post_access_denied(
        self, client, mock_raise_for_dashboard_access, dashboard_id: int
    ):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        payload = {
            "value": value,
        }
        resp = client.post(
            f"api/v1/dashboard/{dashboard_id}/filter_state", json=payload
        )
        assert resp.status_code == 403

    def test_put(self, client, dashboard_id: int):
        payload = {
            "value": "new value",
        }
        resp = client.put(
            f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 200

    def test_put_bad_request(self, client, dashboard_id: int):
        payload = {
            "value": 1234,
        }
        resp = client.put(
            f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 400

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_put_access_denied(
        self, client, mock_raise_for_dashboard_access, dashboard_id: int
    ):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        payload = {
            "value": "new value",
        }
        resp = client.put(
            f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/", json=payload
        )
        assert resp.status_code == 403

    def test_get_key_not_found(self, client):
        resp = client.get("unknown-key")
        assert resp.status_code == 404

    def test_get_dashboard_not_found(self, client):
        resp = client.get(f"api/v1/dashboard/{-1}/filter_state/{key}/")
        assert resp.status_code == 404

    def test_get(self, client, dashboard_id: int):
        resp = client.get(f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        assert value == data.get("value")

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_get_access_denied(
        self, client, mock_raise_for_dashboard_access, dashboard_id
    ):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        resp = client.get(f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/")
        assert resp.status_code == 403

    def test_delete(self, client, dashboard_id: int):
        resp = client.delete(f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/")
        assert resp.status_code == 200

    @patch("superset.security.SupersetSecurityManager.raise_for_dashboard_access")
    def test_delete_access_denied(
        self, client, mock_raise_for_dashboard_access, dashboard_id: int
    ):
        mock_raise_for_dashboard_access.side_effect = DashboardAccessDeniedError()
        resp = client.delete(f"api/v1/dashboard/{dashboard_id}/filter_state/{key}/")
        assert resp.status_code == 403
