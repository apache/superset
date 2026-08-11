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
