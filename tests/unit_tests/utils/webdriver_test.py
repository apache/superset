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

from unittest.mock import ANY, MagicMock, patch
from uuid import UUID

import pytest

from superset.utils.report_execution import (
    ReportExecutionContext,
    ReportExecutionDeadline,
)
from superset.utils.webdriver import (
    check_playwright_availability,
    PLAYWRIGHT_AVAILABLE,
    PLAYWRIGHT_INSTALL_MESSAGE,
    WebDriverPlaywright,
)


def _report_context(
    *,
    dashboard_id: int | None = 805,
    chart_id: int | None = None,
    expected_chart_count: int = 52,
) -> ReportExecutionContext:
    """Return a deterministic scheduled-report context."""

    return ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=11,
        dashboard_id=dashboard_id,
        chart_id=chart_id,
        expected_chart_count=expected_chart_count,
        deadline=ReportExecutionDeadline(
            total_seconds=900,
            started_at=0,
            _clock=lambda: 0,
        ),
        capture_reserve_seconds=60,
        delivery_reserve_seconds=120,
        cleanup_reserve_seconds=30,
    )


@pytest.fixture()
def mock_app():
    """Mock Flask app with webdriver configuration."""
    app = MagicMock()
    app.config = {
        "WEBDRIVER_OPTION_ARGS": [],
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 10,
    }
    return app


class TestPlaywrightAvailabilityCheck:
    """Test comprehensive Playwright availability checking."""

    @patch("superset.utils.webdriver.sync_playwright", None)
    def test_check_playwright_availability_returns_false_when_module_not_available(
        self,
    ):
        """Test check_playwright_availability returns False when no module."""
        result = check_playwright_availability()
        assert result is False

    @patch("superset.utils.webdriver.sync_playwright")
    @patch("superset.utils.webdriver.logger")
    def test_check_playwright_availability_returns_true_when_module_importable(
        self, mock_logger, mock_sync_playwright
    ):
        """Test check_playwright_availability returns True when module is importable."""
        result = check_playwright_availability()
        assert result is True
        # Only checks sync_playwright is not None — never launches browser
        mock_sync_playwright.assert_not_called()


