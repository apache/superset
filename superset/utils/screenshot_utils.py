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

from PIL import Image

logger = logging.getLogger(__name__)

# Time to wait after scrolling for content to settle and load (in milliseconds)
SCROLL_SETTLE_TIMEOUT_MS = 1000

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
except ImportError:
    PlaywrightTimeout = Exception

if TYPE_CHECKING:
    try:
        from playwright.sync_api import Page
    except ImportError:
        Page = None

# Selectors used to build a positive per-tile readiness check. A chart holder
# is only "ready" once it shows a terminal state (a rendered chart or an
# error/empty state) -- the mere absence of a `.loading` element is not
# sufficient, since a chart holder that intersects the viewport but hasn't
# mounted anything yet (e.g. its IntersectionObserver callback hasn't fired)
# would otherwise pass vacuously.
# See superset-frontend/src/dashboard/components/gridComponents/ChartHolder/
# ChartHolder.tsx for `data-test="dashboard-component-chart-holder"`,
# superset-frontend/src/components/Chart/Chart.tsx for `.slice_container`
# (rendered chart container, `data-test="slice-container"`) and `.loading`
# (spinner, via the shared Loading component), and
# superset-frontend/packages/superset-ui-core/src/components/EmptyState for
# `.ant-empty` (e.g. "no results"/"add required control values" states).
#
# For diagnostics, each unready holder is additionally classified by *why*
# it isn't ready, distinguishing a slow query from the virtualization race:
#   - "waiting_on_database": `.loading` present with no `.slice_container`
#     -- Chart.tsx's `renderSpinner()` replaces the whole container while
#     the initial query is in flight (`chartStatus === 'loading'`).
#   - "spinner_mounted": `.loading` present *inside* `.slice_container`
#     -- the chart's query finished, but it isn't in the virtualization
#     viewport yet, so `renderChartContainer()` shows a bare spinner instead
#     of the chart.
#   - "nothing_mounted": neither `.loading` nor any ready marker present --
#     the vacuous-pass race this check exists to close.
_UNREADY_CHART_HOLDERS_JS_BODY = """
    const holders = document.querySelectorAll(
        '[data-test="dashboard-component-chart-holder"]'
    );
    const unready = [];
    for (const holder of holders) {
        const r = holder.getBoundingClientRect();
        if (!(r.top < window.innerHeight && r.bottom > 0)) {
            continue;
        }
        const hasSliceContainer = holder.querySelector(
            '[data-test="slice-container"]'
        ) !== null;
        const stillLoading = holder.querySelector('.loading') !== null;
        const isReady = hasSliceContainer || holder.querySelector(
            '[role="alert"], .ant-empty, .missing-chart-container'
        ) !== null;
        if (stillLoading || !isReady) {
            const chartIdEl = holder.querySelector('[data-test-chart-id]');
            let state;
            if (stillLoading && hasSliceContainer) {
                state = 'spinner_mounted';
            } else if (stillLoading) {
                state = 'waiting_on_database';
            } else {
                state = 'nothing_mounted';
            }
            unready.push({
                chartId: chartIdEl
                    ? chartIdEl.getAttribute('data-test-chart-id')
                    : 'unknown',
                state: state,
            });
        }
    }
"""

# Predicate for page.wait_for_function: true once every viewport-visible chart
# holder has reached a terminal state.
_TILE_READY_CHECK_JS = (
    f"() => {{ {_UNREADY_CHART_HOLDERS_JS_BODY} return unready.length === 0; }}"
)

# Diagnostic query for page.evaluate: chart id + state of holders still not
# ready, used to build the timeout log message.
_FIND_UNREADY_CHART_HOLDERS_JS = (
    f"() => {{ {_UNREADY_CHART_HOLDERS_JS_BODY} return unready; }}"
)


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
        logger.exception(f"Failed to combine screenshot tiles: {e}")
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
            f"Dashboard: {dashboard_width}x{dashboard_height}px at "
            f"({dashboard_left}, {dashboard_top})"
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
                    _TILE_READY_CHECK_JS,
                    timeout=load_wait * 1000,
                )
            except PlaywrightTimeout:
                elapsed = time.monotonic() - tile_wait_start
                unready_chart_holders = page.evaluate(_FIND_UNREADY_CHART_HOLDERS_JS)
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

            logger.debug(f"Captured tile {i + 1}/{num_tiles} with clip {clip}")

        # Combine all tiles
        logger.debug("Captured tile %s/%s with clip %s", i + 1, num_tiles, clip)
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
