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
Pooled screenshot implementations for improved performance
"""

import logging
import time
from typing import Any

from flask import current_app
from flask_appbuilder.security.sqla.models import User
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

from superset.extensions import machine_auth_provider_factory
from superset.mcp_service.webdriver_pool import get_webdriver_pool
from superset.utils.screenshots import BaseScreenshot, WindowSize

logger = logging.getLogger(__name__)


class PooledBaseScreenshot(BaseScreenshot):
    """
    Enhanced screenshot class that uses WebDriver pooling for better performance.

    Key improvements:
    - Reuses WebDriver instances from a connection pool
    - Faster screenshot generation (no browser startup/shutdown per request)
    - Better resource management and automatic cleanup
    - Health checking and recovery of WebDriver instances
    """

    def get_screenshot(
        self, user: User, window_size: WindowSize | None = None
    ) -> bytes | None:
        """
        Generate screenshot using pooled WebDriver for improved performance.

        Args:
            user: User context for authentication
            window_size: Optional window size override

        Returns:
            Screenshot as PNG bytes or None if failed
        """
        window_size = window_size or self.window_size
        pool = get_webdriver_pool()

        # Use pooled WebDriver
        with pool.get_driver(window_size, user.id) as driver:
            try:
                # Authenticate the driver for this user
                machine_auth_provider_factory.instance.authenticate_webdriver(
                    driver, user
                )

                # Navigate to the URL
                driver.get(self.url)

                # Take screenshot using the specific implementation
                return self._take_screenshot(driver, user)

            except Exception as e:
                logger.error(f"Error taking screenshot with pooled driver: {e}")
                raise

    def _take_screenshot(self, driver: Any, user: User) -> bytes | None:
        """
        Override this method in subclasses to implement specific screenshot logic.

        Args:
            driver: Authenticated WebDriver instance
            user: User context

        Returns:
            Screenshot as PNG bytes
        """
        raise NotImplementedError("Subclasses must implement _take_screenshot")


class PooledChartScreenshot(PooledBaseScreenshot):
    """Pooled version of chart screenshot generation"""

    thumbnail_type: str = "chart"
    element: str = "chart-container"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        from superset.utils.urls import modify_url_query
        from superset.utils.webdriver import ChartStandaloneMode

        # Chart reports are in standalone="true" mode
        url = modify_url_query(
            url,
            standalone=ChartStandaloneMode.HIDE_NAV.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or (800, 600)
        self.thumb_size = thumb_size or (400, 300)

    def _take_screenshot(self, driver: Any, user: User) -> bytes | None:
        """Take screenshot of chart with standard Superset chart handling"""
        try:
            # Wait for page to load
            selenium_headstart = current_app.config["SCREENSHOT_SELENIUM_HEADSTART"]
            logger.debug(f"Sleeping for {selenium_headstart} seconds")
            time.sleep(selenium_headstart)

            # Wait for chart container
            wait = WebDriverWait(driver, current_app.config["SCREENSHOT_LOCATE_WAIT"])
            element = wait.until(
                expected_conditions.presence_of_element_located(
                    (By.CLASS_NAME, self.element)
                )
            )

            # Wait for chart containers to render
            wait.until(
                expected_conditions.visibility_of_all_elements_located(
                    (By.CLASS_NAME, "chart-container")
                )
            )

            # Wait for loading to complete
            WebDriverWait(driver, current_app.config["SCREENSHOT_LOAD_WAIT"]).until_not(
                expected_conditions.presence_of_all_elements_located(
                    (By.CLASS_NAME, "loading")
                )
            )

            # Wait for animations
            animation_wait = current_app.config["SCREENSHOT_SELENIUM_ANIMATION_WAIT"]
            logger.debug(f"Wait {animation_wait} seconds for chart animation")
            time.sleep(animation_wait)

            # Handle unexpected errors if configured
            if current_app.config.get("SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"):
                from superset.utils.webdriver import WebDriverSelenium

                unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver)
                if unexpected_errors:
                    logger.warning(
                        f"{len(unexpected_errors)} errors found in screenshot. "
                        f"URL: {self.url}. Errors: {unexpected_errors}"
                    )

            # Take screenshot
            logger.debug(f"Taking PNG screenshot as user {user.username}")
            return element.screenshot_as_png

        except TimeoutException:
            logger.exception(f"Timeout taking chart screenshot for URL: {self.url}")
            raise
        except WebDriverException:
            logger.exception(f"WebDriver error taking screenshot for URL: {self.url}")
            raise


class PooledExploreScreenshot(PooledBaseScreenshot):
    """
    Pooled version of explore screenshot with UI hiding functionality.

    This class provides the same clean chart-only screenshots as the previous
    implementation but with improved performance through WebDriver pooling.
    """

    thumbnail_type: str = "explore"
    element: str = "chart-container"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        super().__init__(url, digest)
        self.window_size = window_size or (1600, 1200)
        self.thumb_size = thumb_size or (800, 600)

    def _take_screenshot(self, driver: Any, user: User) -> bytes | None:
        """
        Take screenshot of explore page with UI elements hidden for clean chart display.

        This implementation:
        1. Waits for chart to load
        2. Hides navigation, panels, and headers using JavaScript
        3. Takes screenshot of just the chart area
        4. Includes fallback strategies if chart container not found
        """
        try:
            # Give explore page time to initialize
            logger.debug("Waiting for explore page to initialize")
            time.sleep(3)

            # Wait for chart container to load and be visible
            wait = WebDriverWait(driver, 45)
            chart_element = wait.until(
                expected_conditions.visibility_of_element_located(
                    (By.CLASS_NAME, "chart-container")
                )
            )

            # Wait for any loading indicators to disappear
            WebDriverWait(driver, 30).until_not(
                expected_conditions.presence_of_all_elements_located(
                    (By.CLASS_NAME, "loading")
                )
            )

            # Hide overlapping UI elements using JavaScript
            self._hide_ui_elements(driver)

            # Wait for UI hiding animations to complete
            time.sleep(2)

            # Take screenshot of just the chart area
            img = chart_element.screenshot_as_png
            logger.info("Successfully captured chart-container screenshot")
            return img

        except TimeoutException as e:
            logger.warning(f"Chart container not found, trying fallbacks: {e}")
            return self._fallback_screenshot(driver)
        except Exception as e:
            logger.error(f"Error taking explore screenshot: {e}")
            raise

    def _hide_ui_elements(self, driver: Any) -> None:
        """Hide UI elements to show only the chart"""
        hide_script = """
            // Hide the specific left panels by their exact class names
            var dataSourcePanel = document.querySelector(
                '.explore-column.data-source-selection'
            );
            if (dataSourcePanel) {
                dataSourcePanel.style.display = 'none';
                console.log('Hidden data source panel');
            }

            var controlsPanel = document.querySelector(
                '.col-sm-3.explore-column.controls-column'
            );
            if (controlsPanel) {
                controlsPanel.style.display = 'none';
                console.log('Hidden controls panel');
            }

            // Also try alternate selectors for the controls
            var controlsAlt = document.querySelector('.explore-column.controls-column');
            if (controlsAlt) {
                controlsAlt.style.display = 'none';
                console.log('Hidden controls panel (alt)');
            }

            // Hide the main navigation header
            var mainHeader = document.querySelector('header.top#main-menu');
            if (mainHeader) {
                mainHeader.style.display = 'none';
                console.log('Hidden main navigation header');
            }

            // Hide the chart header with actions (title input and save button)
            var chartHeader = document.querySelector('.header-with-actions');
            if (chartHeader) {
                chartHeader.style.display = 'none';
                console.log('Hidden chart header with actions');
            }

            // Make sure the main chart area expands to use available space
            var mainContent = document.querySelector('.main-explore-content');
            if (mainContent) {
                mainContent.style.width = '100%';
                // Change from col-sm-7 to col-sm-12
                mainContent.className = 'main-explore-content col-sm-12';
            }

            // Ensure chart container is visible
            var chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.style.position = 'relative';
                chartContainer.style.zIndex = '999';
                chartContainer.style.width = '100%';
            }
        """

        try:
            driver.execute_script(hide_script)
            logger.debug("Successfully executed UI hiding script")
        except WebDriverException as e:
            logger.warning(f"Failed to execute UI hiding script: {e}")

    def _fallback_screenshot(self, driver: Any) -> bytes | None:
        """Fallback screenshot strategies if chart container not found"""
        try:
            # Fallback 1: Try slice container
            logger.debug("Trying slice_container fallback")
            slice_element = WebDriverWait(driver, 10).until(
                expected_conditions.visibility_of_element_located(
                    (By.CLASS_NAME, "slice_container")
                )
            )
            img = slice_element.screenshot_as_png
            logger.info("Successfully captured slice_container screenshot")
            return img

        except TimeoutException:
            try:
                # Fallback 2: Try any chart-related container
                logger.debug("Trying chart-related container fallback")
                chart_containers = driver.find_elements(
                    By.CSS_SELECTOR,
                    ".chart, .slice-container, .chart-content, "
                    "[data-test='chart-container']",
                )
                if chart_containers:
                    img = chart_containers[0].screenshot_as_png
                    logger.info(
                        "Successfully captured chart-related container screenshot"
                    )
                    return img

            except Exception as e2:
                logger.warning(f"Chart-related container fallback failed: {e2}")

            # Fallback 3: Full page screenshot
            logger.warning("Using full page screenshot as final fallback")
            img = driver.get_screenshot_as_png()
            logger.info("Using full page screenshot as fallback")
            return img


class PooledDashboardScreenshot(PooledBaseScreenshot):
    """Pooled version of dashboard screenshot generation"""

    thumbnail_type: str = "dashboard"
    element: str = "standalone"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        from superset.utils.urls import modify_url_query
        from superset.utils.webdriver import DashboardStandaloneMode

        # Dashboard screenshots should always capture in standalone
        url = modify_url_query(
            url,
            standalone=DashboardStandaloneMode.REPORT.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or (1600, 1200)
        self.thumb_size = thumb_size or (800, 600)

    def _take_screenshot(self, driver: Any, user: User) -> bytes | None:
        """Take screenshot of dashboard with standard Superset dashboard handling"""
        try:
            # Wait for page to load
            selenium_headstart = current_app.config["SCREENSHOT_SELENIUM_HEADSTART"]
            time.sleep(selenium_headstart)

            # Wait for dashboard element
            wait = WebDriverWait(driver, current_app.config["SCREENSHOT_LOCATE_WAIT"])
            element = wait.until(
                expected_conditions.presence_of_element_located(
                    (By.CLASS_NAME, self.element)
                )
            )

            # Wait for chart containers to render
            try:
                wait.until(
                    expected_conditions.visibility_of_all_elements_located(
                        (By.CLASS_NAME, "chart-container")
                    )
                )
            except TimeoutException:
                # Fallback for empty dashboards
                try:
                    WebDriverWait(driver, 0).until(
                        expected_conditions.visibility_of_all_elements_located(
                            (By.CLASS_NAME, "grid-container")
                        )
                    )
                except TimeoutException:
                    logger.exception(f"Dashboard failed to load at URL: {self.url}")
                    raise

            # Wait for loading to complete
            WebDriverWait(driver, current_app.config["SCREENSHOT_LOAD_WAIT"]).until_not(
                expected_conditions.presence_of_all_elements_located(
                    (By.CLASS_NAME, "loading")
                )
            )

            # Wait for animations
            animation_wait = current_app.config["SCREENSHOT_SELENIUM_ANIMATION_WAIT"]
            time.sleep(animation_wait)

            # Handle unexpected errors if configured
            if current_app.config.get("SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"):
                from superset.utils.webdriver import WebDriverSelenium

                unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver)
                if unexpected_errors:
                    logger.warning(
                        f"{len(unexpected_errors)} errors found in dashboard "
                        f"screenshot. URL: {self.url}. Errors: {unexpected_errors}"
                    )

            # Take screenshot
            logger.debug(f"Taking PNG dashboard screenshot as user {user.username}")
            return element.screenshot_as_png

        except TimeoutException:
            logger.exception(f"Timeout taking dashboard screenshot for URL: {self.url}")
            raise
        except WebDriverException:
            logger.exception(
                f"WebDriver error taking dashboard screenshot for URL: {self.url}"
            )
            raise
