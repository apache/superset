/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Print-mode CSS rules — applied only when `body.print-mode` is present.
 *
 * The `.print-mode` class is set by DashboardBuilder when `?print=1` is in the
 * URL (the browser-print PDF path, SIP-212). It is NOT set by `?standalone=3`
 * alone, so embedded SDK consumers that use standalone=3 are unaffected.
 *
 * Import and inject this string via a <style> tag or a css-in-js call in
 * DashboardBuilder.tsx when print mode is active.
 */

/**
 * Valid values for the ?print_font_size URL param.
 *
 * - small:  compact — saves space, fits more content per page
 * - medium: default sizing — matches the interactive dashboard as closely
 *           as possible (no overrides applied beyond the layout changes)
 * - large:  accessibility / presentation — easier to read when projected
 *           or printed on paper and shared
 *
 * Font sizes target DOM-rendered elements only:
 *   • Chart titles (.header-title inside [data-test="slice-header"])
 *   • Table cells (td, th inside .dataTable)
 *   • Markdown / text card content (.dashboard-markdown)
 *   • Big Number DOM text (.header-line, .subheader-line)
 *
 * ECharts SVG/canvas labels (axis ticks, legend, pie slice labels) are
 * drawn by the ECharts renderer directly onto SVG/canvas with inline
 * font attributes and cannot be resized via CSS after render time.
 */
export type PrintFontSize = 'small' | 'medium' | 'large';

/**
 * Valid values for the ?print_layout URL param.
 *
 * - 1col:  single-column (default) — every chart spans the full page width.
 *          Best for tables and wide charts.
 * - 2col:  two-column adaptive — charts that originally occupied ≤ 50% of
 *          the dashboard row are placed side-by-side (two per row); charts
 *          that occupied > 50% span the full width as normal.  Table charts
 *          are always forced full-width regardless of their original size.
 *          The threshold detection is done by ANNOTATE_PRINT_COLUMNS_JS
 *          (screenshot_utils.py) before page.pdf() is called; this CSS only
 *          acts on the resulting data-print-col-span attributes.
 */
export type PrintLayout = '1col' | '2col';

export const PRINT_LAYOUT_1COL = '1col' as const;
export const PRINT_LAYOUT_2COL = '2col' as const;

export const PRINT_FONT_SIZE_SMALL = 'small' as const;
export const PRINT_FONT_SIZE_MEDIUM = 'medium' as const;
export const PRINT_FONT_SIZE_LARGE = 'large' as const;

/**
 * Returns additional CSS to inject alongside PRINT_MODE_CSS that scales
 * all DOM-rendered text in the PDF to the requested size tier.
 *
 * Returns an empty string for 'medium' because the base PRINT_MODE_CSS
 * already preserves the interactive dashboard's default sizes.
 */
