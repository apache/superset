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

from superset import db
from superset.models.core import Theme
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase


class TestThemeApiEndpoints(SupersetTestCase):
    """Integration tests for Theme API endpoints"""

    def setUp(self):
        """Set up test fixtures"""
        super().setUp()
        self.login("admin")

        # Clean up any existing themes
        db.session.query(Theme).delete()
        db.session.commit()

    def tearDown(self):
        """Clean up after tests"""
        # Clean up any themes created during tests
        db.session.query(Theme).delete()
        db.session.commit()
        super().tearDown()

    def test_post_theme_success(self):
        """Test successful theme creation via POST"""
        # Arrange
        theme_data = {
            "theme_name": "Test Theme",
            "json_data": json.dumps({"algorithm": "default", "token": {}}),
        }

        # Act
        response = self.client.post(
            "/api/v1/theme/",
            json=theme_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 201
        response_data = json.loads(response.data)
        assert "id" in response_data

        # Verify theme was created in database
        created_theme = (
            db.session.query(Theme).filter_by(theme_name="Test Theme").first()
        )
        assert created_theme is not None
        assert created_theme.is_system is False
        assert created_theme.uuid is not None

    def test_post_theme_validation_error(self):
        """Test POST with invalid data returns validation error"""
        # Arrange
        invalid_data = {
            "theme_name": "",  # Required field empty
            "json_data": json.dumps({"algorithm": "default"}),
        }

        # Act
        response = self.client.post(
            "/api/v1/theme/",
            json=invalid_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 400

    def test_post_theme_missing_required_field(self):
        """Test POST with missing required field"""
        # Arrange
        incomplete_data = {
            "theme_name": "Test Theme"
            # Missing json_data
        }

        # Act
        response = self.client.post(
            "/api/v1/theme/",
            json=incomplete_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 400

    def test_put_theme_success(self):
        """Test successful theme update via PUT"""
        # Arrange - Create a theme first
        theme = Theme(
            theme_name="Original Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        db.session.add(theme)
        db.session.commit()

        update_data = {
            "theme_name": "Updated Theme",
            "json_data": json.dumps({"algorithm": "dark"}),
        }

        # Act
        response = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json=update_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 200

        # Verify theme was updated
        updated_theme = db.session.query(Theme).get(theme.id)
        assert updated_theme.theme_name == "Updated Theme"
        assert '"algorithm": "dark"' in updated_theme.json_data

    def test_put_theme_filters_readonly_fields(self):
        """Test PUT filters out read-only fields like is_system and uuid"""
        # Arrange - Create a theme first
        theme = Theme(
            theme_name="Original Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        db.session.add(theme)
        db.session.commit()
        original_uuid = theme.uuid

        # Try to update with read-only fields
        update_data = {
            "theme_name": "Updated Theme",
            "json_data": json.dumps({"algorithm": "dark"}),
            "is_system": True,  # Should be filtered out
            "uuid": "new-uuid",  # Should be filtered out
        }

        # Act
        response = self.client.put(
            f"/api/v1/theme/{theme.id}",
            json=update_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 200

        # Verify only editable fields were updated
        updated_theme = db.session.query(Theme).get(theme.id)
        assert updated_theme.theme_name == "Updated Theme"
        assert updated_theme.is_system is False  # Should remain unchanged
        assert updated_theme.uuid == original_uuid  # Should remain unchanged

    def test_put_system_theme_protection(self):
        """Test PUT fails when trying to update system theme"""
        # Arrange - Create a system theme
        system_theme = Theme(
            theme_name="System Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=True,
        )
        db.session.add(system_theme)
        db.session.commit()

        update_data = {
            "theme_name": "Hacked System Theme",
            "json_data": json.dumps({"algorithm": "dark"}),
        }

        # Act
        response = self.client.put(
            f"/api/v1/theme/{system_theme.id}",
            json=update_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 403
        response_data = json.loads(response.data)
        assert "Forbidden" in response_data.get("message", "")

    def test_put_theme_not_found(self):
        """Test PUT with non-existent theme ID"""
        # Arrange
        update_data = {
            "theme_name": "Updated Theme",
            "json_data": json.dumps({"algorithm": "dark"}),
        }

        # Act
        response = self.client.put(
            "/api/v1/theme/99999",  # Non-existent ID
            json=update_data,
            headers={"Content-Type": "application/json"},
        )

        # Assert
        assert response.status_code == 404

    def test_bulk_delete_excludes_system_themes(self):
        """Test bulk delete excludes system themes"""
        # Arrange - Create regular and system themes
        regular_theme = Theme(
            theme_name="Regular Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        system_theme = Theme(
            theme_name="System Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=True,
        )
        db.session.add_all([regular_theme, system_theme])
        db.session.commit()

        # Act - Try to delete both themes
        response = self.client.delete(
            f"/api/v1/theme/?q={json.dumps([regular_theme.id, system_theme.id])}"
        )

        # Assert
        assert response.status_code == 403  # Should fail due to system theme protection

        # Verify both themes still exist
        assert db.session.query(Theme).get(regular_theme.id) is not None
        assert db.session.query(Theme).get(system_theme.id) is not None

    def test_bulk_delete_regular_themes_only(self):
        """Test bulk delete works with regular themes only"""
        # Arrange - Create only regular themes
        theme1 = Theme(
            theme_name="Theme 1",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        theme2 = Theme(
            theme_name="Theme 2",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        db.session.add_all([theme1, theme2])
        db.session.commit()

        # Act
        response = self.client.delete(
            f"/api/v1/theme/?q={json.dumps([theme1.id, theme2.id])}"
        )

        # Assert
        assert response.status_code == 200

        # Verify themes were deleted
        assert db.session.query(Theme).get(theme1.id) is None
        assert db.session.query(Theme).get(theme2.id) is None

    def test_get_theme_includes_new_fields(self):
        """Test GET theme includes is_system and uuid fields"""
        # Arrange
        theme = Theme(
            theme_name="Test Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=False,
        )
        db.session.add(theme)
        db.session.commit()

        # Act
        response = self.client.get(f"/api/v1/theme/{theme.id}")

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.data)
        result = response_data.get("result", {})

        assert "is_system" in result
        assert "uuid" in result
        assert result["is_system"] is False
        assert result["uuid"] is not None

    def test_get_theme_list_includes_new_fields(self):
        """Test GET theme list includes is_system and uuid fields"""
        # Arrange
        theme = Theme(
            theme_name="Test Theme",
            json_data=json.dumps({"algorithm": "default"}),
            is_system=True,
        )
        db.session.add(theme)
        db.session.commit()

        # Act
        response = self.client.get("/api/v1/theme/")

        # Assert
        assert response.status_code == 200
        response_data = json.loads(response.data)
        results = response_data.get("result", [])

        assert len(results) > 0
        theme_data = results[0]
        assert "is_system" in theme_data
        assert "uuid" in theme_data
