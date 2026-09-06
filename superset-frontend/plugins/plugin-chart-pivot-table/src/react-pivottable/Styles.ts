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

import { css, styled } from '@apache-superset/core/theme';

export const Styles = styled.div<{ isDashboardEditMode: boolean }>`
  ${({ theme, isDashboardEditMode }) => css`
    table.pvtTable {
      position: ${isDashboardEditMode ? 'inherit' : 'relative'};
      width: calc(100% - ${theme.sizeUnit}px);
      font-size: ${theme.fontSizeSM}px;
      text-align: left;
      margin: ${theme.sizeUnit}px;
      border-collapse: separate;
      border-spacing: 0;
      font-family: ${theme.fontFamily};
      line-height: 1.4;
    }

    /* The sticky thead and totals row each form their own stacking
     * context, so a z-index on a cell inside them can't outrank the
     * frozen row labels (z-index 1) in the body. The bands themselves
     * carry the z-index that keeps them painting over row labels
     * scrolling underneath. */
    table thead {
      background-color: ${theme.colorBgBase};
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      top: 0;
      z-index: 2;
    }

    /* Corner cell(s) sitting above the frozen row-label column: the
     * placeholder cell spanning the column-attribute rows, and the
     * row-attribute name cell(s) in the row-header row (which only
     * renders when there are row dimensions). The z-index keeps them
     * over the column labels scrolling underneath within the thead. */
    table.pvtTable thead tr:first-of-type th[aria-hidden='true'],
    table.pvtTable thead tr.pvtRowHeaderRow th.pvtAxisLabel {
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      top: 0;
      left: 0;
      z-index: 1;
      background-color: ${theme.colorBgBase};
    }

    table tbody tr {
      font-feature-settings: 'tnum' 1;
    }

    table.pvtTable thead tr th,
    table.pvtTable tbody tr th {
      border-top: 1px solid ${theme.colorSplit};
      border-left: 1px solid ${theme.colorSplit};
      font-size: ${theme.fontSizeSM}px;
      padding: ${theme.sizeUnit}px;
      font-weight: ${theme.fontWeightNormal};
    }

    table.pvtTable tbody tr.pvtRowTotals {
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      bottom: 0;
      z-index: 2;
      background-color: ${theme.colorBgBase};
    }

    table.pvtTable tbody tr.pvtRowTotals th,
    table.pvtTable tbody tr.pvtRowTotals td {
      background-color: ${theme.colorBgBase};
    }

    table.pvtTable thead tr:last-of-type th,
    table.pvtTable thead tr:first-of-type th.pvtTotalLabel,
    table.pvtTable thead tr:nth-last-of-type(2) th.pvtColLabel,
    table.pvtTable thead th.pvtSubtotalLabel,
    table.pvtTable tbody tr:last-of-type th,
    table.pvtTable tbody tr:last-of-type td {
      border-bottom: 1px solid ${theme.colorSplit};
    }

    table.pvtTable
      thead
      tr:last-of-type:not(:only-child)
      th.pvtAxisLabel
      ~ th.pvtColLabel,
    table.pvtTable tbody tr:first-of-type th,
    table.pvtTable tbody tr:first-of-type td {
      border-top: none;
    }

    table.pvtTable tbody tr td:last-of-type,
    table.pvtTable thead tr th:last-of-type:not(.pvtSubtotalLabel) {
      border-right: 1px solid ${theme.colorSplit};
    }

    table.pvtTable
      thead
      tr:last-of-type:not(:only-child)
      th.pvtAxisLabel
      + .pvtTotalLabel {
      border-right: none;
    }

    table.pvtTable tr th.active {
      background-color: ${theme.colorPrimaryBg};
    }

    table.pvtTable .pvtTotalLabel {
      text-align: right;
      font-weight: ${theme.fontWeightStrong};
    }

    table.pvtTable .pvtSubtotalLabel {
      font-weight: ${theme.fontWeightStrong};
    }

    table.pvtTable tbody tr td {
      color: ${theme.colorPrimaryText};
      padding: ${theme.sizeUnit}px;
      background-color: ${theme.colorBgBase};
      border-top: 1px solid ${theme.colorSplit};
      border-left: 1px solid ${theme.colorSplit};
      vertical-align: top;
      text-align: right;
    }

    table.pvtTable tbody tr th.pvtRowLabel {
      vertical-align: baseline;
      position: ${isDashboardEditMode ? 'inherit' : 'sticky'};
      left: 0;
      z-index: 1;
      background-color: ${theme.colorBgBase};
    }

    /* The frozen-cell background above is more specific than the generic
     * .hoverable:hover and th.active rules, so restate those states here
     * to keep hover and cross-filter highlighting visible on row labels.
     * The hover tint is layered as a background-image over the opaque
     * base so scrolled-under cells don't bleed through a translucent
     * fill token. */
    table.pvtTable tbody tr th.pvtRowLabel.hoverable:hover {
      background-image: linear-gradient(
        ${theme.colorFillContentHover},
        ${theme.colorFillContentHover}
      );
    }

    table.pvtTable tbody tr th.pvtRowLabel.active {
      background-color: ${theme.colorPrimaryBg};
    }

    table.pvtTable tbody tr th.pvtRowLabel.pvtRowLabelLast {
      border-bottom: 1px solid ${theme.colorSplit};
    }

    .pvtTotal,
    .pvtGrandTotal {
      font-weight: ${theme.fontWeightStrong};
    }

    table.pvtTable tbody tr td.pvtRowTotal {
      vertical-align: middle;
    }

    .toggle-wrapper {
      white-space: nowrap;
    }

    .toggle-wrapper > .toggle-val {
      white-space: normal;
    }

    .toggle {
      appearance: none;
      border: none;
      background: none;
      padding-right: ${theme.sizeUnit}px;
      font: inherit;
      cursor: pointer;
    }

    .sort-icon-btn {
      display: inline-flex;
      align-items: center;
      appearance: none;
      border: none;
      background: none;
      padding: 0;
      margin: 0;
      font: inherit;
      cursor: pointer;
    }

    .hoverable:hover {
      background-color: ${theme.colorFillContentHover};
      cursor: pointer;
    }
  `}
`;
