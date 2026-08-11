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
  .ant-dropdown-trigger,
  .resizable-add-row,
  .empty-droptarget,
  [data-test="anchor-link-container"],
  .slice_description { display: none !important; }

  /* ── 2. Single-column vertical stacking ─────────────────────────── */
  /*
   * DOM nesting: .dragdroppable-row > .with-popover-menu > .grid-row
   *   > .dragdroppable-column > .resizable-container
   * Both .dragdroppable-row AND .grid-row are flex:row containers that
   * place dashboard columns side-by-side. Both must become flex:column.
   * .resizable-container carries inline width AND height from re-resizable
   * — both must be overridden so the chart fills the page width and
   * takes its natural height.
   */
  .dragdroppable-row,
  .grid-row {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    gap: 0 !important;
  }
  .dragdroppable-column {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    flex-shrink: 0 !important;
  }
  /* Override all re-resizable inline width + height */
  .resizable-container {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    max-height: none !important;
  }

  /* ── 3. Chart cards ──────────────────────────────────────────────── */
  /* Each chart card (the white rounded box) takes full width and wraps
     to its content height — removes the fixed pixel height set by the
     dashboard layout engine */
  .dashboard-component-chart-holder {
    height: auto !important;
    min-height: 0 !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .chart-slice {
    height: auto !important;
  }
  /* The inner chart canvas/SVG container: keep a sensible minimum so
     charts don't collapse, but let taller charts use their full height */
  .chart-container {
    height: auto !important;
    min-height: 240px;
    overflow: visible !important;
  }
  /* Big-number / KPI charts are naturally short — don't stretch them */
  [data-test-viz-type="big_number"] .chart-container,
  [data-test-viz-type="big_number_total"] .chart-container {
    min-height: 120px;
  }

  /* ── 4. Tables ───────────────────────────────────────────────────── */
  .table-viz,
  .dataTable {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  .dt-global-filter,
  .pagination-container { display: none !important; }

  /* ── 5. Markdown / text cards ────────────────────────────────────── */
  .dashboard-markdown {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
  .dashboard-markdown .resizable-container {
    overflow: visible !important;
    height: auto !important;
  }

  /* ── 6. Spacing between cards ────────────────────────────────────── */
  .dragdroppable-column + .dragdroppable-column {
    margin-top: 8px;
  }
}
`;