export function getPrintFontSizeCSS(fontSize: PrintFontSize): string {
  /*
   * All pixel values below are CSS pixels rendered at 1600px viewport width.
   * page.pdf(scale=794/1600≈0.496) halves every dimension in the output PDF.
   * Rule of thumb: CSS px × 0.375 ≈ pt on paper (at 96 dpi screen, 72 dpi print).
   * 0.496 × 0.375 ≈ 0.186 pt per CSS px in the final PDF.
   *
   * Tier targets (approximate printed point sizes):
   *   small  — no overrides; React/dashboard defaults (~8pt title, ~6pt table)
   *   medium — chart title ~13pt, table ~10pt  (presentation-ready)
   *   large  — chart title ~19pt, table ~15pt  (extra-large / accessibility)
   *
   * NOTE: .header-line on Big Number charts has an inline style="font-size:Xpx"
   * set by React. CSS !important cannot override inline styles. The big number
   * font size is controlled via SET_PRINT_FONT_SIZE_JS in webdriver.py, which
   * patches the inline font-size before page.pdf() is called.
   * These CSS rules therefore do NOT target .header-line.
   *
   * Verified selectors from live DOM inspection:
   *   Table td/th: .superset-chart-table td / .superset-chart-table th
   *   (the inner <table> has class "table table-striped table-condensed";
   *    there is no .dataTable or .table-viz class in the Superset table plugin)
   */

  // small: no overrides — base PRINT_MODE_CSS preserves dashboard defaults
  if (fontSize === 'small') {
    return '';
  }

  if (fontSize === 'medium') {
    return `
body.print-mode {
  /* ── Medium font tier ────────────────────────────────────────────── */
  /* Chart titles (~13pt on paper after 0.496x scale) */
  [data-test="slice-header"] .header-title,
  [data-test="slice-header"] .header-title a,
  [data-test="slice-header"] .header-title span {
    font-size: 26px !important;
    line-height: 1.4 !important;
  }

  /* Table cells and headers (~10pt on paper) */
  .superset-chart-table td,
  .superset-chart-table th {
    font-size: 20px !important;
    line-height: 1.5 !important;
    padding: 8px 14px !important;
  }

  /* Markdown / text cards */
  .dashboard-markdown,
  .dashboard-markdown p,
  .dashboard-markdown li,
  .dashboard-markdown td,
  .dashboard-markdown th {
    font-size: 20px !important;
    line-height: 1.6 !important;
  }
  .dashboard-markdown h1 { font-size: 32px !important; }
  .dashboard-markdown h2 { font-size: 28px !important; }
  .dashboard-markdown h3 { font-size: 24px !important; }
}
`;
  }

  if (fontSize === 'large') {
    return `
body.print-mode {
  /* ── Large font tier ─────────────────────────────────────────────── */

  /* Chart titles (~19pt on paper after 0.496x scale).
   * At 38px the title text is taller than the default slice-header height
   * (~40px authored). Release the header container so the full title line
   * is visible instead of being clipped at the bottom. */
  [data-test="slice-header"],
  [data-test="slice-header"] .header-controls-dash,
  [data-test="slice-header"] .slice-header-wrapper {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  [data-test="slice-header"] .header-title,
  [data-test="slice-header"] .header-title a,
  [data-test="slice-header"] .header-title span {
    font-size: 38px !important;
    line-height: 1.35 !important;
    white-space: normal !important;
    overflow: visible !important;
  }

  /* Table cells and headers (~15pt on paper) */
  .superset-chart-table td,
  .superset-chart-table th {
    font-size: 30px !important;
    line-height: 1.5 !important;
    padding: 10px 18px !important;
  }

  /* Markdown / text cards */
  .dashboard-markdown,
  .dashboard-markdown p,
  .dashboard-markdown li,
  .dashboard-markdown td,
  .dashboard-markdown th {
    font-size: 30px !important;
    line-height: 1.6 !important;
  }
  .dashboard-markdown h1 { font-size: 48px !important; }
  .dashboard-markdown h2 { font-size: 42px !important; }
  .dashboard-markdown h3 { font-size: 36px !important; }
}
`;
  }

  return '';
}

/**
 * Returns additional CSS to inject alongside PRINT_MODE_CSS that enables the
 * two-column adaptive layout (?print_layout=2col).
 *
 * Requires ANNOTATE_PRINT_COLUMNS_JS to have been evaluated first so that
 * data-print-col-span="half"|"full" attributes are present on each
 * .dragdroppable-column element.
 *
 * Table charts are always full-width (enforced by the JS annotation, not here).
 */
