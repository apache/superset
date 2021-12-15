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

import { styled } from '@superset-ui/core';

export const Styles = styled.div`
  table.pvtTable {
    position: relative;
    font-size: 12px;
    text-align: left;
    margin-top: 3px;
    margin-left: 3px;
    border-collapse: separate;
    font-family: 'Inter', Helvetica, Arial, sans-serif;
    line-height: 1.4;
  }

  table thead {
    position: sticky;
    top: 0;
  }

  table.pvtTable thead tr th,
  table.pvtTable tbody tr th {
    background-color: #fff;
    border-top: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
    font-size: 12px;
    padding: 5px;
    font-weight: normal;
  }

  table.pvtTable tbody tr.pvtRowTotals {
    position: sticky;
    bottom: 0;
  }

  table.pvtTable thead tr:last-child th,
  table.pvtTable thead tr:first-child th.pvtTotalLabel,
  table.pvtTable thead tr:nth-last-child(2) th.pvtColLabel,
  table.pvtTable thead th.pvtSubtotalLabel,
  table.pvtTable tbody tr:last-child th,
  table.pvtTable tbody tr:last-child td {
    border-bottom: 1px solid #e0e0e0;
  }

  table.pvtTable
    thead
    tr:last-child:not(:only-child)
    th.pvtAxisLabel
    ~ th.pvtColLabel,
  table.pvtTable tbody tr:first-child th,
  table.pvtTable tbody tr:first-child td {
    border-top: none;
  }

  table.pvtTable tbody tr td:last-child,
  table.pvtTable thead tr th:last-child:not(.pvtSubtotalLabel) {
    border-right: 1px solid #e0e0e0;
  }

  table.pvtTable
    thead
    tr:last-child:not(:only-child)
    th.pvtAxisLabel
    + .pvtTotalLabel {
    border-right: none;
  }

  table.pvtTable tr th.active {
    background-color: #d9dbe4;
  }

  table.pvtTable .pvtTotalLabel {
    text-align: right;
    font-weight: bold;
  }

  table.pvtTable .pvtSubtotalLabel {
    font-weight: bold;
  }

  table.pvtTable tbody tr td {
    color: #2a3f5f;
    padding: 5px;
    background-color: #fff;
    border-top: 1px solid #e0e0e0;
    border-left: 1px solid #e0e0e0;
    vertical-align: top;
    text-align: right;
  }

  table.pvtTable tbody tr th.pvtRowLabel {
    vertical-align: baseline;
  }

  .pvtTotal,
  .pvtGrandTotal {
    font-weight: bold;
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
    padding-right: 4px;
    cursor: pointer;
  }

  .hoverable:hover {
    background-color: #eceef2;
    cursor: pointer;
  }
`;
