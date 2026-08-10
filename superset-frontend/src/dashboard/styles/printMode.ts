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
  /* Hide all interactive chrome */
  .dashboard-header-container { display: none !important; }
  .filter-bar { display: none !important; }
  .drag-handle { display: none !important; }
  .resizable-add-col { display: none !important; }
  .ant-dropdown-trigger { display: none !important; }

  /* Single vertical column layout — stack row children top-to-bottom,
     each column taking the full page width */
  .dragdroppable-row {
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
  /* re-resizable sets inline width on the .resizable-container — override it */
  .dragdroppable-column .resizable-container {
    width: 100% !important;
    max-width: 100% !important;
  }

  /* Expand scroll-clipped containers (tables, long text) so full content
     is visible to the browser print engine rather than being cut off */
  .table-viz {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  .dt-global-filter,
  .pagination-container { display: none !important; }
  .dataTable {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Prevent canvas/SVG charts from collapsing to zero height in block flow */
  .chart-container {
    min-height: 200px;
  }
}
`;
