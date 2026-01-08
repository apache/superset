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
import {
  getStartOfDay,
  getEndOfDay,
  FILTER_OPERATORS,
  SQL_OPERATORS,
  validateColumnName,
} from './utils/agGridFilterConverter';

/**
 * Maps custom server-side date filter operators to normalized operator names.
 * Server-side operators (serverEquals, serverBefore, etc.) are custom operators
 * used when server_pagination is enabled to bypass client-side filtering.
 */
const DATE_FILTER_OPERATOR_MAP: Record<string, string> = {
  // Standard operators
  [FILTER_OPERATORS.EQUALS]: FILTER_OPERATORS.EQUALS,
  [FILTER_OPERATORS.NOT_EQUAL]: FILTER_OPERATORS.NOT_EQUAL,
  [FILTER_OPERATORS.LESS_THAN]: FILTER_OPERATORS.LESS_THAN,
  [FILTER_OPERATORS.LESS_THAN_OR_EQUAL]: FILTER_OPERATORS.LESS_THAN_OR_EQUAL,
  [FILTER_OPERATORS.GREATER_THAN]: FILTER_OPERATORS.GREATER_THAN,
  [FILTER_OPERATORS.GREATER_THAN_OR_EQUAL]: FILTER_OPERATORS.GREATER_THAN_OR_EQUAL,
  [FILTER_OPERATORS.IN_RANGE]: FILTER_OPERATORS.IN_RANGE,
  // Custom server-side operators (map to standard equivalents)
  [FILTER_OPERATORS.SERVER_EQUALS]: FILTER_OPERATORS.EQUALS,
  [FILTER_OPERATORS.SERVER_NOT_EQUAL]: FILTER_OPERATORS.NOT_EQUAL,
  [FILTER_OPERATORS.SERVER_BEFORE]: FILTER_OPERATORS.LESS_THAN,
  [FILTER_OPERATORS.SERVER_AFTER]: FILTER_OPERATORS.GREATER_THAN,
  [FILTER_OPERATORS.SERVER_IN_RANGE]: FILTER_OPERATORS.IN_RANGE,
};

/**
 * Blank filter operator types
 */
const BLANK_OPERATORS: Set<string> = new Set([
  FILTER_OPERATORS.BLANK,
  FILTER_OPERATORS.NOT_BLANK,
  FILTER_OPERATORS.SERVER_BLANK,
  FILTER_OPERATORS.SERVER_NOT_BLANK,
]);

