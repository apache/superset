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
  /* Chart titles (~19pt on paper after 0.496x scale) */
  [data-test="slice-header"] .header-title,
  [data-test="slice-header"] .header-title a,
  [data-test="slice-header"] .header-title span {
    font-size: 38px !important;
    line-height: 1.4 !important;
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
   * fixed-height scroll container set via inline styles.  EXPAND_TABLE_CONTAINERS_JS
   * (evaluated by Playwright before page.pdf()) removes those inline heights.
   * These CSS rules handle the remaining layout ancestors that have
   * overflow:hidden applied via class rules (not inline styles):
   *   .dashboard-chart has overflow:hidden from its stylesheet
   *   .chart-container may also clip
   * We use :has() scoped to table viz types so non-table charts are unaffected.
   */
  [data-test-viz-type="table"] ~ * .dashboard-chart,
  .dashboard-chart:has([data-test-viz-type="table"]),
  .dashboard-chart:has(.superset-chart-table) {
    overflow: visible !important;
    height: auto !important;
  }
  .chart-container:has(.superset-chart-table),
  .chart-container:has([data-test-viz-type="table"]) {
    overflow: visible !important;
    height: auto !important;
    min-height: 0 !important;
  }
  /* The inner scroll containers set via inline style are handled by JS;
     these CSS rules cover any remaining table-viz wrapper elements */
  .table-viz,
  .dataTable {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  .dt-global-filter,
  .pagination-container { display: none !important; }

  /* ── 5. Prevent page breaks splitting a single chart card ─────────*/
  .dashboard-component-chart-holder {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
`;
