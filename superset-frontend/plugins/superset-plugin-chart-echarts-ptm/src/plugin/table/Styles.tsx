/*
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

import { css, styled } from '@superset-ui/core';

// PTM: Load Inter font for tables
const PTM_INTER_FONT_ID = 'ptm-inter-font';
if (typeof document !== 'undefined' && !document.getElementById(PTM_INTER_FONT_ID)) {
  const link = document.createElement('link');
  link.id = PTM_INTER_FONT_ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700&display=swap';
  document.head.appendChild(link);
}

export default styled.div`
  ${({ theme }) => css`
    /* PTM Theme - Clean Minimal Table Design */
    &,
    & * {
      font-family: 'Inter', ${theme.typography.families.sansSerif} !important;
    }

    /* ========================================
       TABLE BASE STYLES
       ======================================== */
    table.table {
      width: 100% !important;
      margin: 0 !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      background: #FFFFFF !important;
    }

    /* ========================================
       HEADER STYLES - Clean & Minimal
       ======================================== */
    table.table > thead > tr > th,
    table.table thead th {
      padding: 12px 16px !important;
      background: transparent !important;
      font-family: 'Inter', ${theme.typography.families.sansSerif} !important;
      font-weight: 500 !important;
      font-size: 12px !important;
      color: #9CA3AF !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      border: none !important;
      border-bottom: 1px solid #F3F4F6 !important;
      text-align: left !important;
      white-space: nowrap !important;
    }

    /* Sort icons - subtle */
    table.table thead th svg {
      color: #D1D5DB !important;
      margin-left: 4px !important;
      opacity: 0.6 !important;
      transition: opacity 0.15s ease !important;
    }

    table.table thead th:hover svg {
      opacity: 1 !important;
      color: #6B7280 !important;
    }

    table.table thead th.is-sorted svg {
      opacity: 1 !important;
      color: #6B7280 !important;
    }

    /* ========================================
       BODY / DATA CELLS - Clean
       ======================================== */
    table.table > tbody > tr > td,
    table.table tbody td {
      padding: 8px 16px !important;
      font-size: 14px !important;
      color: #374151 !important;
      border: none !important;
      border-bottom: 1px solid #F3F4F6 !important;
      background: transparent !important;
      font-feature-settings: 'tnum' 1 !important;
      vertical-align: middle !important;
    }

    /* Row styling - NO alternating colors */
    table.table > tbody > tr {
      background-color: #FFFFFF !important;
    }

    /* Override striped - keep all white */
    table.table.table-striped > tbody > tr:nth-of-type(odd),
    table.table.table-striped > tbody > tr:nth-of-type(even) {
      background-color: #FFFFFF !important;
    }

    /* Subtle hover */
    table.table > tbody > tr:hover,
    table.table.table-striped > tbody > tr:hover {
      background-color: #F9FAFB !important;
    }

    /* Last row no border */
    table.table > tbody > tr:last-of-type > td {
      border-bottom: none !important;
    }

    /* ========================================
       NUMERIC CELLS & BARS
       ======================================== */
    .dt-metric {
      text-align: right !important;
      font-variant-numeric: tabular-nums !important;
      color: #111827 !important;
      font-weight: 500 !important;
    }

    /* Cell bar background - subtle */
    .cell-bar {
      opacity: 0.08 !important;
      background-color: #3B82F6 !important;
    }

    .cell-bar.negative {
      background-color: #EF4444 !important;
    }

    .cell-bar.positive {
      background-color: #10B981 !important;
    }

    /* ========================================
       SPECIAL CELLS
       ======================================== */
    .dt-totals {
      font-weight: 600 !important;
      background-color: #F9FAFB !important;
      color: #111827 !important;
    }

    .dt-is-null {
      color: #D1D5DB !important;
      font-style: normal !important;
    }

    /* Filter cells */
    td.dt-is-filter {
      cursor: pointer !important;
    }

    td.dt-is-filter:hover {
      background-color: #F3F4F6 !important;
    }

    td.dt-is-active-filter,
    td.dt-is-active-filter:hover {
      background-color: #EFF6FF !important;
    }

    /* ========================================
       CONTROLS (Search, Page Size) - Minimal
       ======================================== */
    .dt-controls {
      padding: 0 0 12px 0 !important;
    }

    .dt-global-filter {
      float: right !important;
    }

    .dt-global-filter input,
    .form-control.input-sm {
      font-family: 'Inter', ${theme.typography.families.sansSerif} !important;
      border-radius: 6px !important;
      border: 1px solid #E5E7EB !important;
      padding: 8px 12px !important;
      font-size: 13px !important;
      color: #374151 !important;
      background: #FFFFFF !important;
      transition: all 0.15s ease !important;
      box-shadow: none !important;
    }

    .dt-global-filter input:focus,
    .form-control.input-sm:focus {
      border-color: #9CA3AF !important;
      box-shadow: none !important;
      outline: none !important;
    }

    .dt-select-page-size {
      color: #6B7280 !important;
      font-size: 13px !important;
    }

    .dt-select-page-size select {
      border-radius: 6px !important;
      border: 1px solid #E5E7EB !important;
      padding: 8px 10px !important;
      margin: 0 6px !important;
      color: #374151 !important;
      background: #FFFFFF !important;
    }

    .dt-select-page-size select:focus {
      border-color: #9CA3AF !important;
      outline: none !important;
      box-shadow: none !important;
    }

    /* ========================================
       PAGINATION - Clean
       ======================================== */
    .dt-pagination {
      text-align: right !important;
      padding: 12px 0 0 0 !important;
    }

    .dt-pagination .pagination {
      margin: 0 !important;
      display: inline-flex !important;
      gap: 2px !important;
    }

    .pagination > li > a,
    .pagination > li > span {
      font-family: 'Inter', ${theme.typography.families.sansSerif} !important;
      border-radius: 6px !important;
      border: none !important;
      color: #6B7280 !important;
      padding: 8px 12px !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      background: transparent !important;
      transition: all 0.15s ease !important;
      margin: 0 !important;
    }

    .pagination > li > a:hover {
      background-color: #F3F4F6 !important;
      color: #374151 !important;
    }

    .pagination > .active > a,
    .pagination > .active > a:hover,
    .pagination > .active > a:focus,
    .pagination > .active > span {
      background-color: #F3F4F6 !important;
      color: #111827 !important;
      font-weight: 600 !important;
    }

    .pagination > .disabled > a,
    .pagination > .disabled > span {
      color: #D1D5DB !important;
      background: transparent !important;
      cursor: not-allowed !important;
    }

    /* ========================================
       MISC
       ======================================== */
    .dt-truncate-cell {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .dt-truncate-cell:hover {
      overflow: visible !important;
      white-space: normal !important;
      height: auto !important;
    }

    .dt-no-results {
      text-align: center !important;
      padding: 40px 16px !important;
      color: #9CA3AF !important;
      font-size: 14px !important;
    }

    .right-border-only {
      border-right: 1px solid #F3F4F6 !important;
    }

    table .right-border-only:last-child {
      border-right: none !important;
    }

    /* ========================================
       PTM PILLS - Optional Styling
       Use by wrapping values: <span class="ptm-pill">Value</span>
       ======================================== */
    .ptm-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
      
      /* Default colors - can be overridden with inline styles */
      background: #DBEAFE;
      color: #1E40AF;
    }

    .ptm-pill-empty {
      background: #F3F4F6 !important;
      color: #6B7280 !important;
    }
  `}
`;

