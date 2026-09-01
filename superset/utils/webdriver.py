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

from __future__ import annotations

import atexit
import logging
import time
from abc import ABC, abstractmethod
from enum import Enum
from time import sleep
from typing import Any, TYPE_CHECKING

from flask import current_app as app
from packaging import version
from selenium import __version__ as selenium_version
from selenium.common.exceptions import (
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import chrome, firefox, FirefoxProfile
from selenium.webdriver.common.by import By
from selenium.webdriver.common.service import Service
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC  # noqa: N812
from selenium.webdriver.support.ui import WebDriverWait

from superset.extensions import machine_auth_provider_factory
from superset.utils.report_execution import (
    ReportExecutionContext,
)
from superset.utils.retries import retry_call
from superset.utils.screenshot_utils import (
    ANNOTATE_PRINT_COLUMNS_JS,
    CHART_CONTAINER_READY_JS,
    CHART_CONTAINER_STATE_JS,
    CHART_HOLDERS_READY_JS,
    EXPAND_TABLE_CONTAINERS_JS,
    FIND_CHART_HOLDER_STATES_JS,
    PRINT_ALL_CHART_HOLDERS_READY_JS,
    REPORT_CHART_HOLDERS_READY_JS,
    resolve_screenshot_task_budget_seconds,
    SCALE_WIDE_TABLES_JS,
    ScreenshotTaskBudgetExceededError,
    SET_PRINT_FONT_SIZE_JS,
    SHOW_ALL_TABLE_ROWS_JS,
    take_tiled_screenshot,
    UNHIDE_TAB_PANELS_JS,
)

WindowSize = tuple[int, int]
logger = logging.getLogger(__name__)

# Installation message for missing Playwright (Cypress doesn't work with DeckGL)
PLAYWRIGHT_INSTALL_MESSAGE = (
    "To complete the migration from Cypress "
    "and enable WebGL/DeckGL screenshot support, install Playwright with: "
    "pip install playwright && playwright install chromium"
)


if TYPE_CHECKING:
    from typing import Any

    from flask_appbuilder.security.sqla.models import User

try:
    from playwright.sync_api import (
        BrowserContext,
        Error as PlaywrightError,
        Locator,
        Page,
        sync_playwright,
        TimeoutError as PlaywrightTimeout,
    )
except ImportError:
    from typing import Any

    # Define dummy classes when playwright is not available
    BrowserContext = Any
    PlaywrightError = Exception
    PlaywrightTimeout = Exception
    Locator = Any
    Page = Any
    sync_playwright = None


def check_playwright_availability() -> bool:
    """
    Lightweight check for Playwright availability.

    First checks if browser binary exists, falls back to launch test if needed.
    """
    if sync_playwright is None:
        return False

    try:
        with sync_playwright() as p:
            # First try lightweight check - just verify executable exists
            try:
                executable_path = p.chromium.executable_path
                if executable_path:
                    return True
            except Exception:
                # Fall back to full launch test if executable_path fails
                logger.debug(
                    "Executable path check failed, falling back to launch test"
                )

            # Fallback: actually launch browser to ensure it works
            browser = p.chromium.launch(headless=True)
            browser.close()
            return True
    except Exception as e:
        logger.warning(
            "Playwright module is installed but browser launch failed. "
            "Run 'playwright install chromium' to install browser binaries. "
            "Error: %s",
            str(e),
        )
        return False


PLAYWRIGHT_AVAILABLE = check_playwright_availability()


class _PlaywrightBrowserManager:
    """Manages a long-lived Playwright browser instance per worker process.

    In Celery's prefork model, each worker process runs tasks sequentially,
    so a single browser instance per process is safe and avoids the overhead
    of launching/destroying Chromium on every screenshot task. Each task
    creates a lightweight, isolated browser context instead of a full browser.
    """

    def __init__(self) -> None:
        self._playwright: Any = None
        self._browser: Any = None

    def get_browser(self, browser_args: list[str]) -> Any:
        """Return a reusable browser, creating one if needed."""
        if self._browser is not None and self._browser.is_connected():
            return self._browser

        self._cleanup()
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(args=browser_args)
        return self._browser

    def _cleanup(self) -> None:
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception:  # noqa: S110
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                self._playwright.stop()
            except Exception:  # noqa: S110
                pass
            self._playwright = None


_browser_manager = _PlaywrightBrowserManager()
atexit.register(_browser_manager._cleanup)


def validate_webdriver_config() -> dict[str, Any]:
    """
    Validate webdriver configuration and dependencies.

    Used to check migration status from Cypress to Playwright.
    Returns a dictionary with the status of available webdrivers
    and feature flags.
    """
    from superset import feature_flag_manager

    return {
        "selenium_available": True,  # Always available as required dependency
        "playwright_available": PLAYWRIGHT_AVAILABLE,
        "playwright_feature_enabled": feature_flag_manager.is_feature_enabled(
            "PLAYWRIGHT_REPORTS_AND_THUMBNAILS"
        ),
        "recommended_action": (
            PLAYWRIGHT_INSTALL_MESSAGE if not PLAYWRIGHT_AVAILABLE else None
        ),
    }


class DashboardStandaloneMode(Enum):
    HIDE_NAV = 1
    HIDE_NAV_AND_TITLE = 2
    REPORT = 3


class ChartStandaloneMode(Enum):
    HIDE_NAV = "true"
    SHOW_NAV = 0


# pylint: disable=too-few-public-methods
class WebDriverProxy(ABC):
    def __init__(self, driver_type: str, window: WindowSize | None = None):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)
        self._screenshot_locate_wait = app.config["SCREENSHOT_LOCATE_WAIT"]
        self._screenshot_load_wait = app.config["SCREENSHOT_LOAD_WAIT"]

    @abstractmethod
    def get_screenshot(
        self,
        url: str,
        element_name: str,
        user: User | None = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> bytes | None:
        """
        Run webdriver and return a screenshot

        :param log_context: Optional identifier (e.g. report execution id, or
            a cache key for thumbnails) included in log lines for tracing.
        """


class WebDriverPlaywright(WebDriverProxy):
    @staticmethod
    def auth(user: User, context: BrowserContext) -> BrowserContext:
        return machine_auth_provider_factory.instance.authenticate_browser_context(
            context, user
        )

    @staticmethod
    def find_unexpected_errors(page: Page) -> list[str]:
        error_messages = []

        try:
            alert_divs = page.get_by_role("alert").all()

            logger.debug(
                "%i alert elements have been found in the screenshot", len(alert_divs)
            )

            for alert_div in alert_divs:
                # See More button
                alert_div.get_by_role("button").click()

                # wait for modal to show up
                page.locator(".ant-modal-container").wait_for(state="visible")
                err_msg_div = page.locator(".ant-modal-container .ant-modal-body")
                #
                # # collect error message
                error_messages.append(err_msg_div.text_content())
                #
                # # Use HTML so that error messages are shown in the same style (color)
                error_as_html = err_msg_div.inner_html().replace("'", "\\'")
                #
                # # close modal after collecting error messages
                page.locator(".ant-modal-container .ant-modal-close").click()
                #
                # # wait until the modal becomes invisible
                page.locator(".ant-modal-container").wait_for(state="detached")
                try:
                    # Even if some errors can't be updated in the screenshot,
                    # keep all the errors in the server log and do not fail the loop
                    alert_div.evaluate(
                        "(node, error_html) => node.innerHtml = error_html",
                        [error_as_html],
                    )
                except PlaywrightError:
                    logger.exception("Failed to update error messages using alert_div")
        except PlaywrightError:
            logger.exception("Failed to capture unexpected errors")

        return error_messages

    @staticmethod
    def _get_screenshot(
        page: Page,
        element: Locator,
        element_name: str,
        timeout_seconds: float | None = None,
    ) -> bytes:
        timeout_kwargs = (
            {"timeout": timeout_seconds * 1000} if timeout_seconds is not None else {}
        )
        if element_name == "standalone":
            return page.screenshot(full_page=True, **timeout_kwargs)
        else:
            return element.screenshot(**timeout_kwargs)

    @staticmethod
    def _wait_for_charts_ready(  # noqa: C901
        page: Page,
        url: str,
        load_wait: int,
        element_name: str,
        log_context: str | None = None,
        screenshot_started_at: float | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> None:
        """
        Wait for every viewport-visible chart holder to reach a terminal state
        (rendered, or errored/empty) before taking a standard (non-tiled)
        screenshot.

        Uses the same positive readiness predicate as the tiled screenshot
        path (see `take_tiled_screenshot` in screenshot_utils.py, #42119)
        instead of checking for the mere absence of a `.loading` element: a
        chart holder that hasn't mounted anything yet (no spinner, no
        rendered content -- e.g. in the gap between page-load completing and
        React/query bootstrap) would otherwise satisfy an absence-of-spinner
        check immediately, producing a silently blank screenshot with no
        timeout, warning, or error anywhere.

        Scoped to viewport-intersecting chart holders only, same as the tiled
        path: this method's caller never resizes the browser viewport to the
        full dashboard height before capturing, so DashboardVirtualization
        placeholders below the fold haven't mounted anything real yet by
        design and must not block this wait.
        """
        task_budget: float | None
        remaining_budget: float | None
        if report_execution_context:
            log_context = report_execution_context.log_context
        context_suffix = f" [{log_context}]" if log_context else ""
        ready_states = {"rendered", "empty", "error", "virtualized"}
        initial_chart_holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
        initial_unready_chart_holders = [
            holder
            for holder in initial_chart_holder_states
            if holder.get("state") not in ready_states
        ]
        expected_holders = (
            report_execution_context.expected_chart_count
            if report_execution_context
            else None
        )
        initial_mounted_holders = len(initial_chart_holder_states)
        initial_ready_holders = sum(
            holder.get("state") in ready_states
            for holder in initial_chart_holder_states
        )
        deadline = (
            report_execution_context.deadline if report_execution_context else None
        )
        deadline_elapsed = deadline.elapsed_seconds if deadline else None
        deadline_remaining = deadline.remaining_seconds if deadline else None
        logger.info(
            "report_readiness_poll url=%s expected_holders=%s mounted_holders=%s "
            "ready_holders=%s elapsed_seconds=%s remaining_seconds=%s%s states=%s",
            url,
            expected_holders,
            initial_mounted_holders,
            initial_ready_holders,
            f"{deadline_elapsed:.2f}" if deadline_elapsed is not None else None,
            f"{deadline_remaining:.2f}" if deadline_remaining is not None else None,
            context_suffix,
            initial_chart_holder_states,
        )
        if element_name == "standalone" and not initial_chart_holder_states:
            logger.info(
                "report_readiness_waiting_for_mount url=%s expected_holders=%s "
                "mounted_holders=0 ready_holders=0 elapsed_seconds=%s "
                "remaining_seconds=%s%s",
                url,
                expected_holders,
                f"{deadline_elapsed:.2f}" if deadline_elapsed is not None else None,
                (
                    f"{deadline_remaining:.2f}"
                    if deadline_remaining is not None
                    else None
                ),
                context_suffix,
            )
        if initial_unready_chart_holders:
            logger.info(
                "Chart holders not ready before polling at url %s%s: %s",
                url,
                context_suffix,
                initial_unready_chart_holders,
            )
        if report_execution_context:
            effective_load_wait = report_execution_context.deadline.timeout_seconds(
                "chart_readiness",
                reserve_seconds=report_execution_context.readiness_reserve_seconds,
            )
            task_budget = report_execution_context.deadline.total_seconds
            elapsed = report_execution_context.deadline.elapsed_seconds
            remaining_budget = report_execution_context.deadline.remaining_seconds
        else:
            task_budget = resolve_screenshot_task_budget_seconds(log_context)
            elapsed = (
                max(0.0, time.monotonic() - screenshot_started_at)
                if task_budget is not None and screenshot_started_at is not None
                else 0.0
            )
            remaining_budget = (
                task_budget - elapsed if task_budget is not None else None
            )
            effective_load_wait = (
                min(float(load_wait), remaining_budget)
                if remaining_budget is not None
                else float(load_wait)
            )
            if remaining_budget is not None and effective_load_wait <= 0:
                logger.warning(
                    "Screenshot task budget exhausted before chart readiness wait "
                    "at url %s%s (%.2fs elapsed of %.2fs safe budget); unready chart "
                    "holders (chart id, state): %s; all chart holder states: %s. "
                    "Aborting before capture so cleanup and cache error transition "
                    "can complete.",
                    url,
                    context_suffix,
                    elapsed,
                    task_budget,
                    initial_unready_chart_holders,
                    initial_chart_holder_states,
                )
                raise ScreenshotTaskBudgetExceededError(
                    f"Screenshot task budget of {task_budget:.2f}s exhausted "
                    "before chart readiness"
                )
        logger.debug(
            "Waiting for all chart holders to reach a terminal state at "
            "url: %s (SCREENSHOT_LOAD_WAIT=%ss, effective_wait=%.2fs, "
            "task_budget=%s, elapsed=%.2fs)%s",
            url,
            load_wait,
            effective_load_wait,
            task_budget,
            elapsed,
            context_suffix,
        )
        if element_name == "chart-container":
            readiness_predicate = CHART_CONTAINER_READY_JS
        elif report_execution_context:
            readiness_predicate = REPORT_CHART_HOLDERS_READY_JS
        else:
            # Preserve the thumbnail behavior introduced by #42253. The
            # stricter zero-holder gate is report-specific because an empty
            # dashboard thumbnail is still a valid cache artifact.
            readiness_predicate = CHART_HOLDERS_READY_JS
        try:
            page.wait_for_function(
                readiness_predicate,
                timeout=effective_load_wait * 1000,
            )
        except PlaywrightTimeout:
            if element_name == "chart-container":
                # Chart captures have no dashboard grid holders; the holder
                # counters below would read as vacuous zeros. Log the actual
                # `.chart-container` state instead.
                logger.warning(
                    "report_readiness_terminal url=%s target=chart-container "
                    "container_state=%s elapsed_seconds=%.2f "
                    "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                    "terminal_reason=readiness_timeout; "
                    "aborting before capture or delivery",
                    url,
                    page.evaluate(CHART_CONTAINER_STATE_JS),
                    deadline.elapsed_seconds if deadline else elapsed,
                    (
                        f"{deadline.remaining_seconds:.2f}"
                        if deadline
                        else (
                            f"{remaining_budget:.2f}"
                            if remaining_budget is not None
                            else None
                        )
                    ),
                    effective_load_wait,
                    context_suffix,
                )
                raise
            chart_holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
            unready_chart_holders = [
                holder
                for holder in chart_holder_states
                if holder.get("state") not in ready_states
            ]
            mounted_holders = len(chart_holder_states)
            ready_holders = sum(
                holder.get("state") in ready_states for holder in chart_holder_states
            )
            deadline_elapsed = deadline.elapsed_seconds if deadline else elapsed
            deadline_remaining = (
                deadline.remaining_seconds if deadline else remaining_budget
            )
            logger.warning(
                "report_readiness_terminal url=%s expected_holders=%s "
                "mounted_holders=%s ready_holders=%s elapsed_seconds=%.2f "
                "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                "terminal_reason=readiness_timeout unready_holders=%s states=%s; "
                "aborting before capture or delivery",
                url,
                expected_holders,
                mounted_holders,
                ready_holders,
                deadline_elapsed,
                (
                    f"{deadline_remaining:.2f}"
                    if deadline_remaining is not None
                    else None
                ),
                effective_load_wait,
                context_suffix,
                unready_chart_holders,
                chart_holder_states,
            )
            raise
        if element_name == "chart-container":
            # Chart captures have no dashboard grid holders; the holder
            # counters below would read as vacuous zeros. Log the actual
            # `.chart-container` state instead.
            logger.info(
                "report_readiness_ready url=%s target=chart-container "
                "container_state=%s elapsed_seconds=%.2f remaining_seconds=%s%s",
                url,
                page.evaluate(CHART_CONTAINER_STATE_JS),
                deadline.elapsed_seconds if deadline else elapsed,
                (
                    f"{deadline.remaining_seconds:.2f}"
                    if deadline
                    else (
                        f"{remaining_budget:.2f}"
                        if remaining_budget is not None
                        else None
                    )
                ),
                context_suffix,
            )
            return
        chart_holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
        mounted_holders = len(chart_holder_states)
        ready_holders = sum(
            holder.get("state") in ready_states for holder in chart_holder_states
        )
        deadline_elapsed = deadline.elapsed_seconds if deadline else elapsed
        deadline_remaining = (
            deadline.remaining_seconds if deadline else remaining_budget
        )
        logger.info(
            "report_readiness_ready url=%s expected_holders=%s mounted_holders=%s "
            "ready_holders=%s elapsed_seconds=%.2f remaining_seconds=%s%s",
            url,
            expected_holders,
            mounted_holders,
            ready_holders,
            deadline_elapsed,
            (f"{deadline_remaining:.2f}" if deadline_remaining is not None else None),
            context_suffix,
        )

    def get_screenshot(  # pylint: disable=too-many-locals, too-many-statements  # noqa: C901
        self,
        url: str,
        element_name: str,
        user: User | None = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> bytes | None:
        screenshot_started_at = time.monotonic()
        if report_execution_context:
            log_context = report_execution_context.log_context
            report_execution_context.deadline.available_seconds(
                "browser_setup",
                reserve_seconds=report_execution_context.readiness_reserve_seconds,
            )
        if not PLAYWRIGHT_AVAILABLE:
            logger.info(
                "Playwright not available - falling back to Selenium. "
                "Note: WebGL/Canvas charts may not render correctly with Selenium. "
                "%s",
                PLAYWRIGHT_INSTALL_MESSAGE,
            )
            return None

        browser_args = app.config["WEBDRIVER_OPTION_ARGS"]
        browser = _browser_manager.get_browser(browser_args)
        pixel_density = app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)
        viewport_height = self._window[1]
        viewport_width = self._window[0]
        context = browser.new_context(
            bypass_csp=True,
            viewport={
                "height": viewport_height,
                "width": viewport_width,
            },
            device_scale_factor=pixel_density,
        )
        context.set_default_timeout(app.config["SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT"])
        if user:
            self.auth(user, context)
        page = context.new_page()
        img: bytes | None = None
        try:
            try:
                navigation_timeout = (
                    report_execution_context.deadline.timeout_seconds(
                        "browser_navigation",
                        reserve_seconds=(
                            report_execution_context.readiness_reserve_seconds
                        ),
                    )
                    if report_execution_context
                    else None
                )
                page.goto(
                    url,
                    wait_until=app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                    **(
                        {"timeout": navigation_timeout * 1000}
                        if navigation_timeout is not None
                        else {}
                    ),
                )
            except PlaywrightTimeout:
                logger.exception(
                    "Web event %s not detected. Page %s might not have been fully loaded",  # noqa: E501
                    app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                    url,
                )

            selenium_headstart = app.config["SCREENSHOT_SELENIUM_HEADSTART"]
            if report_execution_context:
                selenium_headstart = min(
                    selenium_headstart,
                    report_execution_context.deadline.available_seconds(
                        "browser_headstart",
                        reserve_seconds=(
                            report_execution_context.readiness_reserve_seconds
                        ),
                    ),
                )
            logger.debug("Sleeping for %i seconds", selenium_headstart)
            page.wait_for_timeout(selenium_headstart * 1000)
            element: Locator
            try:
                try:
                    # page didn't load
                    logger.debug(
                        "Wait for the presence of %s at url: %s", element_name, url
                    )
                    element = page.locator(f".{element_name}")
                    element_wait_timeout = (
                        report_execution_context.deadline.timeout_seconds(
                            "dashboard_mount",
                            reserve_seconds=(
                                report_execution_context.readiness_reserve_seconds
                            ),
                        )
                        if report_execution_context
                        else None
                    )
                    element.wait_for(
                        **(
                            {"timeout": element_wait_timeout * 1000}
                            if element_wait_timeout is not None
                            else {}
                        )
                    )
                except PlaywrightTimeout:
                    logger.exception("Timed out requesting url %s", url)
                    raise

                slice_container_elems: list[Locator] = []
                rendered_chart_count = 0
                try:
                    # chart containers didn't render
                    logger.debug("Wait for chart containers to draw at url: %s", url)
                    slice_container_locator = page.locator(".chart-container")
                    # One-time snapshot: containers mounting after this point
                    # are neither waited on nor counted, so the progress
                    # numbers below describe the snapshot, not the final DOM.
                    slice_container_elems = slice_container_locator.all()
                    for slice_container_elem in slice_container_elems:
                        slice_wait_timeout = (
                            report_execution_context.deadline.timeout_seconds(
                                "chart_mount",
                                reserve_seconds=(
                                    report_execution_context.readiness_reserve_seconds
                                ),
                            )
                            if report_execution_context
                            else None
                        )
                        slice_container_elem.wait_for(
                            **(
                                {"timeout": slice_wait_timeout * 1000}
                                if slice_wait_timeout is not None
                                else {}
                            )
                        )
                        rendered_chart_count += 1
                except PlaywrightTimeout:
                    # Customer-side chart loading is often just slow, not a
                    # Superset bug, so this is a WARNING (matching the other
                    # locate-wait timeouts below) rather than an ERROR -- but
                    # it still fails the screenshot; see the `raise` below.
                    logger.warning(
                        "Timed out waiting for chart containers to draw at url %s "
                        "(%s of %s chart containers rendered before the timeout)",
                        url,
                        rendered_chart_count,
                        len(slice_container_elems),
                        exc_info=True,
                    )
                    raise
                selenium_animation_wait = app.config[
                    "SCREENSHOT_SELENIUM_ANIMATION_WAIT"
                ]
                if app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                    unexpected_errors = WebDriverPlaywright.find_unexpected_errors(page)
                    if unexpected_errors:
                        logger.warning(
                            "%i errors found in the screenshot. URL: %s. Errors are: %s",  # noqa: E501
                            len(unexpected_errors),
                            url,
                            unexpected_errors,
                        )
                # Detect large dashboards and use tiled screenshots if enabled
                tiled_enabled = app.config.get("SCREENSHOT_TILED_ENABLED", False)

                if tiled_enabled:
                    mounted_chart_count = page.evaluate(
                        'document.querySelectorAll(".chart-container").length'
                    )
                    expected_chart_count = (
                        report_execution_context.expected_chart_count
                        if report_execution_context
                        else None
                    )
                    chart_count = max(
                        mounted_chart_count,
                        expected_chart_count or 0,
                    )
                    dashboard_height = page.evaluate(
                        f"""() => {{
                            const target = document.querySelector(\".{element_name}\");
                            return target ? target.scrollHeight : 0;
                        }}"""
                    )
                    chart_threshold = app.config.get(
                        "SCREENSHOT_TILED_CHART_THRESHOLD", 20
                    )
                    height_threshold = app.config.get(
                        "SCREENSHOT_TILED_HEIGHT_THRESHOLD", 5000
                    )
                    tile_height = app.config.get(
                        "SCREENSHOT_TILED_VIEWPORT_HEIGHT", viewport_height
                    )

                    # A height of 0 means the DOM query above found no matching
                    # element (or it hadn't laid out yet), not that the
                    # dashboard is actually empty. Treat it as "unknown" rather
                    # than "fits in a single tile": chart_count alone already
                    # tells us whether this looks like a large dashboard, and
                    # that signal must not be silently vetoed just because we
                    # couldn't measure height, or a large dashboard could skip
                    # tiling and ship with unrendered below-the-fold charts.
                    height_unknown = dashboard_height == 0
                    likely_large_dashboard = (
                        chart_count >= chart_threshold
                        or dashboard_height > height_threshold
                    )
                    if height_unknown:
                        log_fn = (
                            logger.warning if likely_large_dashboard else logger.debug
                        )
                        log_fn(
                            "Could not determine dashboard height for element %s "
                            "at url %s (%s chart containers found); %s",
                            element_name,
                            url,
                            chart_count,
                            "attempting tiled screenshot anyway"
                            if likely_large_dashboard
                            else "falling back to standard screenshot behavior",
                        )

                    # Use tiled screenshots for large dashboards
                    use_tiled = likely_large_dashboard and (
                        height_unknown or dashboard_height > tile_height
                    )

                    if use_tiled:
                        logger.info(
                            "Large dashboard detected: expected_charts=%s "
                            "mounted_chart_containers=%s effective_chart_count=%s "
                            "height_px=%s url=%s%s; using tiled screenshots",
                            expected_chart_count,
                            mounted_chart_count,
                            chart_count,
                            dashboard_height,
                            url,
                            f" [{log_context}]" if log_context else "",
                        )
                        # set viewport height to tile height for easier calculations
                        page.set_viewport_size(
                            {"height": tile_height, "width": viewport_width}
                        )
                        img = take_tiled_screenshot(
                            page,
                            element_name,
                            tile_height,
                            load_wait=self._screenshot_load_wait,
                            animation_wait=selenium_animation_wait,
                            log_context=log_context,
                            report_execution_context=report_execution_context,
                            url=url,
                            screenshot_started_at=screenshot_started_at,
                        )
                        if not img:
                            # _get_screenshot() has no wait/readiness logic at
                            # all, so falling back to it here would risk
                            # silently delivering a screenshot of spinners or
                            # a blank dashboard. Fail the capture loudly
                            # (report error, thumbnail cache ERROR) instead of
                            # guessing at a "safer" fallback (#42273) -- for
                            # thumbnails too, since the caller treats the
                            # raise as a clean cache-ERROR, never caching or
                            # serving a blank.
                            logger.warning(
                                "Tiled screenshot failed for url %s%s and no safe "
                                "fallback exists; "
                                "terminal_reason=tiled_capture_failed",
                                url,
                                f" [{log_context}]" if log_context else "",
                            )
                            raise PlaywrightTimeout(
                                f"Tiled screenshot failed for url {url}"
                            )
                        logger.debug(
                            "Tiled screenshot result: %d bytes for url: %s",
                            len(img),
                            url,
                        )
                    else:
                        logger.debug(
                            "Dashboard below tiling threshold "
                            "(%s charts, %spx height); using standard screenshot "
                            "for url: %s",
                            chart_count,
                            dashboard_height,
                            url,
                        )
                        # Standard screenshot captures the full element including
                        # below-the-fold content, so wait for all viewport-visible
                        # chart holders to reach a terminal state.
                        WebDriverPlaywright._wait_for_charts_ready(
                            page,
                            url,
                            self._screenshot_load_wait,
                            element_name,
                            log_context=log_context,
                            screenshot_started_at=screenshot_started_at,
                            report_execution_context=report_execution_context,
                        )
                        if selenium_animation_wait > 0:
                            if report_execution_context:
                                selenium_animation_wait = min(
                                    selenium_animation_wait,
                                    report_execution_context.deadline.available_seconds(
                                        "chart_animation",
                                        reserve_seconds=(
                                            report_execution_context.readiness_reserve_seconds
                                        ),
                                    ),
                                )
                            logger.debug(
                                "Wait %i seconds for chart animation",
                                selenium_animation_wait,
                            )
                            page.wait_for_timeout(selenium_animation_wait * 1000)
                        logger.debug(
                            "Taking screenshot of url %s as user %s",
                            url,
                            user.username if user else "None",
                        )
                        capture_timeout = (
                            report_execution_context.deadline.timeout_seconds(
                                "screenshot_capture",
                                reserve_seconds=(
                                    report_execution_context.post_capture_reserve_seconds
                                ),
                            )
                            if report_execution_context
                            else None
                        )
                        img = WebDriverPlaywright._get_screenshot(
                            page,
                            element,
                            element_name,
                            timeout_seconds=capture_timeout,
                        )
                        logger.debug(
                            "Screenshot result: %d bytes for url: %s",
                            len(img) if img else 0,
                            url,
                        )
                else:
                    logger.debug(
                        "Tiled screenshots disabled; using standard screenshot "
                        "for url: %s",
                        url,
                    )
                    # Standard screenshot captures the full element including
                    # below-the-fold content, so wait for all viewport-visible
                    # chart holders to reach a terminal state.
                    WebDriverPlaywright._wait_for_charts_ready(
                        page,
                        url,
                        self._screenshot_load_wait,
                        element_name,
                        log_context=log_context,
                        screenshot_started_at=screenshot_started_at,
                        report_execution_context=report_execution_context,
                    )
                    if selenium_animation_wait > 0:
                        if report_execution_context:
                            selenium_animation_wait = min(
                                selenium_animation_wait,
                                report_execution_context.deadline.available_seconds(
                                    "chart_animation",
                                    reserve_seconds=(
                                        report_execution_context.readiness_reserve_seconds
                                    ),
                                ),
                            )
                        logger.debug(
                            "Wait %i seconds for chart animation",
                            selenium_animation_wait,
                        )
                        page.wait_for_timeout(selenium_animation_wait * 1000)
                    logger.debug(
                        "Taking screenshot of url %s as user %s",
                        url,
                        user.username if user else "None",
                    )
                    capture_timeout = (
                        report_execution_context.deadline.timeout_seconds(
                            "screenshot_capture",
                            reserve_seconds=(
                                report_execution_context.post_capture_reserve_seconds
                            ),
                        )
                        if report_execution_context
                        else None
                    )
                    img = WebDriverPlaywright._get_screenshot(
                        page,
                        element,
                        element_name,
                        timeout_seconds=capture_timeout,
                    )
                    logger.debug(
                        "Screenshot result: %d bytes for url: %s",
                        len(img) if img else 0,
                        url,
                    )

            except PlaywrightTimeout:
                raise
            except PlaywrightError:
                logger.exception(
                    "Encountered an unexpected error when requesting url %s", url
                )
        finally:
            context.close()
        return img

    @staticmethod
    def _escape_html(text: str) -> str:
        """HTML-escape a plain-text string for safe inline HTML embedding."""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    @staticmethod
    def _resolve_slot(
        raw: str,
        title: str,
    ) -> str:
        """
        Expand user-defined token placeholders in a header/footer slot string.

        Supported tokens:
          {title} — the dashboard title (HTML-escaped)
          {date}  — replaced with a <span class="date"></span> element so
                    Chromium injects the actual print date at render time.

        The returned string is safe for direct insertion into an inline-HTML
        Playwright template (all literal text is HTML-escaped; only the
        Chromium-class <span> elements are allowed through unescaped).
        """
        # Split on {date} first so we can handle it as a Chromium span.
        # Everything else: substitute {title} then HTML-escape the result,
        # so a dashboard title containing "<", ">" or "&" cannot inject markup.
        parts = raw.split("{date}")
        resolved_parts = []
        for i, part in enumerate(parts):
            safe_part = WebDriverPlaywright._escape_html(part.replace("{title}", title))
            resolved_parts.append(safe_part)
            if i < len(parts) - 1:
                resolved_parts.append('<span class="date"></span>')
        return "".join(resolved_parts)

    @staticmethod
    def _slot_span(content: str, extra_style: str = "") -> str:
        """
        Wrap resolved slot content in a flex-child <span> with overflow
        protection so long strings are truncated with an ellipsis rather
        than spilling into adjacent slots or off the page band.

        Each slot is capped at 200px (paper pixels — templates are rendered
        at full paper width, not scaled by page.pdf(scale)).
        """
        base = (
            "display:inline-block;"
            "max-width:200px;"
            "overflow:hidden;"
            "text-overflow:ellipsis;"
            "white-space:nowrap;"
            "vertical-align:bottom;"
        )
        style = base + extra_style
        return f'<span style="{style}">{content}</span>'

    @staticmethod
    def _build_pdf_header_template(
        title: str,
        content: dict[str, str] | None = None,
    ) -> str:
        """
        Build the Playwright header_template HTML string.

        Rules for Playwright/Chromium header templates:
        - Must be a single root element.
        - All styles must be inline — no <style> tags.
        - font-size defaults to 0px; must be set explicitly or text is invisible.
        - Special classes injected by Chromium: date, title, url,
          pageNumber, totalPages.
        - Template is rendered at full paper width, independent of page.pdf(scale).
        - Lives entirely inside the top margin space.

        ``content`` is a dict with optional keys "left", "center", "right"
        whose values are plain-text strings supporting {title} and {date}
        tokens (see _resolve_slot).  Defaults to the built-in layout when
        None or when a key is absent.
        """
        _c = content or {}
        raw_left = _c.get("left", "{title}")
        raw_center = _c.get("center", "")
        raw_right = _c.get("right", "Apache Superset | {date}")

        left_html = WebDriverPlaywright._slot_span(
            WebDriverPlaywright._resolve_slot(raw_left, title),
            "font-weight:700;font-size:11px;letter-spacing:0.2px;",
        )
        center_html = WebDriverPlaywright._slot_span(
            WebDriverPlaywright._resolve_slot(raw_center, title),
            "font-size:8px;color:#57606a;",
        )
        right_html = WebDriverPlaywright._slot_span(
            WebDriverPlaywright._resolve_slot(raw_right, title),
            "font-size:8px;color:#57606a;text-align:right;",
        )

        return (
            '<div style="'
            "width:100%;"
            "font-family:Arial,Helvetica,sans-serif;"
            "font-size:9px;"
            "color:#1f2328;"
            "display:flex;"
            "justify-content:space-between;"
            "align-items:flex-end;"
            "padding:0 10mm 4px 10mm;"
            "box-sizing:border-box;"
            "border-bottom:1.5px solid #3b82d4;"
            '">'
            f"{left_html}"
            f"{center_html}"
            f"{right_html}"
            "</div>"
        )

    @staticmethod
    def _build_pdf_footer_template(
        content: dict[str, str] | None = None,
    ) -> str:
        """
        Build the Playwright footer_template HTML string.

        The right slot is always "Page N of M" using Chromium's special
        pageNumber / totalPages classes substituted at render time.  It
        cannot be overridden via ``content``.

        ``content`` is a dict with optional keys "left" and "center" whose
        values are plain-text strings supporting {title} and {date} tokens.
        Defaults to the built-in layout when None or when a key is absent.
        """
        _c = content or {}
        raw_left = _c.get("left", "Confidential")
        raw_center = _c.get("center", "Generated by Apache Superset")

        left_html = WebDriverPlaywright._slot_span(
            WebDriverPlaywright._resolve_slot(raw_left, ""),
        )
        center_html = WebDriverPlaywright._slot_span(
            WebDriverPlaywright._resolve_slot(raw_center, ""),
            "text-align:center;",
        )
        # Right slot: fixed page numbering — not user-overridable.
        page_html = (
            '<span style="white-space:nowrap;">'
            'Page <span class="pageNumber"></span>'
            ' of <span class="totalPages"></span>'
            "</span>"
        )

        return (
            '<div style="'
            "width:100%;"
            "font-family:Arial,Helvetica,sans-serif;"
            "font-size:8px;"
            "color:#57606a;"
            "display:flex;"
            "justify-content:space-between;"
            "align-items:flex-start;"
            "padding:4px 10mm 0 10mm;"
            "box-sizing:border-box;"
            "border-top:1px solid #e5e7eb;"
            '">'
            f"{left_html}"
            f"{center_html}"
            f"{page_html}"
            "</div>"
        )

    def get_print_pdf(  # noqa: C901
        self,
        url: str,
        user: "User | None" = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
        header_title: str | None = None,
        font_size: str | None = None,
        print_layout: str | None = None,
        print_orientation: str | None = None,
        tab_ids: list[str] | None = None,
    ) -> bytes | None:
        """
        Render the dashboard in print-ready mode and call page.pdf().

        When tab_ids is provided (list of Superset TAB-xxx component IDs),
        the dashboard is rendered once per tab by appending #TAB-xxx to the
        URL — each navigation activates that tab so its charts mount and render.
        The resulting per-tab PDFs are merged into a single document via pypdf.
        Falls back to single-URL rendering if pypdf is not available.

        Uses PRINT_ALL_CHART_HOLDERS_READY_JS (all holders, not just
        viewport-visible) to detect readiness, then calls Playwright's
        native page.pdf() instead of page.screenshot().

        The viewport width is set to the authored dashboard width (default
        1600 px) so ECharts/canvas elements measure and draw at their design
        resolution. page.pdf(scale=794/1600) maps the content onto A4 paper
        width without blank guttering.

        When header_title is provided (and BROWSER_PRINT_PDF_HEADER_FOOTER is
        True in app config), Playwright's display_header_footer API is used to
        stamp a title+date header and a confidential/page-count footer on every
        page.  The header/footer template is rendered at full paper width by the
        Chromium print engine and is NOT affected by page.pdf(scale).

        font_size ('small' | 'medium' | None) controls DOM-rendered text sizes.
        Big Number charts use an inline style for font-size which CSS !important
        cannot override; SET_PRINT_FONT_SIZE_JS patches those inline styles
        directly before page.pdf() is called.

        print_layout ('2col' | None) enables two-column adaptive layout:
        ANNOTATE_PRINT_COLUMNS_JS is called before page.pdf() to tag each
        .dragdroppable-column with data-print-col-span="half"|"full" based on
        its original pixel width relative to its row.  The CSS injected via
        ?print_layout=2col in the URL then uses those attributes to lay out
        small charts side-by-side.  Table charts are always forced full-width
        by the JS annotation regardless of their original size.

        print_orientation controls page rotation:
          'portrait'  (default/None) — A4 portrait throughout.
          'landscape' — page.pdf(landscape=True) entire document landscape.
          'auto'      — CSS @page named pages + prefer_css_page_size=True.
                        Wide tables get data-print-landscape="true" set by
                        SCALE_WIDE_TABLES_JS and render in landscape; all
                        other pages stay portrait.

        Returns None (never raises) so the caller can fall back to
        the existing screenshot path.
        """
        if not PLAYWRIGHT_AVAILABLE:
            return None
        browser_args = app.config["WEBDRIVER_OPTION_ARGS"]
        browser = _browser_manager.get_browser(browser_args)
        pixel_density = app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)
        # Render at the authored dashboard width (default 1600 px) so
        # ECharts/canvas elements measure and draw at their design resolution.
        # page.pdf(scale=...) then scales the rendered content down to fit
        # A4 paper width (794 px at 96 dpi), giving full-resolution charts
        # with no blank guttering — equivalent to browser print-to-PDF with
        # a custom scale factor.
        pdf_viewport_width = app.config.get(
            "BROWSER_PRINT_PDF_VIEWPORT_WIDTH", self._window[0]
        )
        context = browser.new_context(
            bypass_csp=True,
            viewport={"height": self._window[1], "width": pdf_viewport_width},
            device_scale_factor=pixel_density,
        )
        context.set_default_timeout(app.config["SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT"])
        if user:
            self.auth(user, context)
        page = context.new_page()
        pdf_bytes: bytes | None = None

        # Determine readiness timeout once (reused for all tabs)
        load_wait = app.config["SCREENSHOT_LOAD_WAIT"]
        if report_execution_context:
            effective_wait = report_execution_context.deadline.timeout_seconds(
                "chart_readiness",
                reserve_seconds=report_execution_context.readiness_reserve_seconds,
            )
        else:
            effective_wait = float(load_wait)

        _a4_px = 794  # A4 width in CSS pixels at 96 dpi
        _pdf_scale = min(1.0, _a4_px / pdf_viewport_width)

        use_header_footer = bool(
            header_title and app.config.get("BROWSER_PRINT_PDF_HEADER_FOOTER", True)
        )
        pdf_kwargs: dict[str, Any] = {
            "format": "A4",
            "print_background": True,
            "scale": _pdf_scale,
            "margin": {
                "top": "18mm" if use_header_footer else "10mm",
                "bottom": "15mm" if use_header_footer else "10mm",
                "left": "10mm",
                "right": "10mm",
            },
        }
        # Landscape orientation:
        #   'landscape' — page.pdf(landscape=True) entire document.
        #   'auto'      — per-element CSS @page named pages via
        #                 prefer_css_page_size=True; the frontend injects the
        #                 @page rules when ?print_orientation=auto is set.
        if print_orientation == "landscape":
            pdf_kwargs["landscape"] = True
        elif print_orientation == "auto":
            pdf_kwargs["prefer_css_page_size"] = True
        if use_header_footer:
            header_content: dict[str, str] | None = app.config.get(
                "BROWSER_PRINT_PDF_HEADER_CONTENT"
            )
            footer_content: dict[str, str] | None = app.config.get(
                "BROWSER_PRINT_PDF_FOOTER_CONTENT"
            )
            pdf_kwargs["display_header_footer"] = True
            pdf_kwargs["header_template"] = self._build_pdf_header_template(
                header_title,  # type: ignore[arg-type]
                content=header_content,
            )
            pdf_kwargs["footer_template"] = self._build_pdf_footer_template(
                content=footer_content,
            )

        def _render_page(render_url: str) -> bytes:
            """Navigate, wait for charts, apply JS patches, return PDF bytes."""
            page.goto(
                render_url,
                wait_until=app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                timeout=effective_wait * 1000,
            )
            page.wait_for_timeout(app.config["SCREENSHOT_SELENIUM_HEADSTART"] * 1000)
            page.locator(".standalone").wait_for(timeout=effective_wait * 1000)

            # Safety net: remove any residual display:none from CSSMotion
            unhidden = page.evaluate(UNHIDE_TAB_PANELS_JS)
            if unhidden:
                logger.debug(
                    "browser_print_pdf_unhide url=%s panels_unhidden=%d",
                    render_url,
                    unhidden,
                )

            page.wait_for_function(
                PRINT_ALL_CHART_HOLDERS_READY_JS,
                timeout=effective_wait * 1000,
            )

            # Show all rows on client-side paginated tables before expanding
            # containers.  react-table's usePagination only renders the current
            # page's rows; calling onChange(0) on the page-size selector forces
            # it to re-render with pageSize=0 (all rows).  Server-side paginated
            # tables cannot be expanded this way — only the fetched page is
            # available in memory — so those are logged as warnings.
            page_size_result = page.evaluate(SHOW_ALL_TABLE_ROWS_JS)
            if page_size_result.get("clientExpanded", 0):
                logger.info(
                    "browser_print_pdf_show_all_rows url=%s "
                    "client_tables_expanded=%d server_warning=%d log_context=%s",
                    render_url,
                    page_size_result["clientExpanded"],
                    page_size_result.get("serverWarning", 0),
                    log_context or "",
                )
                # Wait for React to re-render with all rows before expanding.
                page.wait_for_timeout(600)
            if page_size_result.get("serverWarning", 0):
                logger.warning(
                    "browser_print_pdf_server_pagination url=%s "
                    "server_paginated_tables=%d — only the current page is "
                    "included in the PDF; configure a larger page_length for "
                    "dashboards intended for PDF export log_context=%s",
                    render_url,
                    page_size_result["serverWarning"],
                    log_context or "",
                )

            expanded = page.evaluate(EXPAND_TABLE_CONTAINERS_JS)
            if expanded:
                logger.info(
                    "browser_print_pdf_expand_tables url=%s tables_expanded=%d "
                    "log_context=%s",
                    render_url,
                    expanded,
                    log_context or "",
                )

            # After expanding table height/overflow constraints, detect tables
            # whose natural rendered width exceeds the viewport width.
            # In 'auto' orientation mode, mark wide-table elements with
            # data-print-landscape="true" so the CSS @page named page rule
            # rotates that page to landscape.  For portrait and landscape
            # modes (whole-document rotation), apply a CSS scale transform
            # so all columns fit without horizontal clipping.
            mark_landscape = print_orientation == "auto"
            scale_result = page.evaluate(SCALE_WIDE_TABLES_JS, mark_landscape)
            if scale_result.get("scaled", 0) or scale_result.get("marked", 0):
                logger.info(
                    "browser_print_pdf_wide_tables url=%s "
                    "scaled=%d landscape_marked=%d viewport=%d log_context=%s",
                    render_url,
                    scale_result.get("scaled", 0),
                    scale_result.get("marked", 0),
                    scale_result.get("viewport", 0),
                    log_context or "",
                )

            _big_number_px: int | None = None
            if font_size == "medium":
                _big_number_px = 64
            elif font_size == "large":
                _big_number_px = 96
            if _big_number_px is not None:
                page.evaluate(SET_PRINT_FONT_SIZE_JS, _big_number_px)

            if print_layout == "2col":
                col_annotated = page.evaluate(ANNOTATE_PRINT_COLUMNS_JS)
                logger.info(
                    "browser_print_pdf_2col url=%s columns_annotated=%d log_context=%s",
                    render_url,
                    col_annotated,
                    log_context or "",
                )

            return page.pdf(**pdf_kwargs)

        try:
            if tab_ids and len(tab_ids) > 1:
                # Multi-tab dashboard: render each tab separately using a URL
                # hash fragment (#TAB-ID) so the inactive tab's charts mount.
                # antd v6 with tabPane animation disabled does not mount
                # inactive content even with forceRender:true in the items
                # array, so per-tab navigation is the only reliable approach.
                # Merge the per-tab PDFs into a single document with pypdf.
                try:
                    import pypdf  # noqa: PLC0415

                    writer = pypdf.PdfWriter()
                    for tab_id in tab_ids:
                        tab_url = f"{url}#{tab_id}"
                        logger.info(
                            "browser_print_pdf_tab url=%s tab_id=%s log_context=%s",
                            tab_url,
                            tab_id,
                            log_context or "",
                        )
                        tab_pdf_bytes = _render_page(tab_url)
                        reader = pypdf.PdfReader(
                            __import__("io").BytesIO(tab_pdf_bytes)
                        )
                        for pdf_page in reader.pages:
                            writer.add_page(pdf_page)
                    import io as _io

                    buf = _io.BytesIO()
                    writer.write(buf)
                    pdf_bytes = buf.getvalue()
                    logger.info(
                        "browser_print_pdf_success url=%s tabs=%d bytes=%d "
                        "log_context=%s",
                        url,
                        len(tab_ids),
                        len(pdf_bytes),
                        log_context or "",
                    )
                except ImportError:
                    # pypdf not installed: fall back to single-URL render
                    logger.warning(
                        "browser_print_pdf_no_pypdf url=%s; rendering default "
                        "tab only — install pypdf for multi-tab PDF merge",
                        url,
                    )
                    pdf_bytes = _render_page(url)
                    logger.info(
                        "browser_print_pdf_success url=%s bytes=%d log_context=%s",
                        url,
                        len(pdf_bytes) if pdf_bytes else 0,
                        log_context or "",
                    )
            else:
                # Single URL (no tabs or tab IDs not provided)
                pdf_bytes = _render_page(url)
                logger.info(
                    "browser_print_pdf_success url=%s bytes=%d log_context=%s",
                    url,
                    len(pdf_bytes) if pdf_bytes else 0,
                    log_context or "",
                )
        except (PlaywrightTimeout, PlaywrightError, Exception):  # noqa: BLE001
            logger.exception(
                "browser_print_pdf_failed url=%s log_context=%s; "
                "caller should fall back to screenshot path",
                url,
                log_context or "",
            )
            return None
        finally:
            context.close()
        return pdf_bytes


class WebDriverSelenium(WebDriverProxy):
    def __init__(
        self,
        driver_type: str,
        window: WindowSize | None = None,
        user: User | None = None,
    ):
        super().__init__(driver_type, window)
        self._user = user
        self._driver: WebDriver | None = None

    def __del__(self) -> None:
        self._destroy()

    @property
    def driver(self) -> WebDriver:
        if not self._driver:
            self._driver = self._create()
            if not self._driver:
                raise RuntimeError("WebDriver creation failed")
            try:
                self._driver.set_window_size(*self._window)
                # Bound driver.get() so an unreachable page raises a
                # TimeoutException instead of blocking the worker (and the
                # report schedule) forever.
                page_load_wait = app.config["SCREENSHOT_PAGE_LOAD_WAIT"]
                if page_load_wait is not None:
                    self._driver.set_page_load_timeout(page_load_wait)
                if self._user:
                    self._auth(self._user)
            except Exception:
                # A failure mid-setup (e.g. the new page-load timeout or auth
                # raising) would otherwise leave a partially initialized,
                # unauthenticated driver cached for reuse. Tear it down so the
                # next access recreates it cleanly.
                self._destroy()
                raise
        return self._driver

    def _create_firefox_driver(
        self, pixel_density: float
    ) -> tuple[type[WebDriver], type[Service], dict[str, Any]]:
        """Create Firefox driver configuration."""
        options = firefox.options.Options()
        profile = FirefoxProfile()
        profile.set_preference("layout.css.devPixelsPerPx", str(pixel_density))
        options.profile = profile
        return (
            firefox.webdriver.WebDriver,
            firefox.service.Service,
            {"options": options},
        )

    def _create_chrome_driver(
        self, pixel_density: float
    ) -> tuple[type[WebDriver], type[Service], dict[str, Any]]:
        """Create Chrome driver configuration."""
        options = chrome.options.Options()
        options.add_argument(f"--force-device-scale-factor={pixel_density}")
        options.add_argument(f"--window-size={self._window[0]},{self._window[1]}")
        return (
            chrome.webdriver.WebDriver,
            chrome.service.Service,
            {"options": options},
        )

    def _normalize_timeout_values(self, config: dict[str, Any]) -> dict[str, Any]:
        """Convert timeout values to float for urllib3 2.x compatibility."""
        timeout_keys = [
            "timeout",
            "connect_timeout",
            "socket_timeout",
            "read_timeout",
            "page_load_timeout",
            "implicit_wait",
            "command_executor_timeout",
            "connection_timeout",
        ]

        for key, value in config.items():
            if any(timeout_key in key.lower() for timeout_key in timeout_keys):
                if value is None or value == "None" or value == "null":
                    config[key] = None
                else:
                    try:
                        config[key] = float(value)
                    except (ValueError, TypeError):
                        config[key] = None
                        logger.warning(
                            "Invalid timeout value for %s: %s, setting to None",
                            key,
                            value,
                        )
        return config

    def create(self) -> WebDriver:
        """Create and return the WebDriver instance.

        This is the public interface for creating the driver. It wraps
        the internal _create method for backward compatibility.
        """
        return self._create()

    def destroy(self) -> None:
        """Destroy the WebDriver instance.

        This is the public interface for cleanup. It wraps the internal
        _destroy method and should be called when done with the driver.
        """
        self._destroy()

    def _create(self) -> WebDriver:
        pixel_density = app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)

        # Get driver class and initial kwargs based on driver type
        if self._driver_type == "firefox":
            driver_class, service_class, kwargs = self._create_firefox_driver(
                pixel_density
            )
        elif self._driver_type == "chrome":
            driver_class, service_class, kwargs = self._create_chrome_driver(
                pixel_density
            )
        else:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Webdriver name ({self._driver_type}) not supported"
            )

        # Add additional arguments from config
        options = kwargs["options"]
        for arg in list(app.config["WEBDRIVER_OPTION_ARGS"]):
            options.add_argument(arg)

        # Fix timeout values for urllib3 2.x compatibility
        webdriver_config = app.config["WEBDRIVER_CONFIGURATION"].copy()
        webdriver_config = self._normalize_timeout_values(webdriver_config)
        kwargs.update(webdriver_config)

        # Set the binary location if provided
        # We need to pop it from the dict due to selenium_version < 4.10.0
        options.binary_location = webdriver_config.pop("binary_location", "")

        if version.parse(selenium_version) < version.parse("4.10.0"):
            kwargs |= webdriver_config
        else:
            driver_opts = dict(
                webdriver_config.get("options", {"capabilities": {}, "preferences": {}})
            )
            driver_srv = dict(
                webdriver_config.get(
                    "service",
                    {
                        "log_output": "/dev/null",
                        "service_args": [],
                        "port": 0,
                        "env": {},
                    },
                )
            )
            for name, value in driver_opts.get("capabilities", {}).items():
                options.set_capability(name, value)
            if hasattr(options, "profile"):
                for name, value in driver_opts.get("preferences", {}).items():
                    options.profile.set_preference(str(name), value)
            kwargs |= {
                "options": options,
                "service": service_class(**driver_srv),
            }

        logger.debug("Init selenium driver")
        return driver_class(**kwargs)

    def _auth(self, user: User) -> None:
        """Authenticate the persistent driver in-place."""
        if self._driver is None:
            raise RuntimeError("WebDriver is not initialized")
        machine_auth_provider_factory.instance.authenticate_webdriver(
            self._driver, user
        )

    def _destroy(self, tries: int = 2) -> None:
        """Destroy the persistent driver"""
        if not self._driver:
            return
        # This is some very flaky code in selenium. Hence the retries
        # and catch-all exceptions
        try:
            retry_call(self._driver.close, max_tries=tries)
        except Exception:  # pylint: disable=broad-except  # noqa: S110
            pass
        try:
            self._driver.quit()
        except Exception:  # pylint: disable=broad-except  # noqa: S110
            pass
        self._driver = None

    @staticmethod
    def find_unexpected_errors(driver: WebDriver) -> list[str]:
        error_messages = []

        try:
            alert_divs = driver.find_elements(By.XPATH, "//div[@role = 'alert']")
            logger.debug(
                "%i alert elements have been found in the screenshot", len(alert_divs)
            )

            for alert_div in alert_divs:
                # See More button
                alert_div.find_element(By.XPATH, ".//*[@role = 'button']").click()

                # wait for modal to show up
                modal = WebDriverWait(
                    driver,
                    app.config["SCREENSHOT_WAIT_FOR_ERROR_MODAL_VISIBLE"],
                ).until(
                    EC.visibility_of_any_elements_located(
                        (By.CLASS_NAME, "ant-modal-container")
                    )
                )[0]

                err_msg_div = modal.find_element(By.CLASS_NAME, "ant-modal-body")

                # collect error message
                error_messages.append(err_msg_div.text)

                # close modal after collecting error messages
                modal.find_element(By.CLASS_NAME, "ant-modal-close").click()

                # wait until the modal becomes invisible
                WebDriverWait(
                    driver,
                    app.config["SCREENSHOT_WAIT_FOR_ERROR_MODAL_INVISIBLE"],
                ).until(EC.invisibility_of_element(modal))

                # Use HTML so that error messages are shown in the same style (color)
                error_as_html = err_msg_div.get_attribute("innerHTML").replace(
                    "'", "\\'"
                )

                try:
                    # Even if some errors can't be updated in the screenshot,
                    # keep all the errors in the server log and do not fail the loop
                    driver.execute_script(
                        f"arguments[0].innerHTML = '{error_as_html}'", alert_div
                    )
                except WebDriverException:
                    logger.exception("Failed to update error messages using alert_div")
        except WebDriverException:
            logger.exception("Failed to capture unexpected errors")

        return error_messages

    def get_screenshot(  # noqa: C901
        self,
        url: str,
        element_name: str,
        user: User | None = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> bytes | None:
        if report_execution_context:
            log_context = report_execution_context.log_context

        def phase_timeout(
            phase: str,
            requested_seconds: float | None,
            reserve_seconds: float = 0.0,
        ) -> float:
            if report_execution_context:
                return report_execution_context.deadline.timeout_seconds(
                    phase,
                    requested_seconds=requested_seconds,
                    reserve_seconds=reserve_seconds,
                )
            return float(requested_seconds or self._screenshot_load_wait)

        # If a user is passed explicitly and differs from the stored user,
        # update and re-authenticate
        if user and user != self._user:
            self._user = user
            if self._driver:
                self._destroy()
        driver = self.driver
        if report_execution_context:
            driver.set_page_load_timeout(
                phase_timeout(
                    "browser_navigation",
                    None,
                    report_execution_context.readiness_reserve_seconds,
                )
            )
        driver.get(url)
        img: bytes | None = None
        selenium_headstart = app.config["SCREENSHOT_SELENIUM_HEADSTART"]
        if report_execution_context:
            selenium_headstart = min(
                selenium_headstart,
                phase_timeout(
                    "browser_headstart",
                    None,
                    report_execution_context.readiness_reserve_seconds,
                ),
            )
        logger.debug("Sleeping for %i seconds", selenium_headstart)
        sleep(selenium_headstart)

        # WebDriver cleanup is intentionally not performed in this method. When the
        # driver is used persistently (e.g., cache warmup), cleanup is handled
        # externally via destroy(). When used for one-off screenshots, the caller or
        # __del__ handles cleanup.
        try:
            try:
                # page didn't load
                logger.debug(
                    "Wait for the presence of %s at url: %s", element_name, url
                )
                element = WebDriverWait(
                    driver,
                    phase_timeout(
                        "dashboard_mount",
                        self._screenshot_locate_wait,
                        (
                            report_execution_context.readiness_reserve_seconds
                            if report_execution_context
                            else 0.0
                        ),
                    ),
                ).until(EC.presence_of_element_located((By.CLASS_NAME, element_name)))
            except TimeoutException:
                logger.warning(
                    "Selenium timed out requesting url %s", url, exc_info=True
                )
                raise

            if report_execution_context and element_name in {
                "standalone",
                "chart-container",
            }:
                readiness_predicate = (
                    REPORT_CHART_HOLDERS_READY_JS
                    if element_name == "standalone"
                    else CHART_CONTAINER_READY_JS
                )
                readiness_timeout = phase_timeout(
                    "chart_readiness",
                    None,
                    report_execution_context.readiness_reserve_seconds,
                )
                try:
                    WebDriverWait(driver, readiness_timeout).until(
                        lambda webdriver: webdriver.execute_script(
                            f"return ({readiness_predicate})()"
                        )
                    )
                    holder_states = (
                        driver.execute_script(
                            f"return ({FIND_CHART_HOLDER_STATES_JS})()"
                        )
                        if element_name == "standalone"
                        else [
                            {
                                "chartId": report_execution_context.chart_id,
                                "state": "rendered",
                            }
                        ]
                    )
                    ready_states = {"rendered", "empty", "error", "virtualized"}
                    deadline = report_execution_context.deadline
                    logger.info(
                        "report_readiness_ready url=%s expected_holders=%s "
                        "mounted_holders=%s ready_holders=%s elapsed_seconds=%s "
                        "remaining_seconds=%s%s",
                        url,
                        report_execution_context.expected_chart_count,
                        len(holder_states),
                        sum(
                            holder.get("state") in ready_states
                            for holder in holder_states
                        ),
                        f"{deadline.elapsed_seconds:.2f}",
                        f"{deadline.remaining_seconds:.2f}",
                        f" [{log_context}]" if log_context else "",
                    )
                except TimeoutException:
                    holder_states = (
                        driver.execute_script(
                            f"return ({FIND_CHART_HOLDER_STATES_JS})()"
                        )
                        if element_name == "standalone"
                        else [
                            {
                                "chartId": report_execution_context.chart_id,
                                "state": "not_ready",
                            }
                        ]
                    )
                    ready_states = {"rendered", "empty", "error", "virtualized"}
                    ready_holders = sum(
                        holder.get("state") in ready_states for holder in holder_states
                    )
                    deadline = report_execution_context.deadline
                    logger.warning(
                        "report_readiness_terminal url=%s expected_holders=%s "
                        "mounted_holders=%s ready_holders=%s elapsed_seconds=%s "
                        "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                        "terminal_reason=readiness_timeout states=%s; "
                        "aborting before capture or delivery",
                        url,
                        report_execution_context.expected_chart_count,
                        len(holder_states),
                        ready_holders,
                        f"{deadline.elapsed_seconds:.2f}",
                        f"{deadline.remaining_seconds:.2f}",
                        readiness_timeout,
                        f" [{log_context}]" if log_context else "",
                        holder_states,
                    )
                    raise
            else:
                try:
                    # chart containers didn't render
                    logger.debug("Wait for chart containers to draw at url: %s", url)
                    WebDriverWait(
                        driver,
                        phase_timeout(
                            "chart_mount",
                            self._screenshot_locate_wait,
                            (
                                report_execution_context.readiness_reserve_seconds
                                if report_execution_context
                                else 0.0
                            ),
                        ),
                    ).until(
                        EC.visibility_of_all_elements_located(
                            (By.CLASS_NAME, "chart-container")
                        )
                    )
                except TimeoutException:
                    if element_name == "standalone":
                        logger.info("Timeout Exception caught")
                        # Preserve support for empty dashboard thumbnails. Report
                        # dashboards use the positive holder gate above instead.
                        try:
                            WebDriverWait(driver, 0).until(
                                EC.visibility_of_all_elements_located(
                                    (By.CLASS_NAME, "grid-container")
                                )
                            )
                        except Exception:
                            logger.warning(
                                "Selenium timed out waiting for dashboard to draw "
                                "at url %s",
                                url,
                                exc_info=True,
                            )
                            raise
                    else:
                        logger.warning(
                            "Selenium timed out waiting for chart to draw at url %s",
                            url,
                            exc_info=True,
                        )
                        raise

                try:
                    # charts took too long to load
                    logger.debug(
                        "Wait for loading element of charts to be gone at url: %s",
                        url,
                    )
                    WebDriverWait(
                        driver,
                        phase_timeout(
                            "chart_readiness",
                            self._screenshot_load_wait,
                            (
                                report_execution_context.readiness_reserve_seconds
                                if report_execution_context
                                else 0.0
                            ),
                        ),
                    ).until_not(
                        EC.presence_of_all_elements_located((By.CLASS_NAME, "loading"))
                    )
                except TimeoutException:
                    logger.warning(
                        "Selenium timed out waiting for charts to load at url %s",
                        url,
                        exc_info=True,
                    )
                    raise

            selenium_animation_wait = app.config["SCREENSHOT_SELENIUM_ANIMATION_WAIT"]
            if report_execution_context:
                selenium_animation_wait = min(
                    selenium_animation_wait,
                    phase_timeout(
                        "chart_animation",
                        None,
                        report_execution_context.readiness_reserve_seconds,
                    ),
                )
            logger.debug("Wait %i seconds for chart animation", selenium_animation_wait)
            sleep(selenium_animation_wait)
            logger.debug(
                "Taking a PNG screenshot of url %s as user %s",
                url,
                self._user.username if self._user else "None",
            )

            if app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver)
                if unexpected_errors:
                    logger.warning(
                        "%i errors found in the screenshot. URL: %s. Errors are: %s",
                        len(unexpected_errors),
                        url,
                        unexpected_errors,
                    )

            if report_execution_context:
                phase_timeout(
                    "screenshot_capture",
                    None,
                    report_execution_context.post_capture_reserve_seconds,
                )
            img = element.screenshot_as_png
        except TimeoutException:
            # Already logged at WARNING in the inner handlers above
            raise
        except StaleElementReferenceException:
            logger.warning(
                "Selenium got a stale element while requesting url %s",
                url,
                exc_info=True,
            )
            raise
        except WebDriverException:
            logger.warning(
                "Encountered an unexpected error when requesting url %s",
                url,
                exc_info=True,
            )
            raise
        except Exception as ex:
            logger.warning("exception in webdriver", exc_info=ex)
            raise
        return img
