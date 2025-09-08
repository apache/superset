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
Integration tests for Playwright migration and fallback functionality.
Tests the full screenshot pipeline from driver selection to cache handling.
"""

from unittest.mock import MagicMock, patch

from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    DashboardScreenshot,
)


class TestPlaywrightMigrationIntegration:
    """Integration tests for the full Playwright migration pipeline."""

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.app")
    def test_full_chart_screenshot_pipeline_with_playwright(
        self, mock_app, mock_sync_playwright, mock_feature_flag
    ):
        """Test full chart screenshot pipeline when Playwright available."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup app config
        mock_app.config = {
            "WEBDRIVER_TYPE": "chrome",
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
        mock_element.screenshot.return_value = b"chart_screenshot_data"

        # Create chart screenshot and take screenshot
        with patch("superset.utils.webdriver.WebDriverPlaywright.auth") as mock_auth:
            mock_auth.return_value = mock_context

            chart_screenshot = ChartScreenshot(
                "http://example.com/chart/1", "digest123"
            )
            result = chart_screenshot.get_screenshot(mock_user)

        # Verify the full pipeline worked
        assert result == b"chart_screenshot_data"
        assert chart_screenshot.screenshot == b"chart_screenshot_data"

        # Verify Playwright was used correctly
        mock_playwright_instance.chromium.launch.assert_called_once()
        mock_browser.new_context.assert_called_once()
        mock_page.goto.assert_called_once()
        mock_element.screenshot.assert_called_once()

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.webdriver.WebDriverSelenium")
    def test_full_dashboard_screenshot_pipeline_fallback_to_selenium(
        self, mock_selenium_class, mock_logger, mock_feature_flag
    ):
        """Test full dashboard screenshot pipeline fallback to Selenium."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup Selenium mock
        mock_selenium_instance = MagicMock()
        mock_selenium_instance.get_screenshot.return_value = b"dashboard_selenium_data"
        mock_selenium_class.return_value = mock_selenium_instance

        # Create dashboard screenshot and take screenshot
        dashboard_screenshot = DashboardScreenshot(
            "http://example.com/dashboard/1", "digest456"
        )
        result = dashboard_screenshot.get_screenshot(mock_user)

        # Verify fallback worked
        assert result == b"dashboard_selenium_data"
        assert dashboard_screenshot.screenshot == b"dashboard_selenium_data"

        # Verify fallback logging occurred
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args[0][0]
        assert "Falling back to Selenium" in log_call

        # Verify Selenium driver was created and used
        mock_selenium_class.assert_called_once()
        mock_selenium_instance.get_screenshot.assert_called_once_with(
            "http://example.com/dashboard/1?standalone=3", "standalone", mock_user
        )

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.WebDriverSelenium")
    def test_playwright_webdriver_fallback_integration(
        self, mock_selenium_class, mock_webdriver_logger, mock_feature_flag
    ):
        """Test when Playwright available in screenshots but not webdriver."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup mocks
        mock_selenium_instance = MagicMock()
        mock_selenium_instance.get_screenshot.return_value = b"webdriver_fallback_data"
        mock_selenium_class.return_value = mock_selenium_instance

        # This scenario tests when screenshots module has Playwright available
        # but webdriver module doesn't (different import contexts)
        chart_screenshot = ChartScreenshot("http://example.com/chart/1", "digest789")

        # Mock driver method to return WebDriverPlaywright (will fallback)
        with patch.object(chart_screenshot, "driver") as mock_driver_method:
            from superset.utils.webdriver import WebDriverPlaywright

            mock_playwright_driver = WebDriverPlaywright("chrome")
            mock_driver_method.return_value = mock_playwright_driver

            # get_screenshot should return None (Playwright unavailable)
            with patch.object(
                mock_playwright_driver, "get_screenshot", return_value=None
            ):
                result = chart_screenshot.get_screenshot(mock_user)

        # Should get None when Playwright webdriver is unavailable
        assert result is None
        assert chart_screenshot.screenshot is None

        # Should have logged the webdriver fallback message
        mock_webdriver_logger.info.assert_called()

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.logger")
    def test_screenshot_cache_integration_with_fallback(
        self, mock_logger, mock_feature_flag
    ):
        """Test screenshot cache behavior during fallback scenarios."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Mock cache
        mock_cache = MagicMock()

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            with patch(
                "superset.utils.webdriver.WebDriverSelenium"
            ) as mock_selenium_class:
                mock_selenium_instance = MagicMock()
                mock_selenium_instance.get_screenshot.return_value = (
                    b"cached_fallback_data"
                )
                mock_selenium_class.return_value = mock_selenium_instance

                chart_screenshot = ChartScreenshot(
                    "http://example.com/chart/cache", "cache_digest"
                )
                chart_screenshot.cache = mock_cache

                # Test compute_and_cache with fallback
                chart_screenshot.compute_and_cache(force=True, user=mock_user)

        # Verify cache operations occurred with fallback
        assert mock_cache.set.call_count >= 1  # Called at least once for caching

        # Verify fallback logging
        mock_logger.info.assert_called()
        log_messages = [call.args[0] for call in mock_logger.info.call_args_list]
        assert any("Falling back to Selenium" in msg for msg in log_messages)

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_feature_flag_toggle_behavior(self, mock_feature_flag):
        """Test behavior when feature flag is toggled during runtime."""
        mock_user = MagicMock()
        mock_user.username = "test_user"

        chart_screenshot = ChartScreenshot(
            "http://example.com/chart/toggle", "toggle_digest"
        )

        # First call with feature flag enabled
        mock_feature_flag.return_value = True
        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True):
            driver1 = chart_screenshot.driver()
            assert driver1.__class__.__name__ == "WebDriverPlaywright"

        # Second call with feature flag disabled
        mock_feature_flag.return_value = False
        driver2 = chart_screenshot.driver()
        assert driver2.__class__.__name__ == "WebDriverSelenium"

        # Verify feature flag was checked for each call
        assert mock_feature_flag.call_count == 2

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.app")
    def test_error_handling_during_screenshot_generation(
        self, mock_app, mock_sync_playwright, mock_feature_flag
    ):
        """Test error handling in full screenshot pipeline."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup app config
        mock_app.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "WEBDRIVER_WINDOW": {"pixel_density": 1},
            "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
            "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
            "SCREENSHOT_SELENIUM_HEADSTART": 5,
        }

        # Setup playwright to raise an error
        mock_sync_playwright.return_value.__enter__.side_effect = Exception(
            "Playwright error"
        )

        chart_screenshot = ChartScreenshot(
            "http://example.com/chart/error", "error_digest"
        )

        # Should handle error gracefully and return None
        result = chart_screenshot.get_screenshot(mock_user)
        assert result is None

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.app")
    def test_tiled_screenshot_integration_with_playwright(
        self, mock_app, mock_sync_playwright, mock_feature_flag
    ):
        """Test tiled screenshot functionality with Playwright."""
        mock_feature_flag.return_value = True
        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup app config for tiled screenshots
        mock_app.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "WEBDRIVER_WINDOW": {"pixel_density": 1},
            "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
            "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
            "SCREENSHOT_SELENIUM_HEADSTART": 5,
            "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
            "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
            "SCREENSHOT_TILED_ENABLED": True,
            "SCREENSHOT_TILED_CHART_THRESHOLD": 5,
            "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 2000,
            "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 1200,
        }

        # Setup playwright mocks for tiled screenshot scenario
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

        # Mock page.evaluate to return values that trigger tiled screenshots
        mock_page.evaluate.side_effect = [10, 3000]  # 10 charts, 3000px height

        # Mock the tiled screenshot function
        with patch("superset.utils.webdriver.take_tiled_screenshot") as mock_tiled:
            mock_tiled.return_value = b"tiled_screenshot_data"

            with patch(
                "superset.utils.webdriver.WebDriverPlaywright.auth"
            ) as mock_auth:
                mock_auth.return_value = mock_context

                dashboard_screenshot = DashboardScreenshot(
                    "http://example.com/dashboard/large", "large_digest"
                )
                result = dashboard_screenshot.get_screenshot(mock_user)

        # Verify tiled screenshot was used
        assert result == b"tiled_screenshot_data"
        mock_tiled.assert_called_once()

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.logger")
    def test_multiple_screenshot_types_consistency(
        self, mock_logger, mock_feature_flag
    ):
        """Test that different screenshot types behave consistently with fallback."""
        mock_feature_flag.return_value = True

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            # Test both ChartScreenshot and DashboardScreenshot
            chart_screenshot = ChartScreenshot(
                "http://example.com/chart/1", "chart_digest"
            )
            dashboard_screenshot = DashboardScreenshot(
                "http://example.com/dashboard/1", "dashboard_digest"
            )

            chart_driver = chart_screenshot.driver()
            dashboard_driver = dashboard_screenshot.driver()

            # Both should fallback to Selenium consistently
            assert chart_driver.__class__.__name__ == "WebDriverSelenium"
            assert dashboard_driver.__class__.__name__ == "WebDriverSelenium"

            # Both should log fallback messages
            assert mock_logger.info.call_count == 2

            # Verify window sizes are preserved correctly
            assert chart_driver._window == chart_screenshot.window_size
            assert dashboard_driver._window == dashboard_screenshot.window_size


