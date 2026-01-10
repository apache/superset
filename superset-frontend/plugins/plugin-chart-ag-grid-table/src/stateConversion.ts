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
  QuerySortBy,
  type AgGridChartState,
  type AgGridSortModel,
  type AgGridFilterModel,
  type AgGridFilter,
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

/** Escapes single quotes in SQL strings: O'Hara → O''Hara */
function escapeStringValue(value: string): string {
  return value.replace(/'/g, "''");
}

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
 * Converts any AG Grid filter to a SQL WHERE/HAVING clause.
 * Recursively handles both simple filters (single condition) and complex filters (multiple conditions with AND/OR).
 *
 * Examples:
 * - Simple text: {filterType: 'text', type: 'contains', filter: 'abc'} → "column_name ILIKE '%abc%'"
 * - Simple number: {filterType: 'number', type: 'greaterThan', filter: 5} → "column_name > 5"
 * - Complex: {operator: 'AND', condition1: {type: 'greaterThan', filter: 1}, condition2: {type: 'lessThan', filter: 16}}
 *   → "(column_name > 1 AND column_name < 16)"
 * - Set: {filterType: 'set', values: ['a', 'b']} → "column_name IN ('a', 'b')"
 */
function convertFilterToSQL(
  colId: string,
  filter: AgGridFilter,
): string | null {
  // Complex filter: has operator and conditions
  if (
    filter.operator &&
    (filter.condition1 || filter.condition2 || filter.conditions)
  ) {
    const conditions: string[] = [];

    // Collect all conditions
    [filter.condition1, filter.condition2, ...(filter.conditions || [])]
      .filter(Boolean)
      .forEach(condition => {
        const sql = convertFilterToSQL(colId, condition!);
        if (sql) conditions.push(sql);
      });

    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];

    return `(${conditions.join(` ${filter.operator} `)})`;
  }

  if (filter.filterType === 'text' && filter.filter && filter.type) {
    const op = TEXT_FILTER_OPERATORS[filter.type];
    const escapedFilter = escapeStringValue(String(filter.filter));
    const val = getTextComparator(filter.type, escapedFilter);

    return op === 'ILIKE' || op === 'NOT ILIKE'
      ? `${colId} ${op} '${val}'`
      : `${colId} ${op} '${escapedFilter}'`;
  }

  if (
    filter.filterType === 'number' &&
    filter.filter !== undefined &&
    filter.type
  ) {
    const op = NUMBER_FILTER_OPERATORS[filter.type];
    return `${colId} ${op} ${filter.filter}`;
  }

  if (filter.filterType === 'date' && filter.dateFrom && filter.type) {
    const op = NUMBER_FILTER_OPERATORS[filter.type];
    const escapedDate = escapeStringValue(filter.dateFrom);
    return `${colId} ${op} '${escapedDate}'`;
  }

  if (
    filter.filterType === 'set' &&
    Array.isArray(filter.values) &&
    filter.values.length > 0
  ) {
    const values = filter.values
      .map((v: string) => `'${escapeStringValue(v)}'`)
      .join(', ');
    return `${colId} IN (${values})`;
  }

  return null;
}

/**
 * Converts AG Grid filterModel to SQL WHERE/HAVING clauses.
 * All filters (simple and complex) are uniformly converted to SQL for consistent backend handling.
 *
 * Returns a map of column IDs to their SQL filter expressions.
 */
export function convertFilterModel(
  filterModel: AgGridFilterModel,
): { sqlClauses?: Record<string, string> } | undefined {
  if (!filterModel || Object.keys(filterModel).length === 0) {
    return undefined;
  }

  const sqlClauses: Record<string, string> = {};

  Object.entries(filterModel).forEach(([colId, filter]) => {
    const sqlClause = convertFilterToSQL(colId, filter);
    if (sqlClause) {
      sqlClauses[colId] = sqlClause;
    }
  });

  if (Object.keys(sqlClauses).length === 0) {
    return undefined;
  }

  return { sqlClauses };
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

  const sortBy = convertSortModel(agGridState.sortModel);
  if (sortBy) {
    ownState.sortBy = sortBy;
  }

  const columnOrder = convertColumnState(agGridState.columnState);
  if (columnOrder) {
    ownState.columnOrder = columnOrder;
  }

  const filterConversion = convertFilterModel(agGridState.filterModel);
  if (filterConversion?.sqlClauses) {
    ownState.sqlClauses = filterConversion.sqlClauses;
  }

  if (agGridState.pageSize !== undefined) {
    ownState.pageSize = agGridState.pageSize;
  }

  if (agGridState.currentPage !== undefined) {
    ownState.currentPage = agGridState.currentPage;
  }

  return ownState;
}
