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

export type AgGridFilterType = 'text' | 'number' | 'date' | 'set' | 'boolean';

export type AgGridFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'inRange'
  | 'blank'
  | 'notBlank'
  // Custom server-side date filter operators (always pass client-side filtering)
  | 'serverEquals'
  | 'serverNotEqual'
  | 'serverBefore'
  | 'serverAfter'
  | 'serverInRange'
  | 'serverBlank'
  | 'serverNotBlank';

export type AgGridLogicalOperator = 'AND' | 'OR';

export const FILTER_OPERATORS = {
  EQUALS: 'equals' as const,
  NOT_EQUAL: 'notEqual' as const,
  CONTAINS: 'contains' as const,
  NOT_CONTAINS: 'notContains' as const,
  STARTS_WITH: 'startsWith' as const,
  ENDS_WITH: 'endsWith' as const,
  LESS_THAN: 'lessThan' as const,
  LESS_THAN_OR_EQUAL: 'lessThanOrEqual' as const,
  GREATER_THAN: 'greaterThan' as const,
  GREATER_THAN_OR_EQUAL: 'greaterThanOrEqual' as const,
  IN_RANGE: 'inRange' as const,
  BLANK: 'blank' as const,
  NOT_BLANK: 'notBlank' as const,
  // Custom server-side date filter operators
  SERVER_EQUALS: 'serverEquals' as const,
  SERVER_NOT_EQUAL: 'serverNotEqual' as const,
  SERVER_BEFORE: 'serverBefore' as const,
  SERVER_AFTER: 'serverAfter' as const,
  SERVER_IN_RANGE: 'serverInRange' as const,
  SERVER_BLANK: 'serverBlank' as const,
  SERVER_NOT_BLANK: 'serverNotBlank' as const,
} as const;

export const SQL_OPERATORS = {
  EQUALS: '=',
  NOT_EQUALS: '!=',
  ILIKE: 'ILIKE',
  NOT_ILIKE: 'NOT ILIKE',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL: '<=',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL: '>=',
  BETWEEN: 'BETWEEN',
  IS_NULL: 'IS NULL',
  IS_NOT_NULL: 'IS NOT NULL',
  IN: 'IN',
  TEMPORAL_RANGE: 'TEMPORAL_RANGE',
} as const;

export type FilterValue = string | number | boolean | Date | null;

// Regex for validating column names. Allows:
// - Alphanumeric chars, underscores, dots, spaces (standard column names)
// - Parentheses for aggregate functions like COUNT(*)
// - % for LIKE patterns, * for wildcards, + - / for computed columns
const COLUMN_NAME_REGEX = /^[a-zA-Z0-9_. ()%*+\-/]+$/;

