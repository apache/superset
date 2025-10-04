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
