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

"""
Working tests for Playwright migration functionality.
These tests demonstrate the core functionality works correctly.
"""

from unittest.mock import MagicMock, patch

from superset.utils.webdriver import (
    PLAYWRIGHT_AVAILABLE,
    PLAYWRIGHT_INSTALL_MESSAGE,
    validate_webdriver_config,
)


class TestPlaywrightMigrationCore:
    """Core tests that demonstrate working Playwright migration functionality."""

    def test_playwright_install_message_contains_required_instructions(self):
        """Test that the install message contains all required instructions."""
        message = PLAYWRIGHT_INSTALL_MESSAGE

        # Check for pip install command
        assert "pip install playwright" in message

        # Check for browser installation command
        assert "playwright install chromium" in message

        # Check for context about WebGL/DuckGL support
        assert "WebGL/DuckGL" in message

        # Check for migration context
        assert "Cypress" in message

    def test_playwright_available_is_boolean(self):
        """Test that PLAYWRIGHT_AVAILABLE is always a boolean."""
        assert isinstance(PLAYWRIGHT_AVAILABLE, bool)

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_validate_webdriver_config_structure(self, mock_feature_flag):
        """Test that validate_webdriver_config returns correct structure."""
        mock_feature_flag.return_value = True

        result = validate_webdriver_config()

        # Check required keys exist
        required_keys = [
            "selenium_available",
            "playwright_available",
            "playwright_feature_enabled",
            "recommended_action",
        ]
        for key in required_keys:
            assert key in result

        # Check data types
        assert isinstance(result["selenium_available"], bool)
        assert isinstance(result["playwright_available"], bool)
        assert isinstance(result["playwright_feature_enabled"], bool)
        assert result["recommended_action"] is None or isinstance(
            result["recommended_action"], str
        )

        # Selenium should always be available
        assert result["selenium_available"] is True

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_validate_webdriver_config_with_feature_disabled(self, mock_feature_flag):
        """Test validate_webdriver_config when feature flag is disabled."""
        mock_feature_flag.return_value = False

        result = validate_webdriver_config()

        assert result["playwright_feature_enabled"] is False
        mock_feature_flag.assert_called_once_with("PLAYWRIGHT_REPORTS_AND_THUMBNAILS")

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_validate_webdriver_config_recommendation_logic(self, mock_feature_flag):
        """Test that recommendations are provided when Playwright unavailable."""
        mock_feature_flag.return_value = True

        result = validate_webdriver_config()

        # If Playwright is available, no recommendation should be given
        if result["playwright_available"]:
            assert result["recommended_action"] is None
        else:
            # If Playwright is not available, should recommend installation
            assert result["recommended_action"] == PLAYWRIGHT_INSTALL_MESSAGE

    def test_constants_module_import_safety(self):
        """Test that constants can be imported safely."""
        # These imports should work regardless of Playwright installation
        from superset.utils.webdriver import (
            PLAYWRIGHT_AVAILABLE,
            PLAYWRIGHT_INSTALL_MESSAGE,
        )

        assert isinstance(PLAYWRIGHT_AVAILABLE, bool)
        assert isinstance(PLAYWRIGHT_INSTALL_MESSAGE, str)
        assert len(PLAYWRIGHT_INSTALL_MESSAGE) > 0

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.webdriver.logger")
    def test_webdriver_playwright_fallback_logging(self, mock_logger):
        """Test that WebDriverPlaywright logs fallback correctly."""
        from superset.utils.webdriver import WebDriverPlaywright

        mock_user = MagicMock()
        mock_user.username = "test_user"

        driver = WebDriverPlaywright("chrome")
        result = driver.get_screenshot("http://example.com", "test-element", mock_user)

        # Should return None when unavailable
        assert result is None

        # Should log the fallback message
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args[0][0]
        assert "Playwright not available" in log_call
        assert "falling back to Selenium" in log_call
        assert "WebGL/Canvas charts may not render correctly" in log_call

    def test_webdriver_classes_exist(self):
        """Test that both WebDriver classes can be imported."""
        from superset.utils.webdriver import WebDriverPlaywright, WebDriverSelenium

        # Should be able to create instances without errors
        playwright_driver = WebDriverPlaywright("chrome")
        selenium_driver = WebDriverSelenium("chrome")

        assert playwright_driver is not None
        assert selenium_driver is not None

        # Should have required attributes
        assert hasattr(playwright_driver, "_driver_type")
        assert hasattr(selenium_driver, "_driver_type")

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_screenshot_driver_selection_basic(self, mock_feature_flag):
        """Test basic driver selection in BaseScreenshot."""
        from superset.utils.screenshots import BaseScreenshot

        # Test with feature flag disabled - should use Selenium
        mock_feature_flag.return_value = False
        screenshot = BaseScreenshot("http://example.com", "test_digest")
        driver = screenshot.driver()

        assert driver.__class__.__name__ == "WebDriverSelenium"
        mock_feature_flag.assert_called_once_with("PLAYWRIGHT_REPORTS_AND_THUMBNAILS")

    def test_chart_and_dashboard_screenshot_classes(self):
        """Test that ChartScreenshot and DashboardScreenshot can be created."""
        from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot

        chart_screenshot = ChartScreenshot("http://example.com/chart", "chart_digest")
        dashboard_screenshot = DashboardScreenshot(
            "http://example.com/dashboard", "dashboard_digest"
        )

        # Should have correct attributes
        assert chart_screenshot.element == "chart-container"
        assert dashboard_screenshot.element == "standalone"

        # Should have correct thumbnail types
        assert chart_screenshot.thumbnail_type == "chart"
        assert dashboard_screenshot.thumbnail_type == "dashboard"

    def test_screenshot_url_modifications(self):
        """Test that URLs are modified correctly for standalone mode."""
        from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot

        base_chart_url = "http://example.com/chart/1"
        base_dashboard_url = "http://example.com/dashboard/1"

        chart_screenshot = ChartScreenshot(base_chart_url, "chart_digest")
        dashboard_screenshot = DashboardScreenshot(
            base_dashboard_url, "dashboard_digest"
        )

        # URLs should be modified for standalone mode
        assert "standalone=true" in chart_screenshot.url
        assert "standalone=3" in dashboard_screenshot.url

    def test_error_handling_imports(self):
        """Test that modules handle import errors gracefully."""
        # Test that dummy classes are available when Playwright not installed
        from superset.utils.webdriver import (
            BrowserContext,
            PlaywrightError,
            PlaywrightTimeout,
            sync_playwright,
        )

        # These should exist regardless of actual Playwright installation
        # If Playwright is not installed, these should be dummy classes/None
        if not PLAYWRIGHT_AVAILABLE:
            assert sync_playwright is None
            # Dummy classes should be available for type annotations
            assert BrowserContext is not None
            assert PlaywrightError is not None
            assert PlaywrightTimeout is not None
