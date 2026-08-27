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
from typing import Any, TYPE_CHECKING

from flask import current_app as app

from superset.extensions import machine_auth_provider_factory
from superset.utils.report_execution import (
    ReportExecutionContext,
)
from superset.utils.screenshot_utils import (
    CHART_CONTAINER_READY_JS,
    CHART_CONTAINER_STATE_JS,
    CHART_HOLDERS_READY_JS,
    FIND_ALL_UNREADY_CHART_HOLDERS_JS,
    FIND_CHART_HOLDER_STATES_JS,
    FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS,
    REPORT_ALL_CHART_HOLDERS_READY_JS,
    resolve_screenshot_task_budget_seconds,
    ScreenshotTaskBudgetExceededError,
    take_tiled_screenshot,
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
    """Check Playwright availability by verifying the module is importable."""
    return sync_playwright is not None


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
    def find_unexpected_errors(page: Page, log_context: str | None = None) -> list[str]:
        error_messages = []
        context_suffix = f" [{log_context}]" if log_context else ""

        try:
            alert_divs = page.get_by_role("alert").all()

            logger.debug(
                "%i alert elements have been found in the screenshot%s",
                len(alert_divs),
                context_suffix,
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
                    logger.exception(
                        "Failed to update error messages using alert_div%s",
                        context_suffix,
                    )
        except PlaywrightError:
            logger.exception("Failed to capture unexpected errors%s", context_suffix)

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
            # This non-tiled path captures the whole element in one shot
            # (`_get_screenshot` uses `full_page=True` / `element.screenshot()`),
            # so below-the-fold holders end up in the image. Force every
            # virtualized row to render up front -- mirroring the client-side
            # "Download as Image/PDF" path -- and then require *all* mounted
            # holders (not just the viewport-visible ones) to reach a terminal
            # state. If an off-screen holder never renders, the wait times out
            # and the report fails loudly instead of silently delivering a
            # blank/partial screenshot as a Success. The tiled path keeps the
            # viewport-scoped predicate because it scrolls each region into view
            # before capturing it.
            page.evaluate(FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS)
            readiness_predicate = REPORT_ALL_CHART_HOLDERS_READY_JS
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
            # `FIND_CHART_HOLDER_STATES_JS` short-circuits off-screen holders to
            # "virtualized" (counted as ready above), so on the report path -- a
            # full-page capture that includes below-the-fold holders -- the real
            # culprits (off-screen holders that never rendered) would be hidden.
            # Surface them explicitly using the non-viewport-scoped scan.
            below_fold_unready = (
                page.evaluate(FIND_ALL_UNREADY_CHART_HOLDERS_JS)
                if report_execution_context
                else unready_chart_holders
            )
            deadline_elapsed = deadline.elapsed_seconds if deadline else elapsed
            deadline_remaining = (
                deadline.remaining_seconds if deadline else remaining_budget
            )
            logger.warning(
                "report_readiness_terminal url=%s expected_holders=%s "
                "mounted_holders=%s ready_holders=%s elapsed_seconds=%.2f "
                "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                "terminal_reason=readiness_timeout unready_holders=%s "
                "all_unready_holders=%s states=%s; "
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
                below_fold_unready,
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
        context_suffix = f" [{log_context}]" if log_context else ""
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError(
                f"Playwright is required for screenshots. "
                f"{PLAYWRIGHT_INSTALL_MESSAGE}{context_suffix}"
            )

        browser_args = app.config["WEBDRIVER_OPTION_ARGS"]
        try:
            browser = _browser_manager.get_browser(browser_args)
        except Exception as ex:
            raise RuntimeError(
                f"Playwright is required for screenshots. "
                f"{PLAYWRIGHT_INSTALL_MESSAGE}{context_suffix}"
            ) from ex
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
                    "Web event %s not detected. Page %s might not have been fully loaded%s",  # noqa: E501
                    app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                    url,
                    context_suffix,
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
            logger.debug(
                "Sleeping for %i seconds%s", selenium_headstart, context_suffix
            )
            page.wait_for_timeout(selenium_headstart * 1000)
            element: Locator
            try:
                try:
                    # page didn't load
                    logger.debug(
                        "Wait for the presence of %s at url: %s%s",
                        element_name,
                        url,
                        context_suffix,
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
                    logger.exception(
                        "Timed out requesting url %s%s", url, context_suffix
                    )
                    raise

                slice_container_elems: list[Locator] = []
                rendered_chart_count = 0
                try:
                    # chart containers didn't render
                    logger.debug(
                        "Wait for chart containers to draw at url: %s%s",
                        url,
                        context_suffix,
                    )
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
                        "(%s of %s chart containers rendered before the timeout)%s",
                        url,
                        rendered_chart_count,
                        len(slice_container_elems),
                        context_suffix,
                        exc_info=True,
                    )
                    raise
                selenium_animation_wait = app.config[
                    "SCREENSHOT_SELENIUM_ANIMATION_WAIT"
                ]
                if app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                    unexpected_errors = WebDriverPlaywright.find_unexpected_errors(
                        page, log_context=log_context
                    )
                    if unexpected_errors:
                        logger.warning(
                            "%i errors found in the screenshot. URL: %s. Errors are: %s%s",  # noqa: E501
                            len(unexpected_errors),
                            url,
                            unexpected_errors,
                            context_suffix,
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
                            "at url %s (%s chart containers found); %s%s",
                            element_name,
                            url,
                            chart_count,
                            "attempting tiled screenshot anyway"
                            if likely_large_dashboard
                            else "falling back to standard screenshot behavior",
                            context_suffix,
                        )

                    # Use tiled screenshots for large dashboards. For scheduled
                    # reports a likely-large dashboard whose measured height is
                    # at or below a single tile is almost always mid-layout
                    # (charts still virtualized/collapsed at measurement time),
                    # not genuinely short -- a 52-chart dashboard is never really
                    # <one viewport tall. Routing it to the single-shot,
                    # full-page non-tiled capture risks shipping a windowed
                    # partial render. Prefer the tiled path, which scrolls every
                    # region into view and waits per tile; worst case it is a
                    # single tile. The tiled decision for thumbnails is
                    # unchanged.
                    use_tiled = likely_large_dashboard and (
                        height_unknown
                        or dashboard_height > tile_height
                        or report_execution_context is not None
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
                            "Tiled screenshot result: %d bytes for url: %s%s",
                            len(img),
                            url,
                            context_suffix,
                        )
                    else:
                        logger.debug(
                            "Dashboard below tiling threshold "
                            "(%s charts, %spx height); using standard screenshot "
                            "for url: %s%s",
                            chart_count,
                            dashboard_height,
                            url,
                            context_suffix,
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
                                "Wait %i seconds for chart animation%s",
                                selenium_animation_wait,
                                context_suffix,
                            )
                            page.wait_for_timeout(selenium_animation_wait * 1000)
                        logger.debug(
                            "Taking screenshot of url %s as user %s%s",
                            url,
                            user.username if user else "None",
                            context_suffix,
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
                            "Screenshot result: %d bytes for url: %s%s",
                            len(img) if img else 0,
                            url,
                            context_suffix,
                        )
                else:
                    logger.debug(
                        "Tiled screenshots disabled; using standard screenshot "
                        "for url: %s%s",
                        url,
                        context_suffix,
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
                            "Wait %i seconds for chart animation%s",
                            selenium_animation_wait,
                            context_suffix,
                        )
                        page.wait_for_timeout(selenium_animation_wait * 1000)
                    logger.debug(
                        "Taking screenshot of url %s as user %s%s",
                        url,
                        user.username if user else "None",
                        context_suffix,
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
                        "Screenshot result: %d bytes for url: %s%s",
                        len(img) if img else 0,
                        url,
                        context_suffix,
                    )

            except PlaywrightTimeout:
                raise
            except PlaywrightError:
                logger.exception(
                    "Encountered an unexpected error when requesting url %s%s",
                    url,
                    context_suffix,
                )
        finally:
            context.close()
        return img
