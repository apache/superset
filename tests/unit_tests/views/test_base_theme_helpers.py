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

from unittest.mock import MagicMock, mock_open, patch

from superset.themes.types import ThemeMode
from superset.utils import json
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

        # Verify user overrides are applied (merged with base defaults)
        assert result["theme"]["enableUiThemeAdministration"] is False
        assert result["theme"]["default"]["token"]["colorPrimary"] == "#config1"
        assert result["theme"]["dark"]["token"]["colorPrimary"] == "#config2"

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

        # Should fall back to config themes (merged with base defaults)
        assert result["theme"]["enableUiThemeAdministration"] is True
        assert result["theme"]["default"]["token"]["colorPrimary"] == "#config1"
        assert result["theme"]["dark"]["token"]["colorPrimary"] == "#config2"

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

            # Should fall back to config theme (merged with base defaults)
            assert result["theme"]["default"]["token"]["colorPrimary"] == "#config1"
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

    @patch("superset.views.base.app")
    @patch("superset.views.base.get_config_value")
    def test_partial_theme_override_preserves_base_tokens(
        self, mock_get_config, mock_app
    ):
        """Regression test for #40375: partial THEME_DEFAULT override must
        preserve unspecified token fields from the built-in defaults so the
        frontend does not crash on undefined values."""
        from superset.config import _THEME_DARK_BASE, _THEME_DEFAULT_BASE

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "ENABLE_UI_THEME_ADMINISTRATION": False,
        }.get(k, d)

        # Simulate a minimal user override in superset_config.py
        partial_default = {
            "token": {"colorPrimary": "#ff0000"},
            "algorithm": "default",
        }
        partial_dark = {
            "token": {"colorPrimary": "#00ff00"},
            "algorithm": "dark",
        }
        mock_get_config.side_effect = lambda k: {
            "THEME_DEFAULT": partial_default,
            "THEME_DARK": partial_dark,
        }.get(k)

        result = get_theme_bootstrap_data()

        default_theme = result["theme"]["default"]
        dark_theme = result["theme"]["dark"]

        # User overrides must be applied
        assert default_theme["token"]["colorPrimary"] == "#ff0000"
        assert dark_theme["token"]["colorPrimary"] == "#00ff00"

        # All built-in base tokens must still be present
        for key in _THEME_DEFAULT_BASE["token"]:
            assert key in default_theme["token"], (
                f"Missing base token '{key}' in default theme after partial override"
            )
        for key in _THEME_DARK_BASE["token"]:
            assert key in dark_theme["token"], (
                f"Missing base token '{key}' in dark theme after partial override"
            )

        # Spot-check a few critical fields that caused the original crash
        assert (
            default_theme["token"]["fontFamily"]
            == (_THEME_DEFAULT_BASE["token"]["fontFamily"])
        )
        assert (
            default_theme["token"]["colorLink"]
            == (_THEME_DEFAULT_BASE["token"]["colorLink"])
        )


