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

from unittest.mock import MagicMock, patch

from superset.daos.theme import ThemeDAO
from superset.models.core import Theme


class TestThemeDAO:
    """Test ThemeDAO functionality"""

    @patch("superset.daos.theme.db.session")
    def test_find_system_default_single(self, mock_session):
        """Test finding system default theme when exactly one exists"""
        # Create a mock theme
        mock_theme = MagicMock(spec=Theme)
        mock_theme.is_system_default = True

        # Mock the query chain
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [mock_theme]

        # Call the method
        result = ThemeDAO.find_system_default()

        # Verify the result
        assert result == mock_theme

    @patch("superset.daos.theme.db.session")
    @patch("superset.daos.theme.logger")
    def test_find_system_default_multiple(self, mock_logger, mock_session):
        """Test finding system default theme when multiple exist"""
        # Create mock themes
        mock_theme1 = MagicMock(spec=Theme)
        mock_theme1.is_system_default = True
        mock_theme2 = MagicMock(spec=Theme)
        mock_theme2.is_system_default = True

        # Create mock fallback theme
        mock_fallback = MagicMock(spec=Theme)
        mock_fallback.is_system = True
        mock_fallback.theme_name = "THEME_DEFAULT"

        # Mock the query chains - need separate mocks for each query call
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()
        mock_session.query.side_effect = [mock_query1, mock_query2]

        # First query returns multiple themes
        mock_filter1 = MagicMock()
        mock_query1.filter.return_value = mock_filter1
        mock_filter1.all.return_value = [mock_theme1, mock_theme2]

        # Second query returns fallback theme
        mock_filter2 = MagicMock()
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = mock_fallback

        # Call the method
        result = ThemeDAO.find_system_default()

        # Verify warning was logged
        mock_logger.warning.assert_called_once()
        assert (
            "Multiple system default themes found (2)"
            in mock_logger.warning.call_args[0][0]
        )

        # Verify the result is the fallback theme
        assert result == mock_fallback

    @patch("superset.daos.theme.db.session")
    def test_find_system_default_none(self, mock_session):
        """Test finding system default theme when none exist"""
        # Create mock fallback theme
        mock_fallback = MagicMock(spec=Theme)
        mock_fallback.is_system = True
        mock_fallback.theme_name = "THEME_DEFAULT"

        # Mock the query chains - need separate mocks for each query call
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()
        mock_session.query.side_effect = [mock_query1, mock_query2]

        # First query returns no themes
        mock_filter1 = MagicMock()
        mock_query1.filter.return_value = mock_filter1
        mock_filter1.all.return_value = []

        # Second query returns fallback theme
        mock_filter2 = MagicMock()
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = mock_fallback

        # Call the method
        result = ThemeDAO.find_system_default()

        # Verify the result is the fallback theme
        assert result == mock_fallback

    @patch("superset.daos.theme.db.session")
    def test_find_system_dark_single(self, mock_session):
        """Test finding system dark theme when exactly one exists"""
        # Create a mock theme
        mock_theme = MagicMock(spec=Theme)
        mock_theme.is_system_dark = True

        # Mock the query chain
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [mock_theme]

        # Call the method
        result = ThemeDAO.find_system_dark()

        # Verify the result
        assert result == mock_theme

    @patch("superset.daos.theme.db.session")
    @patch("superset.daos.theme.logger")
    def test_find_system_dark_multiple(self, mock_logger, mock_session):
        """Test finding system dark theme when multiple exist"""
        # Create mock themes
        mock_theme1 = MagicMock(spec=Theme)
        mock_theme1.is_system_dark = True
        mock_theme2 = MagicMock(spec=Theme)
        mock_theme2.is_system_dark = True

        # Create mock fallback theme
        mock_fallback = MagicMock(spec=Theme)
        mock_fallback.is_system = True
        mock_fallback.theme_name = "THEME_DARK"

        # Mock the query chains - need separate mocks for each query call
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()
        mock_session.query.side_effect = [mock_query1, mock_query2]

        # First query returns multiple themes
        mock_filter1 = MagicMock()
        mock_query1.filter.return_value = mock_filter1
        mock_filter1.all.return_value = [mock_theme1, mock_theme2]

        # Second query returns fallback theme
        mock_filter2 = MagicMock()
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = mock_fallback

        # Call the method
        result = ThemeDAO.find_system_dark()

        # Verify warning was logged
        mock_logger.warning.assert_called_once()
        assert (
            "Multiple system dark themes found (2)"
            in mock_logger.warning.call_args[0][0]
        )

        # Verify the result is the fallback theme
        assert result == mock_fallback

    @patch("superset.daos.theme.db.session")
    def test_find_system_dark_none_with_fallback(self, mock_session):
        """Test finding system dark theme when none exist but fallback does"""
        # Create mock fallback theme
        mock_fallback = MagicMock(spec=Theme)
        mock_fallback.is_system = True
        mock_fallback.theme_name = "THEME_DARK"

        # Mock the query chains - need separate mocks for each query call
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()
        mock_session.query.side_effect = [mock_query1, mock_query2]

        # First query returns no themes
        mock_filter1 = MagicMock()
        mock_query1.filter.return_value = mock_filter1
        mock_filter1.all.return_value = []

        # Second query returns fallback theme
        mock_filter2 = MagicMock()
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = mock_fallback

        # Call the method
        result = ThemeDAO.find_system_dark()

        # Verify the result is the fallback theme
        assert result == mock_fallback

    @patch("superset.daos.theme.db.session")
    def test_find_system_dark_none_without_fallback(self, mock_session):
        """Test finding system dark theme when none exist and no fallback"""
        # Mock the query chains - need separate mocks for each query call
        mock_query1 = MagicMock()
        mock_query2 = MagicMock()
        mock_session.query.side_effect = [mock_query1, mock_query2]

        # First query returns no themes
        mock_filter1 = MagicMock()
        mock_query1.filter.return_value = mock_filter1
        mock_filter1.all.return_value = []

        # Second query returns no fallback
        mock_filter2 = MagicMock()
        mock_query2.filter.return_value = mock_filter2
        mock_filter2.first.return_value = None

        # Call the method
        result = ThemeDAO.find_system_dark()

        # Verify the result is None
        assert result is None
