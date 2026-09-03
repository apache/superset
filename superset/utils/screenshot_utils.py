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

import io
import logging
import time
from typing import TYPE_CHECKING

from celery import current_task
from PIL import Image, UnidentifiedImageError

from superset.utils.report_execution import (
    ReportExecutionBudgetExceededError,
    ReportExecutionContext,
)

logger = logging.getLogger(__name__)

# Time to wait after scrolling for content to settle and load (in milliseconds)
SCROLL_SETTLE_TIMEOUT_MS = 1000

# Chromium can occasionally return a valid but uniformly blank PNG for an
# off-screen clip. Retry after forcing a compositor frame, but keep each CDP
# capture bounded so a wedged compositor cannot consume the report deadline.
TILED_SCREENSHOT_CAPTURE_TIMEOUT_SECONDS = 120
TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS = 3
TILED_SCREENSHOT_BLANK_DOMINANT_PIXEL_RATIO = 0.995

# Runtime task-budget policy shared with the approach introduced in #42118.
# Celery exposes the effective per-task hard/soft limits only on the running
# task, so a static Superset timeout cannot reliably stay below task-level
# overrides. Reserve at most 20% (capped at five minutes) for browser cleanup,
# cache error transition, and the remaining report pipeline.
SCREENSHOT_TASK_BUDGET_MARGIN_FRACTION = 0.2
SCREENSHOT_TASK_BUDGET_MAX_MARGIN_SECONDS = 300


def resolve_screenshot_task_budget_seconds(
    log_context: str | None = None,
) -> float | None:
    """
    Return the safe screenshot budget derived from the active Celery task.

    Celery exposes ``request.timelimit`` as ``(hard, soft)``. Prefer the soft
    limit because cleanup must finish before Celery raises it, falling back to
    the hard limit when no soft limit is configured. Outside Celery, or when
    the metadata is absent or malformed, return ``None`` so callers preserve
    their configured standalone timeout.
    """
    context_suffix = f" [{log_context}]" if log_context else ""
    try:
        if not current_task:
            return None
        timelimit = current_task.request.timelimit
        if not isinstance(timelimit, (tuple, list)) or len(timelimit) != 2:
            return None
        hard_limit, soft_limit = timelimit
        limit = soft_limit or hard_limit
        if isinstance(limit, bool) or not isinstance(limit, (int, float)) or limit <= 0:
            return None
        margin = min(
            SCREENSHOT_TASK_BUDGET_MAX_MARGIN_SECONDS,
            limit * SCREENSHOT_TASK_BUDGET_MARGIN_FRACTION,
        )
        budget = max(0.0, float(limit) - margin)
        logger.debug(
            "Screenshot budget derived from Celery task %s=%.1fs: %.1fs "
            "(cleanup margin=%.1fs)%s",
            "soft_time_limit" if soft_limit else "time_limit",
            limit,
            budget,
            margin,
            context_suffix,
        )
        return budget
    except Exception:
        logger.debug(
            "Failed to derive screenshot budget from Celery task context; "
            "using the configured screenshot timeout%s",
            context_suffix,
            exc_info=True,
        )
        return None


# Fallback wall-clock budget, in seconds, for the entire tiled-screenshot
# operation (element lookup plus all per-tile readiness/animation waits
# combined), used when resolve_screenshot_task_budget_seconds() returns None
# (no Celery task context -- e.g. synchronous thumbnail generation -- or no
# usable task limit). The non-tiled readiness path treats None as "keep the
# configured SCREENSHOT_LOAD_WAIT" because it makes exactly one bounded wait;
# the tiled path cannot, because its per-tile waits accumulate: with N tiles,
# an uncapped load_wait allows N * load_wait of total wall-clock time, so the
# operation still needs one fixed total ceiling. Sized against the longest
# Celery hard task_time_limit observed in production for report execution
# (1740s), minus the same 300s cleanup margin the runtime derivation reserves
# for combining tiles, building the PDF, and delivering the notification.
TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS = 1440  # 1740s limit - 300s margin


class ScreenshotTaskBudgetExceededError(RuntimeError):
    """Raised when no safe task budget remains before screenshot capture."""


class TiledScreenshotBudgetExceededError(ScreenshotTaskBudgetExceededError):
    """Raised when the tiled-screenshot time budget runs out mid-capture."""


class ScreenshotCaptureTimeoutError(RuntimeError):
    """Raised when Chromium repeatedly times out while capturing a tile."""


def is_screenshot_nearly_uniform(screenshot: bytes) -> tuple[bool, float]:
    """Return whether one color occupies nearly all sampled screenshot pixels."""

    try:
        with Image.open(io.BytesIO(screenshot)) as image:
            sample = image.convert("RGB")
            sample.thumbnail((256, 256))
            colors = sample.getcolors(maxcolors=256)
            if not colors:
                return False, 0.0
            dominant_pixels = max(count for count, _color in colors)
            dominant_ratio = dominant_pixels / (sample.width * sample.height)
            return (
                dominant_ratio >= TILED_SCREENSHOT_BLANK_DOMINANT_PIXEL_RATIO,
                dominant_ratio,
            )
    except (OSError, UnidentifiedImageError):
        # Combining the tiles remains responsible for rejecting corrupt image
        # bytes. This check only identifies valid images with blank pixels.
        return False, 0.0


try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
except ImportError:
    PlaywrightTimeout = Exception

if TYPE_CHECKING:
    try:
        from playwright.sync_api import Page
    except ImportError:
        Page = None