class TestBrandAppNameFallback:
    """Test brandAppName fallback mechanism for APP_NAME migration (issue #34865)"""

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_uses_theme_value_when_set(self, mock_app, mock_payload):
        """Test that explicit brandAppName in theme takes precedence"""
        from superset.views.base import get_spa_template_context

        # Use a plain dict for config to mirror Flask's config mapping behavior
        mock_app.config = {"APP_NAME": "Fallback App Name"}

        # Mock payload with theme data that has custom brandAppName
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandAppName": "My Custom App",
                            "brandLogoAlt": "Logo Alt",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        # Should use the theme's brandAppName
        assert result["default_title"] == "My Custom App"
        # Theme tokens should have brandAppName
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "My Custom App"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_falls_back_to_app_name_config(self, mock_app, mock_payload):
        """Test fallback to APP_NAME config when brandAppName not in theme"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "My Test Analytics Platform",
        }.get(k, d)

        # Mock payload with default "Superset" brandAppName
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandAppName": "Superset",  # Default value
                            "brandLogoAlt": "Apache Superset",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        # Should fall back to APP_NAME config
        assert result["default_title"] == "My Test Analytics Platform"
        # Theme tokens should be updated with APP_NAME value
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "My Test Analytics Platform"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_uses_superset_default_when_nothing_set(
        self, mock_app, mock_payload
    ):
        """Test fallback to 'Superset' when neither is customized"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "Superset",  # Default value
        }.get(k, d)

        # Mock payload with default "Superset" brandAppName
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandAppName": "Superset",  # Default value
                            "brandLogoAlt": "Apache Superset",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        # Should use default "Superset"
        assert result["default_title"] == "Superset"
        # Theme tokens should keep "Superset"
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "Superset"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_empty_string_falls_back(self, mock_app, mock_payload):
        """Test that empty string brandAppName triggers fallback"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "Custom App",
        }.get(k, d)

        # Mock payload with empty brandAppName
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandAppName": "",  # Empty string
                            "brandLogoAlt": "Logo",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        # Should fall back to APP_NAME
        assert result["default_title"] == "Custom App"
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "Custom App"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_none_falls_back(self, mock_app, mock_payload):
        """Test that missing brandAppName triggers fallback"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "Analytics Dashboard",
        }.get(k, d)

        # Mock payload without brandAppName
        mock_payload.return_value = {
            "common": {"theme": {"default": {"token": {"brandLogoAlt": "Logo"}}}}
        }

        result = get_spa_template_context("app")

        # Should fall back to APP_NAME
        assert result["default_title"] == "Analytics Dashboard"
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "Analytics Dashboard"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_updates_both_default_and_dark_themes(
        self, mock_app, mock_payload
    ):
        """Test that brandAppName fallback applies to both default and dark themes"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "Multi Theme App",
        }.get(k, d)

        # Mock payload with both themes missing brandAppName
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandAppName": "Superset",  # Default value
                            "colorPrimary": "#111",
                        }
                    },
                    "dark": {
                        "token": {
                            # Missing brandAppName
                            "colorPrimary": "#222",
                        }
                    },
                }
            }
        }

        result = get_spa_template_context("app")

        # Should update both themes
        assert result["default_title"] == "Multi Theme App"
        # Verify default theme was updated
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "Multi Theme App"
        assert theme_tokens["colorPrimary"] == "#111"  # Preserved

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_does_not_mutate_cached_payload(self, mock_app, mock_payload):
        """Test that brandAppName fallback doesn't mutate the cached payload"""
        from superset.views.base import get_spa_template_context

        mock_app.config = MagicMock()
        mock_app.config.get.side_effect = lambda k, d=None: {
            "APP_NAME": "Test App",
        }.get(k, d)

        # Create a payload that simulates cached data
        original_theme_data = {
            "default": {
                "token": {
                    "brandAppName": "Superset",
                    "colorPrimary": "#333",
                }
            }
        }

        mock_payload.return_value = {"common": {"theme": original_theme_data}}

        # Call get_spa_template_context
        result = get_spa_template_context("app")

        # Verify the function result has the updated brandAppName
        assert result["default_title"] == "Test App"
        theme_tokens = result["theme_tokens"]
        assert theme_tokens["brandAppName"] == "Test App"

        # Verify the original mock payload structure wasn't mutated
        # (the function should deep copy before mutating)
        # Note: We can't easily test the cached payload immutability
        # without more complex mocking, but we've verified the result is correct
        assert result["default_title"] == "Test App"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_handles_empty_theme_config(self, mock_app, mock_payload):
        """Test that empty theme configs are skipped gracefully"""
        from superset.views.base import get_spa_template_context

        mock_app.config = {"APP_NAME": "Test App"}

        # Mock payload with empty dark theme
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {"token": {"brandAppName": "Superset"}},
                    "dark": {},  # Empty theme config
                }
            }
        }

        result = get_spa_template_context("app")

        # Should handle empty theme gracefully and still update default
        assert result["default_title"] == "Test App"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_creates_token_dict_when_missing(self, mock_app, mock_payload):
        """Test that token dict is created when missing from theme config"""
        from superset.views.base import get_spa_template_context

        mock_app.config = {"APP_NAME": "Token Test App"}

        # Mock payload with theme missing token dict
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {"algorithm": "default"},  # No token dict
                    "dark": {"algorithm": "dark"},  # No token dict
                }
            }
        }

        result = get_spa_template_context("app")

        # Should create token dict and set brandAppName
        assert result["default_title"] == "Token Test App"
        assert result["theme_tokens"]["brandAppName"] == "Token Test App"

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandappname_handles_missing_common_in_payload(
        self, mock_app, mock_payload
    ):
        """Test handling when common dict is missing from payload"""
        from superset.views.base import get_spa_template_context

        mock_app.config = {"APP_NAME": "Superset"}

        # Mock payload without common dict
        mock_payload.return_value = {}

        result = get_spa_template_context("app")

        # Should handle gracefully and use default title
        assert result["default_title"] == "Superset"


