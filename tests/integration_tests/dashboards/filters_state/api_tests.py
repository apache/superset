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
from superset import security_manager
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.test_app import app
from sqlalchemy.orm import Session

dashboardId = 1
value = "test"


class FilterStateTests(SupersetTestCase):
    def post(self):
        payload = {
            "value": value,
        }
        return self.client.post(
            f"api/v1/dashboard/{dashboardId}/filters_state", json=payload
        )

    def clearTable(self, session, model):
        rows = session.query(model).all()
        for row in rows:
            session.delete(row)
        session.commit()

    def createDashboard(self, session):
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

    @pytest.fixture(autouse=True, scope="session")
    def beforeAll(self):
        with app.app_context() as ctx:
            session: Session = ctx.app.appbuilder.get_session
            self.clearTable(session, Dashboard)
            self.createDashboard(session)

    def setUp(self):
        self.login(username="admin")

    def test_post(self):
        resp = self.post()
        assert resp.status_code == 201

    def test_get_not_found(self):
        resp = self.client.get("unknown-key")
        assert resp.status_code == 404

    def test_get(self):
        resp = self.post()
        data = json.loads(resp.data.decode("utf-8"))
        key = data.get("key")
        resp = self.client.get(f"api/v1/dashboard/{dashboardId}/filters_state/{key}/")
        assert resp.status_code == 200
        data = json.loads(resp.data.decode("utf-8"))
        assert value == data.get("value")