export interface AgGridSimpleFilter {
  filterType: AgGridFilterType;
  type: AgGridFilterOperator;
  filter?: FilterValue;
  filterTo?: FilterValue;
  // Date filter properties
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface AgGridCompoundFilter {
  filterType: AgGridFilterType;
  operator: AgGridLogicalOperator;
  condition1: AgGridSimpleFilter;
  condition2: AgGridSimpleFilter;
  conditions?: AgGridSimpleFilter[];
}

export interface AgGridSetFilter {
  filterType: 'set';
  values: FilterValue[];
}

export type AgGridFilterModel = Record<
  string,
  AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter
>;

export interface SQLAlchemyFilter {
  col: string;
  op: string;
  val: FilterValue | FilterValue[];
}

export interface ConvertedFilter {
  simpleFilters: SQLAlchemyFilter[];
  complexWhere?: string;
  havingClause?: string;
}

const AG_GRID_TO_SQLA_OPERATOR_MAP: Record<AgGridFilterOperator, string> = {
  [FILTER_OPERATORS.EQUALS]: SQL_OPERATORS.EQUALS,
  [FILTER_OPERATORS.NOT_EQUAL]: SQL_OPERATORS.NOT_EQUALS,
  [FILTER_OPERATORS.CONTAINS]: SQL_OPERATORS.ILIKE,
  [FILTER_OPERATORS.NOT_CONTAINS]: SQL_OPERATORS.NOT_ILIKE,
  [FILTER_OPERATORS.STARTS_WITH]: SQL_OPERATORS.ILIKE,
  [FILTER_OPERATORS.ENDS_WITH]: SQL_OPERATORS.ILIKE,
  [FILTER_OPERATORS.LESS_THAN]: SQL_OPERATORS.LESS_THAN,
  [FILTER_OPERATORS.LESS_THAN_OR_EQUAL]: SQL_OPERATORS.LESS_THAN_OR_EQUAL,
  [FILTER_OPERATORS.GREATER_THAN]: SQL_OPERATORS.GREATER_THAN,
  [FILTER_OPERATORS.GREATER_THAN_OR_EQUAL]: SQL_OPERATORS.GREATER_THAN_OR_EQUAL,
  [FILTER_OPERATORS.IN_RANGE]: SQL_OPERATORS.BETWEEN,
  [FILTER_OPERATORS.BLANK]: SQL_OPERATORS.IS_NULL,
  [FILTER_OPERATORS.NOT_BLANK]: SQL_OPERATORS.IS_NOT_NULL,
  // Server-side date filter operators (map to same SQL operators as standard ones)
  [FILTER_OPERATORS.SERVER_EQUALS]: SQL_OPERATORS.EQUALS,
  [FILTER_OPERATORS.SERVER_NOT_EQUAL]: SQL_OPERATORS.NOT_EQUALS,
  [FILTER_OPERATORS.SERVER_BEFORE]: SQL_OPERATORS.LESS_THAN,
  [FILTER_OPERATORS.SERVER_AFTER]: SQL_OPERATORS.GREATER_THAN,
  [FILTER_OPERATORS.SERVER_IN_RANGE]: SQL_OPERATORS.BETWEEN,
  [FILTER_OPERATORS.SERVER_BLANK]: SQL_OPERATORS.IS_NULL,
  [FILTER_OPERATORS.SERVER_NOT_BLANK]: SQL_OPERATORS.IS_NOT_NULL,
};

/**
 * Escapes single quotes in SQL strings to prevent SQL injection
 * @param value - String value to escape
 * @returns Escaped string safe for SQL queries
 */
function escapeSQLString(value: string): string {
  return value.replace(/'/g, "''");
}

// Maximum column name length - conservative upper bound that exceeds all common
// database identifier limits (MySQL: 64, PostgreSQL: 63, SQL Server: 128, Oracle: 128)
const MAX_COLUMN_NAME_LENGTH = 255;

/**
 * Validates a column name to prevent SQL injection
 * Checks for: non-empty string, length limit, allowed characters
 */
export function validateColumnName(columnName: string): boolean {
  if (!columnName || typeof columnName !== 'string') {
    return false;
  }

  if (columnName.length > MAX_COLUMN_NAME_LENGTH) {
    return false;
  }

  if (!COLUMN_NAME_REGEX.test(columnName)) {
    return false;
  }

  return true;
}

/**
 * Validates a filter value for a given operator
 * BLANK and NOT_BLANK operators don't require values
 * @param value - Filter value to validate
 * @param operator - AG Grid filter operator
 * @returns True if the value is valid for the operator, false otherwise
 */
function validateFilterValue(
  value: FilterValue | undefined,
  operator: AgGridFilterOperator,
): boolean {
  if (
    operator === FILTER_OPERATORS.BLANK ||
    operator === FILTER_OPERATORS.NOT_BLANK
  ) {
    return true;
  }

  if (value === undefined) {
    return false;
  }

  const valueType = typeof value;
  if (
    value !== null &&
    valueType !== 'string' &&
    valueType !== 'number' &&
    valueType !== 'boolean' &&
    !(value instanceof Date)
  ) {
    return false;
  }

  return true;
}

function formatValueForOperator(
  operator: AgGridFilterOperator,
  value: FilterValue,
): FilterValue {
  if (typeof value === 'string') {
    if (
      operator === FILTER_OPERATORS.CONTAINS ||
      operator === FILTER_OPERATORS.NOT_CONTAINS
    ) {
      return `%${value}%`;
    }
    if (operator === FILTER_OPERATORS.STARTS_WITH) {
      return `${value}%`;
    }
    if (operator === FILTER_OPERATORS.ENDS_WITH) {
      return `%${value}`;
    }
  }
  return value;
}

/**
 * Format a date string to ISO format expected by Superset, preserving local timezone
 */
export function formatDateForSuperset(dateStr: string): string {
  // AG Grid typically provides dates in format: "YYYY-MM-DD HH:MM:SS"
  // Superset expects: "YYYY-MM-DDTHH:MM:SS" in local timezone (not UTC)
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr; // Return as-is if invalid
  }

  // Format date in local timezone, not UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const formatted = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  return formatted;
}

/**
 * Get the start of day (00:00:00) for a given date string
 */
export function getStartOfDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return formatDateForSuperset(date.toISOString());
}