/** Escapes single quotes in SQL strings: O'Hara → O''Hara */
function escapeStringValue(value: string): string {
  return value.replace(/'/g, "''");
}

function getTextComparator(type: string, value: string): string {
  if (type === FILTER_OPERATORS.CONTAINS || type === FILTER_OPERATORS.NOT_CONTAINS) {
    return `%${value}%`;
  }
  if (type === FILTER_OPERATORS.STARTS_WITH) {
    return `${value}%`;
  }
  if (type === FILTER_OPERATORS.ENDS_WITH) {
    return `%${value}`;
  }
  return value;
}

/**
 * Converts a date filter to SQL clause.
 * Handles both standard operators (equals, lessThan, etc.) and
 * custom server-side operators (serverEquals, serverBefore, etc.).
 *
 * @param colId - Column identifier
 * @param filter - AG Grid date filter object
 * @returns SQL clause string or null if conversion not possible
 */
function convertDateFilterToSQL(
  colId: string,
  filter: AgGridFilter,
): string | null {
  const { type, dateFrom, dateTo } = filter;

  if (!type) return null;

  // Map custom server operators to standard ones
  const normalizedType = DATE_FILTER_OPERATOR_MAP[type] || type;

  switch (normalizedType) {
    case FILTER_OPERATORS.EQUALS:
      if (!dateFrom) return null;
      // Full day range for equals
      return `(${colId} >= '${getStartOfDay(dateFrom)}' AND ${colId} <= '${getEndOfDay(dateFrom)}')`;

    case FILTER_OPERATORS.NOT_EQUAL:
      if (!dateFrom) return null;
      // Outside the full day range for not equals
      return `(${colId} < '${getStartOfDay(dateFrom)}' OR ${colId} > '${getEndOfDay(dateFrom)}')`;

    case FILTER_OPERATORS.LESS_THAN:
      if (!dateFrom) return null;
      return `${colId} < '${getStartOfDay(dateFrom)}'`;

    case FILTER_OPERATORS.LESS_THAN_OR_EQUAL:
      if (!dateFrom) return null;
      return `${colId} <= '${getEndOfDay(dateFrom)}'`;

    case FILTER_OPERATORS.GREATER_THAN:
      if (!dateFrom) return null;
      return `${colId} > '${getEndOfDay(dateFrom)}'`;

    case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
      if (!dateFrom) return null;
      return `${colId} >= '${getStartOfDay(dateFrom)}'`;

    case FILTER_OPERATORS.IN_RANGE:
      if (!dateFrom || !dateTo) return null;
      return `${colId} BETWEEN '${getStartOfDay(dateFrom)}' AND '${getEndOfDay(dateTo)}'`;

    default:
      return null;
  }
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
 * - Blank: {filterType: 'text', type: 'blank'} → "column_name IS NULL"
 * - Date: {filterType: 'date', type: 'serverBefore', dateFrom: '2024-01-01'} → "column_name < '2024-01-01T00:00:00'"
 */
function convertFilterToSQL(
  colId: string,
  filter: AgGridFilter,
): string | null {
  // Validate column name to prevent SQL injection and malformed queries
  if (!validateColumnName(colId)) {
    return null;
  }

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

  // Handle blank/notBlank operators for all filter types
  // These are special operators that check for NULL values
  if (filter.type && BLANK_OPERATORS.has(filter.type)) {
    if (
      filter.type === FILTER_OPERATORS.BLANK ||
      filter.type === FILTER_OPERATORS.SERVER_BLANK
    ) {
      return `${colId} ${SQL_OPERATORS.IS_NULL}`;
    }
    if (
      filter.type === FILTER_OPERATORS.NOT_BLANK ||
      filter.type === FILTER_OPERATORS.SERVER_NOT_BLANK
    ) {
      return `${colId} ${SQL_OPERATORS.IS_NOT_NULL}`;
    }
  }

  if (filter.filterType === 'text' && filter.filter && filter.type) {
    const escapedFilter = escapeStringValue(String(filter.filter));
    const val = getTextComparator(filter.type, escapedFilter);

    // Map text filter types to SQL operators
    switch (filter.type) {
      case FILTER_OPERATORS.EQUALS:
        return `${colId} ${SQL_OPERATORS.EQUALS} '${escapedFilter}'`;
      case FILTER_OPERATORS.NOT_EQUAL:
        return `${colId} ${SQL_OPERATORS.NOT_EQUALS} '${escapedFilter}'`;
      case FILTER_OPERATORS.CONTAINS:
        return `${colId} ${SQL_OPERATORS.ILIKE} '${val}'`;
      case FILTER_OPERATORS.NOT_CONTAINS:
        return `${colId} ${SQL_OPERATORS.NOT_ILIKE} '${val}'`;
      case FILTER_OPERATORS.STARTS_WITH:
      case FILTER_OPERATORS.ENDS_WITH:
        return `${colId} ${SQL_OPERATORS.ILIKE} '${val}'`;
      default:
        return null;
    }
  }

  if (
    filter.filterType === 'number' &&
    filter.filter !== undefined &&
    filter.type
  ) {
    // Map number filter types to SQL operators
    switch (filter.type) {
      case FILTER_OPERATORS.EQUALS:
        return `${colId} ${SQL_OPERATORS.EQUALS} ${filter.filter}`;
      case FILTER_OPERATORS.NOT_EQUAL:
        return `${colId} ${SQL_OPERATORS.NOT_EQUALS} ${filter.filter}`;
      case FILTER_OPERATORS.LESS_THAN:
        return `${colId} ${SQL_OPERATORS.LESS_THAN} ${filter.filter}`;
      case FILTER_OPERATORS.LESS_THAN_OR_EQUAL:
        return `${colId} ${SQL_OPERATORS.LESS_THAN_OR_EQUAL} ${filter.filter}`;
      case FILTER_OPERATORS.GREATER_THAN:
        return `${colId} ${SQL_OPERATORS.GREATER_THAN} ${filter.filter}`;
      case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
        return `${colId} ${SQL_OPERATORS.GREATER_THAN_OR_EQUAL} ${filter.filter}`;
      default:
        return null;
    }
  }

  // Handle date filters with proper date formatting and custom server operators
  if (filter.filterType === 'date' && filter.type) {
    return convertDateFilterToSQL(colId, filter);
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