export function getPrintLayoutCSS(layout: PrintLayout): string {
  if (layout !== '2col') {
    return '';
  }
  return `
body.print-mode.print-layout-2col {
  /*
   * Multi-column adaptive layout — restores the original dashboard side-by-side
   * layout for rows that had 2 or 3 charts side-by-side.
   *
   * Confirmed DOM structure (live inspection):
   *   .dragdroppable-row
   *     .with-popover-menu
   *       .grid-row                  ← flex container
   *         .dragdroppable-column    ← one per chart; JS sets --print-col-weight
   *           .resizable-container
   *
   * ANNOTATE_PRINT_COLUMNS_JS (screenshot_utils.py):
   *   - Sets data-print-2col="true" on qualifying .grid-row elements (2–3 cols,
   *     no table charts, no single chart >= 90% viewport width)
   *   - Sets --print-col-weight on each .dragdroppable-column to its
   *     proportional share of the total row authored width (normalised to 100),
   *     so columns always fill the full row regardless of authored gap
   *
   * The base PRINT_MODE_CSS forces .grid-row to flex-direction:column.
   * We override that back to row only for JS-annotated rows.
   */

  /* Restore annotated rows to horizontal flex */
  .grid-row[data-print-2col="true"] {
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    gap: 0 !important;
    width: 100% !important;
  }

  /* Each column fills its proportional share of the row via flex-grow.
   * flex-basis:0 + flex-grow=weight means the browser divides the available
   * space exactly in the authored proportions, and the columns always sum
   * to 100% with no gap — even when the authored widths didn't exactly fill
   * the viewport. flex-shrink:0 prevents columns from being squeezed below
   * their flex-grow share. */
  .grid-row[data-print-2col="true"] > .dragdroppable-column {
    flex-grow: var(--print-col-weight, 50) !important;
    flex-shrink: 0 !important;
    flex-basis: 0 !important;
    width: 0 !important;
    max-width: none !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  /* The resizable-container must fill its column completely */
  .grid-row[data-print-2col="true"] > .dragdroppable-column > .resizable-container {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }
}
`;
}

