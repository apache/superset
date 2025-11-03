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

    /* Cell styling */
    th,
    td {
      min-width: 4.3em;
      padding: 0.75rem;
      vertical-align: top;
    }

    /* Header styling */
    thead > tr > th {
      padding-right: 0;
      position: relative;
      background-color: ${theme.colorBgBase};
      text-align: left;
      border-bottom: 2px solid ${theme.colorSplit};
      color: ${theme.colorText};
      vertical-align: bottom;
    }

    /* Icons in header */
    th svg {
      margin: 1px ${theme.sizeUnit / 2}px;
      fill-opacity: 0.2;
    }

    th.is-sorted svg {
      color: ${theme.colorText};
      fill-opacity: 1;
    }

    /* Table body styling */
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

    /* Controls and metrics */
    .dt-controls {
      padding-bottom: 0.65em;
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

    /* Cell truncation */
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

    /* Pagination styling */
    .dt-pagination {
      text-align: right;
      /* use padding instead of margin so clientHeight can capture it */
      padding: ${theme.paddingXXS}px 0px;
    }

    .dt-pagination .pagination > li {
      display: inline;
      margin: 0 ${theme.marginXXS}px;
    }

    .dt-pagination .pagination > li > a,
    .dt-pagination .pagination > li > span {
      background-color: ${theme.colorBgBase};
      color: ${theme.colorText};
      border-color: ${theme.colorBorderSecondary};
      padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
      border-radius: ${theme.borderRadius}px;
    }

    .dt-pagination .pagination > li.active > a,
    .dt-pagination .pagination > li.active > span,
    .dt-pagination .pagination > li.active > a:focus,
    .dt-pagination .pagination > li.active > a:hover,
    .dt-pagination .pagination > li.active > span:focus,
    .dt-pagination .pagination > li.active > span:hover {
      background-color: ${theme.colorPrimary};
      color: ${theme.colorBgContainer};
      border-color: ${theme.colorBorderSecondary};
    }

    .pagination > li > span.dt-pagination-ellipsis:focus,
    .pagination > li > span.dt-pagination-ellipsis:hover {
      background: ${theme.colorBgLayout};
      border-color: ${theme.colorBorderSecondary};
    }

    .dt-no-results {
      text-align: center;
      padding: 1em 0.6em;
    }

    .right-border-only {
      border-right: 2px solid ${theme.colorSplit};
    }

    table .right-border-only:last-child {
      border-right: none;
    }
  `}
`;