# Production dashboard builds run ``babel-plugin-jsx-remove-data-test-id``
# under the production BABEL_ENV (including Docker builds), so readiness must
# never depend on ``data-test`` attributes. These runtime classes are the
# production contract shared by readiness polling and diagnostics.
CHART_HOLDER_SELECTOR = (
    r'.dashboard-component-chart-holder[class*="dashboard-chart-id-"]'
)
SLICE_CONTAINER_SELECTOR = r".slice_container"
LOADING_SELECTOR = r".loading"
ALERT_SELECTOR = r'[role="alert"]'
EMPTY_SELECTOR = r".ant-empty, .ag-overlay-no-rows-wrapper:not(.ag-hidden)"
MISSING_CHART_SELECTOR = r".missing-chart-container"
CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS = f"""clip => {{
    const holders = Array.from(
        document.querySelectorAll('{CHART_HOLDER_SELECTOR}')
    );
    const contentful = holders.filter(holder => {{
        const rect = holder.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, clip.bottom)
            - Math.max(rect.top, clip.top);
        const meaningfulOverlap = overlap > Math.min(
            rect.height,
            clip.bottom - clip.top,
        ) * 0.1;
        const isEmptyOrError = holder.querySelector(
            '{ALERT_SELECTOR}, {EMPTY_SELECTOR}, {MISSING_CHART_SELECTOR}'
        ) !== null;
        return meaningfulOverlap && !isEmptyOrError;
    }}).length;
    return {{total: holders.length, contentful}};
}}"""
TERMINAL_MARKER_SELECTOR = (
    f"{SLICE_CONTAINER_SELECTOR}, {ALERT_SELECTOR}, {EMPTY_SELECTOR}, "
    f"{MISSING_CHART_SELECTOR}"
)
CHART_ID_CLASS_PATTERN = r"\bdashboard-chart-id-(\d+)\b"

# ECharts paint marker. The frontend
# (plugins/plugin-chart-echarts/src/components/Echart.tsx) tags the canvas host
# ``.echarts-host`` and adds ``.echarts-render-finished`` only in the ECharts
# ``finished`` event -- the sole signal that the canvas is fully painted.
# ``.slice_container`` alone is a pre-paint signal (it mounts when data arrives,
# before the canvas is drawn; chartStatus/onRenderSuccess fire pre-paint too), so
# a holder that still contains an unpainted host is treated as not-yet-rendered and
# the report screenshot waits for it instead of capturing a blank chart. Only
# ECharts hosts are gated; DOM/SVG vizzes paint on commit and non-ECharts canvas
# vizzes (deck.gl/mapbox/etc.) have no ``.echarts-host`` so they are unaffected.
ECHARTS_UNPAINTED_HOST_SELECTOR = r".echarts-host:not(.echarts-render-finished)"
AG_GRID_HOST_SELECTOR = r'[data-themed-ag-grid="true"]'
CHART_ERROR_OR_EMPTY_SELECTOR = (
    f"{ALERT_SELECTOR}, {EMPTY_SELECTOR}, {MISSING_CHART_SELECTOR}"
)

# Runtime contract with the dashboard frontend. Dispatching this window event
# forces every DashboardVirtualization row to render regardless of whether it
# intersects the headless viewport, mirroring the client-side "Download as
# Image/PDF" path (see FORCE_IN_VIEW_EVENT in
# superset-frontend/src/dashboard/constants.ts and forceLoadAllCharts in
# superset-frontend/src/utils/downloadUtils.ts). The non-tiled report capture
# takes a single full-page screenshot that includes below-the-fold holders, so
# those holders must be forced to render before the readiness wait -- otherwise
# a virtualized (or still-loading) off-screen holder is captured blank. A plain
# Event with no `detail.rowIds` means "force every row", matching the frontend's
# single-pass branch.
FORCE_ALL_CHART_HOLDERS_IN_VIEW_EVENT = "superset-force-all-in-view"
FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS = (
    f"() => window.dispatchEvent(new Event('{FORCE_ALL_CHART_HOLDERS_IN_VIEW_EVENT}'))"
)