/**
 * Get the end of day (23:59:59) for a given date string
 */
export function getEndOfDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setHours(23, 59, 59, 999);
  return formatDateForSuperset(date.toISOString());
}

/**
 * Convert a date filter to a WHERE clause
 * @param columnName - Column name
 * @param filter - AG Grid date filter
 * @returns WHERE clause string for date filter
 */
function dateFilterToWhereClause(
  columnName: string,
  filter: AgGridSimpleFilter,
): string {
  const { type, dateFrom, dateTo, filter: filterValue, filterTo } = filter;

  // Support both dateFrom/dateTo and filter/filterTo
  const fromDate = dateFrom || (filterValue as string);
  const toDate = dateTo || (filterTo as string);

  // Convert based on operator type
  switch (type) {
    case FILTER_OPERATORS.EQUALS:
      if (!fromDate) return '';
      // For equals, check if date is within the full day range
      return `(${columnName} >= '${getStartOfDay(fromDate)}' AND ${columnName} <= '${getEndOfDay(fromDate)}')`;

    case FILTER_OPERATORS.NOT_EQUAL:
      if (!fromDate) return '';
      // For not equals, exclude the full day range
      return `(${columnName} < '${getStartOfDay(fromDate)}' OR ${columnName} > '${getEndOfDay(fromDate)}')`;

    case FILTER_OPERATORS.LESS_THAN:
      if (!fromDate) return '';
      return `${columnName} < '${getStartOfDay(fromDate)}'`;

    case FILTER_OPERATORS.LESS_THAN_OR_EQUAL:
      if (!fromDate) return '';
      return `${columnName} <= '${getEndOfDay(fromDate)}'`;

    case FILTER_OPERATORS.GREATER_THAN:
      if (!fromDate) return '';
      return `${columnName} > '${getEndOfDay(fromDate)}'`;

    case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
      if (!fromDate) return '';
      return `${columnName} >= '${getStartOfDay(fromDate)}'`;

    case FILTER_OPERATORS.IN_RANGE:
      if (!fromDate || !toDate) return '';
      return `${columnName} ${SQL_OPERATORS.BETWEEN} '${getStartOfDay(fromDate)}' AND '${getEndOfDay(toDate)}'`;

    case FILTER_OPERATORS.BLANK:
      return `${columnName} ${SQL_OPERATORS.IS_NULL}`;

    case FILTER_OPERATORS.NOT_BLANK:
      return `${columnName} ${SQL_OPERATORS.IS_NOT_NULL}`;

    default:
      return '';
  }
}

function simpleFilterToWhereClause(
  columnName: string,
  filter: AgGridSimpleFilter,
): string {
  // Check if this is a date filter and handle it specially
  if (filter.filterType === 'date') {
    return dateFilterToWhereClause(columnName, filter);
  }

  const { type, filter: value, filterTo } = filter;

  const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];
  if (!operator) {
    return '';
  }

  if (!validateFilterValue(value, type)) {
    return '';
  }

  if (type === FILTER_OPERATORS.BLANK) {
    return `${columnName} ${SQL_OPERATORS.IS_NULL}`;
  }

  if (type === FILTER_OPERATORS.NOT_BLANK) {
    return `${columnName} ${SQL_OPERATORS.IS_NOT_NULL}`;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (type === FILTER_OPERATORS.IN_RANGE && filterTo !== undefined) {
    return `${columnName} ${SQL_OPERATORS.BETWEEN} ${value} AND ${filterTo}`;
  }

  const formattedValue = formatValueForOperator(type, value!);

  if (
    operator === SQL_OPERATORS.ILIKE ||
    operator === SQL_OPERATORS.NOT_ILIKE
  ) {
    return `${columnName} ${operator} '${escapeSQLString(String(formattedValue))}'`;
  }

  if (typeof formattedValue === 'string') {
    return `${columnName} ${operator} '${escapeSQLString(formattedValue)}'`;
  }

  return `${columnName} ${operator} ${formattedValue}`;
}