class TestWebDriverPlaywrightFallback:
    """Test WebDriverPlaywright fallback behavior when unavailable."""

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_raises_when_unavailable(self, mock_logger, mock_app):
        """Test get_screenshot raises RuntimeError when Playwright is unavailable."""
        mock_user = MagicMock()
        mock_user.username = "test_user"

        driver = WebDriverPlaywright("chrome")
        with pytest.raises(RuntimeError, match="Playwright is required"):
            driver.get_screenshot("http://example.com", "test-element", mock_user)

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_get_screenshot_works_when_available(self, mock_app, mock_browser_manager):
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
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
        }

        # Setup playwright mocks
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
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
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_handles_playwright_timeout(
        self, mock_logger, mock_browser_manager
    ):
        """Test WebDriverPlaywright handles PlaywrightTimeout gracefully."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup playwright mocks to raise timeout
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.goto.side_effect = PlaywrightTimeout("timeout")

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": True,
                "SCREENSHOT_TILED_ENABLED": False,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com", "test-element", mock_user
                )

        # page.goto() timeout is caught and logged without aborting; execution
        # continues to the element waits, which succeed here, so a screenshot
        # is taken and returned (not None).
        assert result is not None
        mock_logger.exception.assert_called()
        exception_call = mock_logger.exception.call_args[0][0]
        assert "Web event %s not detected" in exception_call


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
            "Failed to capture unexpected errors%s", ""
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
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_uses_wait_for_function_to_detect_spinners(
        self, mock_app, mock_browser_manager
    ):
        """wait_for_function polls for chart-holder readiness, not snapshotting."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            "WEBDRIVER_OPTION_ARGS": [],
            "WEBDRIVER_WINDOW": {"pixel_density": 1},
            "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
            "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
            "SCREENSHOT_SELENIUM_HEADSTART": 0,
            "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
            "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
            "SCREENSHOT_TILED_ENABLED": False,
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 60,
        }

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element
        mock_element.screenshot.return_value = b"screenshot"

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            driver.get_screenshot("http://example.com", "test-element", mock_user)

        mock_page.wait_for_function.assert_called_once()
        call_args, call_kwargs = mock_page.wait_for_function.call_args
        js = call_args[0]
        # The old absence-of-`.loading` predicate passed vacuously when a
        # chart holder hadn't mounted anything yet; the fix requires a
        # positive terminal-state check instead (same predicate as the tiled
        # path, #42119).
        assert "dashboard-component-chart-holder" in js
        assert ".slice_container" in js
        assert "data-test" not in js
        assert call_kwargs["timeout"] == 60 * 1000
        # Guard against reintroducing the old snapshot-based approach
        loading_locator_calls = [
            c for c in mock_page.locator.call_args_list if c.args == (".loading",)
        ]
        assert loading_locator_calls == []

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_spinner_timeout_logs_warning_and_raises(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        """Readiness timeout is logged as a warning, with per-chart diagnostics,
        and re-raised rather than silently capturing."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            "WEBDRIVER_OPTION_ARGS": [],
            "WEBDRIVER_WINDOW": {"pixel_density": 1},
            "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
            "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
            "SCREENSHOT_SELENIUM_HEADSTART": 0,
            "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
            "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
            "SCREENSHOT_TILED_ENABLED": False,
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 60,
        }

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element

        timeout = PlaywrightTimeout()
        mock_page.wait_for_function.side_effect = timeout
        mock_page.evaluate.return_value = [
            {"chartId": "42", "state": "nothing_mounted"}
        ]

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            with pytest.raises(PlaywrightTimeout) as exc_info:
                driver.get_screenshot("http://example.com", "test-element", mock_user)

        assert exc_info.value is timeout
        mock_logger.error.assert_not_called()
        warning_call = mock_logger.warning.call_args
        assert "terminal_reason=readiness_timeout" in warning_call.args[0]
        assert warning_call.args[1] == "http://example.com"
        assert warning_call.args[3] == 1  # mounted holders
        assert warning_call.args[4] == 0  # ready holders
        assert warning_call.args[7] == 60
        assert warning_call.args[9] == [{"chartId": "42", "state": "nothing_mounted"}]

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    def test_get_screenshot_raises_on_element_wait_timeout(
        self, mock_logger, mock_browser_manager
    ):
        """Test that PlaywrightTimeout propagates when waiting for page elements."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        # Setup mocks
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        # Keep a reference to the exact instance so we can verify identity below.
        timeout = PlaywrightTimeout()
        mock_page.locator.return_value = mock_element
        mock_element.wait_for.side_effect = timeout

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": True,
                "SCREENSHOT_TILED_ENABLED": False,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                with pytest.raises(PlaywrightTimeout) as exc_info:
                    driver.get_screenshot(
                        "http://example.com", "test-element", mock_user
                    )

        # The exact injected instance must propagate — guards against the
        # fallback alias (PlaywrightTimeout = Exception when playwright is
        # not installed) accepting unrelated exceptions.
        assert exc_info.value is timeout
        mock_logger.exception.assert_any_call(
            "Timed out requesting url %s%s", "http://example.com", ""
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    def test_missing_element_for_dashboard_height_falls_back_without_crashing(
        self, mock_logger, mock_browser_manager
    ):
        """Missing dashboard element should not crash height evaluation."""
        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()
        mock_chart_container = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        def locator_side_effect(selector):
            if selector == ".dashboard":
                return mock_element
            if selector == ".chart-container":
                locator = MagicMock()
                locator.all.return_value = [mock_chart_container]
                return locator
            if selector == ".loading":
                locator = MagicMock()
                locator.all.return_value = []
                return locator
            return MagicMock()

        mock_page.locator.side_effect = locator_side_effect
        mock_element.wait_for.return_value = None
        mock_element.screenshot.return_value = b"fake_screenshot"
        mock_chart_container.wait_for.return_value = None
        mock_page.wait_for_timeout.return_value = None

        def evaluate_side_effect(script):
            if script == 'document.querySelectorAll(".chart-container").length':
                return 1
            if "const target = document.querySelector" in script:
                return 0
            if "dashboard-component-chart-holder" in script:
                return []
            return None

        mock_page.evaluate.side_effect = evaluate_side_effect

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
                "SCREENSHOT_TILED_ENABLED": True,
                "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
                "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
                "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com", "dashboard", mock_user
                )

        assert result == b"fake_screenshot"
        # chart_count (1) is well below the tiling threshold (20), so this is
        # the benign/expected case and must not be logged as a WARNING.
        mock_logger.debug.assert_any_call(
            "Could not determine dashboard height for element %s "
            "at url %s (%s chart containers found); %s%s",
            "dashboard",
            "http://example.com",
            1,
            "falling back to standard screenshot behavior",
            "",
        )
        assert not any(
            call.args and "Could not determine dashboard height" in call.args[0]
            for call in mock_logger.warning.call_args_list
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    def test_unknown_height_does_not_veto_tiling_for_large_dashboard(
        self, mock_take_tiled, mock_logger, mock_browser_manager
    ):
        """
        A large dashboard (by chart_count) whose height can't be measured
        must still attempt tiling instead of being silently downgraded to a
        standard screenshot, since below-the-fold charts may not have
        rendered without the scroll-driven tiling pass.
        """
        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()
        mock_chart_container = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        def locator_side_effect(selector):
            if selector == ".chart-container":
                locator = MagicMock()
                locator.all.return_value = [mock_chart_container]
                return locator
            return mock_element

        mock_page.locator.side_effect = locator_side_effect
        mock_element.wait_for.return_value = None
        mock_chart_container.wait_for.return_value = None
        mock_page.wait_for_timeout.return_value = None
        mock_take_tiled.return_value = b"tiled_screenshot"

        def evaluate_side_effect(script):
            if script == 'document.querySelectorAll(".chart-container").length':
                return 25  # chart_count >= threshold
            if "const target = document.querySelector" in script:
                return 0  # height could not be determined
            return None

        mock_page.evaluate.side_effect = evaluate_side_effect

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
                "SCREENSHOT_TILED_ENABLED": True,
                "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
                "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
                "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com", "dashboard", mock_user
                )

        assert result == b"tiled_screenshot"
        mock_take_tiled.assert_called_once()
        mock_logger.warning.assert_any_call(
            "Could not determine dashboard height for element %s "
            "at url %s (%s chart containers found); %s%s",
            "dashboard",
            "http://example.com",
            25,
            "attempting tiled screenshot anyway",
            "",
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    def test_large_report_dashboard_tiles_even_when_measured_height_is_short(
        self, mock_take_tiled, mock_browser_manager
    ):
        """Regression: the GOOD (full) report path is the tiled one; BAD
        (blank/partial) runs mis-route a large dashboard to the single-shot
        non-tiled capture because ``scrollHeight`` is measured while charts are
        still virtualized/collapsed (<= one tile). A scheduled report whose
        dashboard is large by chart count must take the tiled path regardless
        of that stale height measurement, so every region is scrolled into
        view and waited on instead of captured as a windowed partial.
        """
        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()
        mock_chart_container = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        def locator_side_effect(selector):
            if selector == ".chart-container":
                locator = MagicMock()
                locator.all.return_value = [mock_chart_container]
                return locator
            return mock_element

        mock_page.locator.side_effect = locator_side_effect
        mock_take_tiled.return_value = b"tiled_screenshot"

        def evaluate_side_effect(script):
            if script == 'document.querySelectorAll(".chart-container").length':
                return 52  # mounted containers
            if "const target = document.querySelector" in script:
                # Non-zero but <= one tile: the classic mid-layout measurement
                # that previously vetoed tiling and dropped to the non-tiled
                # path.
                return 1500
            return None

        mock_page.evaluate.side_effect = evaluate_side_effect

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 1,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
                "SCREENSHOT_TILED_ENABLED": True,
                "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
                "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
                # Larger than the measured 1500px height, so only the new
                # report-mode branch (not `dashboard_height > tile_height`) can
                # select tiling here.
                "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 2000,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                result = driver.get_screenshot(
                    "http://example.com/dashboard/805",
                    "standalone",
                    mock_user,
                    report_execution_context=_report_context(),
                )

        assert result == b"tiled_screenshot"
        mock_take_tiled.assert_called_once()
        # The non-tiled single-shot capture must not run for this large report.
        mock_page.screenshot.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    def test_chart_container_timeout_logs_warning_with_progress_and_raises(
        self, mock_logger, mock_browser_manager
    ):
        """
        Timing out while waiting for `.chart-container` elements to draw must
        be logged as a WARNING (matching the other locate-wait timeouts in
        this method, and the customer-side-slowness convention established
        for these Playwright timeouts) with rendered/total progress, and must
        still fail the screenshot by re-raising.
        """
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page

        timeout = PlaywrightTimeout()
        rendered_ok = MagicMock()
        rendered_ok.wait_for.return_value = None
        never_renders = MagicMock()
        never_renders.wait_for.side_effect = timeout

        def locator_side_effect(selector):
            if selector == ".chart-container":
                locator = MagicMock()
                locator.all.return_value = [rendered_ok, never_renders]
                return locator
            return mock_element

        mock_page.locator.side_effect = locator_side_effect
        mock_element.wait_for.return_value = None

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 5,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 1,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
                "SCREENSHOT_TILED_ENABLED": False,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                with pytest.raises(PlaywrightTimeout) as exc_info:
                    driver.get_screenshot(
                        "http://example.com", "test-element", mock_user
                    )

        assert exc_info.value is timeout
        mock_logger.warning.assert_any_call(
            "Timed out waiting for chart containers to draw at url %s "
            "(%s of %s chart containers rendered before the timeout)%s",
            "http://example.com",
            1,
            2,
            "",
            exc_info=True,
        )
        mock_logger.exception.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    def test_tiled_screenshot_failure_raises_without_fallback(
        self, mock_take_tiled, mock_logger, mock_browser_manager
    ) -> None:
        """When take_tiled_screenshot returns None, fail loudly instead of
        falling back to an unguarded standard screenshot."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"

        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element
        mock_element.wait_for.return_value = None
        # page.screenshot is used by _get_screenshot for the "standalone" element;
        # it must never be reached by the failure path under test.
        mock_page.screenshot.return_value = b"fallback_screenshot"

        def evaluate_side_effect(script):
            if "querySelectorAll" in script:
                return 25  # chart_count >= threshold
            if "const target" in script:
                return 6000  # dashboard_height > height_threshold and > tile_height
            return None

        mock_page.evaluate.side_effect = evaluate_side_effect
        mock_take_tiled.return_value = None  # tiled screenshot returns None

        with patch("superset.utils.webdriver.app") as mock_app:
            mock_app.config = {
                "WEBDRIVER_OPTION_ARGS": [],
                "WEBDRIVER_WINDOW": {"pixel_density": 1},
                "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
                "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
                "SCREENSHOT_SELENIUM_HEADSTART": 0,
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
                "SCREENSHOT_LOCATE_WAIT": 10,
                "SCREENSHOT_LOAD_WAIT": 10,
                "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
                "SCREENSHOT_TILED_ENABLED": True,
                "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
                "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
                "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
            }

            with patch.object(WebDriverPlaywright, "auth") as mock_auth:
                mock_auth.return_value = mock_context

                driver = WebDriverPlaywright("chrome")
                # match= keeps this assertion meaningful even when playwright
                # is not installed and PlaywrightTimeout aliases bare Exception.
                with pytest.raises(
                    PlaywrightTimeout, match="Tiled screenshot failed for url"
                ):
                    driver.get_screenshot(
                        "http://example.com",
                        "standalone",
                        mock_user,
                        report_execution_context=_report_context(),
                    )

        mock_take_tiled.assert_called_once()
        mock_page.screenshot.assert_not_called()
        mock_element.screenshot.assert_not_called()
        assert any(
            "no safe fallback exists" in call.args[0]
            for call in mock_logger.warning.call_args_list
        )


class TestWebDriverPlaywrightChartReadiness:
    """Regression tests for the non-tiled vacuous-pass fix.

    The readiness predicate itself (`CHART_HOLDERS_READY_JS` /
    `FIND_UNREADY_CHART_HOLDERS_JS` in screenshot_utils.py) is exercised
    directly in test_screenshot_utils.py; these tests confirm the standard
    (non-tiled) `get_screenshot` path wires up to that *same* shared
    predicate instead of the old absence-of-`.loading` check, which passed
    vacuously for a chart holder that hadn't mounted anything yet.
    """

    _base_config = {
        "WEBDRIVER_OPTION_ARGS": [],
        "WEBDRIVER_WINDOW": {"pixel_density": 1},
        "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
        "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
        "SCREENSHOT_SELENIUM_HEADSTART": 0,
        "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
        "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
        "SCREENSHOT_TILED_ENABLED": False,
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 5,
    }

    def _make_pw_mocks(self, mock_browser_manager):
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element
        mock_element.screenshot.return_value = b"screenshot"
        return mock_context, mock_page

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_chart_holder_with_nothing_mounted_does_not_satisfy_wait(
        self, mock_app, mock_browser_manager
    ):
        """A chart holder present in the DOM but with nothing mounted yet (no
        spinner, no rendered content -- e.g. the gap between page-load
        completing and React/query bootstrap) must not satisfy the readiness
        wait. The old `.loading`-absence check passed immediately in this
        case, producing a silently blank screenshot.
        """
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config}

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        def fake_wait_for_function(js, timeout=None):
            # Confirm the predicate sent is the shared terminal-state check
            # (not the old absence-of-`.loading` check), then simulate it
            # correctly reporting "not ready" for a chart holder that hasn't
            # mounted anything.
            assert "dashboard-component-chart-holder" in js
            raise PlaywrightTimeout("Timeout waiting for chart holders")

        mock_page.wait_for_function.side_effect = fake_wait_for_function
        mock_page.evaluate.return_value = [{"chartId": "7", "state": "nothing_mounted"}]

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            with pytest.raises(PlaywrightTimeout):
                driver.get_screenshot("http://example.com", "test-element", mock_user)

        # No screenshot should be captured -- fail loudly instead of
        # silently returning a blank image.
        mock_page.screenshot.assert_not_called()
        mock_page.locator.return_value.screenshot.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_all_chart_holders_ready_passes(self, mock_app, mock_browser_manager):
        """All chart holders rendered or errored -> wait passes, screenshot taken."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config}

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        # mock_page.wait_for_function is a no-op MagicMock by default, i.e.
        # the readiness predicate is satisfied immediately.

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            result = driver.get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert result == b"screenshot"
        # Readiness diagnostics are emitted before polling so a task killed by
        # an outer limit still leaves useful state in the logs.
        assert mock_page.evaluate.call_count == 2
        assert all(
            "state: 'rendered'" in call.args[0]
            for call in mock_page.evaluate.call_args_list
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_chart_capture_uses_positive_terminal_state_predicate(
        self, mock_app, mock_browser_manager
    ):
        """Chart captures require a terminal marker and no loading marker."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_app.config = {**self._base_config}
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        timeout = PlaywrightTimeout("chart not ready")
        mock_page.wait_for_function.side_effect = timeout

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            with pytest.raises(PlaywrightTimeout):
                WebDriverPlaywright("chrome").get_screenshot(
                    "http://example.com",
                    "chart-container",
                    MagicMock(),
                    report_execution_context=_report_context(
                        dashboard_id=None,
                        chart_id=7,
                        expected_chart_count=1,
                    ),
                )

        predicate = mock_page.wait_for_function.call_args.args[0]
        assert "document.querySelector('.chart-container')" in predicate
        assert ".slice_container" in predicate
        assert ".loading" in predicate
        assert '[role="alert"]' in predicate
        assert ".ant-empty" in predicate
        assert ".missing-chart-container" in predicate
        mock_page.locator.return_value.screenshot.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_standalone_zero_holders_remain_not_ready_and_skip_capture(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        from superset.utils.webdriver import PlaywrightTimeout

        mock_app.config = {**self._base_config}
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        mock_page.evaluate.return_value = []
        mock_page.wait_for_function.side_effect = PlaywrightTimeout("zero holders")

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            with pytest.raises(PlaywrightTimeout):
                WebDriverPlaywright("chrome").get_screenshot(
                    "http://example.com",
                    "standalone",
                    MagicMock(),
                    report_execution_context=_report_context(),
                )

        assert any(
            "report_readiness_waiting_for_mount" in call.args[0]
            for call in mock_logger.info.call_args_list
        )
        assert (
            "terminal_reason=readiness_timeout" in mock_logger.warning.call_args.args[0]
        )
        mock_page.screenshot.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_thumbnail_zero_holders_preserves_existing_capture_behavior(
        self,
        mock_app,
        mock_browser_manager,
    ):
        mock_app.config = {**self._base_config}
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        mock_page.evaluate.return_value = []

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            result = WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com",
                "standalone",
                MagicMock(),
            )

        predicate = mock_page.wait_for_function.call_args.args[0]
        assert "holders.length > 0" not in predicate
        assert result == mock_page.screenshot.return_value

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_readiness_check_scoped_to_viewport_visible_holders(
        self, mock_app, mock_browser_manager
    ):
        """The non-tiled readiness check only requires viewport-intersecting
        chart holders to be ready, mirroring the tiled path's reasoning
        (#42119). `get_screenshot`'s standard (non-tiled) branch never
        resizes the browser viewport to the full dashboard height before
        capturing -- only the tiled branch's `set_viewport_size` call does
        that -- so a below-the-fold chart holder is a
        DashboardVirtualization placeholder that hasn't mounted anything
        real yet by design and must not block this wait.
        """
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config}

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            driver.get_screenshot("http://example.com", "test-element", mock_user)

        js = mock_page.wait_for_function.call_args[0][0]
        # The predicate skips any chart holder whose bounding rect doesn't
        # intersect the current viewport -- an off-screen/below-fold holder
        # is excluded from the readiness requirement rather than blocking it.
        assert "getBoundingClientRect" in js
        assert "window.innerHeight" in js
        # set_viewport_size is only ever called on the tiled branch (to
        # resize to tile_height); confirming it's untouched here is what
        # makes the viewport-scoped predicate necessary for this branch.
        mock_page.set_viewport_size.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_log_context_threaded_into_readiness_wait(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        """log_context (e.g. report execution id) is threaded through the
        non-tiled readiness wait for correlation, matching #42119's
        convention for the tiled path."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config}

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        mock_page.wait_for_function.side_effect = PlaywrightTimeout("timed out")
        mock_page.evaluate.return_value = [{"chartId": "7", "state": "nothing_mounted"}]

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            with pytest.raises(PlaywrightTimeout):
                driver.get_screenshot(
                    "http://example.com",
                    "test-element",
                    mock_user,
                    log_context="execution_id=abc-123",
                )

        assert mock_logger.warning.call_args.args[8] == " [execution_id=abc-123]"

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_wait_is_capped_to_remaining_runtime_task_budget(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        """Elapsed setup time is removed from the task-derived safe budget."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_LOAD_WAIT": 600,
        }
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        with (
            patch.object(WebDriverPlaywright, "auth", return_value=mock_context),
            patch(
                "superset.utils.webdriver.resolve_screenshot_task_budget_seconds",
                return_value=240,
            ),
            patch(
                "superset.utils.webdriver.time.monotonic",
                side_effect=[100.0, 110.0],
            ),
        ):
            WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert mock_page.wait_for_function.call_args.kwargs["timeout"] == 230_000

    def test_report_readiness_uses_shared_deadline_and_phase_reserves(self):
        from uuid import UUID

        from superset.utils.report_execution import (
            ReportExecutionContext,
            ReportExecutionDeadline,
        )

        page = MagicMock()
        page.evaluate.return_value = [{"chartId": "7", "state": "rendered"}]
        deadline = ReportExecutionDeadline(
            total_seconds=900,
            started_at=0,
            _clock=lambda: 100,
        )
        report_context = ReportExecutionContext(
            execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
            report_schedule_id=11,
            dashboard_id=805,
            expected_chart_count=52,
            deadline=deadline,
            capture_reserve_seconds=60,
            delivery_reserve_seconds=120,
            cleanup_reserve_seconds=30,
        )

        WebDriverPlaywright._wait_for_charts_ready(
            page,
            "http://example.com/dashboard/805",
            5,
            "standalone",
            report_execution_context=report_context,
        )

        assert page.wait_for_function.call_args.kwargs["timeout"] == 590_000

    def test_report_readiness_budget_exhaustion_skips_poll_and_capture(self):
        from uuid import UUID

        from superset.utils.report_execution import (
            ReportExecutionBudgetExceededError,
            ReportExecutionContext,
            ReportExecutionDeadline,
        )

        page = MagicMock()
        page.evaluate.return_value = []
        deadline = ReportExecutionDeadline(
            total_seconds=900,
            started_at=0,
            _clock=lambda: 700,
        )
        report_context = ReportExecutionContext(
            execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
            report_schedule_id=11,
            dashboard_id=805,
            expected_chart_count=52,
            deadline=deadline,
            capture_reserve_seconds=60,
            delivery_reserve_seconds=120,
            cleanup_reserve_seconds=30,
        )

        with pytest.raises(ReportExecutionBudgetExceededError):
            WebDriverPlaywright._wait_for_charts_ready(
                page,
                "http://example.com/dashboard/805",
                600,
                "standalone",
                report_execution_context=report_context,
            )

        page.wait_for_function.assert_not_called()
        page.screenshot.assert_not_called()

    def test_report_readiness_forces_below_fold_render_and_waits_for_all_holders(
        self,
    ):
        """Regression for blank/partial report PDFs.

        The non-tiled report capture takes a single full-page screenshot that
        includes below-the-fold holders, so the readiness gate must (a) force
        every virtualized row to render up front and (b) require *all* mounted
        holders -- not just the viewport-visible ones -- to reach a terminal
        state. Otherwise an off-screen holder that never rendered is captured
        blank and silently delivered as a Success.
        """
        from superset.utils.screenshot_utils import (
            FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS,
            REPORT_ALL_CHART_HOLDERS_READY_JS,
        )

        page = MagicMock()
        page.evaluate.return_value = [{"chartId": "7", "state": "rendered"}]

        WebDriverPlaywright._wait_for_charts_ready(
            page,
            "http://example.com/dashboard/805",
            5,
            "standalone",
            report_execution_context=_report_context(),
        )

        # (a) Off-screen rows are forced to render before the wait.
        assert any(
            call.args and call.args[0] == FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS
            for call in page.evaluate.call_args_list
        )
        # (b) The readiness predicate is the all-holders variant: it must not
        # skip below-the-fold holders (no viewport-intersection test), so a
        # virtualized/unrendered off-screen holder cannot satisfy the gate.
        predicate = page.wait_for_function.call_args.args[0]
        assert predicate == REPORT_ALL_CHART_HOLDERS_READY_JS
        assert "getBoundingClientRect" not in predicate
        assert "window.innerHeight" not in predicate

    @patch("superset.utils.webdriver.logger")
    def test_report_readiness_below_fold_unrendered_fails_loudly(self, mock_logger):
        """When an off-screen holder never renders within budget the report
        must fail loudly (raise) rather than capture/deliver a blank
        screenshot, and the terminal log must surface the below-the-fold
        unready holders that the viewport-scoped diagnostic hides as
        'virtualized'.
        """
        from superset.utils.screenshot_utils import (
            FIND_ALL_UNREADY_CHART_HOLDERS_JS,
            FIND_CHART_HOLDER_STATES_JS,
        )
        from superset.utils.webdriver import PlaywrightTimeout

        page = MagicMock()
        # 22 on-screen rendered holders + 30 off-screen holders that the
        # viewport-scoped diagnostic labels 'virtualized' (and would otherwise
        # count as "ready").
        holder_states = [
            {"chartId": str(i), "state": "rendered"} for i in range(22)
        ] + [{"chartId": str(i), "state": "virtualized"} for i in range(22, 52)]
        below_fold_unready = [
            {"chartId": str(i), "state": "nothing_mounted"} for i in range(22, 52)
        ]

        def _evaluate(script, *args):
            if script == FIND_ALL_UNREADY_CHART_HOLDERS_JS:
                return below_fold_unready
            if script == FIND_CHART_HOLDER_STATES_JS:
                return holder_states
            return None

        page.evaluate.side_effect = _evaluate
        page.wait_for_function.side_effect = PlaywrightTimeout(
            "below-fold holders never rendered"
        )

        with pytest.raises(PlaywrightTimeout):
            WebDriverPlaywright._wait_for_charts_ready(
                page,
                "http://example.com/dashboard/805",
                5,
                "standalone",
                report_execution_context=_report_context(),
            )

        terminal_call = next(
            call
            for call in mock_logger.warning.call_args_list
            if call.args and call.args[0].startswith("report_readiness_terminal")
        )
        assert "terminal_reason=readiness_timeout" in terminal_call.args[0]
        # The below-the-fold offenders are surfaced explicitly.
        assert "all_unready_holders=" in terminal_call.args[0]
        assert below_fold_unready in terminal_call.args

    @patch("superset.utils.webdriver.logger")
    def test_chart_capture_ready_logs_container_state_not_holder_counts(
        self, mock_logger
    ):
        """Chart pages have no dashboard grid holders, so the ready line must
        report the `.chart-container` state instead of vacuous zero counters
        (which read as "no charts" in customer logs)."""
        from superset.utils.screenshot_utils import CHART_CONTAINER_STATE_JS

        page = MagicMock()
        page.wait_for_function.return_value = None
        page.evaluate.side_effect = lambda script: (
            "terminal" if script == CHART_CONTAINER_STATE_JS else []
        )

        with patch(
            "superset.utils.webdriver.resolve_screenshot_task_budget_seconds",
            return_value=None,
        ):
            WebDriverPlaywright._wait_for_charts_ready(
                page,
                "http://example.com",
                10,
                "chart-container",
                log_context="capture_kind=alert execution_id=abc-123",
            )

        ready_call = next(
            call
            for call in mock_logger.info.call_args_list
            if call.args and call.args[0].startswith("report_readiness_ready")
        )
        assert "target=chart-container" in ready_call.args[0]
        assert "mounted_holders" not in ready_call.args[0]
        assert "terminal" in ready_call.args
        assert " [capture_kind=alert execution_id=abc-123]" in ready_call.args

    @patch("superset.utils.webdriver.logger")
    def test_chart_capture_timeout_logs_container_state(self, mock_logger):
        from superset.utils.screenshot_utils import CHART_CONTAINER_STATE_JS
        from superset.utils.webdriver import PlaywrightTimeout

        page = MagicMock()
        page.wait_for_function.side_effect = PlaywrightTimeout()
        page.evaluate.side_effect = lambda script: (
            "loading" if script == CHART_CONTAINER_STATE_JS else []
        )

        with (
            patch(
                "superset.utils.webdriver.resolve_screenshot_task_budget_seconds",
                return_value=None,
            ),
            pytest.raises(PlaywrightTimeout),
        ):
            WebDriverPlaywright._wait_for_charts_ready(
                page,
                "http://example.com",
                10,
                "chart-container",
            )

        terminal_call = next(
            call
            for call in mock_logger.warning.call_args_list
            if call.args and call.args[0].startswith("report_readiness_terminal")
        )
        assert "target=chart-container" in terminal_call.args[0]
        assert "terminal_reason=readiness_timeout" in terminal_call.args[0]
        assert "mounted_holders" not in terminal_call.args[0]
        assert "loading" in terminal_call.args

    def test_zero_load_wait_without_task_budget_preserves_playwright_no_timeout(self):
        page = MagicMock()
        page.evaluate.return_value = []

        with patch(
            "superset.utils.webdriver.resolve_screenshot_task_budget_seconds",
            return_value=None,
        ):
            WebDriverPlaywright._wait_for_charts_ready(
                page,
                "http://example.com",
                0,
                "chart-container",
            )

        page.wait_for_function.assert_called_once()
        assert page.wait_for_function.call_args.kwargs["timeout"] == 0

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_exhausted_task_budget_raises_before_capture(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        """An exhausted budget fails loudly while cleanup time remains."""
        from superset.utils.webdriver import ScreenshotTaskBudgetExceededError

        mock_user = MagicMock()
        mock_app.config = {**self._base_config, "SCREENSHOT_LOAD_WAIT": 600}
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        diagnostics = [{"chartId": "17", "state": "nothing_mounted"}]
        mock_page.evaluate.return_value = diagnostics

        with (
            patch.object(WebDriverPlaywright, "auth", return_value=mock_context),
            patch(
                "superset.utils.webdriver.resolve_screenshot_task_budget_seconds",
                return_value=240,
            ),
            patch(
                "superset.utils.webdriver.time.monotonic",
                side_effect=[100.0, 341.0],
            ),
        ):
            with pytest.raises(ScreenshotTaskBudgetExceededError):
                WebDriverPlaywright("chrome").get_screenshot(
                    "http://example.com", "test-element", mock_user
                )

        mock_page.wait_for_function.assert_not_called()
        mock_page.locator.return_value.screenshot.assert_not_called()
        mock_context.close.assert_called_once()
        warning_args = mock_logger.warning.call_args.args
        assert "budget exhausted" in warning_args[0]
        assert warning_args[5] == diagnostics

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.logger")
    @patch("superset.utils.webdriver.app")
    def test_unready_diagnostics_logged_early_and_at_failure(
        self, mock_app, mock_logger, mock_browser_manager
    ):
        """Unready IDs/states are logged before polling and on timeout."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config}
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        diagnostics = [{"chartId": "17", "state": "waiting_on_database"}]
        mock_page.evaluate.return_value = diagnostics
        mock_page.wait_for_function.side_effect = PlaywrightTimeout("timed out")

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            driver = WebDriverPlaywright("chrome")
            with pytest.raises(PlaywrightTimeout):
                driver.get_screenshot("http://example.com", "test-element", mock_user)

        mock_logger.info.assert_any_call(
            "Chart holders not ready before polling at url %s%s: %s",
            "http://example.com",
            "",
            diagnostics,
        )
        failure_args = mock_logger.warning.call_args.args
        assert failure_args[9] == diagnostics
        assert failure_args[10] == diagnostics
        mock_page.locator.return_value.screenshot.assert_not_called()


class TestWebDriverPlaywrightAnimationWaitOrder:
    """Animation wait must run after the spinner wait, not before."""

    _base_config = {
        "WEBDRIVER_OPTION_ARGS": [],
        "WEBDRIVER_WINDOW": {"pixel_density": 1},
        "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
        "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
        "SCREENSHOT_SELENIUM_HEADSTART": 0,
        "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 2,
        "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 30,
    }

    def _make_pw_mocks(self, mock_browser_manager):
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_element = MagicMock()

        mock_browser_manager.get_browser.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.locator.return_value = mock_element
        mock_element.screenshot.return_value = b"screenshot"
        return mock_context, mock_page

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_animation_wait_after_spinner_wait_tiled_disabled(
        self, mock_app, mock_browser_manager
    ):
        """Non-tiled path: animation wait runs after spinner wait_for_function."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {**self._base_config, "SCREENSHOT_TILED_ENABLED": False}

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        call_order: list[str] = []

        def record_wait_for_function(*args, **kwargs):
            call_order.append("spinner_wait")

        def record_wait_for_timeout(ms):
            if ms == 2 * 1000:
                call_order.append("animation_wait")

        mock_page.wait_for_function.side_effect = record_wait_for_function
        mock_page.wait_for_timeout.side_effect = record_wait_for_timeout

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert "spinner_wait" in call_order
        assert "animation_wait" in call_order
        spinner_idx = call_order.index("spinner_wait")
        anim_idx = call_order.index("animation_wait")
        assert spinner_idx < anim_idx, (
            "spinner wait must precede animation wait in non-tiled path"
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_animation_wait_after_spinner_wait_tiled_enabled_small_dashboard(
        self, mock_app, mock_browser_manager
    ):
        """Non-tiled path (tiled on, small dashboard): animation after spinner."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_TILED_ENABLED": True,
            "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
            "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
            "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
        }

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        # Small dashboard: 3 charts, 1000px height — below both thresholds
        mock_page.evaluate.side_effect = [3, 1000, [], []]

        call_order: list[str] = []

        def record_wait_for_function(*args, **kwargs):
            call_order.append("spinner_wait")

        def record_wait_for_timeout(ms):
            if ms == 2 * 1000:
                call_order.append("animation_wait")

        mock_page.wait_for_function.side_effect = record_wait_for_function
        mock_page.wait_for_timeout.side_effect = record_wait_for_timeout

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert "spinner_wait" in call_order
        assert "animation_wait" in call_order
        assert call_order.index("spinner_wait") < call_order.index("animation_wait")

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    @patch("superset.utils.webdriver.app")
    def test_chart_threshold_does_not_tile_short_dashboard(
        self, mock_app, mock_take_tiled, mock_browser_manager
    ):
        """Preserve the historical height guard for reports and thumbnails."""

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_TILED_ENABLED": True,
            "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
            "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
            "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
        }
        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        mock_page.evaluate.side_effect = [25, 500, [], []]

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            result = WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        assert result == b"screenshot"
        mock_take_tiled.assert_not_called()
        mock_page.set_viewport_size.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    @patch("superset.utils.webdriver.app")
    def test_tiled_path_passes_animation_wait_per_tile_no_global_wait(
        self, mock_app, mock_take_tiled, mock_browser_manager
    ):
        """Tiled path delegates animation_wait to take_tiled_screenshot; no global."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_TILED_ENABLED": True,
            "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
            "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
            "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
        }

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        # Large dashboard: 25 charts, 6000px height
        mock_page.evaluate.side_effect = [25, 6000]
        mock_take_tiled.return_value = b"tiled_screenshot"

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            result = WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "standalone", mock_user
            )

        assert result == b"tiled_screenshot"
        mock_take_tiled.assert_called_once_with(
            mock_page,
            "standalone",
            600,
            load_wait=30,
            animation_wait=2,
            log_context=None,
            report_execution_context=None,
            url="http://example.com",
            screenshot_started_at=ANY,
        )
        # The only wait_for_timeout call should be the 0ms headstart; no global
        # animation wait should be issued (handled per-tile by take_tiled_screenshot)
        animation_waits = [
            call[0][0]
            for call in mock_page.wait_for_timeout.call_args_list
            if call[0][0] == 2 * 1000
        ]
        assert animation_waits == [], (
            "No global 2s animation wait_for_timeout should fire on the tiled path"
        )

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.take_tiled_screenshot")
    @patch("superset.utils.webdriver.app")
    def test_tiled_empty_bytes_raises_without_fallback(
        self, mock_app, mock_take_tiled, mock_browser_manager
    ):
        """Tiled failure raises when take_tiled_screenshot returns b"" (not None),
        instead of silently falling through to an unguarded raw capture."""
        from superset.utils.webdriver import PlaywrightTimeout

        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_TILED_ENABLED": True,
            "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
            "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
            "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 600,
        }

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)
        mock_page.evaluate.side_effect = [25, 6000]
        # Empty bytes — falsy but not None; was silently passed through before the fix
        mock_take_tiled.return_value = b""
        # _get_screenshot("standalone") calls page.screenshot(full_page=True); it
        # must never be reached by the failure path under test.
        mock_page.screenshot.return_value = b"fallback"

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            # match= keeps this assertion meaningful even when playwright
            # is not installed and PlaywrightTimeout aliases bare Exception.
            with pytest.raises(
                PlaywrightTimeout, match="Tiled screenshot failed for url"
            ):
                WebDriverPlaywright("chrome").get_screenshot(
                    "http://example.com", "standalone", mock_user
                )

        # Tiled path was taken (take_tiled_screenshot was called)
        mock_take_tiled.assert_called_once()
        # Standard screenshot must never be called as a fallback
        mock_page.screenshot.assert_not_called()

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.webdriver._browser_manager")
    @patch("superset.utils.webdriver.app")
    def test_animation_wait_skipped_when_zero(self, mock_app, mock_browser_manager):
        """No extra wait_for_timeout call when SCREENSHOT_SELENIUM_ANIMATION_WAIT=0."""
        mock_user = MagicMock()
        mock_user.username = "test_user"
        mock_app.config = {
            **self._base_config,
            "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
            "SCREENSHOT_TILED_ENABLED": False,
        }

        mock_context, mock_page = self._make_pw_mocks(mock_browser_manager)

        with patch.object(WebDriverPlaywright, "auth", return_value=mock_context):
            WebDriverPlaywright("chrome").get_screenshot(
                "http://example.com", "test-element", mock_user
            )

        # Only headstart (0ms) should be called; no animation wait call
        timeout_values = [
            call[0][0] for call in mock_page.wait_for_timeout.call_args_list
        ]
        assert timeout_values == [0], (
            f"Expected only [0] (headstart), got {timeout_values}"
        )