def _unready_chart_holders_js_body(*, viewport_only: bool) -> str:
    """Return the shared holder-readiness scan body.

    A holder is ready only after a terminal marker appears and its loading
    marker disappears. When ``viewport_only`` is True the scan skips holders
    that do not intersect the current viewport: correct for the tiled path,
    which scrolls every region into view before capturing it, and for
    thumbnails, which only ever capture the viewport. The non-tiled *report*
    capture takes a single full-page screenshot that includes below-the-fold
    holders, so it must scan every mounted holder (``viewport_only=False``) --
    otherwise an off-screen holder that never rendered is captured blank and
    silently delivered as a Success.
    """
    viewport_skip = (
        """
        const r = holder.getBoundingClientRect();
        if (!(r.top < window.innerHeight && r.bottom > 0)) {
            continue;
        }"""
        if viewport_only
        else ""
    )
    return f"""
    const holders = document.querySelectorAll('{CHART_HOLDER_SELECTOR}');
    const unready = [];
    for (const holder of holders) {{{viewport_skip}
        const hasSliceContainer = holder.querySelector(
            '{SLICE_CONTAINER_SELECTOR}'
        ) !== null;
        const stillLoading = holder.querySelector('{LOADING_SELECTOR}') !== null;
        const hasErrorOrEmpty = holder.querySelector(
            '{CHART_ERROR_OR_EMPTY_SELECTOR}'
        ) !== null;
        const hasUnpaintedEchart = holder.querySelector(
            '{ECHARTS_UNPAINTED_HOST_SELECTOR}'
        ) !== null;
        const agGrids = Array.from(holder.querySelectorAll(
            '{AG_GRID_HOST_SELECTOR}'
        ));
        const unpaintedAgGrids = agGrids.filter(
            grid => grid._agGridFirstDataRendered !== true
        );
        unpaintedAgGrids.forEach(grid => {{
            grid._supersetAgGridWaitObserved = true;
        }});
        const hasUnpaintedAgGrid = unpaintedAgGrids.length > 0;
        // Ready = a settled error/empty/missing state, or a slice container
        // whose renderer has painted. ECharts and AG Grid expose explicit
        // completion signals; keep either host unready until its signal fires.
        const isReady = !stillLoading && (
            hasErrorOrEmpty || (
                hasSliceContainer && !hasUnpaintedEchart && !hasUnpaintedAgGrid
            )
        );
        if (!isReady) {{
            const chartIdMatch = holder.className.match(/{CHART_ID_CLASS_PATTERN}/);
            const chartId = chartIdMatch ? chartIdMatch[1] : null;
            let state;
            if (stillLoading && hasSliceContainer) {{
                state = 'spinner_mounted';
            }} else if (stillLoading) {{
                state = 'waiting_on_database';
            }} else if (hasSliceContainer && hasUnpaintedEchart) {{
                state = 'mounted_unpainted';
            }} else if (hasSliceContainer && hasUnpaintedAgGrid) {{
                state = 'ag_grid_unpainted';
            }} else {{
                state = 'nothing_mounted';
            }}
            unready.push({{
                chartId: chartId,
                state: state,
            }});
        }}
    }}
"""


# Viewport-scoped scan (tiled path + thumbnails).
UNREADY_CHART_HOLDERS_JS_BODY = _unready_chart_holders_js_body(viewport_only=True)
# Full-dashboard scan (non-tiled report capture, which screenshots the whole
# element in one shot and therefore cannot ignore below-the-fold holders).
UNREADY_ALL_CHART_HOLDERS_JS_BODY = _unready_chart_holders_js_body(viewport_only=False)

# Diagnostic query for every chart holder, including terminal and virtualized
# states. It interpolates the same selector constants as the predicates.
FIND_CHART_HOLDER_STATES_JS = f"""
() => {{
    const holders = document.querySelectorAll('{CHART_HOLDER_SELECTOR}');
    return Array.from(holders).map(holder => {{
        const chartIdMatch = holder.className.match(/{CHART_ID_CLASS_PATTERN}/);
        const chartId = chartIdMatch ? chartIdMatch[1] : null;
        const agGridWaitObserved = Array.from(holder.querySelectorAll(
            '{AG_GRID_HOST_SELECTOR}'
        )).some(grid => grid._supersetAgGridWaitObserved === true);
        const r = holder.getBoundingClientRect();
        if (!(r.top < window.innerHeight && r.bottom > 0)) {{
            return {{ chartId, state: 'virtualized', agGridWaitObserved }};
        }}
        const hasSliceContainer = holder.querySelector(
            '{SLICE_CONTAINER_SELECTOR}'
        ) !== null;
        const stillLoading = holder.querySelector('{LOADING_SELECTOR}') !== null;
        const hasUnpaintedAgGrid = Array.from(holder.querySelectorAll(
            '{AG_GRID_HOST_SELECTOR}'
        )).some(grid => grid._agGridFirstDataRendered !== true);
        if (stillLoading && hasSliceContainer) {{
            return {{ chartId, state: 'spinner_mounted', agGridWaitObserved }};
        }}
        if (stillLoading) {{
            return {{ chartId, state: 'waiting_on_database', agGridWaitObserved }};
        }}
        if (holder.querySelector('{ALERT_SELECTOR}') !== null) {{
            return {{ chartId, state: 'error', agGridWaitObserved }};
        }}
        if (holder.querySelector(
            '{EMPTY_SELECTOR}, {MISSING_CHART_SELECTOR}'
        ) !== null) {{
            return {{ chartId, state: 'empty', agGridWaitObserved }};
        }}
        if (hasSliceContainer && holder.querySelector(
            '{ECHARTS_UNPAINTED_HOST_SELECTOR}'
        ) !== null) {{
            return {{ chartId, state: 'mounted_unpainted', agGridWaitObserved }};
        }}
        if (hasSliceContainer && hasUnpaintedAgGrid) {{
            return {{ chartId, state: 'ag_grid_unpainted', agGridWaitObserved }};
        }}
        if (hasSliceContainer) {{
            return {{ chartId, state: 'rendered', agGridWaitObserved }};
        }}
        return {{ chartId, state: 'nothing_mounted', agGridWaitObserved }};
    }});
}}
"""

CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} return unready.length === 0; }}"
)
REPORT_CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} "
    "return holders.length > 0 && unready.length === 0; }"
)
# Report readiness for the non-tiled full-page capture: every mounted holder --
# including below-the-fold ones -- must be terminally rendered. Off-screen
# holders are forced to render first (FORCE_ALL_CHART_HOLDERS_IN_VIEW_JS); if any
# still fails to render within budget the wait times out and the report fails
# loudly rather than shipping a blank/partial screenshot as a Success.
REPORT_ALL_CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_ALL_CHART_HOLDERS_JS_BODY} "
    "return holders.length > 0 && unready.length === 0; }"
)
CHART_HOLDERS_MOUNTED_JS = (
    f"() => document.querySelectorAll('{CHART_HOLDER_SELECTOR}').length > 0"
)
FIND_UNREADY_CHART_HOLDERS_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} return unready; }}"
)
FIND_ALL_UNREADY_CHART_HOLDERS_JS = (
    f"() => {{ {UNREADY_ALL_CHART_HOLDERS_JS_BODY} return unready; }}"
)

