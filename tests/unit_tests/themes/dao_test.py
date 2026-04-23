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
