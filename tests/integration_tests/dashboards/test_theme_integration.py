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
"""Integration tests for dashboard-theme functionality"""

import json
import uuid

from superset import db
from superset.models.core import Theme
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


class TestDashboardThemeIntegration(SupersetTestCase):
    """Test dashboard-theme integration functionality"""

    def setUp(self):
        """Set up test fixtures"""
        super().setUp()

        # Generate unique identifier for this test
        self.test_id = str(uuid.uuid4())[:8]

        # Create a test theme
        self.theme = Theme(
            theme_name=f"Test Theme {self.test_id}",
            json_data=json.dumps(
                {"colors": {"primary": "#1890ff"}, "typography": {"fontSize": 14}}
            ),
            created_by=self.get_user("admin"),
            changed_by=self.get_user("admin"),
        )
        db.session.add(self.theme)
        db.session.commit()

        # Create a test dashboard with unique slug
        self.dashboard = Dashboard(
            dashboard_title=f"Test Dashboard {self.test_id}",
            slug=f"test-dashboard-{self.test_id}",
            position_json="{}",
            owners=[self.get_user("admin")],
            created_by=self.get_user("admin"),
            changed_by=self.get_user("admin"),
        )
        db.session.add(self.dashboard)
        db.session.commit()

    def tearDown(self):
        """Clean up test fixtures"""
        # Remove theme reference from dashboard first
        if hasattr(self, "dashboard") and self.dashboard:
            self.dashboard.theme_id = None
            db.session.commit()
            db.session.delete(self.dashboard)

        if hasattr(self, "theme") and self.theme:
            db.session.delete(self.theme)

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

        super().tearDown()

    def test_dashboard_theme_assignment(self):
        """Test that themes can be assigned to dashboards"""
        # Assign theme to dashboard
        self.dashboard.theme_id = self.theme.id
        db.session.commit()

        # Verify the assignment
        dashboard = db.session.query(Dashboard).filter_by(id=self.dashboard.id).first()
        assert dashboard.theme_id == self.theme.id
        assert dashboard.theme.theme_name == f"Test Theme {self.test_id}"

    def test_dashboard_api_includes_theme(self):
        """Test that dashboard API includes theme information"""
        # Assign theme to dashboard
        self.dashboard.theme_id = self.theme.id
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Get dashboard via API
        response = self.client.get(f"/api/v1/dashboard/{self.dashboard.id}")
        assert response.status_code == 200

        data = response.get_json()
        result = data["result"]

        # Verify theme is included
        assert "theme" in result
        assert result["theme"]["id"] == self.theme.id
        assert result["theme"]["theme_name"] == f"Test Theme {self.test_id}"

    def test_dashboard_update_with_theme(self):
        """Test updating dashboard with theme via API"""
        # Login as admin
        self.login(ADMIN_USERNAME)

        # Update dashboard with theme
        response = self.client.put(
            f"/api/v1/dashboard/{self.dashboard.id}",
            json={"theme_id": self.theme.id},
        )
        assert response.status_code == 200

        # Verify theme was assigned
        dashboard = db.session.query(Dashboard).filter_by(id=self.dashboard.id).first()
        assert dashboard.theme_id == self.theme.id

    def test_dashboard_theme_removal(self):
        """Test removing theme from dashboard"""
        # First assign theme
        self.dashboard.theme_id = self.theme.id
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Remove theme
        response = self.client.put(
            f"/api/v1/dashboard/{self.dashboard.id}",
            json={"theme_id": None},
        )
        assert response.status_code == 200

        # Verify theme was removed
        dashboard = db.session.query(Dashboard).filter_by(id=self.dashboard.id).first()
        assert dashboard.theme_id is None

    def test_dashboard_with_deleted_theme(self):
        """Test dashboard behavior when assigned theme is deleted"""
        # Assign theme to dashboard
        self.dashboard.theme_id = self.theme.id
        db.session.commit()

        # Remove theme reference and delete the theme
        self.dashboard.theme_id = None
        db.session.commit()
        db.session.delete(self.theme)
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Get dashboard via API - should still work
        response = self.client.get(f"/api/v1/dashboard/{self.dashboard.id}")
        assert response.status_code == 200

        data = response.get_json()
        result = data["result"]

        # Theme should be null
        assert result["theme"] is None

    def test_theme_schema_serialization(self):
        """Test that theme schema properly serializes theme data"""
        # Assign theme to dashboard
        self.dashboard.theme_id = self.theme.id
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Get dashboard via API
        response = self.client.get(f"/api/v1/dashboard/{self.dashboard.id}")
        assert response.status_code == 200

        data = response.get_json()
        result = data["result"]
        theme_data = result["theme"]

        # Verify theme data structure
        assert "id" in theme_data
        assert "theme_name" in theme_data
        assert "json_data" in theme_data

        # Verify json_data is properly serialized
        json_data = json.loads(theme_data["json_data"])
        assert json_data["colors"]["primary"] == "#1890ff"
        assert json_data["typography"]["fontSize"] == 14
