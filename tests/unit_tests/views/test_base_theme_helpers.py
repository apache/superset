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

from superset.views.base import (
    _load_theme_from_model,
    _process_theme,
    _validate_base_theme,
    should_use_base,
)


class TestThemeHelpers:
    """Test theme helper functions in views/base.py"""

    def test_should_use_base_none(self):
        """Test should_use_base returns True for None theme"""
        assert should_use_base(None) is True

    def test_should_use_base_empty(self):
        """Test should_use_base returns True for empty theme"""
        assert should_use_base({}) is True

    def test_should_use_base_with_content(self):
        """Test should_use_base returns False for theme with content"""
        assert should_use_base({"token": {"colorPrimary": "#000"}}) is False

    def test_load_theme_from_model_none(self):
        """Test _load_theme_from_model with None model"""
        fallback = {"token": {"colorPrimary": "#111"}}
        result = _load_theme_from_model(None, fallback, "test")
        assert result == fallback

    def test_load_theme_from_model_valid_json(self):
        """Test _load_theme_from_model with valid JSON"""
        mock_model = MagicMock()
        mock_model.json_data = '{"token": {"colorPrimary": "#222"}}'
        mock_model.id = 1
        fallback = {"token": {"colorPrimary": "#111"}}

        result = _load_theme_from_model(mock_model, fallback, "test")
        assert result == {"token": {"colorPrimary": "#222"}}

    @patch("superset.views.base.logger")
    def test_load_theme_from_model_invalid_json(self, mock_logger):
        """Test _load_theme_from_model with invalid JSON"""
        mock_model = MagicMock()
        mock_model.json_data = "invalid json{"
        mock_model.id = 1
        fallback = {"token": {"colorPrimary": "#111"}}

        result = _load_theme_from_model(mock_model, fallback, "test")
        assert result == fallback
        mock_logger.error.assert_called_once_with(
            "Invalid JSON in system %s theme %s", "test", 1
        )

    @patch("superset.views.base.should_use_base")
    def test_process_theme_should_use_base(self, mock_should_use):
        """Test _process_theme when should_use_base returns True"""
        mock_should_use.return_value = True
        theme = {"token": {"colorPrimary": "#333"}}

        result = _process_theme(theme, "test")
        assert result == {}
        mock_should_use.assert_called_once_with(theme)

    @patch("superset.views.base.should_use_base")
    @patch("superset.views.base.is_valid_theme")
    def test_process_theme_invalid(self, mock_is_valid, mock_should_use):
        """Test _process_theme with invalid theme"""
        mock_should_use.return_value = False
        mock_is_valid.return_value = False
        theme = {"invalid": "theme"}

        with patch("superset.views.base.logger") as mock_logger:
            result = _process_theme(theme, "test")
            assert result == {}
            mock_logger.warning.assert_called_once_with(
                "Invalid %s theme configuration: %s, clearing it",
                "test",
                theme,
            )

    @patch("superset.views.base.should_use_base")
    @patch("superset.views.base.is_valid_theme")
    def test_process_theme_valid(self, mock_is_valid, mock_should_use):
        """Test _process_theme with valid theme"""
        mock_should_use.return_value = False
        mock_is_valid.return_value = True
        theme = {"token": {"colorPrimary": "#444"}}

        result = _process_theme(theme, "test")
        assert result == theme

    def test_process_theme_none_returns_empty(self):
        """Test _process_theme with None returns empty dict"""
        result = _process_theme(None, "test")
        assert result == {}

    @patch("superset.views.base.is_valid_theme")
    def test_validate_base_theme_valid(self, mock_is_valid):
        """Test _validate_base_theme with valid theme"""
        mock_is_valid.return_value = True
        theme = {"token": {"colorPrimary": "#555"}}

        result = _validate_base_theme(theme, "test")
        assert result == theme

    @patch("superset.views.base.is_valid_theme")
    def test_validate_base_theme_invalid(self, mock_is_valid):
        """Test _validate_base_theme with invalid theme"""
        mock_is_valid.return_value = False
        theme = {"invalid": "base_theme"}

        with patch("superset.views.base.logger") as mock_logger:
            result = _validate_base_theme(theme, "test")
            assert result is None
            mock_logger.warning.assert_called_once_with(
                "Invalid %s theme configuration: %s, ignoring",
                "test",
                theme,
            )

    def test_validate_base_theme_none(self):
        """Test _validate_base_theme with None theme"""
        result = _validate_base_theme(None, "test")
        assert result is None


class TestGetThemeBootstrapData:
    """Test get_theme_bootstrap_data function with various scenarios"""

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    @patch("superset.views.base.ThemeDAO")
    def test_ui_admin_enabled_with_db_themes(
        self,
        mock_dao,
        mock_get_config,
        mock_app,
    ):
        """Test with UI admin enabled and themes in database"""
        # Setup
        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "ENABLE_UI_THEME_ADMINISTRATION": True,
            "BASE_THEME_DEFAULT": {"token": {"colorPrimary": "#base1"}},
            "BASE_THEME_DARK": {"token": {"colorPrimary": "#base2"}},
        }.get(k, d)

        mock_get_config.side_effect = lambda k: {
            "THEME_DEFAULT": {"token": {"colorPrimary": "#config1"}},
            "THEME_DARK": {"token": {"colorPrimary": "#config2"}},
        }.get(k)

        mock_default_theme = MagicMock()
        mock_default_theme.json_data = '{"token": {"colorPrimary": "#db1"}}'
        mock_dark_theme = MagicMock()
        mock_dark_theme.json_data = '{"token": {"colorPrimary": "#db2"}}'

        mock_dao.find_system_default.return_value = mock_default_theme
        mock_dao.find_system_dark.return_value = mock_dark_theme

        # Import here to avoid circular imports
        from superset.views.base import get_theme_bootstrap_data

        result = get_theme_bootstrap_data()

        # Verify
        assert result["theme"]["enableUiThemeAdministration"] is True
        assert "default" in result["theme"]
        assert "dark" in result["theme"]
        assert "baseThemeDefault" in result["theme"]
        assert "baseThemeDark" in result["theme"]

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    def test_ui_admin_disabled(self, mock_get_config, mock_app):
        """Test with UI admin disabled, uses config themes"""
        # Setup
        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "ENABLE_UI_THEME_ADMINISTRATION": False,
            "BASE_THEME_DEFAULT": {"token": {"colorPrimary": "#base1"}},
            "BASE_THEME_DARK": {"token": {"colorPrimary": "#base2"}},
        }.get(k, d)

        mock_get_config.side_effect = lambda k: {
            "THEME_DEFAULT": {"token": {"colorPrimary": "#config1"}},
            "THEME_DARK": {"token": {"colorPrimary": "#config2"}},
        }.get(k)

        # Import here to avoid circular imports
        from superset.views.base import get_theme_bootstrap_data

        result = get_theme_bootstrap_data()

        # Verify
        assert result["theme"]["enableUiThemeAdministration"] is False
        assert result["theme"]["default"] == {"token": {"colorPrimary": "#config1"}}
        assert result["theme"]["dark"] == {"token": {"colorPrimary": "#config2"}}