function isCompoundFilter(
  filter: AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter,
): filter is AgGridCompoundFilter {
  return (
    'operator' in filter && ('condition1' in filter || 'conditions' in filter)
  );
}

function isSetFilter(
  filter: AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter,
): filter is AgGridSetFilter {
  return filter.filterType === 'set' && 'values' in filter;
}

function compoundFilterToWhereClause(
  columnName: string,
  filter: AgGridCompoundFilter,
): string {
  const { operator, condition1, condition2, conditions } = filter;

  if (conditions && conditions.length > 0) {
    const clauses = conditions
      .map(cond => {
        const clause = simpleFilterToWhereClause(columnName, cond);

        return clause;
      })
      .filter(clause => clause !== '');

    if (clauses.length === 0) {
      return '';
    }

    if (clauses.length === 1) {
      return clauses[0];
    }

    const result = `(${clauses.join(` ${operator} `)})`;

    return result;
  }

  const clause1 = simpleFilterToWhereClause(columnName, condition1);
  const clause2 = simpleFilterToWhereClause(columnName, condition2);

  if (!clause1 && !clause2) {
    return '';
  }

  if (!clause1) {
    return clause2;
  }

  if (!clause2) {
    return clause1;
  }

  const result = `(${clause1} ${operator} ${clause2})`;
  return result;
}

// Converts date filters to TEMPORAL_RANGE format for Superset backend
function convertDateFilter(
  columnName: string,
  filter: AgGridSimpleFilter,
): SQLAlchemyFilter | null {
  if (filter.filterType !== 'date') {
    return null;
  }

  const { type, dateFrom, dateTo } = filter;

  // Handle null/blank checks for date columns
  if (
    type === FILTER_OPERATORS.BLANK ||
    type === FILTER_OPERATORS.SERVER_BLANK
  ) {
    return {
      col: columnName,
      op: SQL_OPERATORS.IS_NULL,
      val: null,
    };
  }

  if (
    type === FILTER_OPERATORS.NOT_BLANK ||
    type === FILTER_OPERATORS.SERVER_NOT_BLANK
  ) {
    return {
      col: columnName,
      op: SQL_OPERATORS.IS_NOT_NULL,
      val: null,
    };
  }

  // Validate we have at least one date
  if (!dateFrom && !dateTo) {
    return null;
  }

  let temporalRangeValue: string;

  // Convert based on operator type
  switch (type) {
    case FILTER_OPERATORS.EQUALS:
    case FILTER_OPERATORS.SERVER_EQUALS:
      if (!dateFrom) {
        return null;
      }
      // For equals, create a range for the entire day (00:00:00 to 23:59:59)
      temporalRangeValue = `${getStartOfDay(dateFrom)} : ${getEndOfDay(dateFrom)}`;
      break;

    case FILTER_OPERATORS.NOT_EQUAL:
    case FILTER_OPERATORS.SERVER_NOT_EQUAL:
      // NOT EQUAL for dates is complex, skip for now
      return null;

    case FILTER_OPERATORS.LESS_THAN:
    case FILTER_OPERATORS.SERVER_BEFORE:
      if (!dateFrom) {
        return null;
      }
      // Everything before the start of this date
      temporalRangeValue = ` : ${getStartOfDay(dateFrom)}`;
      break;

    case FILTER_OPERATORS.LESS_THAN_OR_EQUAL:
      if (!dateFrom) {
        return null;
      }
      // Everything up to and including the end of this date
      temporalRangeValue = ` : ${getEndOfDay(dateFrom)}`;
      break;

    case FILTER_OPERATORS.GREATER_THAN:
    case FILTER_OPERATORS.SERVER_AFTER:
      if (!dateFrom) {
        return null;
      }
      // Everything after the end of this date
      temporalRangeValue = `${getEndOfDay(dateFrom)} : `;
      break;

    case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
      if (!dateFrom) {
        return null;
      }
      // Everything from the start of this date onwards
      temporalRangeValue = `${getStartOfDay(dateFrom)} : `;
      break;

    case FILTER_OPERATORS.IN_RANGE:
    case FILTER_OPERATORS.SERVER_IN_RANGE:
      // Range between two dates
      if (!dateFrom || !dateTo) {
        return null;
      }
      // From start of first date to end of second date
      temporalRangeValue = `${getStartOfDay(dateFrom)} : ${getEndOfDay(dateTo)}`;
      break;

    default:
      return null;
  }

  const result = {
    col: columnName,
    op: SQL_OPERATORS.TEMPORAL_RANGE,
    val: temporalRangeValue,
  };

  return result;
}

