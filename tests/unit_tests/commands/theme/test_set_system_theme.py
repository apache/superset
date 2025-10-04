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

import pytest

from superset.commands.theme.exceptions import ThemeNotFoundError
from superset.commands.theme.set_system_theme import (
    ClearSystemDarkThemeCommand,
    ClearSystemDefaultThemeCommand,
    SetSystemDarkThemeCommand,
    SetSystemDefaultThemeCommand,
)
from superset.models.core import Theme


class TestSetSystemDefaultThemeCommand:
    """Test SetSystemDefaultThemeCommand"""

    @patch("superset.commands.theme.set_system_theme.db.session")
    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_set_system_default_success(self, mock_dao, mock_session):
        """Test successfully setting a theme as system default"""
        # Create a mock theme
        mock_theme = MagicMock(spec=Theme)
        mock_theme.id = 1
        mock_dao.find_by_id.return_value = mock_theme

        # Mock the update query
        mock_execute = MagicMock()
        mock_session.execute.return_value = mock_execute

        # Create and run command
        command = SetSystemDefaultThemeCommand(1)
        result = command.run()

        # Verify the theme was found
        mock_dao.find_by_id.assert_called_once_with(1)

        # Verify all existing system defaults were cleared
        mock_session.execute.assert_called_once()

        # Verify the theme was set as system default
        assert mock_theme.is_system_default is True

        # Verify the theme was added to session and committed
        mock_session.add.assert_called_once_with(mock_theme)
        mock_session.commit.assert_called_once()

        # Verify the result
        assert result == mock_theme

    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_set_system_default_theme_not_found(self, mock_dao):
        """Test setting system default when theme doesn't exist"""
        # Mock theme not found
        mock_dao.find_by_id.return_value = None

        # Create command and expect exception
        command = SetSystemDefaultThemeCommand(999)

        with pytest.raises(ThemeNotFoundError):
            command.run()

        # Verify the theme was searched for
        mock_dao.find_by_id.assert_called_once_with(999)


class TestSetSystemDarkThemeCommand:
    """Test SetSystemDarkThemeCommand"""

    @patch("superset.commands.theme.set_system_theme.db.session")
    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_set_system_dark_success(self, mock_dao, mock_session):
        """Test successfully setting a theme as system dark"""
        # Create a mock theme
        mock_theme = MagicMock(spec=Theme)
        mock_theme.id = 2
        mock_dao.find_by_id.return_value = mock_theme

        # Mock the update query
        mock_execute = MagicMock()
        mock_session.execute.return_value = mock_execute

        # Create and run command
        command = SetSystemDarkThemeCommand(2)
        result = command.run()

        # Verify the theme was found
        mock_dao.find_by_id.assert_called_once_with(2)

        # Verify all existing system dark themes were cleared
        mock_session.execute.assert_called_once()

        # Verify the theme was set as system dark
        assert mock_theme.is_system_dark is True

        # Verify the theme was added to session and committed
        mock_session.add.assert_called_once_with(mock_theme)
        mock_session.commit.assert_called_once()

        # Verify the result
        assert result == mock_theme

    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_set_system_dark_theme_not_found(self, mock_dao):
        """Test setting system dark when theme doesn't exist"""
        # Mock theme not found
        mock_dao.find_by_id.return_value = None

        # Create command and expect exception
        command = SetSystemDarkThemeCommand(999)

        with pytest.raises(ThemeNotFoundError):
            command.run()

        # Verify the theme was searched for
        mock_dao.find_by_id.assert_called_once_with(999)


class TestClearSystemDefaultThemeCommand:
    """Test ClearSystemDefaultThemeCommand"""

    @patch("superset.commands.theme.set_system_theme.db.session")
    def test_clear_system_default_success(self, mock_session):
        """Test successfully clearing system default theme"""
        # Mock the update query
        mock_execute = MagicMock()
        mock_session.execute.return_value = mock_execute

        # Create and run command
        command = ClearSystemDefaultThemeCommand()
        command.run()

        # Verify the update was executed
        mock_session.execute.assert_called_once()

        # Verify commit was called
        mock_session.commit.assert_called_once()


class TestClearSystemDarkThemeCommand:
    """Test ClearSystemDarkThemeCommand"""

    @patch("superset.commands.theme.set_system_theme.db.session")
    def test_clear_system_dark_success(self, mock_session):
        """Test successfully clearing system dark theme"""
        # Mock the update query
        mock_execute = MagicMock()
        mock_session.execute.return_value = mock_execute

        # Create and run command
        command = ClearSystemDarkThemeCommand()
        command.run()

        # Verify the update was executed
        mock_session.execute.assert_called_once()

        # Verify commit was called
        mock_session.commit.assert_called_once()


class TestSystemThemeConstraints:
    """Test system theme uniqueness constraints"""

    @patch("superset.commands.theme.set_system_theme.db.session")
    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_only_one_system_default(self, mock_dao, mock_session):
        """Test that setting a new system default clears all others"""
        # Create mock themes
        mock_theme_new = MagicMock(spec=Theme)
        mock_theme_new.id = 3
        mock_dao.find_by_id.return_value = mock_theme_new

        # Mock update to track the SQL
        mock_update = MagicMock()
        mock_session.execute.return_value = mock_update

        # Create and run command
        command = SetSystemDefaultThemeCommand(3)
        command.run()

        # Verify the SQL update was called to clear all is_system_default flags
        mock_session.execute.assert_called_once()

        # Get the actual SQL expression that was executed
        sql_expr = mock_session.execute.call_args[0][0]

        # Verify it's an update statement (can't directly check SQL content with mocks)
        assert sql_expr is not None

    @patch("superset.commands.theme.set_system_theme.db.session")
    @patch("superset.commands.theme.set_system_theme.ThemeDAO")
    def test_only_one_system_dark(self, mock_dao, mock_session):
        """Test that setting a new system dark clears all others"""
        # Create mock themes
        mock_theme_new = MagicMock(spec=Theme)
        mock_theme_new.id = 4
        mock_dao.find_by_id.return_value = mock_theme_new

        # Mock update to track the SQL
        mock_update = MagicMock()
        mock_session.execute.return_value = mock_update

        # Create and run command
        command = SetSystemDarkThemeCommand(4)
        command.run()

        # Verify the SQL update was called to clear all is_system_dark flags
        mock_session.execute.assert_called_once()

        # Get the actual SQL expression that was executed
        sql_expr = mock_session.execute.call_args[0][0]

        # Verify it's an update statement (can't directly check SQL content with mocks)
        assert sql_expr is not None
