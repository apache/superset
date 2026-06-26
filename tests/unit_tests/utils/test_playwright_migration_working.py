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
    _PlaywrightBrowserManager,
    PLAYWRIGHT_AVAILABLE,
    validate_webdriver_config,
)


class TestPlaywrightMigrationCore:
    """Core tests that demonstrate working Playwright migration functionality."""

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


class TestPlaywrightBrowserManager:
    """Tests for the per-worker browser manager."""

    def test_initial_state(self):
        manager = _PlaywrightBrowserManager()
        assert manager._playwright is None
        assert manager._browser is None

    def test_get_browser_creates_browser(self):
        mock_browser = MagicMock()
        mock_browser.is_connected.return_value = True

        mock_pw_instance = MagicMock()
        mock_pw_instance.chromium.launch.return_value = mock_browser

        mock_sync_pw = MagicMock()
        mock_sync_pw.start.return_value = mock_pw_instance

        manager = _PlaywrightBrowserManager()
        with patch(
            "superset.utils.webdriver.sync_playwright", return_value=mock_sync_pw
        ):
            browser = manager.get_browser(["--headless"])

        assert browser is mock_browser
        mock_pw_instance.chromium.launch.assert_called_once_with(args=["--headless"])

    def test_get_browser_reuses_connected_browser(self):
        mock_browser = MagicMock()
        mock_browser.is_connected.return_value = True

        manager = _PlaywrightBrowserManager()
        manager._browser = mock_browser
        manager._playwright = MagicMock()

        browser = manager.get_browser(["--headless"])

        assert browser is mock_browser
        # Should NOT launch a new browser
        manager._playwright.chromium.launch.assert_not_called()

    def test_get_browser_recreates_on_disconnect(self):
        stale_browser = MagicMock()
        stale_browser.is_connected.return_value = False

        new_browser = MagicMock()
        new_browser.is_connected.return_value = True

        mock_pw_instance = MagicMock()
        mock_pw_instance.chromium.launch.return_value = new_browser

        mock_sync_pw = MagicMock()
        mock_sync_pw.start.return_value = mock_pw_instance

        manager = _PlaywrightBrowserManager()
        manager._browser = stale_browser
        manager._playwright = MagicMock()

        with patch(
            "superset.utils.webdriver.sync_playwright", return_value=mock_sync_pw
        ):
            browser = manager.get_browser(["--headless"])

        assert browser is new_browser
        stale_browser.close.assert_called_once()

    def test_cleanup(self):
        mock_browser = MagicMock()
        mock_playwright = MagicMock()

        manager = _PlaywrightBrowserManager()
        manager._browser = mock_browser
        manager._playwright = mock_playwright

        manager._cleanup()

        mock_browser.close.assert_called_once()
        mock_playwright.stop.assert_called_once()
        assert manager._browser is None
        assert manager._playwright is None

    def test_cleanup_handles_exceptions(self):
        mock_browser = MagicMock()
        mock_browser.close.side_effect = Exception("crash")
        mock_playwright = MagicMock()
        mock_playwright.stop.side_effect = Exception("crash")

        manager = _PlaywrightBrowserManager()
        manager._browser = mock_browser
        manager._playwright = mock_playwright

        # Should not raise
        manager._cleanup()

        assert manager._browser is None
        assert manager._playwright is None
