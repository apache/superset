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

import { css, styled } from '@apache-superset/core/ui';

export default styled.div`
  ${({ theme }) => css`
    /* Base table styles */
    table {
      width: 100%;
      min-width: auto;
      max-width: none;
      margin: 0;
      border-collapse: collapse;
    }

    /* Context menu */
    .dt-context-menu {
      position: fixed;
      z-index: 10000;
      background: ${theme.colorBgBase};
      border: 1px solid ${theme.colorBorderSecondary};
      box-shadow: none;
      border-radius: ${theme.borderRadius}px;
      padding: ${theme.paddingXS}px 0;
      min-width: 180px;
    }
    .dt-context-menu .item {
      padding: 6px 12px;
      cursor: pointer;
      color: ${theme.colorText};
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: ${theme.marginXXS}px;
    }
    .dt-context-menu .item:hover {
      background: ${theme.colorBgLayout};
    }
    .dt-context-menu .separator {
      height: 1px;
      background: ${theme.colorSplit};
      margin: 4px 0;
    }

    th,
    td {
      min-width: 4.3em;
      padding: 0.75rem;
      vertical-align: top;
    }

    thead > tr > th {
      padding-right: 0;
      position: relative;
      background-color: ${theme.colorBgBase};
      text-align: left;
      border-bottom: 2px solid ${theme.colorSplit};
      color: ${theme.colorText};
      vertical-align: bottom;
    }
    /* Subtle actions header: no bottom border and muted color */
    thead > tr > th[data-column-name='actions'] {
      border-bottom: none;
      color: ${theme.colorTextTertiary};
    }
    /* Make header ellipsis decorative (no hover/click) */
    thead > tr > th[data-column-name='actions'] .dt-ellipsis-button {
      pointer-events: none;
      cursor: default;
      background: transparent;
      border-color: transparent;
      color: ${theme.colorTextTertiary};
    }
    thead > tr > th[data-column-name='actions'] .dt-ellipsis-button:hover,
    thead > tr > th[data-column-name='actions'] .dt-ellipsis-button:focus {
      background: transparent;
      border-color: transparent;
      color: ${theme.colorTextTertiary};
    }
    /* Column resize handle */
    .dt-col-resizer {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      user-select: none;
      touch-action: none;
      /* subtle visual cue on hover */
    }
    .dt-col-resizer:hover {
      background: ${theme.colorBgLayout};
    }
    th svg {
      margin: ${theme.sizeUnit / 2}px;
      fill-opacity: 0.2;
    }
    th.is-sorted svg {
      color: ${theme.colorText};
      fill-opacity: 1;
    }
    .table > tbody > tr:first-of-type > td,
    .table > tbody > tr:first-of-type > th {
      border-top: 0;
    }

    .table > tbody tr td {
      font-feature-settings: 'tnum' 1;
      border-top: 1px solid ${theme.colorSplit};
    }

    /* Bootstrap-like condensed table styles */
    table.table-condensed,
    table.table-sm {
      font-size: ${theme.fontSizeSM}px;
    }

    table.table-condensed th,
    table.table-condensed td,
    table.table-sm th,
    table.table-sm td {
      padding: 0.3rem;
    }

    /* Bootstrap-like bordered table styles */
    table.table-bordered {
      border: 1px solid ${theme.colorSplit};
    }

    table.table-bordered th,
    table.table-bordered td {
      border: 1px solid ${theme.colorSplit};
    }

    /* Bootstrap-like striped table styles */
    table.table-striped tbody tr:nth-of-type(odd) {
      background-color: ${theme.colorBgLayout};
    }

    .dt-controls {
      padding-bottom: 0.65em;
    }
    .dt-description {
      /* top and bottom spacing using theme + slight indent */
      margin-block-start: ${theme.marginSM}px;
      margin-block-end: ${theme.marginSM}px;
      margin-inline-start: ${theme.marginXXS}px; /* RTL-aware indent */
      color: ${theme.colorText};
      /* ensure long content displays without overlap */
      word-break: break-word;
    }
    .dt-description img {
      max-width: 100%;
      height: auto;
    }
    .dt-description pre {
      overflow: auto;
      white-space: pre;
    }
    .dt-metric {
      text-align: right;
    }
    .dt-totals {
      font-weight: ${theme.fontWeightStrong};
    }
    .dt-is-null {
      color: ${theme.colorTextTertiary};
    }
    td.dt-is-filter {
      cursor: pointer;
    }
    td.dt-is-filter:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }
    td.dt-is-active-filter,
    td.dt-is-active-filter:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }

    .dt-global-filter {
      float: right;
    }

    .dt-truncate-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dt-truncate-cell:hover {
      overflow: visible;
      white-space: normal;
      height: auto;
    }

    .dt-pagination {
      text-align: right;
      /* use padding instead of margin so clientHeight can capture it */
      padding: ${theme.paddingXXS}px 0px;
    }
    .dt-pagination .pagination {
      margin: 0;
      padding-left: 0;
      list-style: none;
      display: inline-block;
      white-space: nowrap;
    }

    /* Align pagination item layout and spacing */
    .dt-pagination .pagination > li {
      display: inline;
      margin: 0 ${theme.marginXXS}px;
    }

    /* Button look-and-feel to match core table */
    .dt-pagination .pagination > li > a,
    .dt-pagination .pagination > li > span,
    .dt-pagination .pagination > li > button {
      background-color: ${theme.colorBgBase};
      color: ${theme.colorText};
      border: 1px solid transparent; /* no visible border for inactive */
      padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
      border-radius: ${theme.borderRadius}px;
      display: inline-block;
      text-decoration: none;
      line-height: 1.2;
    }

    /* Disabled pagination buttons */
    .dt-pagination .pagination > li > button[disabled] {
      cursor: default;
      opacity: 0.6;
    }

    .dt-pagination .pagination > li > a:hover,
    .dt-pagination .pagination > li > a:focus,
    .dt-pagination .pagination > li > span:hover,
    .dt-pagination .pagination > li > span:focus,
    .dt-pagination .pagination > li > button:hover,
    .dt-pagination .pagination > li > button:focus {
      background: ${theme.colorBgLayout};
      border-color: transparent; /* keep border hidden on hover for inactive */
      color: ${theme.colorText};
    }

    /* Prevent hover effect on disabled */
    .dt-pagination .pagination > li > button[disabled]:hover,
    .dt-pagination .pagination > li > button[disabled]:focus {
      background: ${theme.colorBgBase};
      color: ${theme.colorText};
    }

    .dt-pagination .pagination.pagination-sm > li > a,
    .dt-pagination .pagination.pagination-sm > li > span,
    .dt-pagination .pagination.pagination-sm > li > button {
      font-size: ${theme.fontSizeSM}px;
      padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
    }

    /* Active page styles */
    .dt-pagination .pagination > li.active > a,
    .dt-pagination .pagination > li.active > span,
    .dt-pagination .pagination > li.active > button,
    .dt-pagination .pagination > li.active > a:focus,
    .dt-pagination .pagination > li.active > a:hover,
    .dt-pagination .pagination > li.active > span:focus,
    .dt-pagination .pagination > li.active > span:hover,
    .dt-pagination .pagination > li.active > button:focus,
    .dt-pagination .pagination > li.active > button:hover {
      background-color: ${theme.colorPrimary};
      color: ${theme.colorBgContainer};
      border-color: ${theme.colorBorderSecondary};
    }

    /* Ellipsis item hover/focus */
    .pagination > li > span.dt-pagination-ellipsis:focus,
    .pagination > li > span.dt-pagination-ellipsis:hover,
    .dt-pagination .pagination > li.dt-pagination-ellipsis > span:focus,
    .dt-pagination .pagination > li.dt-pagination-ellipsis > span:hover {
      background: ${theme.colorBgLayout};
      border-color: ${theme.colorBorderSecondary};
    }

    /* Ellipsis default appearance */
    .dt-pagination .pagination > li.dt-pagination-ellipsis > span {
      background: transparent;
      border: 1px solid transparent;
      color: ${theme.colorTextTertiary};
      cursor: default;
    }

    .dt-no-results {
      text-align: center;
      padding: 1em 0.6em;
      min-height: 48px;
    }

    .right-border-only { border-right: 2px solid ${theme.colorSplit}; }
    table .right-border-only:last-child {
      border-right: none;
    }
    .selection-cell {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      width: 3rem;
      min-width: 3rem;
    }
    .selection-cell-number {
      display: block;
      text-overflow: ellipsis;
    }

    /* Generic ellipsis trigger styling to match header/pagination ellipsis */
    .dt-ellipsis-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      min-width: 12px;
      min-height: 12px;
      border-radius: ${theme.borderRadius}px;
      background: transparent;
      border: 1px solid transparent;
      color: #1a1a1a; /* near black for column menu icon */
      cursor: pointer;
      line-height: 1;
      user-select: none;
    }
    .dt-ellipsis-button:hover,
    .dt-ellipsis-button:focus {
      background: ${theme.colorBgLayout};
      border-color: ${theme.colorBorderSecondary};
      color: #000000; /* black on hover/focus */
      outline: none;
    }
    .dt-ellipsis-button svg {
      fill-opacity: 1; /* override th svg opacity */
    }
    .dt-tag-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-left: ${theme.marginXXS}px;
      color: inherit;
    }
    .dt-tag-sep {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 ${theme.marginXXS}px;
      color: ${theme.colorTextTertiary};
      user-select: none;
    }

    /* Advanced filter popover in header */
    .dt-filter-icon {
      margin-left: 0;
      color: #1a1a1a; /* near black for advanced filter icon */
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      min-width: 12px;
      min-height: 12px;
      border-radius: ${theme.borderRadius}px;
      background: transparent;
      border: 1px solid transparent;
    }
    .dt-filter-icon:hover,
    .dt-filter-icon:focus {
      background: ${theme.colorBgLayout};
      border-color: ${theme.colorBorderSecondary};
      color: #000000; /* black on hover/focus */
      outline: none;
    }
    .dt-filter-icon.active {
      color: #1a1a1a; /* keep near black when active */
    }
    .dt-filter-icon.active:hover,
    .dt-filter-icon.active:focus {
      color: #000000; /* black on hover when active */
    }
    .dt-filter-icon svg {
      fill-opacity: 1; /* override th svg opacity */
    }
    .dt-filter-panel {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: 10000; /* above sticky cells and dropdowns */
      background: ${theme.colorBgBase};
      border: 1px solid ${theme.colorBorder};
      box-shadow: none !important;
      padding: ${theme.paddingMD}px;
      min-width: 280px;
      max-width: 380px;
      max-height: 500px;
      border-radius: ${theme.borderRadiusLG}px;
      font-size: ${theme.fontSize}px;
      display: flex;
      flex-direction: column;
    }
    /* Ensure Ant overlay menu does not add its own shadow */
    .ant-dropdown-menu.dt-filter-panel,
    .ant-dropdown-menu-light.dt-filter-panel {
      box-shadow: none !important;
      border: 1px solid ${theme.colorBorder};
    }
    .dt-filter-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 4px;
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      font-size: 10px;
      line-height: 14px;
      color: #fff;
      background: ${theme.colorPrimary};
      border-radius: 7px;
    }
    .dt-filter-panel select,
    .dt-filter-panel input[type="number"],
    .dt-filter-panel input[type="text"],
    .dt-filter-panel input:not([type]) {
      width: 100%;
      box-sizing: border-box;
    }
    .dt-condition-list {
      display: flex;
      flex-direction: column;
      gap: ${theme.marginXS}px;
      max-height: 200px;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .dt-condition-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: nowrap;
      background: ${theme.colorBgLayout};
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadiusSM}px;
      padding: 8px 10px;
      font-size: ${theme.fontSizeSM}px;
      box-shadow: none;
      transition: all 0.2s ease;
    }
    .dt-condition-row:hover {
      background: ${theme.colorBgContainer};
      border-color: ${theme.colorPrimary};
    }
    .dt-condition-row:focus-within {
      background: ${theme.colorBgContainer};
      border-color: ${theme.colorPrimary};
      outline: none;
    }
    .dt-condition-row .left {
      display: inline-flex;
      align-items: center;
      gap: ${theme.marginXXS}px;
      min-width: 0;
      flex: 1 1 auto;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .dt-chip-connector, .dt-next-connector {
      color: ${theme.colorTextTertiary};
    }
    .dt-chip-connector .ant-radio-button-wrapper,
    .dt-next-connector .ant-radio-button-wrapper {
      padding: 0 ${theme.paddingXXS}px;
      height: 22px;
      line-height: 20px;
      font-size: ${theme.fontSizeSM - 1}px;
    }
    .dt-chip-op {
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorPrimary};
    }
    .dt-chip-val {
      color: ${theme.colorText};
      font-family: ${theme.fontFamilyCode || 'monospace'};
    }
    .dt-chip-close {
      cursor: pointer;
      color: ${theme.colorTextTertiary};
      padding: 2px;
      border-radius: ${theme.borderRadiusSM}px;
      transition: all 0.2s ease;
    }
    .dt-chip-close:hover {
      color: ${theme.colorError};
      background: ${theme.colorErrorBgHover};
    }
    .dt-condition-separator {
      height: 1px;
      background: ${theme.colorBorderSecondary};
      margin: ${theme.marginMD}px 0;
      width: 100%;
    }
    .dt-filter-panel .row + .row { margin-top: ${theme.marginXS}px; }
    .dt-filter-panel .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dt-filter-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: ${theme.marginSM}px;
      padding-top: ${theme.paddingSM}px;
      border-top: 1px solid ${theme.colorBorderSecondary};
    }
    .dt-filter-actions .left {
      flex: 0 0 auto;
      display: inline-flex;
      gap: ${theme.marginXS}px;
    }
    .dt-filter-actions .right {
      flex: 0 0 auto;
      display: inline-flex;
      justify-content: flex-end;
    }
    .dt-filter-panel .ant-btn,
    .dt-filter-actions .ant-btn {
      height: 24px;
      padding: 0 ${theme.paddingSM}px;
      font-size: ${theme.fontSizeSM}px;
      line-height: 22px;
      border-radius: ${theme.borderRadiusSM}px;
    }
    .dt-filter-actions .ant-tag {
      margin-inline-end: 0;
      margin-inline-start: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: ${theme.paddingXS}px ${theme.paddingSM}px;
      font-size: ${theme.fontSize}px;
      line-height: 1.5;
    }
    .dt-filter-panel .row { margin-bottom: ${theme.marginXS}px; }
    .dt-filter-panel .row:last-child { margin-bottom: 0; }
    .dt-filter-chip {
      display: inline-flex;
      align-items: center;
      gap: ${theme.marginXXS}px;
      background: ${theme.colorBgLayout};
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadiusSM}px;
      padding: 2px 6px;
      margin: 2px;
      font-size: ${theme.fontSizeSM}px;
    }
    .dt-filter-chip .dt-chip-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: ${theme.marginXXS}px;
      cursor: pointer;
      color: ${theme.colorTextTertiary};
      flex: 0 0 auto;
    }
    .dt-filter-chip .dt-chip-close:hover,
    .dt-filter-chip .dt-chip-close:focus {
      color: ${theme.colorText};
    }

    /* All-filters panel (from Filters tag) */
    .dt-all-filters-panel {
      max-width: 520px;
      max-height: 320px;
      overflow: auto;
      padding: ${theme.paddingSM}px;
      box-shadow: none !important;
    }
    .dt-all-filters-panel .title {
      font-weight: ${theme.fontWeightStrong};
      margin-bottom: ${theme.marginXS}px;
    }
    .dt-all-filters-panel .group {
      margin-bottom: ${theme.marginXS}px;
    }
    .dt-all-filters-panel .group-label {
      font-weight: ${theme.fontWeightStrong};
      margin-bottom: 2px;
    }
    .dt-all-filters-panel .group-conds {
      display: block;
    }
    .dt-all-filters-panel .cond {
      display: inline-block;
      margin-right: ${theme.marginXS}px;
      margin-bottom: 2px;
      white-space: normal;
    }
    .dt-all-filters-panel .cond .connector {
      color: ${theme.colorTextTertiary};
      margin-right: 4px;
    }
    .dt-all-filters-panel .cond .op { font-weight: ${theme.fontWeightStrong}; margin-right: 4px; }
    .dt-all-filters-panel .cond .val { margin-right: 4px; }
    .dt-all-filters-panel .actions {
      display: flex;
      justify-content: flex-end;
      gap: ${theme.marginXXS}px;
      border-top: 1px solid ${theme.colorSplit};
      margin-top: ${theme.marginXS}px;
      padding-top: ${theme.paddingXS}px;
    }
    .dt-all-filters-panel .actions .ant-btn {
      height: 22px;
      padding: 0 ${theme.paddingXXS}px;
      font-size: ${Math.max(11, theme.fontSizeSM - 1)}px;
      line-height: 20px;
    }

    /* Pinned columns */
    th.pinned-left, td.pinned-left {
      position: sticky;
      left: 0; /* actual offset is applied inline */
      z-index: 3;
      background: ${theme.colorBgBase};
      box-shadow: 2px 0 0 ${theme.colorSplit};
    }
    th.pinned-right, td.pinned-right {
      position: sticky;
      right: 0; /* actual offset is applied inline */
      z-index: 3;
      background: ${theme.colorBgBase};
      box-shadow: -2px 0 0 ${theme.colorSplit};
    }

    /* Keyboard navigation focus styles */
    td.dt-cell-focused {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
      position: relative;
      z-index: 4; /* Above pinned columns */
    }
    td.dt-cell-focused:focus {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: -2px;
    }

  `}
`;