# A chart capture has one target rather than dashboard holders, but needs the
# same positive terminal-state guarantee and loading exclusion.
CHART_CONTAINER_READY_JS = f"""
() => {{
    const chart = document.querySelector('.chart-container');
    return chart !== null
        && chart.querySelector('{LOADING_SELECTOR}') === null
        && chart.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null
        && (
            chart.querySelector('{CHART_ERROR_OR_EMPTY_SELECTOR}') !== null
            || (
                chart.querySelector('{ECHARTS_UNPAINTED_HOST_SELECTOR}') === null
                && !Array.from(
                    chart.querySelectorAll('{AG_GRID_HOST_SELECTOR}')
                ).some(grid => grid._agGridFirstDataRendered !== true)
            )
        );
}}
"""

# Diagnostic companion to CHART_CONTAINER_READY_JS: reports why a chart
# capture is (or is not) ready. Chart pages have no dashboard grid holders,
# so the holder-count diagnostics read as vacuous zeros there.
CHART_CONTAINER_STATE_JS = f"""
() => {{
    const chart = document.querySelector('.chart-container');
    if (chart === null) {{ return 'missing'; }}
    if (chart.querySelector('{LOADING_SELECTOR}') !== null) {{ return 'loading'; }}
    if (chart.querySelector('{CHART_ERROR_OR_EMPTY_SELECTOR}') !== null) {{
        return 'terminal';
    }}
    if (chart.querySelector('{ECHARTS_UNPAINTED_HOST_SELECTOR}') !== null) {{
        return 'mounted_unpainted';
    }}
    if (Array.from(chart.querySelectorAll('{AG_GRID_HOST_SELECTOR}')).some(
        grid => grid._agGridFirstDataRendered !== true
    )) {{
        return 'ag_grid_unpainted';
    }}
    if (chart.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null) {{
        return 'terminal';
    }}
    return 'mounted_pre_terminal';
}}
"""


def combine_screenshot_tiles(
    screenshot_tiles: list[bytes],
    *,
    allow_partial_fallback: bool = True,
    log_context: str | None = None,
) -> bytes:
    """
    Combine multiple screenshot tiles into a single vertical image.

    Args:
        screenshot_tiles: List of screenshot bytes in PNG format
        log_context: Optional identifier (e.g. report execution id, or a
            thumbnail cache key) appended to log lines for tracing.

    Returns:
        Combined screenshot as bytes
    """
    if not screenshot_tiles:
        return b""

    if len(screenshot_tiles) == 1:
        return screenshot_tiles[0]

    context_suffix = f" [{log_context}]" if log_context else ""
    try:
        # Open all images
        images = [Image.open(io.BytesIO(tile)) for tile in screenshot_tiles]

        # Calculate total dimensions
        total_width = max(img.width for img in images)
        total_height = sum(img.height for img in images)

        # Create combined image
        combined = Image.new("RGB", (total_width, total_height), "white")

        # Paste each tile
        y_offset = 0
        for img in images:
            combined.paste(img, (0, y_offset))
            y_offset += img.height

        # Convert back to bytes
        output = io.BytesIO()
        combined.save(output, format="PNG")
        return output.getvalue()

    except Exception as e:
        logger.exception("Failed to combine screenshot tiles: %s%s", e, context_suffix)
        if allow_partial_fallback:
            # Preserve the historical thumbnail behavior. Scheduled reports
            # opt out because delivering only the first tile is incomplete.
            return screenshot_tiles[0]
        raise


