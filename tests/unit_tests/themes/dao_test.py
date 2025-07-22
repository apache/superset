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

from unittest.mock import Mock, patch

from superset.daos.theme import ThemeDAO
from superset.models.core import Theme


class TestThemeDAO:
    """Unit tests for ThemeDAO class"""

    @patch("superset.daos.theme.db")
    def test_find_by_uuid_exists(self, mock_db):
        """Test finding a theme by UUID when it exists"""
        # Arrange
        mock_theme = Mock(spec=Theme)
        mock_theme.uuid = "test-uuid-123"
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.first.return_value = mock_theme

        # Act
        result = ThemeDAO.find_by_uuid("test-uuid-123")

        # Assert
        assert result == mock_theme
        mock_db.session.query.assert_called_once_with(Theme)
        mock_query.filter.assert_called_once()
        mock_query.filter.return_value.first.assert_called_once()

    @patch("superset.daos.theme.db")
    def test_find_by_uuid_not_exists(self, mock_db):
        """Test finding a theme by UUID when it doesn't exist"""
        # Arrange
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.first.return_value = None

        # Act
        result = ThemeDAO.find_by_uuid("nonexistent-uuid")

        # Assert
        assert result is None

    def test_resolve_theme_with_uuid_no_uuid_field(self):
        """Test resolve_theme_with_uuid when config has no uuid field"""
        # Arrange
        theme_config = {"algorithm": "default", "token": {}}

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        assert result == theme_config

    @patch.object(ThemeDAO, "find_by_uuid")
    def test_resolve_theme_with_uuid_theme_found(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid when UUID resolves to a theme"""
        # Arrange
        theme_config = {"uuid": "test-uuid", "algorithm": "default"}
        mock_theme = Mock(spec=Theme)
        mock_theme.json_data = (
            '{"algorithm": "dark", "token": {"colorPrimary": "#000"}}'
        )
        mock_find_by_uuid.return_value = mock_theme

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        expected_result = {"algorithm": "dark", "token": {"colorPrimary": "#000"}}
        assert result == expected_result
        mock_find_by_uuid.assert_called_once_with("test-uuid")

    @patch.object(ThemeDAO, "find_by_uuid")
    def test_resolve_theme_with_uuid_theme_not_found(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid when UUID doesn't resolve to a theme"""
        # Arrange
        theme_config = {"uuid": "nonexistent-uuid", "algorithm": "default"}
        mock_find_by_uuid.return_value = None

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        assert result == theme_config

    @patch.object(ThemeDAO, "find_by_uuid")
    def test_resolve_theme_with_uuid_theme_no_json_data(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid when theme exists but has no json_data"""
        # Arrange
        theme_config = {"uuid": "test-uuid", "algorithm": "default"}
        mock_theme = Mock(spec=Theme)
        mock_theme.json_data = None
        mock_find_by_uuid.return_value = mock_theme

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        assert result == theme_config

    @patch.object(ThemeDAO, "find_by_uuid")
    def test_resolve_theme_with_uuid_invalid_json(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid when theme has invalid JSON data"""
        # Arrange
        theme_config = {"uuid": "test-uuid", "algorithm": "default"}
        mock_theme = Mock(spec=Theme)
        mock_theme.json_data = '{"invalid": json}'  # Invalid JSON
        mock_find_by_uuid.return_value = mock_theme

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        # Should return original config on JSON parse error
        assert result == theme_config

    @patch.object(ThemeDAO, "find_by_uuid")
    def test_resolve_theme_with_uuid_exception_handling(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid handles exceptions gracefully"""
        # Arrange
        theme_config = {"uuid": "test-uuid", "algorithm": "default"}
        mock_find_by_uuid.side_effect = Exception("Database error")

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert
        assert result == theme_config  # Should return original config on exception