// Converts AG Grid filters to SQLAlchemy format, separating dimension (WHERE) and metric (HAVING) filters
export function convertAgGridFiltersToSQL(
  filterModel: AgGridFilterModel,
  metricColumns: string[] = [],
): ConvertedFilter {
  if (!filterModel || typeof filterModel !== 'object') {
    return {
      simpleFilters: [],
      complexWhere: undefined,
      havingClause: undefined,
    };
  }

  const metricColumnsSet = new Set(metricColumns);
  const simpleFilters: SQLAlchemyFilter[] = [];
  const complexWhereClauses: string[] = [];
  const complexHavingClauses: string[] = [];

  Object.entries(filterModel).forEach(([columnName, filter]) => {
    if (!validateColumnName(columnName)) {
      return;
    }

    if (!filter || typeof filter !== 'object') {
      return;
    }

    const isMetric = metricColumnsSet.has(columnName);

    if (isSetFilter(filter)) {
      if (!Array.isArray(filter.values) || filter.values.length === 0) {
        return;
      }

      if (isMetric) {
        const values = filter.values
          .map(v => (typeof v === 'string' ? `'${escapeSQLString(v)}'` : v))
          .join(', ');
        complexHavingClauses.push(`${columnName} IN (${values})`);
      } else {
        simpleFilters.push({
          col: columnName,
          op: SQL_OPERATORS.IN,
          val: filter.values,
        });
      }
      return;
    }

    if (isCompoundFilter(filter)) {
      const whereClause = compoundFilterToWhereClause(columnName, filter);
      if (whereClause) {
        if (isMetric) {
          complexHavingClauses.push(whereClause);
        } else {
          complexWhereClauses.push(whereClause);
        }
      }
      return;
    }

    const simpleFilter = filter as AgGridSimpleFilter;

    // Check if this is a date filter and handle it specially
    if (simpleFilter.filterType === 'date') {
      const dateFilter = convertDateFilter(columnName, simpleFilter);
      if (dateFilter) {
        simpleFilters.push(dateFilter);
        return;
      }
    }

    const { type, filter: value } = simpleFilter;

    if (!type) {
      return;
    }

    const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];
    if (!operator) {
      return;
    }

    if (type === FILTER_OPERATORS.BLANK) {
      if (isMetric) {
        complexHavingClauses.push(`${columnName} ${SQL_OPERATORS.IS_NULL}`);
      } else {
        simpleFilters.push({
          col: columnName,
          op: SQL_OPERATORS.IS_NULL,
          val: null,
        });
      }
      return;
    }

    if (type === FILTER_OPERATORS.NOT_BLANK) {
      if (isMetric) {
        complexHavingClauses.push(`${columnName} ${SQL_OPERATORS.IS_NOT_NULL}`);
      } else {
        simpleFilters.push({
          col: columnName,
          op: SQL_OPERATORS.IS_NOT_NULL,
          val: null,
        });
      }
      return;
    }

    if (!validateFilterValue(value, type)) {
      return;
    }

    const formattedValue = formatValueForOperator(type, value!);

    if (isMetric) {
      const sqlClause = simpleFilterToWhereClause(columnName, simpleFilter);
      if (sqlClause) {
        complexHavingClauses.push(sqlClause);
      }
    } else {
      simpleFilters.push({
        col: columnName,
        op: operator,
        val: formattedValue,
      });
    }
  });

  let complexWhere;
  if (complexWhereClauses.length === 1) {
    [complexWhere] = complexWhereClauses;
  } else if (complexWhereClauses.length > 1) {
    complexWhere = `(${complexWhereClauses.join(' AND ')})`;
  }

  let havingClause;
  if (complexHavingClauses.length === 1) {
    [havingClause] = complexHavingClauses;
  } else if (complexHavingClauses.length > 1) {
    havingClause = `(${complexHavingClauses.join(' AND ')})`;
  }

  const result = {
    simpleFilters,
    complexWhere,
    havingClause,
  };

  return result;
}