def take_tiled_screenshot(  # noqa: C901
    page: "Page",
    element_name: str,
    tile_height: int,
    load_wait: int = 60,
    animation_wait: int = 0,
    log_context: str | None = None,
    report_execution_context: ReportExecutionContext | None = None,
    url: str | None = None,
    screenshot_started_at: float | None = None,
) -> bytes | None:
    """
    Take a tiled screenshot of a large dashboard by scrolling and capturing sections.

    Args:
        page: Playwright page object
        element_name: CSS class name of the element to screenshot
        tile_height: Height of each tile in pixels
        load_wait: Seconds to wait for charts to load per tile (default 60)
        animation_wait: Seconds to wait for chart animations per tile (default 0)
        log_context: Optional identifier (e.g. report execution id, or a
            cache key for thumbnails) appended to log lines so a slow/timed-out
            capture can be traced back to the run that produced it.
        report_execution_context: Shared report identifiers, phase reserves,
            and end-to-end deadline. Thumbnail callers leave this unset.
        url: Dashboard URL included in structured capture logs.
        screenshot_started_at: Optional time.monotonic() timestamp taken at
            the start of the overall screenshot operation (before browser
            navigation), so pre-capture time counts against the non-report
            task budget -- the same clock _wait_for_charts_ready uses.
            Ignored when a report_execution_context provides its own
            deadline; falls back to "now" when omitted.

    Returns:
        Combined screenshot bytes or None if failed

    Raises:
        TiledScreenshotBudgetExceededError: If the total time budget for the
            tiled-screenshot operation runs out before every tile has been
            verifiably captured. Callers must treat this as a hard failure
            rather than fall back to an unchecked/partial screenshot.
    """
    if report_execution_context:
        log_context = report_execution_context.log_context
    context_suffix = f" [{log_context}]" if log_context else ""
    # Set right before re-raising the per-tile readiness timeout below, and
    # checked in the except block at the bottom of this function. Deciding
    # whether to propagate via `isinstance(e, PlaywrightTimeout)` would be
    # unreliable: when the playwright package isn't installed,
    # `PlaywrightTimeout` is aliased to the bare `Exception` class (see the
    # try/except ImportError above this function), which would make *any*
    # exception -- not just our own deliberate readiness-timeout raise --
    # match `except PlaywrightTimeout` and incorrectly propagate instead of
    # degrading to `None` like every other unexpected error in this function.
    readiness_timeout = False
    if screenshot_started_at is None:
        screenshot_started_at = time.monotonic()
    task_budget = (
        None
        if report_execution_context
        else resolve_screenshot_task_budget_seconds(log_context)
    )
    # Non-report callers (thumbnails) have no execution deadline; cap the
    # whole tiled operation against the running Celery task's own limit,
    # falling back to a fixed total ceiling when no usable limit exists --
    # per-tile waits accumulate, so "no budget" must not mean "uncapped"
    # (#42118; see TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS).
    if report_execution_context is None and task_budget is None:
        task_budget = float(TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS)

    def _deadline_values() -> tuple[float, float | None]:
        if report_execution_context:
            deadline = report_execution_context.deadline
            return deadline.elapsed_seconds, deadline.remaining_seconds
        elapsed = max(0.0, time.monotonic() - screenshot_started_at)
        remaining = task_budget - elapsed if task_budget is not None else None
        return elapsed, remaining

    def _timeout_seconds(
        phase: str,
        *,
        requested_seconds: float | None = None,
        reserve_seconds: float = 0.0,
    ) -> float:
        if report_execution_context:
            return report_execution_context.deadline.timeout_seconds(
                phase,
                requested_seconds=requested_seconds,
                reserve_seconds=reserve_seconds,
            )
        elapsed, remaining = _deadline_values()
        if remaining is not None and remaining <= 0:
            raise TiledScreenshotBudgetExceededError(
                f"Tiled screenshot budget of {task_budget:.2f}s exhausted "
                f"before {phase} after {elapsed:.2f}s"
            )
        if remaining is None:
            return float(requested_seconds or load_wait)
        if requested_seconds is None or requested_seconds <= 0:
            return remaining
        return min(float(requested_seconds), remaining)

    try:
        # Get the target element
        element = page.locator(f".{element_name}")
        element.wait_for(
            timeout=_timeout_seconds(
                "dashboard_mount",
                requested_seconds=30,
                reserve_seconds=(
                    report_execution_context.readiness_reserve_seconds
                    if report_execution_context
                    else 0.0
                ),
            )
            * 1000
        )

        if report_execution_context:
            mount_wait = _timeout_seconds(
                "chart_holder_mount",
                reserve_seconds=report_execution_context.readiness_reserve_seconds,
            )
            try:
                page.wait_for_function(
                    CHART_HOLDERS_MOUNTED_JS,
                    timeout=mount_wait * 1000,
                )
            except PlaywrightTimeout:
                holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
                elapsed, remaining = _deadline_values()
                logger.warning(
                    "report_readiness_terminal url=%s expected_holders=%s "
                    "mounted_holders=%s ready_holders=0 elapsed_seconds=%.2f "
                    "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                    "terminal_reason=zero_holders_timeout states=%s; "
                    "aborting before dimensions, capture, or delivery",
                    url,
                    report_execution_context.expected_chart_count,
                    len(holder_states),
                    elapsed,
                    f"{remaining:.2f}" if remaining is not None else None,
                    mount_wait,
                    context_suffix,
                    holder_states,
                )
                readiness_timeout = True
                raise

        # Get dashboard dimensions and position
        element_info = page.evaluate(f"""() => {{
            const el = document.querySelector(".{element_name}");
            const rect = el.getBoundingClientRect();
            return {{
                width: el.scrollWidth,
                height: el.scrollHeight,
                left: rect.left + window.scrollX,
                top: rect.top + window.scrollY,
            }};
        }}""")

        dashboard_width = element_info["width"]
        dashboard_height = element_info["height"]
        dashboard_left = element_info["left"]
        dashboard_top = element_info["top"]

        logger.info(
            "Dashboard: %sx%spx at (%s, %s)%s",
            dashboard_width,
            dashboard_height,
            dashboard_left,
            dashboard_top,
            context_suffix,
        )

        # Calculate number of tiles needed
        num_tiles = max(1, (dashboard_height + tile_height - 1) // tile_height)
        logger.info("Taking %s screenshot tiles%s", num_tiles, context_suffix)

        screenshot_tiles: list[bytes] = []
        blank_tile_retries = 0

        def _raise_if_budget_exhausted() -> None:
            elapsed, remaining = _deadline_values()
            if remaining is None or remaining > 0:
                return
            # A customer-side chart-loading issue (a slow/hung dashboard),
            # not a Superset system fault, so this is a WARNING rather
            # than an ERROR -- consistent with #38130/#38441, which
            # deliberately downgraded screenshot timeout logs the same way.
            logger.warning(
                "Tiled screenshot time budget exhausted on tile %s/%s: "
                "%s/%s tiles captured so far, %.1fs elapsed. Aborting "
                "instead of capturing remaining tiles unchecked.%s",
                i + 1,
                num_tiles,
                len(screenshot_tiles),
                num_tiles,
                elapsed,
                context_suffix,
            )
            raise TiledScreenshotBudgetExceededError(
                f"Tiled screenshot budget exhausted "
                f"after {len(screenshot_tiles)}/{num_tiles} tiles"
            )

        for i in range(num_tiles):
            # Check the time budget before starting this tile's readiness wait.
            # If it's already exhausted, we can no longer verify this (or any
            # later) tile is actually ready to capture -- fail loudly instead
            # of silently snapshotting a spinner or blank chart, or running
            # past the Celery task time limit and getting SIGKILLed.
            _raise_if_budget_exhausted()

            # Calculate scroll position to show this tile's content
            scroll_y = dashboard_top + (i * tile_height)

            page.evaluate(f"window.scrollTo(0, {scroll_y})")
            logger.debug(
                "Scrolled window to %s for tile %s/%s%s",
                scroll_y,
                i + 1,
                num_tiles,
                context_suffix,
            )
            # Wait for scroll to settle and content to load
            page.wait_for_timeout(SCROLL_SETTLE_TIMEOUT_MS)

            # Re-check after the scroll-settle sleep -- which itself consumes
            # real wall-clock time -- so the readiness-check timeout below is
            # derived from a fresh remaining value instead of a stale one
            # that would let each tile overrun the budget by up to one settle
            # interval (_timeout_seconds also recomputes at call time).
            _raise_if_budget_exhausted()

            # Wait for every chart holder visible in the current viewport to reach
            # a terminal state (rendered chart or error/empty state), capped at
            # whatever remains of the total time budget so a slow dashboard
            # degrades gracefully instead of exceeding it. Only check
            # viewport-visible chart holders to avoid blocking on virtualization
            # placeholders rendered for off-screen charts. A holder that hasn't
            # mounted anything yet does not satisfy this check -- unlike checking
            # for the absence of `.loading`, which passes vacuously in that case.
            tile_wait_start = time.monotonic()
            tile_load_wait = _timeout_seconds(
                "chart_readiness",
                requested_seconds=None if report_execution_context else load_wait,
                reserve_seconds=(
                    report_execution_context.readiness_reserve_seconds
                    if report_execution_context
                    else 0.0
                ),
            )
            try:
                page.wait_for_function(
                    (
                        REPORT_CHART_HOLDERS_READY_JS
                        if report_execution_context
                        else CHART_HOLDERS_READY_JS
                    ),
                    timeout=tile_load_wait * 1000,
                )
            except PlaywrightTimeout:
                tile_elapsed = time.monotonic() - tile_wait_start
                unready_chart_holders = page.evaluate(FIND_UNREADY_CHART_HOLDERS_JS)
                holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
                ready_states = {"rendered", "empty", "error", "virtualized"}
                ready_holders = sum(
                    holder.get("state") in ready_states for holder in holder_states
                )
                elapsed, remaining = _deadline_values()
                # A chart failing to load in time is a customer chart-loading
                # issue (slow query, error state, etc.), not a Superset system
                # fault, so this stays at WARNING -- the report still fails
                # loudly via the `raise` below. See #38130 / #38441, which
                # made the same call for the other screenshot timeout paths.
                logger.warning(
                    "report_readiness_terminal url=%s expected_holders=%s "
                    "mounted_holders=%s ready_holders=%s tile=%s/%s "
                    "tiles_captured=%s/%s "
                    "tile_elapsed_seconds=%.2f elapsed_seconds=%.2f "
                    "remaining_seconds=%s effective_wait_seconds=%.2f%s "
                    "terminal_reason=readiness_timeout unready_holders=%s "
                    "states=%s; aborting before capture or delivery",
                    url,
                    (
                        report_execution_context.expected_chart_count
                        if report_execution_context
                        else None
                    ),
                    len(holder_states),
                    ready_holders,
                    i + 1,
                    num_tiles,
                    len(screenshot_tiles),
                    num_tiles,
                    tile_elapsed,
                    elapsed,
                    f"{remaining:.2f}" if remaining is not None else None,
                    tile_load_wait,
                    context_suffix,
                    unready_chart_holders,
                    holder_states,
                )
                readiness_timeout = True
                raise
            else:
                tile_elapsed = time.monotonic() - tile_wait_start
                logger.debug(
                    "Tile %s/%s chart holders ready after %.2fs "
                    "(effective_wait=%.2fs)%s",
                    i + 1,
                    num_tiles,
                    tile_elapsed,
                    tile_load_wait,
                    context_suffix,
                )
            readiness_wait_elapsed = time.monotonic() - tile_wait_start

            # Wait for chart animations (e.g. ECharts) to finish after spinner clears.
            # The global animation wait before tiling only covers the first tile;
            # subsequent tiles need their own wait after data loads. Capped at
            # whatever remains of the budget; unlike the readiness wait above this
            # is cosmetic settling, not a readiness check, so we simply skip it
            # (rather than raise) once the budget runs out.
            animation_wait_elapsed = 0.0
            if animation_wait > 0:
                # Cosmetic settling, not a readiness check: cap at whatever
                # remains and simply skip (rather than raise) once the
                # deadline/budget runs out.
                if report_execution_context:
                    try:
                        tile_animation_wait = min(
                            float(animation_wait),
                            _timeout_seconds(
                                "chart_animation",
                                reserve_seconds=(
                                    report_execution_context.readiness_reserve_seconds
                                ),
                            ),
                        )
                    except ReportExecutionBudgetExceededError:
                        tile_animation_wait = 0.0
                else:
                    try:
                        tile_animation_wait = _timeout_seconds(
                            "chart_animation",
                            requested_seconds=float(animation_wait),
                        )
                    except TiledScreenshotBudgetExceededError:
                        tile_animation_wait = 0.0
                if tile_animation_wait > 0:
                    animation_wait_start = time.monotonic()
                    page.wait_for_timeout(tile_animation_wait * 1000)
                    animation_wait_elapsed = time.monotonic() - animation_wait_start

            # Per-tile timing breakdown so slow dashboards can be profiled from
            # logs alone. DEBUG rather than INFO: this fires once per tile, and
            # large dashboards can have dozens of tiles per report run.
            logger.debug(
                "Tile %s/%s timing: %.2fs waiting for chart readiness, "
                "%.2fs waiting for animations.%s",
                i + 1,
                num_tiles,
                readiness_wait_elapsed,
                animation_wait_elapsed,
                context_suffix,
            )

            # Calculate what portion of the element we want to capture for this tile
            tile_start_in_element = i * tile_height
            remaining_content = dashboard_height - tile_start_in_element
            clip_height = min(tile_height, remaining_content)
            clip_y = (
                0
                if tile_height < remaining_content
                else tile_height - remaining_content
            )
            clip_x = dashboard_left

            # Skip tile if dimensions are invalid (width or height <= 0)
            # This can happen if element is completely scrolled out of viewport
            if clip_height <= 0 or clip_y < 0:
                logger.warning(
                    "Skipping tile %s/%s due to invalid clip dimensions: "
                    "x=%s, y=%s, width=%s, height=%s "
                    "(element may be scrolled out of viewport).%s",
                    i + 1,
                    num_tiles,
                    clip_x,
                    clip_y,
                    dashboard_width,
                    clip_height,
                    context_suffix,
                )
                continue

            # Clip to capture only the current tile portion of the element
            clip = {
                "x": clip_x,
                "y": clip_y,
                "width": dashboard_width,
                "height": clip_height,
            }

            holder_count_failed = False
            try:
                holder_counts = page.evaluate(
                    CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS,
                    {"top": clip_y, "bottom": clip_y + clip_height},
                )
                if not (
                    isinstance(holder_counts, dict)
                    and isinstance(holder_counts.get("total"), int)
                    and isinstance(holder_counts.get("contentful"), int)
                ):
                    raise ValueError("Unexpected chart-holder count result")
                total_chart_holders = holder_counts["total"]
                contentful_chart_holders = holder_counts["contentful"]
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Unable to count chart holders intersecting tile %s/%s%s",
                    i + 1,
                    num_tiles,
                    context_suffix,
                    exc_info=True,
                )
                holder_count_failed = True
                total_chart_holders = 0
                contentful_chart_holders = 0

            if (
                total_chart_holders == 0
                and report_execution_context
                and report_execution_context.expected_chart_count
            ):
                logger.warning(
                    "report_capture_no_chart_holders tile=%s/%s "
                    "expected_holders=%s holder_count_failed=%s%s",
                    i + 1,
                    num_tiles,
                    report_execution_context.expected_chart_count,
                    holder_count_failed,
                    context_suffix,
                )

            # Take screenshot with clipping to capture only this tile's content
            tile_screenshot: bytes | None = None
            for capture_attempt in range(1, TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS + 1):
                capture_timeout = (
                    _timeout_seconds(
                        "screenshot_capture",
                        requested_seconds=TILED_SCREENSHOT_CAPTURE_TIMEOUT_SECONDS,
                        reserve_seconds=(
                            report_execution_context.post_capture_reserve_seconds
                            if report_execution_context
                            else 0.0
                        ),
                    )
                    if report_execution_context or task_budget is not None
                    else None
                )
                capture_started_at = time.monotonic()
                try:
                    candidate = page.screenshot(
                        type="png",
                        clip=clip,
                        **(
                            {"timeout": capture_timeout * 1000}
                            if capture_timeout is not None
                            else {}
                        ),
                    )
                except PlaywrightTimeout as ex:
                    capture_elapsed = time.monotonic() - capture_started_at
                    logger.warning(
                        "report_capture_tile_timeout tile=%s/%s attempt=%s/%s "
                        "capture_elapsed_seconds=%.2f%s",
                        i + 1,
                        num_tiles,
                        capture_attempt,
                        TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS,
                        capture_elapsed,
                        context_suffix,
                    )
                    if capture_attempt == TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS:
                        raise ScreenshotCaptureTimeoutError(
                            f"Chromium timed out capturing tile {i + 1}/{num_tiles} "
                            f"after {capture_attempt} attempts"
                        ) from ex
                else:
                    capture_elapsed = time.monotonic() - capture_started_at
                    is_uniform, dominant_ratio = is_screenshot_nearly_uniform(candidate)
                    is_blank = is_uniform and (
                        contentful_chart_holders > 0 or holder_count_failed
                    )
                    logger.debug(
                        "Captured tile %s/%s attempt %s/%s in %.2fs "
                        "(contentful_chart_holders=%s dominant_pixel_ratio=%.5f)%s",
                        i + 1,
                        num_tiles,
                        capture_attempt,
                        TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS,
                        capture_elapsed,
                        contentful_chart_holders,
                        dominant_ratio,
                        context_suffix,
                    )
                    if not is_blank:
                        tile_screenshot = candidate
                        break
                    blank_tile_retries += 1
                    logger.warning(
                        "report_capture_blank_tile tile=%s/%s attempt=%s/%s "
                        "capture_elapsed_seconds=%.2f contentful_chart_holders=%s "
                        "dominant_pixel_ratio=%.5f%s",
                        i + 1,
                        num_tiles,
                        capture_attempt,
                        TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS,
                        capture_elapsed,
                        contentful_chart_holders,
                        dominant_ratio,
                        context_suffix,
                    )
                    if capture_attempt == TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS:
                        tile_screenshot = candidate
                        logger.warning(
                            "report_capture_uniform_tile_retained tile=%s/%s "
                            "attempts=%s contentful_chart_holders=%s "
                            "dominant_pixel_ratio=%.5f%s",
                            i + 1,
                            num_tiles,
                            capture_attempt,
                            contentful_chart_holders,
                            dominant_ratio,
                            context_suffix,
                        )
                        break

                _raise_if_budget_exhausted()
                try:
                    page.bring_to_front()
                    page.evaluate(
                        """() => {
                            window.scrollBy(0, 1);
                            window.scrollBy(0, -1);
                            window.__supersetRepaintComplete = false;
                            requestAnimationFrame(() => requestAnimationFrame(() => {
                                window.__supersetRepaintComplete = true;
                            }));
                        }"""
                    )
                    repaint_timeout = _timeout_seconds(
                        "screenshot_repaint",
                        requested_seconds=5.0,
                        reserve_seconds=(
                            report_execution_context.post_capture_reserve_seconds
                            if report_execution_context
                            else 0.0
                        ),
                    )
                    page.wait_for_function(
                        "() => window.__supersetRepaintComplete === true",
                        timeout=repaint_timeout * 1000,
                    )
                except Exception:  # noqa: BLE001
                    logger.warning(
                        "report_capture_repaint_timeout tile=%s/%s attempt=%s/%s%s",
                        i + 1,
                        num_tiles,
                        capture_attempt,
                        TILED_SCREENSHOT_MAX_CAPTURE_ATTEMPTS,
                        context_suffix,
                        exc_info=True,
                    )

            assert tile_screenshot is not None
            screenshot_tiles.append(tile_screenshot)

            logger.debug(
                "Captured tile %s/%s with clip %s%s",
                i + 1,
                num_tiles,
                clip,
                context_suffix,
            )

        # Combine all tiles
        try:
            holder_states = page.evaluate(FIND_CHART_HOLDER_STATES_JS)
            if not isinstance(holder_states, list):
                holder_states = []
        except Exception:  # noqa: BLE001  # diagnostics must not discard valid tiles
            logger.warning(
                "Unable to collect final chart-holder diagnostics%s",
                context_suffix,
                exc_info=True,
            )
            holder_states = []
        ready_states = {"rendered", "empty", "error", "virtualized"}
        elapsed, remaining = _deadline_values()
        if blank_tile_retries:
            logger.info(
                "report_capture_blank_tile_retries count=%s%s",
                blank_tile_retries,
                context_suffix,
            )
        logger.info(
            "report_readiness_ready url=%s expected_holders=%s mounted_holders=%s "
            "ready_holders=%s ag_grid_waited_holders=%s blank_tile_retries=%s "
            "elapsed_seconds=%.2f "
            "remaining_seconds=%s%s",
            url,
            (
                report_execution_context.expected_chart_count
                if report_execution_context
                else None
            ),
            len(holder_states),
            sum(holder.get("state") in ready_states for holder in holder_states),
            sum(holder.get("agGridWaitObserved") is True for holder in holder_states),
            blank_tile_retries,
            elapsed,
            f"{remaining:.2f}" if remaining is not None else None,
            context_suffix,
        )
        logger.info("Combining screenshot tiles...%s", context_suffix)
        combined_screenshot = combine_screenshot_tiles(
            screenshot_tiles,
            allow_partial_fallback=report_execution_context is None,
            log_context=log_context,
        )

        return combined_screenshot

    except (ReportExecutionBudgetExceededError, TiledScreenshotBudgetExceededError):
        # Budget/deadline exhaustion must fail cleanly, not be swallowed into
        # the generic `return None` degradation below -- the raise carries the
        # diagnostics to the caller, which fails the capture loudly (#42273)
        # instead of receiving an anonymous empty result.
        elapsed, remaining = _deadline_values()
        logger.warning(
            "report_capture_terminal url=%s elapsed_seconds=%.2f "
            "remaining_seconds=%s%s terminal_reason=budget_exhausted; "
            "aborting before unchecked capture or delivery",
            url,
            elapsed,
            f"{remaining:.2f}" if remaining is not None else None,
            context_suffix,
        )
        raise
    except ScreenshotCaptureTimeoutError:
        # Preserve the explicit capture-timeout reason for report execution
        # history instead of degrading it to an anonymous None screenshot.
        logger.exception("Tiled screenshot capture rejected%s", context_suffix)
        if report_execution_context:
            raise
        return None
    except Exception as e:
        if readiness_timeout:
            # Let the per-tile readiness timeout propagate so the caller
            # fails the report instead of silently falling back to a
            # degraded screenshot -- already logged as a WARNING above.
            raise
        # Any other exception is a genuine system-level fault (or a setup
        # failure unrelated to chart readiness, e.g. the dashboard element
        # itself never appearing), not a customer chart taking too long to
        # load, so it stays at ERROR/exception level.
        logger.exception("Tiled screenshot failed: %s%s", e, context_suffix)
        return None
