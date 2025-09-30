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

from superset.themes.types import ThemeMode
from superset.views.base import (
    _load_theme_from_model,
    _merge_theme_dicts,
    _process_theme,
    get_theme_bootstrap_data,
)


class TestThemeHelpers:
    """Test theme helper functions in views/base.py"""

    def test_merge_theme_dicts_simple(self):
        """Test merging simple theme dictionaries"""
        base = {"token": {"colorPrimary": "#000"}}
        overlay = {"token": {"colorPrimary": "#fff"}}
        result = _merge_theme_dicts(base, overlay)
        assert result == {"token": {"colorPrimary": "#fff"}}

    def test_merge_theme_dicts_nested(self):
        """Test merging nested theme dictionaries"""
        base = {"token": {"colorPrimary": "#000", "fontSize": 14}}
        overlay = {"token": {"colorPrimary": "#fff"}}
        result = _merge_theme_dicts(base, overlay)
        assert result == {"token": {"colorPrimary": "#fff", "fontSize": 14}}

    def test_merge_theme_dicts_algorithm(self):
        """Test merging theme with algorithm"""
        base = {"token": {"colorPrimary": "#000"}, "algorithm": "default"}
        overlay = {"algorithm": "dark"}
        result = _merge_theme_dicts(base, overlay)
        assert result == {"token": {"colorPrimary": "#000"}, "algorithm": "dark"}

    def test_merge_theme_dicts_arrays_replaced(self):
        """Test that arrays are replaced, not merged by index"""
        base = {
            "token": {"colorPrimary": "#000"},
            "algorithm": ["default", "compact"],
            "components": {
                "Button": {"sizes": ["small", "medium", "large"]},
            },
        }
        overlay = {
            "algorithm": ["dark"],
            "components": {
                "Button": {"sizes": ["xs", "sm"]},
            },
        }
        result = _merge_theme_dicts(base, overlay)

        # Arrays should be completely replaced, not merged
        assert result["algorithm"] == ["dark"]  # Not ["dark", "compact"]
        assert result["components"]["Button"]["sizes"] == [
            "xs",
            "sm",
        ]  # Not ["xs", "sm", "large"]
        assert result["token"]["colorPrimary"] == "#000"  # Preserved

    def test_merge_minimal_theme_preserves_base(self):
        """Test that minimal theme overlay preserves all base tokens"""
        # Simulate a full base theme from config
        base_theme = {
            "token": {
                "colorPrimary": "#1890ff",
                "colorSuccess": "#52c41a",
                "colorWarning": "#faad14",
                "colorError": "#f5222d",
                "fontSize": 14,
                "borderRadius": 6,
                "wireframe": False,
                "colorBgContainer": "#ffffff",
                "colorText": "#000000",
            },
            "algorithm": "default",
            "components": {
                "Button": {"colorPrimary": "#1890ff"},
                "Input": {"borderRadius": 4},
            },
        }

        # Minimal overlay theme (like from database)
        minimal_overlay = {
            "token": {
                "colorPrimary": "#ff00ff",  # Only override primary color
            },
            "algorithm": "dark",  # Change to dark mode
        }

        result = _merge_theme_dicts(base_theme, minimal_overlay)

        # Should preserve all base tokens except the ones explicitly overridden
        assert result["token"]["colorPrimary"] == "#ff00ff"  # Overridden
        assert result["token"]["colorSuccess"] == "#52c41a"  # Preserved from base
        assert result["token"]["colorWarning"] == "#faad14"  # Preserved from base
        assert result["token"]["colorError"] == "#f5222d"  # Preserved from base
        assert result["token"]["fontSize"] == 14  # Preserved from base
        assert result["token"]["borderRadius"] == 6  # Preserved from base
        assert result["token"]["wireframe"] is False  # Preserved from base
        assert result["token"]["colorBgContainer"] == "#ffffff"  # Preserved from base
        assert result["token"]["colorText"] == "#000000"  # Preserved from base
        assert result["algorithm"] == "dark"  # Overridden
        assert result["components"]["Button"]["colorPrimary"] == "#1890ff"  # Preserved
        assert result["components"]["Input"]["borderRadius"] == 4  # Preserved

    def test_merge_complete_theme_replaces_tokens(self):
        """Test that complete theme overlay replaces all specified tokens"""
        # Base theme from config
        base_theme = {
            "token": {
                "colorPrimary": "#1890ff",
                "colorSuccess": "#52c41a",
                "colorWarning": "#faad14",
                "fontSize": 14,
                "borderRadius": 6,
            },
            "algorithm": "default",
        }

        # Complete overlay theme that redefines everything
        complete_overlay = {
            "token": {
                "colorPrimary": "#ff0000",
                "colorSuccess": "#00ff00",
                "colorWarning": "#ffff00",
                "fontSize": 16,
                "borderRadius": 8,
                # Adding new tokens not in base
                "colorInfo": "#0000ff",
                "lineHeight": 1.5,
            },
            "algorithm": "dark",
            "components": {
                "Button": {"size": "large"},
            },
        }

        result = _merge_theme_dicts(base_theme, complete_overlay)

        # All overlay tokens should replace base tokens
        assert result["token"]["colorPrimary"] == "#ff0000"
        assert result["token"]["colorSuccess"] == "#00ff00"
        assert result["token"]["colorWarning"] == "#ffff00"
        assert result["token"]["fontSize"] == 16
        assert result["token"]["borderRadius"] == 8
        # New tokens should be added
        assert result["token"]["colorInfo"] == "#0000ff"
        assert result["token"]["lineHeight"] == 1.5
        # Algorithm should be replaced
        assert result["algorithm"] == "dark"
        # New components should be added
        assert result["components"]["Button"]["size"] == "large"

    def test_load_theme_from_model_none(self):
        """Test _load_theme_from_model with None model"""
        fallback = {"token": {"colorPrimary": "#111"}}
        result = _load_theme_from_model(None, fallback, "test")
        assert result == fallback

    def test_load_theme_from_model_minimal_theme(self):
        """Test _load_theme_from_model with minimal theme that merges with base"""
        mock_model = MagicMock()
        # Minimal theme from database - only overrides primary color
        mock_model.json_data = '{"token": {"colorPrimary": "#ff00ff"}}'
        mock_model.id = 1
        # Full base theme from config
        fallback = {
            "token": {
                "colorPrimary": "#1890ff",
                "colorSuccess": "#52c41a",
                "colorWarning": "#faad14",
                "fontSize": 14,
                "borderRadius": 6,
            },
            "algorithm": "default",
        }

        result = _load_theme_from_model(mock_model, fallback, "test")

        # Should merge, preserving base tokens
        assert result["token"]["colorPrimary"] == "#ff00ff"  # From database
        assert result["token"]["colorSuccess"] == "#52c41a"  # From base
        assert result["token"]["colorWarning"] == "#faad14"  # From base
        assert result["token"]["fontSize"] == 14  # From base
        assert result["token"]["borderRadius"] == 6  # From base
        assert result["algorithm"] == "default"  # From base

    def test_load_theme_from_model_complete_theme(self):
        """Test _load_theme_from_model with complete theme that replaces base tokens"""
        mock_model = MagicMock()
        # Complete theme from database - redefines all tokens
        mock_model.json_data = """{
            "token": {
                "colorPrimary": "#ff0000",
                "colorSuccess": "#00ff00",
                "colorWarning": "#ffff00",
                "fontSize": 16,
                "borderRadius": 8,
                "colorInfo": "#0000ff"
            },
            "algorithm": "dark"
        }"""
        mock_model.id = 1
        # Base theme from config
        fallback = {
            "token": {
                "colorPrimary": "#1890ff",
                "colorSuccess": "#52c41a",
                "colorWarning": "#faad14",
                "fontSize": 14,
                "borderRadius": 6,
            },
            "algorithm": "default",
        }

        result = _load_theme_from_model(mock_model, fallback, "test")

        # All database tokens should replace base tokens
        assert result["token"]["colorPrimary"] == "#ff0000"  # From database
        assert result["token"]["colorSuccess"] == "#00ff00"  # From database
        assert result["token"]["colorWarning"] == "#ffff00"  # From database
        assert result["token"]["fontSize"] == 16  # From database
        assert result["token"]["borderRadius"] == 8  # From database
        assert result["token"]["colorInfo"] == "#0000ff"  # New from database
        assert result["algorithm"] == "dark"  # From database

    @patch("superset.views.base.logger")
    def test_load_theme_from_model_invalid_json(self, mock_logger):
        """Test _load_theme_from_model with invalid JSON"""
        mock_model = MagicMock()
        mock_model.json_data = "invalid json{"
        mock_model.id = 1
        fallback = {"token": {"colorPrimary": "#111"}}

        result = _load_theme_from_model(mock_model, fallback, ThemeMode.DEFAULT)
        assert result == fallback
        mock_logger.error.assert_called_once_with(
            "Invalid JSON in system %s theme %s", "default", 1
        )

    def test_process_theme_none(self):
        """Test _process_theme with None theme"""
        result = _process_theme(None, ThemeMode.DEFAULT)
        assert result == {}

    def test_process_theme_empty(self):
        """Test _process_theme with empty theme"""
        result = _process_theme({}, ThemeMode.DEFAULT)
        assert result == {}

    @patch("superset.views.base.is_valid_theme")
    def test_process_theme_invalid(self, mock_is_valid):
        """Test _process_theme with invalid theme"""
        mock_is_valid.return_value = False
        theme = {"invalid": "theme"}

        with patch("superset.views.base.logger") as mock_logger:
            result = _process_theme(theme, ThemeMode.DEFAULT)
            assert result == {}
            mock_logger.warning.assert_called_once_with(
                "Invalid %s theme configuration: %s, clearing it",
                "default",
                theme,
            )

    @patch("superset.views.base.is_valid_theme")
    def test_process_theme_valid(self, mock_is_valid):
        """Test _process_theme with valid theme"""
        mock_is_valid.return_value = True
        theme = {"token": {"colorPrimary": "#444"}}

        result = _process_theme(theme, ThemeMode.DEFAULT)
        assert result == theme

    def test_process_theme_none_returns_empty(self):
        """Test _process_theme with None returns empty dict"""
        result = _process_theme(None, ThemeMode.DEFAULT)
        assert result == {}


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

        result = get_theme_bootstrap_data()

        # Verify
        assert result["theme"]["enableUiThemeAdministration"] is True
        assert "default" in result["theme"]
        assert "dark" in result["theme"]
        assert "baseThemeDefault" not in result["theme"]
        assert "baseThemeDark" not in result["theme"]

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

        result = get_theme_bootstrap_data()

        # Verify
        assert result["theme"]["enableUiThemeAdministration"] is False
        assert result["theme"]["default"] == {"token": {"colorPrimary": "#config1"}}
        assert result["theme"]["dark"] == {"token": {"colorPrimary": "#config2"}}

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    @patch("superset.views.base.ThemeDAO")
    def test_ui_admin_enabled_minimal_db_theme(
        self,
        mock_dao,
        mock_get_config,
        mock_app,
    ):
        """Test UI admin with minimal database theme overlaying config theme"""
        # Setup
        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "ENABLE_UI_THEME_ADMINISTRATION": True,
            "BASE_THEME_DEFAULT": {"token": {"colorPrimary": "#base1"}},
            "BASE_THEME_DARK": {"token": {"colorPrimary": "#base2"}},
        }.get(k, d)

        # Full config themes with multiple tokens
        mock_get_config.side_effect = lambda k: {
            "THEME_DEFAULT": {
                "token": {
                    "colorPrimary": "#1890ff",
                    "colorSuccess": "#52c41a",
                    "colorWarning": "#faad14",
                    "fontSize": 14,
                },
                "algorithm": "default",
            },
            "THEME_DARK": {
                "token": {
                    "colorPrimary": "#1890ff",
                    "colorSuccess": "#52c41a",
                    "fontSize": 14,
                },
                "algorithm": "dark",
            },
        }.get(k)

        # Minimal database themes
        mock_default_theme = MagicMock()
        mock_default_theme.json_data = '{"token": {"colorPrimary": "#ff00ff"}}'
        mock_dark_theme = MagicMock()
        mock_dark_theme.json_data = (
            '{"token": {"colorWarning": "#orange"}, "algorithm": "dark"}'
        )

        mock_dao.find_system_default.return_value = mock_default_theme
        mock_dao.find_system_dark.return_value = mock_dark_theme

        result = get_theme_bootstrap_data()

        # Verify merging behavior
        assert result["theme"]["enableUiThemeAdministration"] is True
        # Default theme should merge database with config
        assert (
            result["theme"]["default"]["token"]["colorPrimary"] == "#ff00ff"
        )  # From DB
        assert (
            result["theme"]["default"]["token"]["colorSuccess"] == "#52c41a"
        )  # From config
        assert (
            result["theme"]["default"]["token"]["colorWarning"] == "#faad14"
        )  # From config
        assert result["theme"]["default"]["token"]["fontSize"] == 14  # From config
        assert result["theme"]["default"]["algorithm"] == "default"  # From config

        # Dark theme should merge database with config
        assert (
            result["theme"]["dark"]["token"]["colorPrimary"] == "#1890ff"
        )  # From config
        assert result["theme"]["dark"]["token"]["colorWarning"] == "#orange"  # From DB
        assert result["theme"]["dark"]["algorithm"] == "dark"  # From DB

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    @patch("superset.views.base.ThemeDAO")
    def test_ui_admin_enabled_no_db_themes(
        self,
        mock_dao,
        mock_get_config,
        mock_app,
    ):
        """Test UI admin enabled but no themes in database, falls back to config"""
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

        # No database themes
        mock_dao.find_system_default.return_value = None
        mock_dao.find_system_dark.return_value = None

        result = get_theme_bootstrap_data()

        # Should fall back to config themes
        assert result["theme"]["enableUiThemeAdministration"] is True
        assert result["theme"]["default"] == {"token": {"colorPrimary": "#config1"}}
        assert result["theme"]["dark"] == {"token": {"colorPrimary": "#config2"}}

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    @patch("superset.views.base.ThemeDAO")
    def test_ui_admin_enabled_invalid_db_theme(
        self,
        mock_dao,
        mock_get_config,
        mock_app,
    ):
        """Test UI admin with invalid JSON in database theme"""
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

        # Invalid JSON in database theme
        mock_default_theme = MagicMock()
        mock_default_theme.json_data = "{invalid json"
        mock_default_theme.id = 1

        mock_dao.find_system_default.return_value = mock_default_theme
        mock_dao.find_system_dark.return_value = None

        with patch("superset.views.base.logger") as mock_logger:
            result = get_theme_bootstrap_data()

            # Should fall back to config theme and log error
            assert result["theme"]["default"] == {"token": {"colorPrimary": "#config1"}}
            mock_logger.error.assert_called_once()

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    def test_ui_admin_disabled_no_config_themes(self, mock_get_config, mock_app):
        """Test with UI admin disabled and no config themes (empty themes)"""
        # Setup
        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "ENABLE_UI_THEME_ADMINISTRATION": False,
            "BASE_THEME_DEFAULT": {"token": {"colorPrimary": "#base1"}},
            "BASE_THEME_DARK": {"token": {"colorPrimary": "#base2"}},
        }.get(k, d)

        # No config themes (None values)
        mock_get_config.side_effect = lambda k: None

        result = get_theme_bootstrap_data()

        # Should have empty theme objects
        assert result["theme"]["enableUiThemeAdministration"] is False
        assert result["theme"]["default"] == {}
        assert result["theme"]["dark"] == {}
