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
from PIL import Image

logger = logging.getLogger(__name__)

# Time to wait after scrolling for content to settle and load (in milliseconds)
SCROLL_SETTLE_TIMEOUT_MS = 1000

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
EMPTY_SELECTOR = r".ant-empty"
MISSING_CHART_SELECTOR = r".missing-chart-container"
TERMINAL_MARKER_SELECTOR = (
    f"{SLICE_CONTAINER_SELECTOR}, {ALERT_SELECTOR}, {EMPTY_SELECTOR}, "
    f"{MISSING_CHART_SELECTOR}"
)
CHART_ID_CLASS_PATTERN = r"\bdashboard-chart-id-(\d+)\b"

# Shared body for holder readiness and timeout diagnostics. A holder is ready
# only after a terminal marker appears and its loading marker disappears.
UNREADY_CHART_HOLDERS_JS_BODY = f"""
    const holders = document.querySelectorAll('{CHART_HOLDER_SELECTOR}');
    const unready = [];
    for (const holder of holders) {{
        const r = holder.getBoundingClientRect();
        if (!(r.top < window.innerHeight && r.bottom > 0)) {{
            continue;
        }}
        const hasSliceContainer = holder.querySelector(
            '{SLICE_CONTAINER_SELECTOR}'
        ) !== null;
        const stillLoading = holder.querySelector('{LOADING_SELECTOR}') !== null;
        const isReady = holder.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null;
        if (stillLoading || !isReady) {{
            const chartIdMatch = holder.className.match(/{CHART_ID_CLASS_PATTERN}/);
            const chartId = chartIdMatch ? chartIdMatch[1] : null;
            let state;
            if (stillLoading && hasSliceContainer) {{
                state = 'spinner_mounted';
            }} else if (stillLoading) {{
                state = 'waiting_on_database';
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

# Diagnostic query for every chart holder, including terminal and virtualized
# states. It interpolates the same selector constants as the predicates.
FIND_CHART_HOLDER_STATES_JS = f"""
() => {{
    const holders = document.querySelectorAll('{CHART_HOLDER_SELECTOR}');
    return Array.from(holders).map(holder => {{
        const chartIdMatch = holder.className.match(/{CHART_ID_CLASS_PATTERN}/);
        const chartId = chartIdMatch ? chartIdMatch[1] : null;
        const r = holder.getBoundingClientRect();
        if (!(r.top < window.innerHeight && r.bottom > 0)) {{
            return {{ chartId, state: 'virtualized' }};
        }}
        const hasSliceContainer = holder.querySelector(
            '{SLICE_CONTAINER_SELECTOR}'
        ) !== null;
        const stillLoading = holder.querySelector('{LOADING_SELECTOR}') !== null;
        if (stillLoading && hasSliceContainer) {{
            return {{ chartId, state: 'spinner_mounted' }};
        }}
        if (stillLoading) {{
            return {{ chartId, state: 'waiting_on_database' }};
        }}
        if (holder.querySelector('{ALERT_SELECTOR}') !== null) {{
            return {{ chartId, state: 'error' }};
        }}
        if (holder.querySelector(
            '{EMPTY_SELECTOR}, {MISSING_CHART_SELECTOR}'
        ) !== null) {{
            return {{ chartId, state: 'empty' }};
        }}
        if (hasSliceContainer) {{
            return {{ chartId, state: 'rendered' }};
        }}
        return {{ chartId, state: 'nothing_mounted' }};
    }});
}}
"""

CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} return unready.length === 0; }}"
)
FIND_UNREADY_CHART_HOLDERS_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} return unready; }}"
)

# A chart capture has one target rather than dashboard holders, but needs the
# same positive terminal-state guarantee and loading exclusion.
CHART_CONTAINER_READY_JS = f"""
() => {{
    const chart = document.querySelector('.chart-container');
    return chart !== null
        && chart.querySelector('{LOADING_SELECTOR}') === null
        && chart.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null;
}}
"""


def combine_screenshot_tiles(screenshot_tiles: list[bytes]) -> bytes:
    """
    Combine multiple screenshot tiles into a single vertical image.

    Args:
        screenshot_tiles: List of screenshot bytes in PNG format

    Returns:
        Combined screenshot as bytes
    """
    if not screenshot_tiles:
        return b""

    if len(screenshot_tiles) == 1:
        return screenshot_tiles[0]

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
        logger.exception("Failed to combine screenshot tiles: %s", e)
        # Return the first tile as fallback
        return screenshot_tiles[0]


def take_tiled_screenshot(
    page: "Page",
    element_name: str,
    tile_height: int,
    load_wait: int = 60,
    animation_wait: int = 0,
    log_context: str | None = None,
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

    Returns:
        Combined screenshot bytes or None if failed
    """
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
    try:
        # Get the target element
        element = page.locator(f".{element_name}")
        element.wait_for(timeout=30000)  # 30 second timeout

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
            "Dashboard: %sx%spx at (%s, %s)",
            dashboard_width,
            dashboard_height,
            dashboard_left,
            dashboard_top,
        )

        # Calculate number of tiles needed
        num_tiles = max(1, (dashboard_height + tile_height - 1) // tile_height)
        logger.info("Taking %s screenshot tiles", num_tiles)

        screenshot_tiles = []

        for i in range(num_tiles):
            # Calculate scroll position to show this tile's content
            scroll_y = dashboard_top + (i * tile_height)

            page.evaluate(f"window.scrollTo(0, {scroll_y})")
            logger.debug(
                "Scrolled window to %s for tile %s/%s", scroll_y, i + 1, num_tiles
            )
            # Wait for scroll to settle and content to load
            page.wait_for_timeout(SCROLL_SETTLE_TIMEOUT_MS)
            # Wait for every chart holder visible in the current viewport to reach
            # a terminal state (rendered chart or error/empty state). Only check
            # viewport-visible chart holders to avoid blocking on virtualization
            # placeholders rendered for off-screen charts. A holder that hasn't
            # mounted anything yet does not satisfy this check -- unlike checking
            # for the absence of `.loading`, which passes vacuously in that case.
            tile_wait_start = time.monotonic()
            try:
                page.wait_for_function(
                    CHART_HOLDERS_READY_JS,
                    timeout=load_wait * 1000,
                )
            except PlaywrightTimeout:
                elapsed = time.monotonic() - tile_wait_start
                unready_chart_holders = page.evaluate(FIND_UNREADY_CHART_HOLDERS_JS)
                # A chart failing to load in time is a customer chart-loading
                # issue (slow query, error state, etc.), not a Superset system
                # fault, so this stays at WARNING -- the report still fails
                # loudly via the `raise` below. See #38130 / #38441, which
                # made the same call for the other screenshot timeout paths.
                logger.warning(
                    "Timed out after %.2fs waiting for %s chart container(s) to "
                    "become ready on tile %s/%s (load_wait=%ss)%s; unready chart "
                    "holders (chart id, state): %s. Aborting tiled screenshot "
                    "rather than capturing a blank or partially-loaded tile.",
                    elapsed,
                    len(unready_chart_holders),
                    i + 1,
                    num_tiles,
                    load_wait,
                    context_suffix,
                    unready_chart_holders,
                )
                readiness_timeout = True
                raise
            else:
                elapsed = time.monotonic() - tile_wait_start
                logger.debug(
                    "Tile %s/%s chart holders ready after %.2fs (load_wait=%ss)%s",
                    i + 1,
                    num_tiles,
                    elapsed,
                    load_wait,
                    context_suffix,
                )

            # Wait for chart animations (e.g. ECharts) to finish after spinner clears.
            # The global animation wait before tiling only covers the first tile;
            # subsequent tiles need their own wait after data loads.
            if animation_wait > 0:
                page.wait_for_timeout(animation_wait * 1000)

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
                    "(element may be scrolled out of viewport)",
                    i + 1,
                    num_tiles,
                    clip_x,
                    clip_y,
                    dashboard_width,
                    clip_height,
                )
                continue

            # Clip to capture only the current tile portion of the element
            clip = {
                "x": clip_x,
                "y": clip_y,
                "width": dashboard_width,
                "height": clip_height,
            }

            # Take screenshot with clipping to capture only this tile's content
            tile_screenshot = page.screenshot(type="png", clip=clip)
            screenshot_tiles.append(tile_screenshot)

            logger.debug("Captured tile %s/%s with clip %s", i + 1, num_tiles, clip)

        # Combine all tiles
        logger.info("Combining screenshot tiles...")
        combined_screenshot = combine_screenshot_tiles(screenshot_tiles)

        return combined_screenshot

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
