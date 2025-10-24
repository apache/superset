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

import {
  BackendOwnState,
  QueryFilterClause,
  QuerySortBy,
  type AgGridChartState,
  type AgGridSortModel,
  type AgGridFilterModel,
} from '@superset-ui/core';

/**
 * AG Grid text filter type to backend operator mapping
 */
const TEXT_FILTER_OPERATORS: Record<string, string> = {
  equals: '==',
  notEqual: '!=',
  contains: 'ILIKE',
  notContains: 'NOT ILIKE',
  startsWith: 'ILIKE',
  endsWith: 'ILIKE',
};

/**
 * AG Grid number filter type to backend operator mapping
 */
const NUMBER_FILTER_OPERATORS: Record<string, string> = {
  equals: '==',
  notEqual: '!=',
  lessThan: '<',
  lessThanOrEqual: '<=',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
};

/**
 * Converts text filter value based on filter type
 */
function getTextComparator(type: string, value: string): string {
  if (type === 'contains' || type === 'notContains') {
    return `%${value}%`;
  }
  if (type === 'startsWith') {
    return `${value}%`;
  }
  if (type === 'endsWith') {
    return `%${value}`;
  }
  return value;
}

/**
 * Converts AG Grid sortModel to backend sortBy format
 */
export function convertSortModel(
  sortModel: AgGridSortModel[],
): QuerySortBy[] | undefined {
  if (!sortModel || sortModel.length === 0) {
    return undefined;
  }

  const sortItem = sortModel[0];
  return [
    {
      id: sortItem.colId,
      key: sortItem.colId,
      desc: sortItem.sort === 'desc',
    },
  ];
}

/**
 * Extracts column order from AG Grid columnState
 */
export function convertColumnState(
  columnState: Array<{ colId: string }>,
): string[] | undefined {
  if (!columnState || columnState.length === 0) {
    return undefined;
  }

  return columnState.map(col => col.colId);
}

/**
 * Converts AG Grid filterModel to backend filter clauses
 */
export function convertFilterModel(
  filterModel: AgGridFilterModel,
): QueryFilterClause[] | undefined {
  if (!filterModel || Object.keys(filterModel).length === 0) {
    return undefined;
  }

  const filters: QueryFilterClause[] = [];

  Object.keys(filterModel).forEach(colId => {
    const filter = filterModel[colId];

    // Text filter
    if (filter.filterType === 'text' && filter.filter && filter.type) {
      filters.push({
        col: colId,
        op: TEXT_FILTER_OPERATORS[filter.type] || 'ILIKE',
        val: getTextComparator(filter.type, filter.filter),
      });
    }
    // Number filter
    else if (
      filter.filterType === 'number' &&
      filter.filter !== undefined &&
      filter.type
    ) {
      filters.push({
        col: colId,
        op: NUMBER_FILTER_OPERATORS[filter.type] || '==',
        val: filter.filter,
      });
    }
    // Set filter (multi-select)
    else if (
      filter.filterType === 'set' &&
      Array.isArray(filter.values) &&
      filter.values.length > 0
    ) {
      filters.push({
        col: colId,
        op: 'IN',
        val: filter.values,
      });
    }
  });

  return filters.length > 0 ? filters : undefined;
}

/**
 * Base converter for AG Grid-based charts (table, pivot, etc.)
 * Converts AG Grid state to backend-compatible format.
 *
 * This can be extended by specific implementations (pivot) that need
 * additional conversion logic.
 */
export function convertAgGridStateToOwnState(
  agGridState: AgGridChartState,
): Partial<BackendOwnState> {
  const ownState: Partial<BackendOwnState> = {};

  // Convert sort model
  const sortBy = convertSortModel(agGridState.sortModel);
  if (sortBy) {
    ownState.sortBy = sortBy;
  }

  // Convert column state
  const columnOrder = convertColumnState(agGridState.columnState);
  if (columnOrder) {
    ownState.columnOrder = columnOrder;
  }

  // Convert filter model
  const filters = convertFilterModel(agGridState.filterModel);
  if (filters) {
    ownState.filters = filters;
  }

  // Include page size and current page if present
  if (agGridState.pageSize !== undefined) {
    ownState.pageSize = agGridState.pageSize;
  }

  if (agGridState.currentPage !== undefined) {
    ownState.currentPage = agGridState.currentPage;
  }

  return ownState;
}