class TestPlaywrightMigrationEdgeCases:
    """Test edge cases and corner scenarios in Playwright migration."""

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_rapid_feature_flag_toggles(self, mock_feature_flag):
        """Test rapid feature flag toggles don't cause issues."""
        screenshot_obj = BaseScreenshot("http://example.com", "rapid_digest")

        # Rapidly toggle feature flag
        results = []
        for i in range(20):
            mock_feature_flag.return_value = i % 2 == 0  # Alternate True/False
            with patch(
                "superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", i % 3 == 0
            ):  # Varying availability
                driver = screenshot_obj.driver()
                results.append(driver.__class__.__name__)

        # Should handle rapid toggles gracefully
        assert len(results) == 20
        assert all(
            name in ["WebDriverPlaywright", "WebDriverSelenium"] for name in results
        )

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    def test_memory_behavior_with_many_driver_instances(
        self, mock_playwright_available, mock_feature_flag
    ):
        """Test memory behavior when creating many driver instances."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "memory_digest")

        # Create many driver instances
        drivers = []
        for _ in range(100):
            drivers.append(screenshot_obj.driver())

        # All should be unique instances
        driver_ids = [id(driver) for driver in drivers]
        assert len(set(driver_ids)) == 100  # All unique

        # All should be Playwright drivers
        for driver in drivers:
            assert driver.__class__.__name__ == "WebDriverPlaywright"

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.logger")
    def test_logging_message_content_accuracy(self, mock_logger, mock_feature_flag):
        """Test that logging messages contain accurate technical information."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "logging_digest")

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            screenshot_obj.driver()

        mock_logger.info.assert_called_once()
        log_message = mock_logger.info.call_args[0][0]

        # Verify technical accuracy of log message
        assert "PLAYWRIGHT_REPORTS_AND_THUMBNAILS enabled" in log_message
        assert "Playwright not installed" in log_message
        assert "Falling back to Selenium" in log_message
        assert "WebGL/Canvas charts may not render correctly" in log_message
        assert "pip install playwright" in log_message
        assert "playwright install chromium" in log_message

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_type_consistency_across_calls(self, mock_feature_flag):
        """Test that driver type remains consistent for same feature flag state."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "consistency_digest")

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True):
            drivers = [screenshot_obj.driver() for _ in range(10)]
            driver_types = [driver.__class__.__name__ for driver in drivers]
            assert all(dt == "WebDriverPlaywright" for dt in driver_types)

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            drivers = [screenshot_obj.driver() for _ in range(10)]
            driver_types = [driver.__class__.__name__ for driver in drivers]
            assert all(dt == "WebDriverSelenium" for dt in driver_types)

    def test_validate_webdriver_config_integration_with_real_feature_flag(self):
        """Test validate_webdriver_config with actual feature flag manager."""
        from superset.utils.webdriver import validate_webdriver_config

        # This test uses the real feature flag manager to ensure integration works
        result = validate_webdriver_config()

        # Should return valid structure regardless of actual flag state
        required_keys = [
            "selenium_available",
            "playwright_available",
            "playwright_feature_enabled",
            "recommended_action",
        ]
        assert all(key in result for key in required_keys)

        # Selenium should always be available
        assert result["selenium_available"] is True

        # Other fields should be appropriate types
        assert isinstance(result["playwright_available"], bool)
        assert isinstance(result["playwright_feature_enabled"], bool)
        assert result["recommended_action"] is None or isinstance(
            result["recommended_action"], str
        )
