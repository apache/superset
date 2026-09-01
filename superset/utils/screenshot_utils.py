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
REPORT_CHART_HOLDERS_READY_JS = (
    f"() => {{ {UNREADY_CHART_HOLDERS_JS_BODY} "
    "return holders.length > 0 && unready.length === 0; }"
)

# Like REPORT_CHART_HOLDERS_READY_JS, but scoped to ALL chart holders, not just
# viewport-visible ones. Required for browser-print mode where page.pdf()
# renders the full DOM. The getBoundingClientRect() viewport filter from
# UNREADY_CHART_HOLDERS_JS_BODY is intentionally absent here.
PRINT_ALL_CHART_HOLDERS_READY_JS_BODY = f"""
    const holders = document.querySelectorAll('{CHART_HOLDER_SELECTOR}');
    const unready = [];
    for (const holder of holders) {{
        const hasSliceContainer = holder.querySelector(
            '{SLICE_CONTAINER_SELECTOR}'
        ) !== null;
        const stillLoading = holder.querySelector('{LOADING_SELECTOR}') !== null;
        const isReady = holder.querySelector('{TERMINAL_MARKER_SELECTOR}') !== null;
        if (stillLoading || !isReady) {{
            const chartIdMatch = holder.className.match(/{CHART_ID_CLASS_PATTERN}/);
            unready.push({{ chartId: chartIdMatch ? chartIdMatch[1] : null }});
        }}
    }}
"""

PRINT_ALL_CHART_HOLDERS_READY_JS = (
    f"() => {{ {PRINT_ALL_CHART_HOLDERS_READY_JS_BODY} "
    "return holders.length > 0 && unready.length === 0; }"
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
        //    table viz.  The table plugin wraps rows in:
        //      style="height:Xpx; overflow:auto; width:Ypx"
        //    Clearing both height AND width ensures tall AND wide tables are
        //    fully visible in the PDF without clipping.
        for (const el of root.querySelectorAll('div[style]')) {
            const s = el.style;
            const hasHeight = s.height && s.height !== '' && s.height !== 'auto';
            // Also release width constraints on scroll containers that would
            // clip a wide table (many columns) at the authored pixel width.
            const hasWidthClip = (s.overflow === 'auto' || s.overflow === 'scroll'
                || s.overflowX === 'auto' || s.overflowX === 'scroll')
                && s.width && s.width !== '' && s.width !== '100%';
            if (hasHeight) {
                s.height = 'auto';
                s.maxHeight = 'none';
                s.overflow = 'visible';
                s.overflowY = 'visible';
                s.overflowX = 'visible';
                count++;
            }
            if (hasWidthClip) {
                s.width = '100%';
                s.maxWidth = 'none';
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
#   small  → no JS call; React default (32px) is the no-override baseline
#   medium → 64px CSS  ≈ ~12pt on paper
#   large  → 96px CSS  ≈ ~18pt on paper
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

# For tables with many columns the natural <table> scrollWidth can exceed the
# 1600 px print viewport width and overflow the right edge of the A4 PDF.
#
# Industry approach (used by Tableau / Power BI PDF export): apply a CSS
# transform: scale() to shrink the table to fit the page width.  A scale
# transform is purely cosmetic — it does not change the element's layout
# footprint in the document flow, so the scaled table would still occupy its
# original (pre-scale) pixel height and potentially overlap the next row.
# To compensate, we wrap each wide table in a new <div> whose height is set
# to tableHeight * scaleFactor so the document flow sees the correct (smaller)
# height after scaling.
#
# Must be called AFTER EXPAND_TABLE_CONTAINERS_JS (so the table has rendered
# to its natural width and height) and BEFORE page.pdf() (so the scale
# transform is in place when the PDF engine lays out the page).
#
# Only tables whose scrollWidth > viewportWidth are touched.  Tables that fit
# naturally are left completely unmodified.
SCALE_WIDE_TABLES_JS = """
() => {
    const viewport = window.innerWidth || 1600;
    // Leave a small gutter so the table doesn't butt up against the right margin.
    const maxWidth = viewport - 24;
    let scaled = 0;

    const sel = '.superset-chart-table,'
        + ' [data-test-viz-type="table"],'
        + ' [data-test-viz-type="TableChartTransformed"]';

    for (const root of document.querySelectorAll(sel)) {
        // The inner <table> element carries the natural column widths.
        const tableEl = root.querySelector('table');
        if (!tableEl) continue;

        const tableW = tableEl.scrollWidth;
        if (tableW <= maxWidth) continue;  // fits — no scaling needed

        const scaleFactor = maxWidth / tableW;

        // Measure the table's natural height BEFORE applying the scale so we
        // can set the wrapper height to compensate for the layout footprint.
        const tableH = tableEl.scrollHeight;
        const scaledH = Math.ceil(tableH * scaleFactor);

        // Apply the CSS scale transform directly to the <table> element.
        // transform-origin: top left ensures the scaled table aligns flush with
        // the left edge of the page rather than centering or shifting right.
        tableEl.style.transform = 'scale(' + scaleFactor + ')';
        tableEl.style.transformOrigin = 'top left';
        // The scaled element still occupies its original layout footprint.
        // Force the immediate parent (scroll container cleared by EXPAND_JS)
        // to exactly the post-scale height so subsequent rows start correctly.
        const parent = tableEl.parentElement;
        if (parent) {
            parent.style.height = scaledH + 'px';
            parent.style.overflow = 'hidden';
        }

        scaled++;
    }
    return { scaled: scaled, viewport: viewport };
}
"""

CHART_HOLDERS_MOUNTED_JS = (
    f"() => document.querySelectorAll('{CHART_HOLDER_SELECTOR}').length > 0"
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

# Diagnostic companion to CHART_CONTAINER_READY_JS: reports why a chart
# capture is (or is not) ready. Chart pages have no dashboard grid holders,
# so the holder-count diagnostics read as vacuous zeros there.
CHART_CONTAINER_STATE_JS = f"""
() => {{
    const chart = document.querySelector('.chart-container');
    if (chart === null) {{ return 'missing'; }}
    if (chart.querySelector('{LOADING_SELECTOR}') !== null) {{ return 'loading'; }}
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
) -> bytes:
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
            "Dashboard: %sx%spx at (%s, %s)",
            dashboard_width,
            dashboard_height,
            dashboard_left,
            dashboard_top,
        )

        # Calculate number of tiles needed
        num_tiles = max(1, (dashboard_height + tile_height - 1) // tile_height)
        logger.info("Taking %s screenshot tiles", num_tiles)

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
                "Scrolled window to %s for tile %s/%s", scroll_y, i + 1, num_tiles
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

            logger.debug("Captured tile %s/%s with clip %s", i + 1, num_tiles, clip)

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
        logger.info("Combining screenshot tiles...")
        combined_screenshot = combine_screenshot_tiles(
            screenshot_tiles,
            allow_partial_fallback=report_execution_context is None,
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
