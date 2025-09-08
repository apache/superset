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

from superset.utils.webdriver import (
    PLAYWRIGHT_AVAILABLE,
    PLAYWRIGHT_INSTALL_MESSAGE,
    validate_webdriver_config,
    WebDriverPlaywright,
    WebDriverSelenium,
)


@pytest.fixture
def mock_app():
    """Mock Flask app with webdriver configuration."""
    app = MagicMock()
    app.config = {
        "WEBDRIVER_TYPE": "chrome",
        "WEBDRIVER_OPTION_ARGS": [],
        "WEBDRIVER_CONFIGURATION": {},
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 10,
    }
    return app


class TestWebDriverSelenium:
    """Test WebDriverSelenium timeout handling for urllib3 2.x compatibility."""

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_conversion_to_float(
        self, mock_chrome, mock_firefox, mock_app_patch, mock_app
    ):
        """Test that timeout values are properly converted to float."""
        # Set up app mock to be used throughout
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "30",
                "connect_timeout": "10.5",
                "socket_timeout": 20,
                "read_timeout": "15.0",
                "command_executor_timeout": "25",
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that the driver was called with float timeout values
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] == 30.0
        assert call_kwargs["connect_timeout"] == 10.5
        assert call_kwargs["socket_timeout"] == 20.0
        assert call_kwargs["read_timeout"] == 15.0
        assert call_kwargs["command_executor_timeout"] == 25.0

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_none_handling(self, mock_chrome, mock_app_patch, mock_app):
        """Test that None, 'None', and 'null' timeout values are set to None."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": None,
                "connect_timeout": "None",
                "socket_timeout": "null",
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that None values are preserved
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] is None
        assert call_kwargs["connect_timeout"] is None
        assert call_kwargs["socket_timeout"] is None

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    @patch("superset.utils.webdriver.logger")
    def test_invalid_timeout_warning(
        self, mock_logger, mock_chrome, mock_app_patch, mock_app
    ):
        """Test that invalid timeout values log warnings and are set to None."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "invalid",
                "connect_timeout": "not_a_number",
                "Page_Load_Timeout": "abc123",  # Test case-insensitive matching
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that invalid values are set to None
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] is None
        assert call_kwargs["connect_timeout"] is None
        assert call_kwargs["Page_Load_Timeout"] is None

        # Check that warnings were logged with lazy logging format
        assert mock_logger.warning.call_count == 3
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for %s: %s, setting to None", "timeout", "invalid"
        )
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for %s: %s, setting to None",
            "connect_timeout",
            "not_a_number",
        )
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for %s: %s, setting to None",
            "Page_Load_Timeout",
            "abc123",
        )

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_non_timeout_config_preserved(self, mock_chrome, mock_app_patch, mock_app):
        """Test that non-timeout configuration values are preserved."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "30",
                "some_other_option": "value",
                "another_option": 123,
                "boolean_option": True,
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that all config values are passed through
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] == 30.0
        assert call_kwargs["some_other_option"] == "value"
        assert call_kwargs["another_option"] == 123
        assert call_kwargs["boolean_option"] is True

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_key_case_insensitive(self, mock_chrome, mock_app_patch, mock_app):
        """Test that timeout detection is case-insensitive."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "TIMEOUT": "10",
                "Connect_Timeout": "20",
                "SOCKET_TIMEOUT": "30",
                "connection_timeout_ms": "5000",  # Contains 'connection_timeout'
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that all timeout values are converted to float
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["TIMEOUT"] == 10.0
        assert call_kwargs["Connect_Timeout"] == 20.0
        assert call_kwargs["SOCKET_TIMEOUT"] == 30.0
        assert call_kwargs["connection_timeout_ms"] == 5000.0

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_empty_webdriver_config(self, mock_chrome, mock_app_patch, mock_app):
        """Test handling of empty webdriver configuration."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {},
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Should create driver without errors
        mock_driver_class.assert_called_once()


class TestPlaywrightMigrationSupport:
    """Test Playwright migration and fallback functionality."""

    def test_playwright_install_message_constant(self):
        """Test that PLAYWRIGHT_INSTALL_MESSAGE contains expected content."""
        assert "pip install playwright" in PLAYWRIGHT_INSTALL_MESSAGE
        assert "playwright install chromium" in PLAYWRIGHT_INSTALL_MESSAGE
        assert "WebGL/DuckGL" in PLAYWRIGHT_INSTALL_MESSAGE
        assert "Cypress" in PLAYWRIGHT_INSTALL_MESSAGE

    def test_playwright_available_constant_type(self):
        """Test that PLAYWRIGHT_AVAILABLE is a boolean."""
        assert isinstance(PLAYWRIGHT_AVAILABLE, bool)

    @patch("superset.utils.webdriver.sync_playwright", None)
    def test_playwright_available_false_when_not_installed(self):
        """Test PLAYWRIGHT_AVAILABLE is False when playwright not available."""
        # Import the module with mocked playwright
        from importlib import reload

        import superset.utils.webdriver as webdriver_module

        reload(webdriver_module)

        assert not webdriver_module.PLAYWRIGHT_AVAILABLE

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_validate_webdriver_config_all_available(self, mock_feature_flag):
        """Test validate_webdriver_config when all dependencies available."""
        mock_feature_flag.return_value = True

        result = validate_webdriver_config()

        assert result["selenium_available"] is True
        assert isinstance(result["playwright_available"], bool)
        assert isinstance(result["playwright_feature_enabled"], bool)

        if result["playwright_available"]:
            assert result["recommended_action"] is None
        else:
            assert result["recommended_action"] == PLAYWRIGHT_INSTALL_MESSAGE

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_validate_webdriver_config_feature_flag_disabled(self, mock_feature_flag):
        """Test validate_webdriver_config when feature flag is disabled."""
        mock_feature_flag.return_value = False

        result = validate_webdriver_config()

        assert result["selenium_available"] is True
        assert result["playwright_feature_enabled"] is False

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", False)
    def test_validate_webdriver_config_playwright_unavailable(self, mock_feature_flag):
        """Test validate_webdriver_config when Playwright not available."""
        mock_feature_flag.return_value = True

        result = validate_webdriver_config()

        assert result["selenium_available"] is True
        assert result["playwright_available"] is False
        assert result["playwright_feature_enabled"] is True
        assert result["recommended_action"] == PLAYWRIGHT_INSTALL_MESSAGE


class TestWebDriverPlaywrightFallback:
    """Test WebDriverPlaywright fallback behavior when unavailable."""

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_returns_none_when_unavailable(self, mock_logger, mock_app):
        """Test WebDriverPlaywright.get_screenshot returns None when unavailable."""
        mock_user = MagicMock()
        mock_user.username = "test_user"

        driver = WebDriverPlaywright("chrome")
        result = driver.get_screenshot("http://example.com", "test-element", mock_user)

        assert result is None

        # Verify warning log was called with correct message
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args[0][0]
        assert "Playwright not available" in log_call
        assert "falling back to Selenium" in log_call
        assert "WebGL/Canvas charts may not render correctly" in log_call
        assert PLAYWRIGHT_INSTALL_MESSAGE in log_call

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.app")
    def test_get_screenshot_works_when_available(
        self, mock_app, mock_sync_playwright, mock_app_fixture
    ):
        """Test WebDriverPlaywright.get_screenshot works when Playwright available."""
        # Setup mocks
        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_app.config = {
            "WEBDRIVER_OPTION_ARGS": [],
            "WEBDRIVER_WINDOW": {"pixel_density": 1},
            "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
            "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
            "SCREENSHOT_SELENIUM_HEADSTART": 5,
            "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
            "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
            "SCREENSHOT_TILED_ENABLED": False,
        }

        # Setup playwright mocks
        mock_playwright_instance = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_sync_playwright.return_value.__enter__.return_value = (
            mock_playwright_instance
        )
        mock_playwright_instance.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element
        mock_element.screenshot.return_value = b"fake_screenshot"

        # Mock the auth method
        with patch.object(WebDriverPlaywright, "auth") as mock_auth:
            mock_auth.return_value = mock_context

            driver = WebDriverPlaywright("chrome")
            result = driver.get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert result == b"fake_screenshot"
        mock_page.goto.assert_called_once_with(
            "http://example.com", wait_until="networkidle"
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_handles_playwright_timeout(
        self, mock_logger, mock_sync_playwright
    ):
        """Test WebDriverPlaywright handles PlaywrightTimeout gracefully."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup playwright mocks to raise timeout
        mock_playwright_instance = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()

        mock_sync_playwright.return_value.__enter__.return_value = (
            mock_playwright_instance
        )
        mock_playwright_instance.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.goto.side_effect = PlaywrightTimeout()

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com", "test-element", mock_user
                )

        # Should handle timeout gracefully and return None
        assert result is None
        mock_logger.exception.assert_called()
        exception_call = mock_logger.exception.call_args[0][0]
        assert "Web event networkidle not detected" in exception_call


