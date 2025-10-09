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

import type { ColumnState, SortModelItem } from 'ag-grid-community';

// AG Grid filter type enums
export enum AgGridFilterType {
  Text = 'text',
  Number = 'number',
  Date = 'date',
  Set = 'set',
}

export enum AgGridTextFilterOperator {
  Equals = 'equals',
  NotEqual = 'notEqual',
  Contains = 'contains',
  NotContains = 'notContains',
  StartsWith = 'startsWith',
  EndsWith = 'endsWith',
  Blank = 'blank',
  NotBlank = 'notBlank',
}

export enum AgGridNumberFilterOperator {
  Equals = 'equals',
  NotEqual = 'notEqual',
  LessThan = 'lessThan',
  LessThanOrEqual = 'lessThanOrEqual',
  GreaterThan = 'greaterThan',
  GreaterThanOrEqual = 'greaterThanOrEqual',
  InRange = 'inRange',
  Blank = 'blank',
  NotBlank = 'notBlank',
}

/**
 * @deprecated Use ColumnState from 'ag-grid-community' instead
 */
export type AgGridColumnState = ColumnState;

/**
 * Extend AG Grid's SortModelItem to add sortIndex for multi-column sorting support
 */
export interface AgGridSortModel extends SortModelItem {
  sortIndex?: number;
}

interface AgGridTextFilter {
  filterType: AgGridFilterType.Text;
  type?: AgGridTextFilterOperator;
  filter?: string;
}

interface AgGridNumberFilter {
  filterType: AgGridFilterType.Number;
  type?: AgGridNumberFilterOperator;
  filter?: number;
  filterTo?: number;
}

interface AgGridSetFilter {
  filterType: AgGridFilterType.Set;
  values?: string[];
}

interface AgGridDateFilter {
  filterType: AgGridFilterType.Date;
  type?: AgGridNumberFilterOperator;
  dateFrom?: string;
  dateTo?: string;
}

type AgGridFilter =
  | AgGridTextFilter
  | AgGridNumberFilter
  | AgGridSetFilter
  | AgGridDateFilter;

export interface AgGridFilterModel {
  [colId: string]: AgGridFilter;
}

export interface AgGridChartState {
  columnState: ColumnState[];
  sortModel: AgGridSortModel[];
  filterModel: AgGridFilterModel;
  columnOrder?: string[];
  pageSize?: number;
  currentPage?: number;
}

// Query filter clause for backend processing
// This represents the converted AG Grid filter in a format the backend can understand
export interface AgGridQueryFilterClause {
  expressionType: 'SIMPLE';
  subject: string;
  operator: string;
  comparator: string | number | string[];
}