export const PRINT_MODE_CSS = `
body.print-mode {
  /* ── 1. Hide interactive chrome ─────────────────────────────────── */
  .dashboard-header-container,
  .filter-bar,
  .drag-handle,
  .resizable-add-col,
  .resizable-add-row,
  .ant-dropdown-trigger,
  .empty-droptarget,
  [data-test="anchor-link-container"],
  .slice_description { display: none !important; }

  /* ── 2. Single-column vertical stacking ─────────────────────────── */
  /*
   * Strategy: render at 1600 px (the authored dashboard width) and use
   * page.pdf(scale=794/1600) to fit A4 paper. This means ECharts, canvas,
   * and SVG elements all measure and draw at their designed pixel sizes —
   * no tiny charts from a collapsed container.
   *
   * The CSS here only needs to:
   *   (a) stack multi-column rows into a single column
   *   (b) override re-resizable inline WIDTHS so nothing overflows 1600 px
   *   (c) NOT touch heights — chart containers must keep their authored
   *       pixel heights so canvas/SVG elements render at full resolution
   *
   * DOM nesting: .dragdroppable-row > .with-popover-menu > .grid-row
   *   > .dragdroppable-column > .resizable-container
   * Both .dragdroppable-row AND .grid-row are display:flex;flex-direction:row.
   * Both need to become flex-direction:column.
   */
  .dragdroppable-row,
  .grid-row {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
  }
  .dragdroppable-column {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    flex-shrink: 0 !important;
  }
  /* Override re-resizable inline width only — leave height untouched */
  .resizable-container {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  /* ── 3. Markdown / text cards: let content determine height ─────── */
  /*
   * Markdown cards have an authored pixel height that clips long text.
   * Unlike chart canvases, markdown is pure DOM so height:auto is safe.
   */
  .dashboard-markdown,
  .dashboard-markdown .resizable-container {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* ── 4. Table charts: show all rows, hide pagination ────────────── */
  /*
   * The table viz renders all rows into the DOM but wraps them in a
   * fixed-height scroll container set via inline styles.
   * EXPAND_TABLE_CONTAINERS_JS (Playwright) removes those inline heights, but
   * the flex layout chain above the table (resizable-container →
   * dragdroppable-column → grid-row) still allocates the authored pixel
   * height to the table's column, causing the expanded table rows to overflow
   * that allocated space and overlap subsequent dashboard rows in the PDF.
   *
   * Fix: release height at every ancestor level for table-containing cells.
   * Use :has() so non-table chart heights are completely unaffected.
   * The walk stops at .grid-row so it doesn't collapse the whole page.
   */

  /* Release the full ancestor chain:
   *   resizable-container → chart-holder → column → grid-row →
   *   with-popover-menu → dragdroppable-row
   *
   * Every level must release height so the flex layout allocates
   * auto height to the table's cell instead of the authored px height.
   * Without releasing .with-popover-menu and .dragdroppable-row the
   * expanded table overflows its slot and overlaps the next row.
   */
  .resizable-container:has(.superset-chart-table),
  .resizable-container:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
  .dashboard-component-chart-holder:has(.superset-chart-table),
  .dashboard-component-chart-holder:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .dragdroppable-column:has(.superset-chart-table),
  .dragdroppable-column:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /* chart-slice / dashboard-chart / chart-container */
  .chart-slice:has(.superset-chart-table),
  .chart-slice:has([data-test-viz-type="table"]),
  .dashboard-chart:has(.superset-chart-table),
  .dashboard-chart:has([data-test-viz-type="table"]),
  .chart-container:has(.superset-chart-table),
  .chart-container:has([data-test-viz-type="table"]) {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
  }
  /* Release the grid-row that contains a table column */
  .grid-row:has(.superset-chart-table),
  .grid-row:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /*
   * Release ALL .dragdroppable-column children of a table-containing .grid-row,
   * not just the column that holds the table. In print mode the grid-row is
   * flex-direction:column, so every column is a block-flow item. Sibling
   * columns with inline style.height (set by re-resizable) cause the row to
   * allocate only the authored pixel height, making the expanded table overflow
   * and interleave with subsequent dashboard rows. Releasing all columns lets
   * each grow to fit its content and the row expands to contain them all.
   */
  .grid-row:has(.superset-chart-table) > .dragdroppable-column,
  .grid-row:has([data-test-viz-type="table"]) > .dragdroppable-column {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .grid-row:has(.superset-chart-table) > .dragdroppable-column > .resizable-container,
  .grid-row:has([data-test-viz-type="table"]) > .dragdroppable-column > .resizable-container {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /* Release .with-popover-menu which sits between .grid-row and
     .dragdroppable-row — also has an authored height in some themes */
  .with-popover-menu:has(.superset-chart-table),
  .with-popover-menu:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /* Release the outermost row wrapper (.dragdroppable-row).
     re-resizable sets an inline style.height on this element that
     clips the expanded table — releasing it here lets the row grow
     to accommodate the full table without overlapping the next row. */
  .dragdroppable-row:has(.superset-chart-table),
  .dragdroppable-row:has([data-test-viz-type="table"]) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  /* The inner scroll containers set via inline style are handled by JS */
  .table-viz,
  .dataTable,
  .superset-chart-table {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  .dt-global-filter,
  .pagination-container { display: none !important; }

  /* ── 5. Page breaks ──────────────────────────────────────────────── */
  /*
   * Avoid splitting a single chart card across a page break.
   * Non-table chart holders get break-inside:avoid so charts are not
   * split across pages. Table rows get break-inside:avoid at the
   * .dragdroppable-row level so the entire table block (title + table)
   * is not split — but individual table rows can still paginate naturally.
   * Tables are NOT given break-inside:avoid on the holder itself because
   * a 100-row table forced onto one page produces an almost-blank page.
   */
  .dashboard-component-chart-holder:not(:has(.superset-chart-table)):not(:has([data-test-viz-type="table"])) {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Keep the chart title and the start of the table together on one page */
  .dashboard-component-chart-holder:has(.superset-chart-table),
  .dashboard-component-chart-holder:has([data-test-viz-type="table"]) {
    break-before: auto;
    page-break-before: auto;
  }
}
`;