class TestWebDriverConstantsWithImportError:
    """Test module-level constants behavior with import errors."""

    def test_playwright_constants_defined_when_import_fails(self):
        """Test constants are properly defined even when Playwright import fails."""
        # These should be available even when playwright is not installed
        assert PLAYWRIGHT_INSTALL_MESSAGE is not None
        assert isinstance(PLAYWRIGHT_INSTALL_MESSAGE, str)

        # PLAYWRIGHT_AVAILABLE should be boolean regardless of installation
        assert isinstance(PLAYWRIGHT_AVAILABLE, bool)

    @patch("superset.utils.webdriver.sync_playwright", None)
    def test_dummy_classes_when_playwright_unavailable(self):
        """Test that dummy classes are defined when Playwright unavailable."""
        # Force reimport to test ImportError path
        from importlib import reload

        import superset.utils.webdriver as webdriver_module

        # Mock the import to fail
        with patch.dict("sys.modules", {"playwright.sync_api": None}):
            reload(webdriver_module)

        # Should have dummy classes defined
        assert hasattr(webdriver_module, "BrowserContext")
        assert hasattr(webdriver_module, "PlaywrightError")
        assert hasattr(webdriver_module, "PlaywrightTimeout")


class TestWebDriverPlaywrightErrorHandling:
    """Test error handling in WebDriverPlaywright methods."""

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.logger")
    def test_find_unexpected_errors_handles_playwright_error(
        self, mock_logger, mock_sync_playwright
    ):
        """Test find_unexpected_errors handles PlaywrightError gracefully."""
        from superset.utils.webdriver import PlaywrightError

        mock_page = MagicMock()
        mock_page.get_by_role.side_effect = PlaywrightError("Test error")

        result = WebDriverPlaywright.find_unexpected_errors(mock_page)

        assert result == []
        mock_logger.exception.assert_called_once_with(
            "Failed to capture unexpected errors"
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.logger")
    def test_find_unexpected_errors_processes_alerts(
        self, mock_logger, mock_sync_playwright
    ):
        """Test find_unexpected_errors processes alert elements correctly."""
        mock_page = MagicMock()
        mock_alert_div = MagicMock()
        mock_button = MagicMock()
        mock_modal_content = MagicMock()
        mock_modal_body = MagicMock()
        mock_close_button = MagicMock()

        # Setup the mock chain
        mock_page.get_by_role.return_value.all.return_value = [mock_alert_div]
        mock_alert_div.get_by_role.return_value = mock_button
        mock_page.locator.side_effect = [
            mock_modal_content,
            mock_modal_body,
            mock_close_button,
            mock_modal_content,
        ]
        mock_modal_body.text_content.return_value = "Error message"
        mock_modal_body.inner_html.return_value = "Error message"

        result = WebDriverPlaywright.find_unexpected_errors(mock_page)

        assert result == ["Error message"]
        mock_button.click.assert_called_once()
        mock_close_button.click.assert_called_once()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_logs_multiple_timeouts(
        self, mock_logger, mock_sync_playwright
    ):
        """Test that multiple timeout scenarios are logged appropriately."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup mocks
        mock_playwright_instance = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_sync_playwright.return_value.__enter__.return_value = (
            mock_playwright_instance
        )
        mock_playwright_instance.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        # Mock locator to raise timeout on element wait
        mock_page.locator.return_value = mock_element
        mock_element.wait_for.side_effect = PlaywrightTimeout()

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com", "test-element", mock_user
                )

        assert result is None
        # Should log timeout for element wait
        assert mock_logger.exception.call_count >= 1