class TestBrandSpinnerUrlPrefix:
    """Test brandSpinnerUrl static asset prefix handling."""

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandspinnerurl_adds_static_assets_prefix(self, mock_app, mock_payload):
        """Test that root-relative spinner URLs include the static assets prefix."""
        from superset.views.base import get_spa_template_context

        mock_app.config = {
            "STATIC_ASSETS_PREFIX": "/analytics",
        }
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandSpinnerUrl": "/static/assets/spinner.gif",
                        }
                    },
                    "dark": {
                        "token": {
                            "brandSpinnerUrl": "/static/assets/dark-spinner.gif",
                        }
                    },
                }
            }
        }

        result = get_spa_template_context("app")

        assert (
            result["theme_tokens"]["brandSpinnerUrl"]
            == "/analytics/static/assets/spinner.gif"
        )
        bootstrap_data = json.loads(result["bootstrap_data"])
        assert (
            bootstrap_data["common"]["theme"]["default"]["token"]["brandSpinnerUrl"]
            == "/analytics/static/assets/spinner.gif"
        )
        assert (
            bootstrap_data["common"]["theme"]["dark"]["token"]["brandSpinnerUrl"]
            == "/analytics/static/assets/dark-spinner.gif"
        )

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandspinnerurl_keeps_absolute_url(self, mock_app, mock_payload):
        """Test that absolute spinner URLs are not prefixed."""
        from superset.views.base import get_spa_template_context

        mock_app.config = {
            "STATIC_ASSETS_PREFIX": "/analytics",
        }
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandSpinnerUrl": "https://cdn.example.com/spinner.gif",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        assert (
            result["theme_tokens"]["brandSpinnerUrl"]
            == "https://cdn.example.com/spinner.gif"
        )

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandspinnerurl_keeps_protocol_relative_url(self, mock_app, mock_payload):
        """Test that protocol-relative spinner URLs are not prefixed."""
        from superset.views.base import get_spa_template_context

        mock_app.config = {
            "STATIC_ASSETS_PREFIX": "/analytics",
        }
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandSpinnerUrl": "//cdn.example.com/spinner.gif",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        assert (
            result["theme_tokens"]["brandSpinnerUrl"] == "//cdn.example.com/spinner.gif"
        )

    @patch("superset.views.base.get_spa_payload")
    @patch("superset.views.base.app")
    def test_brandspinnerurl_does_not_duplicate_static_assets_prefix(
        self, mock_app, mock_payload
    ):
        """Test that already-prefixed spinner URLs are not prefixed again."""
        from superset.views.base import get_spa_template_context

        mock_app.config = {
            "STATIC_ASSETS_PREFIX": "/analytics",
        }
        mock_payload.return_value = {
            "common": {
                "theme": {
                    "default": {
                        "token": {
                            "brandSpinnerUrl": "/analytics/static/assets/spinner.gif",
                        }
                    }
                }
            }
        }

        result = get_spa_template_context("app")

        assert (
            result["theme_tokens"]["brandSpinnerUrl"]
            == "/analytics/static/assets/spinner.gif"
        )


class TestGetDefaultSpinnerSvg:
    """Test get_default_spinner_svg function"""

    @patch("superset.views.base.logger")
    @patch("builtins.open")
    def test_get_default_spinner_svg_file_missing(self, mock_open, mock_logger):
        """Test that missing spinner asset returns None and logs a warning"""
        from superset.views.base import get_default_spinner_svg

        mock_open.side_effect = FileNotFoundError()

        result = get_default_spinner_svg()

        assert result is None
        # Verify that a warning was logged
        mock_logger.warning.assert_called_once()
        warning_msg = mock_logger.warning.call_args[0][0]
        assert "Could not load default spinner SVG" in warning_msg

    @patch("superset.views.base.logger")
    @patch("builtins.open")
    def test_get_default_spinner_svg_other_error(self, mock_open, mock_logger):
        """Test that other unexpected errors during loading log a warning"""
        from superset.views.base import get_default_spinner_svg

        mock_open.side_effect = PermissionError("Permission denied")

        result = get_default_spinner_svg()

        assert result is None
        # Verify that a warning was logged
        mock_logger.warning.assert_called_once()
        warning_msg = mock_logger.warning.call_args[0][0]
        assert "Could not load default spinner SVG" in warning_msg

    @patch("builtins.open", new_callable=mock_open, read_data="<svg>spinner</svg>")
    def test_get_default_spinner_svg_success(self, mock_open):
        """Test that successfully reading SVG returns the content"""
        from superset.views.base import get_default_spinner_svg

        result = get_default_spinner_svg()

        assert result == "<svg>spinner</svg>"

    def test_get_default_spinner_svg_real_file_exists(self):
        """Test that the default spinner SVG file exists and is loadable"""
        from superset.views.base import get_default_spinner_svg

        result = get_default_spinner_svg()
        assert result is not None
        assert "<svg" in result
        assert "morphPath" in result


class TestThemeCacheInvalidation:
    """Test theme cache invalidation event listeners"""

    @patch("superset.extensions.cache_manager.cache.delete_memoized")
    def test_clear_bootstrap_cache_event(self, mock_delete_memoized):
        """Test that the event listener triggers delete_memoized"""
        from superset.models.core import clear_bootstrap_cache
        from superset.views.base import cached_common_bootstrap_data

        # Call clear_bootstrap_cache with dummy mapper, connection, and Theme
        clear_bootstrap_cache(MagicMock(), MagicMock(), MagicMock())

        mock_delete_memoized.assert_called_once_with(cached_common_bootstrap_data)

    @patch("superset.extensions.cache_manager.cache.delete_memoized")
    @patch("superset.models.core.logger")
    def test_clear_bootstrap_cache_event_error(self, mock_logger, mock_delete_memoized):
        """Test that the event listener handles errors gracefully and logs them"""
        from superset.models.core import clear_bootstrap_cache

        mock_delete_memoized.side_effect = Exception("Cache error")
        clear_bootstrap_cache(MagicMock(), MagicMock(), MagicMock())

        mock_logger.warning.assert_called_once_with(
            "Failed to clear theme bootstrap cache: %s",
            mock_delete_memoized.side_effect,
        )
