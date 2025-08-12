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
"""Integration tests for theme API permissions"""

import uuid

from superset import db
from superset.models.core import Theme
from superset.utils import json
from tests.conftest import with_config
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestThemeAPIPermissions(SupersetTestCase):
    """Test theme API permissions and system theme functionality"""

    def setUp(self):
        """Set up test fixtures"""
        super().setUp()

        # Generate unique identifier for this test
        self.test_id = str(uuid.uuid4())[:8]

        # Create test themes
        self.regular_theme = Theme(
            theme_name=f"Regular Theme {self.test_id}",
            json_data=json.dumps({"colors": {"primary": "#1890ff"}}),
            is_system=False,
            created_by=self.get_user("admin"),
            changed_by=self.get_user("admin"),
        )

        self.system_theme = Theme(
            theme_name=f"System Theme {self.test_id}",
            json_data=json.dumps({"colors": {"primary": "#000000"}}),
            is_system=True,
            created_by=self.get_user("admin"),
            changed_by=self.get_user("admin"),
        )

        db.session.add_all([self.regular_theme, self.system_theme])
        db.session.commit()

    def tearDown(self):
        """Clean up test fixtures"""
        # Clean up themes
        for theme in [self.regular_theme, self.system_theme]:
            if theme:
                try:
                    db.session.delete(theme)
                except Exception:
                    db.session.rollback()

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

        super().tearDown()

    def test_admin_can_set_system_default(self):
        """Test that admin can set a theme as system default"""
        # Login as admin
        self.login(ADMIN_USERNAME)

        # Set theme as system default
        response = self.client.put(
            f"/api/v1/theme/{self.regular_theme.id}/set_system_default"
        )

        # Should succeed
        assert response.status_code == 200

        # Verify theme is now system default
        theme = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
        assert theme.is_system_default is True

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": True})
    def test_non_admin_cannot_set_system_default(self):
        """Test that non-admin users cannot set system themes"""
        # Login as gamma user
        self.login(GAMMA_USERNAME)

        # Try to set theme as system default
        response = self.client.put(
            f"/api/v1/theme/{self.regular_theme.id}/set_system_default"
        )

        # Should be forbidden
        assert response.status_code == 403
        data = response.get_json()
        assert "Only administrators can set system themes" in data["message"]

        # Verify theme is not system default
        theme = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
        assert theme.is_system_default is False

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": False})
    def test_system_theme_requires_config_enabled(self):
        """Test that system theme APIs require configuration to be enabled"""
        # Login as admin
        self.login(ADMIN_USERNAME)

        # Try to set theme as system default
        response = self.client.put(
            f"/api/v1/theme/{self.regular_theme.id}/set_system_default"
        )

        # Should be forbidden
        assert response.status_code == 403
        data = response.get_json()
        assert "UI theme administration is not enabled" in data["message"]

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": True})
    def test_admin_can_set_system_dark(self):
        """Test that admin can set a theme as system dark"""
        # Login as admin
        self.login(ADMIN_USERNAME)

        # Set theme as system dark
        response = self.client.put(
            f"/api/v1/theme/{self.regular_theme.id}/set_system_dark"
        )

        # Should succeed
        assert response.status_code == 200

        # Verify theme is now system dark
        theme = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
        assert theme.is_system_dark is True

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": True})
    def test_admin_can_unset_system_default(self):
        """Test that admin can unset system default theme"""
        # First set a theme as system default
        self.regular_theme.is_system_default = True
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Unset system default
        response = self.client.delete("/api/v1/theme/unset_system_default")

        # Should succeed
        assert response.status_code == 200

        # Verify no theme is system default
        theme = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
        assert theme.is_system_default is False

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": True})
    def test_admin_can_unset_system_dark(self):
        """Test that admin can unset system dark theme"""
        # First set a theme as system dark
        self.regular_theme.is_system_dark = True
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Unset system dark
        response = self.client.delete("/api/v1/theme/unset_system_dark")

        # Should succeed
        assert response.status_code == 200

        # Verify no theme is system dark
        theme = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
        assert theme.is_system_dark is False

    @with_config({"ENABLE_UI_THEME_ADMINISTRATION": True})
    def test_only_one_system_default_allowed(self):
        """Test that only one theme can be system default at a time"""
        # Create another theme
        theme2 = Theme(
            theme_name=f"Another Theme {self.test_id}",
            json_data=json.dumps({"colors": {"primary": "#ff0000"}}),
            created_by=self.get_user("admin"),
            changed_by=self.get_user("admin"),
        )
        db.session.add(theme2)
        db.session.commit()

        try:
            # Login as admin
            self.login(ADMIN_USERNAME)

            # Set first theme as system default
            response = self.client.put(
                f"/api/v1/theme/{self.regular_theme.id}/set_system_default"
            )
            assert response.status_code == 200

            # Set second theme as system default
            response = self.client.put(f"/api/v1/theme/{theme2.id}/set_system_default")
            assert response.status_code == 200

            # Verify only the second theme is system default
            theme1 = db.session.query(Theme).filter_by(id=self.regular_theme.id).first()
            theme2_check = db.session.query(Theme).filter_by(id=theme2.id).first()

            assert theme1.is_system_default is False
            assert theme2_check.is_system_default is True

        finally:
            # Clean up
            db.session.delete(theme2)
            db.session.commit()

    def test_system_theme_cannot_be_deleted(self):
        """Test that themes set as system themes cannot be deleted"""
        # Set theme as system default
        self.regular_theme.is_system_default = True
        db.session.commit()

        # Login as admin
        self.login(ADMIN_USERNAME)

        # Try to delete the theme
        response = self.client.delete(f"/api/v1/theme/{self.regular_theme.id}")

        # Should fail with appropriate error
        assert response.status_code == 422
        data = response.get_json()
        assert (
            "Cannot delete theme" in data["message"]
            or "system" in data["message"].lower()
        )

    def test_gamma_user_can_read_themes(self):
        """Test that gamma users can read themes"""
        # Login as gamma user
        self.login(GAMMA_USERNAME)

        # Should be able to read themes
        response = self.client.get("/api/v1/theme/")
        assert response.status_code == 200

        # Should be able to read individual theme
        response = self.client.get(f"/api/v1/theme/{self.regular_theme.id}")
        assert response.status_code == 200

        # Note: Gamma users' ability to create/update/delete themes
        # depends on the specific permissions configuration
