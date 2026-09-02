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

from superset.utils.report_execution import (
    ReportExecutionBudgetExceededError,
    ReportExecutionContext,
)

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
        // Ready = a settled error/empty/missing state, or a slice container
        // whose ECharts canvas has finished painting. An unpainted ECharts host
        // keeps the holder unready so a blank chart is never captured.
        const isReady = !stillLoading && (
            hasErrorOrEmpty || (hasSliceContainer && !hasUnpaintedEchart)
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
        if (hasSliceContainer && holder.querySelector(
            '{ECHARTS_UNPAINTED_HOST_SELECTOR}'
        ) !== null) {{
            return {{ chartId, state: 'mounted_unpainted' }};
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
        && chart.querySelector('{ECHARTS_UNPAINTED_HOST_SELECTOR}') === null;
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
    if (chart.querySelector('{ECHARTS_UNPAINTED_HOST_SELECTOR}') !== null) {{
        return 'mounted_unpainted';
    }}
    if (chart.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null) {{
        return 'terminal';
    }}
    return 'mounted_pre_terminal';
}}
"""

# Like REPORT_ALL_CHART_HOLDERS_READY_JS, but returns True immediately when
# there are no chart holders (markdown-only dashboards). REPORT_*_READY_JS
# requires holders.length > 0 to distinguish "still loading" from "no charts";
# the print path must never block on an empty dashboard, so the gate is omitted.
# Reuses UNREADY_ALL_CHART_HOLDERS_JS_BODY which already excludes ECharts hosts
# that have not yet fired their ``finished`` event, preventing blank-canvas
# captures on dashboards with ECharts vizzes.
PRINT_ALL_CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_ALL_CHART_HOLDERS_JS_BODY} return unready.length === 0; }}"
)

# When forceRender=true is set on antd/rc-tabs tab items, CSSMotion renders
# inactive panels into the DOM but applies inline style="display:none" on each
# hidden panel node. React inline styles override CSS rules (including
# !important), so a stylesheet fix cannot unhide them. This snippet removes
# the inline display:none from every rc-tabs / ant-tabs content panel so that
# Playwright's page.pdf() — which lays out the full DOM, ignoring the browser
# viewport — captures all tab content. Must be evaluated before the readiness
# wait so that inactive-tab chart holders can mount and reach a terminal state.
UNHIDE_TAB_PANELS_JS = """
() => {
    const selectors = [
        '.rc-tabs-tabpane',
        '.ant-tabs-tabpane',
        '[role="tabpanel"]',
    ];
    let count = 0;
    for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
            if (el.style.display === 'none') {
                el.style.display = '';
                count++;
            }
        }
    }
    return count;
}
"""

# When a Superset table chart has page_length > 0 (client-side pagination),
# react-table's usePagination hook only renders the current page's rows into
# the DOM — rows on other pages are simply absent.  Expanding the scroll
# container reveals only the rows already present (the current page), so a
# 100-row table with page_length=10 would still show only 10 rows in the PDF.
#
# Fix: before expanding containers, find every paginated table and trigger a
# page-size change to 0 (= "All rows") via React's internal fiber, which
# causes react-table to re-render with every row visible.
#
# Server-side paginated tables (serverPagination=true) cannot be expanded
# this way — only the rows fetched for the current page exist in memory.
# Those are logged as a warning; operators should configure server-paginated
# tables with a large page size for dashboards intended for PDF export.
#
# This snippet must be evaluated AFTER chart holders are ready (so the
# react-table instance exists) and BEFORE EXPAND_TABLE_CONTAINERS_JS (so
# the newly rendered rows are present when container heights are released).
# After calling it, wait ~500 ms for React to complete the re-render before
# calling EXPAND_TABLE_CONTAINERS_JS.
SHOW_ALL_TABLE_ROWS_JS = """
() => {
    // Resolve an antd Select component's onChange handler from its React fiber.
    // antd v5/v6 stores the fiber on the DOM node as __reactFiber$<hash>.
    function getReactFiber(el) {
        const key = Object.keys(el).find(
            k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
        );
        return key ? el[key] : null;
    }

    // Walk up a React fiber tree to find a fiber with a given prop key.
    function findFiberWithProp(fiber, propName) {
        let f = fiber;
        let depth = 0;
        while (f && depth < 40) {
            if (f.memoizedProps && propName in f.memoizedProps) return f;
            f = f.return;
            depth++;
        }
        return null;
    }

    const results = { clientExpanded: 0, serverWarning: 0, alreadyAll: 0 };

    // Each .superset-chart-table is a client-side table.
    // Each [data-test-viz-type="table"] wraps the whole TableChart component.
    const vizSel = '[data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';
    for (const vizRoot of document.querySelectorAll(vizSel)) {

        // Detect server-side pagination: a server-paginated table has no
        // .dt-select-page-size (it uses a different UI) and its wrapper has a
        // data attribute indicating server mode.
        const isServerPaginated = vizRoot.querySelector(
            '[data-test="dt-select-page-size-wrapper"] .ant-select') === null
            && vizRoot.querySelector('.dt-pagination') !== null;
        // More reliable: check the pageSizeSelect antd dropdown
        const pageSizeSelect = vizRoot.querySelector(
            '.dt-select-page-size .ant-select');

        if (!pageSizeSelect) {
            // No page-size selector: either already showing all rows (pageSize=0
            // means no pagination — hasPagination is false) or server-paginated.
            const hasPaginationEl = vizRoot.querySelector('.dt-pagination');
            if (hasPaginationEl && isServerPaginated) {
                results.serverWarning++;
            } else {
                results.alreadyAll++;
            }
            continue;
        }

        // Get the current selected value from the antd Select.
        const selectValueEl = pageSizeSelect.querySelector(
            '.ant-select-selection-item');
        const currentText = selectValueEl ? selectValueEl.textContent.trim() : '';
        // "All" / "all" means pageSize=0 (already showing everything).
        if (currentText.toLowerCase() === 'all'
                || currentText === '0'
                || currentText === '') {
            results.alreadyAll++;
            continue;
        }

        // Find the antd Select's React onChange handler by walking the fiber.
        const fiber = getReactFiber(pageSizeSelect);
        if (!fiber) { results.alreadyAll++; continue; }

        // antd Select renders a div.ant-select; the onChange prop is on an
        // ancestor InternalSelect fiber.
        const selectorFiber = findFiberWithProp(fiber, 'onChange');
        if (!selectorFiber) { results.alreadyAll++; continue; }

        const onChange = selectorFiber.memoizedProps.onChange;
        if (typeof onChange !== 'function') { results.alreadyAll++; continue; }

        // Trigger pageSize = 0 (the "All rows" option value in PAGE_SIZE_OPTIONS).
        try {
            onChange(0);
            results.clientExpanded++;
        } catch (e) {
            // Ignore errors — fall through to container expansion with
            // whatever rows are currently visible.
        }
    }

    return results;
}
"""

# The Superset table viz renders all rows into the DOM but wraps them in a
# fixed-height scroll container with an inline style such as:
#   style="height: 828px; overflow: auto; width: 1496px; ..."
# page.pdf() lays out the full DOM but the scroll container clips content to
# its inline height before the print engine sees it.  This snippet removes
# the height and overflow constraints from those inline-styled scroll divs
# so all rows flow into the print output.  It must be evaluated after the
# readiness wait (so the chart has finished rendering and populated the DOM)
# and immediately before page.pdf().
#
# Also clears inline width constraints on scroll containers so wide tables
# (with many columns) are not clipped horizontally in the PDF.
EXPAND_TABLE_CONTAINERS_JS = """
() => {
    let count = 0;
    const sel = '.superset-chart-table,'
        + ' [data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';

    // Fully unconstrain an element: clear inline height/overflow, set min-height:0.
    // Setting height:'auto' + min-height:'0' on a flex child is not enough to make
    // it grow past an explicit height in the Chromium PDF layout engine.  The safe
    // approach is to also force display:'block' on flex containers in the chain so
    // their children are in normal block flow (which DOES grow with content).
    function releaseEl(el) {
        if (!el || !el.style) return;
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.minHeight = '0';
        el.style.overflow = 'visible';
        el.style.overflowY = 'visible';
        el.style.overflowX = 'visible';
    }

    const roots = document.querySelectorAll(sel);
    for (const root of roots) {
        // 1. Expand every height/overflow/width-constrained div inside the
        //    table viz.  The table plugin wraps rows in inline styles such as:
        //      style="height:Xpx; overflow:auto; width:Ypx"
        //    Clearing height, overflow AND width is necessary because:
        //    - The body-scroll div clips rows via height+overflow.
        //    - The header-sizer div (parent of the sticky <thead> table) carries
        //      a fixed pixel width (e.g. width:308px) that collapses the visible
        //      column count. It may have overflow:hidden, overflow:auto, OR no
        //      overflow set at all — so the fix must not require an overflow
        //      precondition; any inline pixel width inside the table root is
        //      freed unconditionally.
        for (const el of root.querySelectorAll('div[style]')) {
            const s = el.style;
            const hasHeight = s.height && s.height !== '' && s.height !== 'auto';
            // Any explicit pixel width on a div inside the table root must be
            // released — the header-sizer chain (depth 0-2 of the useSticky
            // structure) carries width:Xpx inline with no overflow constraint.
            const hasInlineWidth = s.width && s.width !== '' && s.width !== '100%'
                && s.width !== 'auto' && /px$/.test(s.width);
            if (hasHeight) {
                s.height = 'auto';
                s.maxHeight = 'none';
                s.overflow = 'visible';
                s.overflowY = 'visible';
                s.overflowX = 'visible';
                count++;
            }
            if (hasInlineWidth) {
                s.width = '100%';
                s.maxWidth = 'none';
                s.overflow = 'visible';
                s.overflowX = 'visible';
            }
        }

        // 2. Walk the ancestor chain up to .grid-content, unconditionally
        //    release every element, and switch flex containers to block layout.
        //
        //    Why block? In a flex container the children's heights ARE constrained
        //    by the flex algorithm even after clearing inline style.height — the
        //    flex engine re-computes from the stretch alignment default.  Converting
        //    to display:block makes every child a normal block box whose height is
        //    determined purely by its content, which is what we need for tables that
        //    have more rows than the authored grid height.
        //
        //    The conversion is limited to flex ancestors that are INSIDE the table's
        //    own column — we track .grid-row and .dragdroppable-row for step 3.
        let gridRow = null;
        let dragRow = null;
        let el = root.parentElement;
        while (el) {
            if (el.classList.contains('dashboard-grid') ||
                el.classList.contains('grid-content')) {
                break;
            }
            if (el.classList.contains('grid-row')) {
                gridRow = el;
            }
            if (el.classList.contains('dragdroppable-row')) {
                dragRow = el;
            }
            releaseEl(el);
            // Switch any flex container to block so children are in normal flow.
            const disp = getComputedStyle(el).display;
            if (disp === 'flex' || disp === 'inline-flex') {
                el.style.display = 'block';
            }
            el = el.parentElement;
        }

        // 3. Release height on ALL sibling .dragdroppable-column wrappers in
        //    the same .grid-row (now a block container).  Each column is a
        //    block-level box; any inline height left on the column div itself
        //    would clip it.
        //
        //    IMPORTANT: do NOT release the .resizable-container height inside
        //    non-table columns.  Canvas/SVG charts (maps, ECharts) measure their
        //    container height at render time; setting height:auto collapses the
        //    container to 0px and the chart renders blank.  Only the column
        //    wrapper needs height:auto — the resizable-container inside each
        //    non-table column keeps its authored pixel height so charts draw at
        //    full resolution.  The table column's resizable-container is already
        //    handled by the ancestor walk-up in step 2.
        if (gridRow) {
            for (const col of gridRow.querySelectorAll(
                    ':scope > .dragdroppable-column')) {
                const colHasTable = !!col.querySelector(
                    '.superset-chart-table, [data-test-viz-type="table"]');
                // Always release the column wrapper itself.
                releaseEl(col);
                if (colHasTable) {
                    // Table column: also release the resizable-container and
                    // every inner scroll div so all rows are visible.
                    const rc = col.querySelector(':scope > .resizable-container');
                    if (rc) releaseEl(rc);
                }
                // Non-table columns: leave .resizable-container height intact
                // so canvas/SVG charts render at their authored size.
            }
        }

        // 4. Also release the .dragdroppable-row wrapper and switch it to block.
        //    re-resizable sets an inline style.height on this element; without
        //    clearing it the row clips at the authored height and the next row
        //    starts at the wrong position.
        if (dragRow) {
            releaseEl(dragRow);
            const disp = getComputedStyle(dragRow).display;
            if (disp === 'flex' || disp === 'inline-flex') {
                dragRow.style.display = 'block';
            }
        }
    }
    return count;
}
"""

# In print mode, antd v6 with tabPane animation disabled (tabPane:false in
# animated prop) does not mount inactive tab content even with forceRender:true
# in the items array.  The only reliable fix is to navigate to each tab's
# content using a URL hash fragment (Superset resolves #TAB-ID to that tab),
# wait for its charts to render, capture a sub-PDF, and merge all sub-PDFs.
#
# This JS returns the IDs of all tab content nodes from .dashboard-component-tabs
# elements, extracted from the React component's data attributes or from the
# tab label data-node-key attributes.  Returns [] if no tabs are present.
EXTRACT_TAB_HASH_IDS_JS = """
() => {
    // antd nav tabs: each nav item has a data-node-key attribute set by
    // the rc-tabs DraggableTabNode wrapper.  In standalone mode the tab
    // nav bar is NOT rendered, so we fall back to reading the tab IDs from
    // the aria-controls attributes on any rendered tab buttons, or from
    // Superset's own data attributes on the tabs wrapper.
    //
    // Primary: .ant-tabs-tab[data-node-key] (present when tab bar renders)
    const navItems = document.querySelectorAll('.ant-tabs-tab[data-node-key]');
    if (navItems.length > 0) {
        return Array.from(navItems).map(n => n.getAttribute('data-node-key'));
    }
    // Fallback: .dashboard-component-tabs stores the superset component ID
    // on the wrapper.  The children of the antd Tabs are the DashboardComponent
    // items for each tab — look for their data-test or id attributes.
    const tabsWrapper = document.querySelector(
        '[data-test="dashboard-component-tabs"]');
    if (!tabsWrapper) return [];
    // The active tab's key is set as the activeKey on the antd Tabs element,
    // exposed via aria-selected on the active nav button — but nav is hidden.
    // Return empty to signal "no clickable tabs; use per-hash navigation".
    return [];
}
"""

# Returns the number of navigable tab buttons (when nav bar is visible).
# In standalone/report mode this is always 0 because antd hides the nav bar.
COUNT_TAB_BUTTONS_JS = """
() => {
    return document.querySelectorAll('.ant-tabs-tab').length;
}
"""

# Reveal all tab panels at once after per-tab navigation has mounted every
# tab's charts.  antd v6 hides non-active pane content via display:none on
# the pane wrapper (.ant-tabs-tabpane) or inline style on .ant-tabs-content
# children.
SHOW_ALL_TAB_PANELS_JS = """
() => {
    let shown = 0;
    const content = document.querySelector('.ant-tabs-content');
    if (content) {
        for (const child of content.children) {
            if (child.style.display === 'none') {
                child.style.removeProperty('display');
                shown++;
            }
        }
    }
    for (const el of document.querySelectorAll(
        '[role="tabpanel"], .ant-tabs-tabpane'
    )) {
        if (el.style.display === 'none') {
            el.style.removeProperty('display');
            shown++;
        }
    }
    return shown;
}
"""

# In 2-column print layout (?print_layout=2col), charts that were originally
# side-by-side in the dashboard should be restored to that layout instead of
# being stacked single-column.
#
# Confirmed DOM structure (live inspection):
#   .grid-content
#     .dragdroppable-row           ← one row per original dashboard row
#       .with-popover-menu
#         .grid-row                ← flex row containing sibling columns
#           .dragdroppable-column  ← one per chart in the row
#             .resizable-container ← inline style.width holds authored px width
#
# Each .grid-row may contain multiple .dragdroppable-column siblings.
# Rows with 2 or 3 columns where no single column dominates the full row
# (ratio < 0.90 of viewport) are candidates for the multi-column layout.
# Table charts are always forced full-width (kept single-column).
#
# Width normalisation: the authored px widths are used as flex-grow weights
# so they always fill the full row width regardless of whether the authored
# widths sum to exactly 100% of the viewport.
#
# Width source: .resizable-container ':scope > .resizable-container' inline
# style.width — re-resizable writes it at mount time, preserved even when
# CSS forces width: 100% !important on the rendered element.
# Denominator: viewport width (window.innerWidth = 1600px at print time).
#   4/12-col: ~380px / 1600px = 23.7%
#   6/12-col: ~776px / 1600px = 48.5%
#   full:    ~1568px / 1600px = 98%  ← blocked by >= 0.90 gate
ANNOTATE_PRINT_COLUMNS_JS = """
() => {
    let annotated = 0;
    const viewportWidth = window.innerWidth || 1600;

    for (const gridRow of document.querySelectorAll('.grid-row')) {
        const cols = Array.from(
            gridRow.querySelectorAll(':scope > .dragdroppable-column'));
        // Support 2 or 3-column rows.  1-column rows are already full-width.
        // 4+ column rows are rare and have very narrow charts — skip them.
        if (cols.length < 2 || cols.length > 3) continue;

        // Gather column data and apply eligibility checks:
        //   - no table chart (tables stay full-width for readability)
        //   - rcW measurable (markdown / dividers have no .resizable-container)
        //   - no single column is >= 90% of viewport (genuinely full-width chart)
        let eligible = true;
        const colData = cols.map(col => {
            const rc = col.querySelector(':scope > .resizable-container');
            const rcW = rc ? parseFloat(rc.style.width) : 0;
            const ratio = rcW / viewportWidth;
            const hasTable = col.querySelector(
                '.superset-chart-table, [data-test-viz-type="table"]'
            ) !== null;
            // A column with no measured width (markdown, divider) or a
            // single chart that nearly fills the full viewport width on its
            // own should keep the row in single-column mode.
            if (hasTable || rcW <= 0 || ratio >= 0.90) eligible = false;
            return { col, rcW, ratio };
        });

        if (!eligible) continue;

        // Mark the .grid-row so the CSS knows to restore flex-direction: row.
        gridRow.setAttribute('data-print-2col', 'true');

        // Compute the total authored width across all columns so we can
        // assign each column a flex-grow weight proportional to its original
        // size.  This normalises the columns to fill 100% of the row even
        // when the authored widths don't exactly sum to the viewport width
        // (e.g. 776+380 = 1156px, not 1568px).
        const totalW = colData.reduce((s, d) => s + d.rcW, 0);

        for (const { col, rcW } of colData) {
            // flex-grow weight: proportional share of the total row width.
            const weight = (rcW / totalW * 100).toFixed(3);
            col.setAttribute('data-print-col-weight', weight);
            col.style.setProperty('--print-col-weight', weight);
            annotated++;
        }
    }
    return annotated;
}
"""

# Big Number charts set font-size directly as an inline style attribute
# (e.g. style="font-size: 32px; ...") via React.  CSS !important cannot
# override inline styles, so the font-size tier for big numbers must be
# applied by directly mutating the inline style before page.pdf() is called.
#
# This JS function accepts a target font-size in pixels (as a number) and
# patches every .header-line element's inline style to use that value.
#
# big_number_px reference values (CSS px, rendered at 1600px viewport,
# then scaled × 0.496 to A4 paper width):
#   small  → 48px CSS  ≈ ~9pt on paper
#   medium → 72px CSS  ≈ ~14pt on paper
#   large  → 108px CSS ≈ ~21pt on paper
SET_PRINT_FONT_SIZE_JS = """
(px) => {
    let count = 0;
    for (const el of document.querySelectorAll('.header-line')) {
        // Preserve all other inline properties; only override font-size.
        el.style.fontSize = px + 'px';
        count++;
    }
    return count;
}
"""


# Measures the actual rendered width of every column in every Superset table
# chart on the page.  Must be called AFTER all chart holders have reached a
# terminal state (so the table component has mounted and useSticky's
# useLayoutEffect has already fired) and AFTER EXPAND_TABLE_CONTAINERS_JS
# (so inline width constraints on the scroll container have been released).
#
# Uses th.getBoundingClientRect().width (same as Superset's useSticky hook)
# with a fallback to th.clientWidth for degenerate cases.  Returns an array
# of per-table objects:
#   { tableIndex, totalWidth, colWidths: number[] }
# where tableIndex is the ordinal position of the viz root among all matching
# roots on the page (one entry per viz root, not per <table> element).
#
# IMPORTANT — Superset's useSticky hook renders TWO <table> elements per viz:
#   table[0]: sticky header sizer — has <thead> with all column <th>s, NO <tbody>
#   table[1]: scrollable body — has <tbody> with all data rows, NO <thead>
# Column widths must be read from table[0]'s <thead>, but row count comes from
# table[1]'s <tbody>.  root.querySelector('table') always returns table[0].
#
# This measurement array is passed unchanged to BAND_TABLE_COLUMNS_JS so
# the two operations share one DOM-measurement pass.
MEASURE_TABLE_COLUMNS_JS = """
() => {
    const sel = '.superset-chart-table,'
        + ' [data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';

    const results = [];
    let tableIndex = 0;

    for (const root of document.querySelectorAll(sel)) {
        // Find the sticky header table (first <table> with a <thead>).
        // useSticky renders table[0]=header-sizer (thead, no tbody) and
        // table[1]=body-scroll (tbody, no thead).  querySelector('table')
        // always returns table[0] — the correct source for column widths.
        const headerTable = root.querySelector('table');
        if (!headerTable) { tableIndex++; continue; }

        const thead = headerTable.querySelector('thead');
        if (!thead) { tableIndex++; continue; }

        // Use the last header row — Superset supports multi-level headers
        // and the last row has the leaf (most detailed) column set.
        const headerRows = Array.from(thead.querySelectorAll('tr'));
        const headerRow = headerRows[headerRows.length - 1] || null;
        if (!headerRow) { tableIndex++; continue; }

        const ths = Array.from(headerRow.querySelectorAll('th'));
        if (ths.length === 0) { tableIndex++; continue; }

        const colWidths = ths.map(th => {
            const r = th.getBoundingClientRect();
            return (r && r.width > 0) ? r.width : (th.clientWidth || 0);
        });
        const totalWidth = colWidths.reduce((s, w) => s + w, 0);

        results.push({
            tableIndex,
            totalWidth,
            colWidths,
        });
        tableIndex++;
    }
    return results;
}
"""

# Column-banding for tables with many columns that exceed the usable page width.
#
# Called AFTER MEASURE_TABLE_COLUMNS_JS (measurement pass) and AFTER
# EXPAND_TABLE_CONTAINERS_JS, and BEFORE SCALE_WIDE_TABLES_JS so that
# already-banded tables (each band ≤ usableWidth) are not unnecessarily scaled.
#
# Accepts an options object:
#   {
#     usableWidth:  number,   // CSS px available for table content on one page
#     keyColCount:  number,   // leftmost N columns repeated in every band (default 1)
#     measurements: array,    // result of MEASURE_TABLE_COLUMNS_JS
#   }
#
# IMPORTANT — Superset's useSticky hook renders TWO <table> elements per viz
# root (confirmed via live DOM inspection):
#   table[0]: sticky-header sizer — has <thead> with all column <th>s, NO <tbody>
#   table[1]: scrollable body     — has <tbody> with all data rows,   NO <thead>
# The banding algorithm must:
#   - Read column widths from table[0]'s <thead> (MEASURE_TABLE_COLUMNS_JS does this)
#   - Read and clone body rows from table[1]'s <tbody>
#   - Reconstruct each band as a standalone <table> that has BOTH a <thead>
#     (key + band column headers from table[0]) and a <tbody> (data rows from
#     table[1]) so the output is a complete, readable table, not just a header row.
#   - Leave table[0] and table[1] in place if ≤ 1 band results (table fits or
#     only slightly overflows — leave SCALE_WIDE_TABLES_JS to handle it).
#
# Only fires when the greedy pack produces ≥ 2 bands (i.e. the table is
# genuinely too wide to fit on one page).  Tables that are slightly wider
# than usableWidth but fit in 1 band are left unmodified for SCALE_WIDE_TABLES_JS.
#
# Returns:
#   { banded, situation_b_wrap, situation_b_rotate, situation_b_truncate,
#     situation_b_pullout }
BAND_TABLE_COLUMNS_JS = """
(opts) => {
    const usableWidth   = opts.usableWidth   || (window.innerWidth - 24);
    const keyColCount   = opts.keyColCount   || 1;
    const measurements  = opts.measurements  || [];

    const counts = {
        banded: 0,
        situation_b_wrap: 0,
        situation_b_rotate: 0,
        situation_b_truncate: 0,
        situation_b_pullout: 0,
    };

    const sel = '.superset-chart-table,'
        + ' [data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';
    const allRoots = Array.from(document.querySelectorAll(sel));

    measurements.forEach(function(m) {
        const root = allRoots[m.tableIndex];
        if (!root) return;

        // useSticky renders two <table> elements per viz root:
        //   headerTable (index 0): <thead> with all <th>s, no <tbody>
        //   bodyTable   (index 1): <tbody> with all data rows, no <thead>
        // We need both: headers from headerTable, body rows from bodyTable.
        const allTables = Array.from(root.querySelectorAll('table'));
        const headerTable = allTables.find(function(t) {
            return t.querySelector('thead') !== null;
        });
        const bodyTable = allTables.find(function(t) {
            return t.querySelector('tbody') !== null
                && t.querySelector('thead') === null;
        }) || allTables.find(function(t) {
            return t.querySelector('tbody') !== null;
        });
        if (!headerTable || !bodyTable) return;

        const thead = headerTable.querySelector('thead');
        if (!thead) return;

        // -----------------------------------------------------------------
        // Build a live column-widths array (re-measure after any mutations).
        // Reads from the header table's <thead>.
        // -----------------------------------------------------------------
        function getColWidths() {
            const rows = Array.from(thead.querySelectorAll('tr'));
            const hr = rows[rows.length - 1];
            if (!hr) return [];
            return Array.from(hr.querySelectorAll('th')).map(function(th) {
                const r = th.getBoundingClientRect();
                return (r && r.width > 0) ? r.width : (th.clientWidth || 0);
            });
        }

        // Collect all <tbody> data rows from the body table.
        function getBodyRows() {
            const tbody = bodyTable.querySelector('tbody');
            return tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        }

        // -----------------------------------------------------------------
        // Situation B: handle columns too wide to fit alone on a page.
        // Applied before banding so the banding algorithm sees corrected widths.
        // Mutations to <td> cells target the body table rows.
        // Mutations to <th> headers target the header table.
        // -----------------------------------------------------------------
        const keyW = getColWidths().slice(0, keyColCount)
            .reduce(function(s, w) { return s + w; }, 0);
        const slotW = usableWidth - keyW;
        const bodyRows = getBodyRows();

        let colWidths = getColWidths();
        const nCols = colWidths.length;

        const pulledOutIndices = new Set();

        for (let ci = keyColCount; ci < nCols; ci++) {
            if (colWidths[ci] <= slotW) continue;

            // --- Step a: text-wrap on body rows ---
            for (const row of bodyRows) {
                const cell = row.querySelectorAll('td')[ci];
                if (cell) {
                    cell.style.whiteSpace = 'normal';
                    cell.style.overflowWrap = 'break-word';
                }
            }
            counts.situation_b_wrap++;
            colWidths = getColWidths();
            if (colWidths[ci] <= slotW) continue;

            // --- Step b: header rotation on header table <th> ---
            const headerRows3 = Array.from(thead.querySelectorAll('tr'));
            const hr3 = headerRows3[headerRows3.length - 1];
            const th3 = hr3 ? hr3.querySelectorAll('th')[ci] : null;
            if (th3) {
                const headerText = (th3.textContent || '').trim();
                let totalCellLen = 0, sampleCount = 0;
                for (let ri = 0; ri < Math.min(bodyRows.length, 20); ri++) {
                    const cell = bodyRows[ri].querySelectorAll('td')[ci];
                    if (cell) {
                        totalCellLen += (cell.textContent || '').trim().length;
                        sampleCount++;
                    }
                }
                const avgCellLen = sampleCount > 0 ? totalCellLen / sampleCount : 0;
                if (headerText.length > avgCellLen * 2) {
                    th3.style.writingMode = 'vertical-lr';
                    th3.style.transform = 'rotate(180deg)';
                    th3.style.maxHeight = '80px';
                    th3.style.whiteSpace = 'nowrap';
                    counts.situation_b_rotate++;
                    colWidths = getColWidths();
                    if (colWidths[ci] <= slotW) continue;
                }
            }

            // --- Step c: truncate with visible marker ---
            const truncW = Math.floor(slotW);
            for (const row of bodyRows) {
                const cell = row.querySelectorAll('td')[ci];
                if (cell) {
                    cell.style.maxWidth = truncW + 'px';
                    cell.style.overflow = 'hidden';
                    cell.style.textOverflow = 'ellipsis';
                    cell.style.whiteSpace = 'nowrap';
                }
            }
            counts.situation_b_truncate++;

            // Append a truncation note below both tables.
            const headerRows4 = Array.from(thead.querySelectorAll('tr'));
            const hr4 = headerRows4[headerRows4.length - 1];
            const th4 = hr4 ? hr4.querySelectorAll('th')[ci] : null;
            const colName = th4 ? (th4.textContent || '').trim() : ('column ' + ci);
            const noteEl = document.createElement('div');
            noteEl.className = 'print-truncation-note';
            noteEl.style.cssText = 'font-size:11px;color:#57606a;margin:4px 0 8px;'
                + 'font-style:italic;';
            noteEl.textContent = 'Some fields in column \u201c'
                + colName + '\u201d were abbreviated due to page width constraints.';
            // Insert after the body table's scroll container.
            const bodyContainer = bodyTable.parentElement;
            if (bodyContainer && bodyContainer.parentNode) {
                bodyContainer.parentNode.insertBefore(
                    noteEl, bodyContainer.nextSibling);
            }

            colWidths = getColWidths();
            if (colWidths[ci] <= slotW) continue;

            // --- Step d: pull out as a labeled section ---
            if (colWidths[ci] > usableWidth / 2) {
                const dl = document.createElement('dl');
                dl.className = 'print-col-pullout';
                dl.style.cssText = 'margin:8px 0 16px;padding:0;font-size:13px;'
                    + 'border-top:1px solid #e5e7eb;';
                const labelEl = document.createElement('div');
                labelEl.style.cssText = 'font-weight:700;margin:4px 0;font-size:12px;'
                    + 'color:#57606a;';
                const hr5 = Array.from(thead.querySelectorAll('tr')).pop();
                const th5 = hr5 ? hr5.querySelectorAll('th')[ci] : null;
                labelEl.textContent = (th5 ? (th5.textContent || '').trim()
                    : ('Column ' + ci)) + ':';
                dl.appendChild(labelEl);
                for (let ri = 0; ri < bodyRows.length; ri++) {
                    const cell = bodyRows[ri].querySelectorAll('td')[ci];
                    if (!cell) continue;
                    const keyCell = bodyRows[ri].querySelectorAll('td')[0];
                    const keyText = keyCell
                        ? ('[' + (keyCell.textContent || '').trim() + '] ') : '';
                    const dd = document.createElement('dd');
                    dd.style.cssText = 'margin:0 0 4px 12px;padding:2px 0;'
                        + 'border-bottom:1px solid #f0f0f0;word-break:break-word;';
                    dd.textContent = keyText + (cell.textContent || '').trim();
                    dl.appendChild(dd);
                    cell.style.display = 'none';
                }
                if (th5) th5.style.display = 'none';
                const insertAfter = noteEl.parentNode ? noteEl : bodyContainer;
                if (insertAfter && insertAfter.parentNode) {
                    insertAfter.parentNode.insertBefore(dl, insertAfter.nextSibling);
                }
                pulledOutIndices.add(ci);
                counts.situation_b_pullout++;
            }
        } // end Situation B

        // -----------------------------------------------------------------
        // Column banding: greedy pack into page-width bands.
        // Only fires when ≥ 2 bands result (table genuinely too wide for 1 page).
        // Tables that are slightly wider than usableWidth (1 band) are left
        // alone — SCALE_WIDE_TABLES_JS handles those with a scale transform.
        // -----------------------------------------------------------------
        colWidths = getColWidths();
        const totalW = colWidths.reduce(function(s, w) { return s + w; }, 0);
        if (totalW <= usableWidth) return; // fits — done

        const keyIndices = [];
        for (let i = 0; i < Math.min(keyColCount, nCols); i++) keyIndices.push(i);
        const keyTotalW = keyIndices.reduce(function(s, i) {
            return s + (colWidths[i] || 0);
        }, 0);
        const bandSlotW = usableWidth - keyTotalW;

        const bands = [];
        let currentBand = [], currentW = 0;
        for (let ci2 = keyColCount; ci2 < nCols; ci2++) {
            if (pulledOutIndices.has(ci2)) continue;
            const w = colWidths[ci2] || 0;
            if (currentBand.length > 0 && currentW + w > bandSlotW) {
                bands.push(currentBand);
                currentBand = [];
                currentW = 0;
            }
            currentBand.push(ci2);
            currentW += w;
        }
        if (currentBand.length > 0) bands.push(currentBand);

        // Only band if ≥ 2 bands result.  A single band means all remaining
        // columns fit in one page after key cols — leave SCALE_WIDE_TABLES_JS
        // to shrink the slight overflow with a CSS transform.
        if (bands.length <= 1) return;

        // Build one complete standalone <table> per band.
        // Each band table has a <thead> (from headerTable) + a <tbody>
        // (from bodyTable) with only key + band column indices.
        function buildBandTable(colIndices) {
            const tbl = document.createElement('table');
            // Copy table classes for styling.
            tbl.className = headerTable.className;

            // --- <colgroup> ---
            const origColgroup = headerTable.querySelector('colgroup');
            if (origColgroup) {
                const cg = origColgroup.cloneNode(false);
                const origCols = Array.from(origColgroup.querySelectorAll('col'));
                colIndices.forEach(function(ci3) {
                    if (origCols[ci3]) cg.appendChild(origCols[ci3].cloneNode(true));
                });
                tbl.appendChild(cg);
            }

            // --- <thead> (key + band column headers) ---
            const newThead = document.createElement('thead');
            const origHeaderRows = Array.from(thead.querySelectorAll('tr'));
            origHeaderRows.forEach(function(origTr) {
                const newTr = document.createElement('tr');
                const origThs = Array.from(origTr.querySelectorAll('th'));
                colIndices.forEach(function(ci3) {
                    if (origThs[ci3]) {
                        newTr.appendChild(origThs[ci3].cloneNode(true));
                    }
                });
                newThead.appendChild(newTr);
            });
            tbl.appendChild(newThead);

            // --- <tbody> (data rows with only key + band column cells) ---
            const newTbody = document.createElement('tbody');
            const allBodyTrs = getBodyRows();
            allBodyTrs.forEach(function(origTr) {
                const newTr = document.createElement('tr');
                // Copy row-level classes (e.g. stripe).
                newTr.className = origTr.className;
                const origTds = Array.from(origTr.querySelectorAll('td'));
                colIndices.forEach(function(ci3) {
                    if (origTds[ci3]) {
                        newTr.appendChild(origTds[ci3].cloneNode(true));
                    } else {
                        newTr.appendChild(document.createElement('td'));
                    }
                });
                newTbody.appendChild(newTr);
            });
            tbl.appendChild(newTbody);

            return tbl;
        }

        // Find the outermost scroll-wrapper that encloses BOTH tables.
        // useSticky wraps headerTable and bodyTable inside sibling divs that
        // are both children of a common container.  Walk up from bodyTable
        // until we reach a node whose parent is outside the viz root.
        let outerContainer = bodyTable.parentElement;
        while (outerContainer && outerContainer !== root
               && outerContainer.parentElement
               && outerContainer.parentElement !== root
               && !outerContainer.parentElement.classList.contains('grid-content')) {
            outerContainer = outerContainer.parentElement;
        }
        if (!outerContainer || outerContainer === root) {
            // Safety fallback: use the body table's direct parent.
            outerContainer = bodyTable.parentElement;
        }

        const bandNodes = bands.map(function(bandCols, bandIdx) {
            const colIndices = keyIndices.concat(bandCols);
            const tbl = buildBandTable(colIndices);
            // Wrap in .superset-chart-table so the font-tier CSS rules
            // (.superset-chart-table td/th font-size !important) apply to
            // the cloned band cells, which sit outside the original viz root.
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'superset-chart-table';
            tableWrapper.style.cssText = 'overflow:visible;';
            tableWrapper.appendChild(tbl);
            const wrapper = document.createElement('div');
            wrapper.className = 'print-col-band';
            wrapper.style.cssText = 'width:100%;overflow:visible;';
            if (bandIdx > 0) {
                wrapper.style.pageBreakBefore = 'always';
                wrapper.style.breakBefore = 'page';
                wrapper.style.paddingTop = '8px';
            }
            wrapper.appendChild(tableWrapper);
            return wrapper;
        });

        // Insert band nodes after outerContainer, then remove the original.
        let insertRef = outerContainer;
        const parentOfOuter = outerContainer.parentNode;
        if (!parentOfOuter) return;
        for (const bandNode of bandNodes) {
            parentOfOuter.insertBefore(bandNode, insertRef.nextSibling);
            insertRef = bandNode;
        }
        outerContainer.remove();

        counts.banded++;
    }); // end forEach measurement

    return counts;
}
"""


# For tables with many columns the natural <table> scrollWidth can exceed the
# 1600 px print viewport width and overflow the right edge of the A4 PDF.
#
# Root-cause: The Superset table plugin wraps <table> in a div with an inline
# style="overflow:hidden; width:1496px; box-sizing:border-box".  That container
# clips the table to 1496px.  Applying a CSS transform to the inner <table>
# alone does nothing visible — the parent's overflow:hidden clips the result
# before the PDF engine sees it.
#
# Fix: identify that scroll-container div (direct parent of <table>) and apply
# the scale transform to IT after widening it to the table's natural scrollWidth
# so the full table is visible before scaling.  Then set the scroll-container's
# height to tableH * scaleFactor so subsequent rows start at the correct
# position, and clear overflow from ALL ancestors up to .superset-chart-table
# so nothing clips the down-scaled element.
#
# When `markLandscape` is true (auto-orientation mode), each wide-table root
# element also receives data-print-landscape="true" so the CSS @page
# print-landscape rule (injected by getPrintOrientationCSS) fires for that
# element's page break, rotating that page to landscape instead of shrinking.
# In this mode the scale transform is still applied as a fallback for tables
# that remain too wide even in landscape.
#
# Must be called AFTER EXPAND_TABLE_CONTAINERS_JS (table has final dimensions)
# and BEFORE page.pdf().  Tables that fit naturally are left unmodified.
SCALE_WIDE_TABLES_JS = """
(markLandscape) => {
    const viewport = window.innerWidth || 1600;
    // Leave a small gutter so the table doesn't butt against the right margin.
    const maxWidth = viewport - 24;
    // In landscape mode A4 is ~297mm wide = ~1122 CSS px at 96dpi × (1600/794)
    // at our print scale.  Using 1.414 (A4 ratio) as the landscape multiplier.
    const landscapeMaxWidth = maxWidth * 1.414;
    // Allow a 10% tolerance before triggering the scale transform.
    // A table that is only slightly wider than the usable width (e.g. due to
    // larger font-size cells expanding column widths by a few percent) should
    // NOT be scaled back down — that would visually cancel the font enlargement.
    // Only apply scale when the table genuinely overflows by more than 10%.
    const scaleTolerance = maxWidth * 1.10;
    const landscapeScaleTolerance = landscapeMaxWidth * 1.10;
    let scaled = 0;
    let marked = 0;

    const sel = '.superset-chart-table,'
        + ' [data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';

    for (const root of document.querySelectorAll(sel)) {
        // The inner <table> carries the natural column widths.
        const tableEl = root.querySelector('table');
        if (!tableEl) continue;

        const tableW = tableEl.scrollWidth;
        if (tableW <= scaleTolerance) {
            // Fits in portrait — no action needed.
            continue;
        }

        // Table is too wide for portrait.
        // In auto-landscape mode, mark this element for a landscape page break
        // and only apply the scale transform if the table is still wider than
        // the landscape width (very extreme: > ~1.41× the viewport width).
        if (markLandscape) {
            root.setAttribute('data-print-landscape', 'true');
            marked++;
            if (tableW <= landscapeScaleTolerance) {
                // Fits in landscape (within tolerance) — don't shrink it further.
                continue;
            }
        }

        // The direct parent of <table> is the scroll container the Superset
        // table plugin sets with style="overflow:hidden; width:Xpx".
        // We must scale THIS container, not the <table> inside it, because
        // the container's overflow:hidden clips the table's rendered output
        // before Chromium's PDF engine can see the full width.
        const container = tableEl.parentElement;
        if (!container) continue;

        // In landscape mode use the wider maxWidth for scale calculation.
        const effectiveMax = markLandscape ? landscapeMaxWidth : maxWidth;
        const scaleFactor = effectiveMax / tableW;

        // 1. Widen the container to the table's natural scrollWidth so the
        //    full table is laid out inside it before the scale is applied.
        //    Do this FIRST so the container reflows to its new width before
        //    we measure its height (scrollHeight depends on width when cell
        //    content wraps, and sticky-header positioning resets on reflow).
        container.style.width = tableW + 'px';
        container.style.maxWidth = 'none';
        container.style.overflow = 'visible';
        container.style.overflowX = 'visible';

        // Fix: sticky <thead> uses position:sticky which breaks under a CSS
        // transform (sticky is relative to the scroll container; under a
        // transform it collapses to y=0 and hides the header row).  Switch
        // all thead and header cells to position:relative so they stay in
        // normal document flow.
        const theadEls = container.querySelectorAll('thead, thead th');
        for (const thEl of theadEls) {
            thEl.style.position = 'relative';
        }

        // Measure the container's natural height AFTER widening so the
        // scrollHeight reflects the final post-reflow layout (row heights
        // can change when width changes due to cell content wrapping).
        const containerH = container.scrollHeight;
        const scaledH = Math.ceil(containerH * scaleFactor);

        // 2. Apply the scale transform to the container.
        //    transform-origin:top left keeps the table flush with the left edge.
        container.style.transform = 'scale(' + scaleFactor + ')';
        container.style.transformOrigin = 'top left';

        // 3. A CSS transform does NOT change the element's layout footprint —
        //    the container still occupies containerH of vertical space.  Force
        //    the height to the post-scale value so subsequent rows follow
        //    immediately below.
        container.style.height = scaledH + 'px';

        // 4. Clear overflow:hidden from every ancestor up to the root selector
        //    (.superset-chart-table / viz wrapper) so nothing clips the
        //    scaled-down container from outside.
        let ancestor = container.parentElement;
        while (ancestor && ancestor !== root.parentElement) {
            const cs = getComputedStyle(ancestor);
            if (cs.overflow !== 'visible') {
                ancestor.style.overflow = 'visible';
            }
            if (cs.overflowX !== 'visible') {
                ancestor.style.overflowX = 'visible';
            }
            ancestor = ancestor.parentElement;
        }

        scaled++;
    }
    return { scaled: scaled, marked: marked, viewport: viewport };
}
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

            # Take screenshot with clipping to capture only this tile's content
            capture_timeout = (
                _timeout_seconds(
                    "screenshot_capture",
                    reserve_seconds=(
                        report_execution_context.post_capture_reserve_seconds
                        if report_execution_context
                        else 0.0
                    ),
                )
                if report_execution_context or task_budget is not None
                else None
            )
            tile_screenshot = page.screenshot(
                type="png",
                clip=clip,
                **(
                    {"timeout": capture_timeout * 1000}
                    if capture_timeout is not None
                    else {}
                ),
            )
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
        logger.info(
            "report_readiness_ready url=%s expected_holders=%s mounted_holders=%s "
            "ready_holders=%s elapsed_seconds=%.2f remaining_seconds=%s%s",
            url,
            (
                report_execution_context.expected_chart_count
                if report_execution_context
                else None
            ),
            len(holder_states),
            sum(holder.get("state") in ready_states for holder in holder_states),
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
