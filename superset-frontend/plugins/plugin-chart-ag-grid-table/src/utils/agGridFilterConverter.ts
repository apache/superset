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
  | 'notBlank';

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
} as const;

export const SQL_OPERATORS = {
  EQUALS: '==',
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
} as const;

export type FilterValue = string | number | boolean | Date | null;

export interface AgGridSimpleFilter {
  filterType: AgGridFilterType;
  type: AgGridFilterOperator;
  filter?: FilterValue;
  filterTo?: FilterValue;
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
};

function validateColumnName(columnName: string): boolean {
  if (!columnName || typeof columnName !== 'string') {
    console.error('[AG Grid Filters] Column name must be a non-empty string');
    return false;
  }

  if (columnName.length > 255) {
    console.error(
      `[AG Grid Filters] Column name exceeds maximum length: ${columnName}`,
    );
    return false;
  }

  // Allow alphanumeric, underscore, dot, space, parentheses, and common metric characters
  // This supports both regular columns (e.g., "user_id", "first.name") and
  // metric columns (e.g., "COUNT(*)", "SUM(revenue)", "AVG(price)")
  if (!/^[a-zA-Z0-9_. ()%*+\-/]+$/.test(columnName)) {
    console.error(
      `[AG Grid Filters] Invalid column name format: ${columnName}`,
    );
    return false;
  }

  return true;
}

function validateFilterValue(
  value: FilterValue | undefined,
  operator: AgGridFilterOperator,
  columnName?: string,
): boolean {
  if (
    operator === FILTER_OPERATORS.BLANK ||
    operator === FILTER_OPERATORS.NOT_BLANK
  ) {
    return true;
  }

  if (value === undefined) {
    console.error(
      `[AG Grid Filters] Filter value required for operator: ${operator}${columnName ? ` (column: ${columnName})` : ''}`,
    );
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
    console.error(
      `[AG Grid Filters] Invalid filter value type: ${valueType}${columnName ? ` (column: ${columnName})` : ''}`,
    );
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

function simpleFilterToWhereClause(
  columnName: string,
  filter: AgGridSimpleFilter,
): string {
  const { type, filter: value, filterTo } = filter;

  const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];
  if (!operator) {
    console.error(
      `[AG Grid Filters] Unsupported filter operator: ${type} for column: ${columnName}`,
    );
    return '';
  }

  if (!validateFilterValue(value, type, columnName)) {
    return '';
  }

  if (type === FILTER_OPERATORS.BLANK) {
    return `${columnName} ${SQL_OPERATORS.IS_NULL}`;
  }

  if (type === FILTER_OPERATORS.NOT_BLANK) {
    return `${columnName} ${SQL_OPERATORS.IS_NOT_NULL}`;
  }

  // For non-blank operators, skip conditions with null values (cleared compound filters)
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
    return `${columnName} ${operator} '${formattedValue}'`;
  }

  if (typeof formattedValue === 'string') {
    return `${columnName} ${operator} '${formattedValue}'`;
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
      .map(cond => simpleFilterToWhereClause(columnName, cond))
      .filter(clause => clause !== '');

    if (clauses.length === 0) {
      return '';
    }

    // If only one valid clause remains, return it without wrapping in parentheses
    if (clauses.length === 1) {
      return clauses[0];
    }

    return `(${clauses.join(` ${operator} `)})`;
  }

  const clause1 = simpleFilterToWhereClause(columnName, condition1);
  const clause2 = simpleFilterToWhereClause(columnName, condition2);

  // Handle cases where one or both conditions are cleared
  if (!clause1 && !clause2) {
    return '';
  }

  // If only one condition is valid, return it without operator
  if (!clause1) {
    return clause2;
  }

  if (!clause2) {
    return clause1;
  }

  return `(${clause1} ${operator} ${clause2})`;
}

/**
 * Convert AG Grid filter model to SQLAlchemy filters
 *
 * @param filterModel - AG Grid filter model from onFilterChanged event
 * @param metricColumns - Array of metric column names (for HAVING clause)
 * @returns Object containing simple filters, WHERE clause, and HAVING clause
 */
export function convertAgGridFiltersToSQL(
  filterModel: AgGridFilterModel,
  metricColumns: string[] = [],
): ConvertedFilter {
  if (!filterModel || typeof filterModel !== 'object') {
    console.error(
      '[AG Grid Filters] Invalid filter model: must be a non-null object',
    );
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
      console.error(
        `[AG Grid Filters] Invalid filter for column: ${columnName}`,
      );
      return;
    }

    const isMetric = metricColumnsSet.has(columnName);

    if (isSetFilter(filter)) {
      if (!Array.isArray(filter.values)) {
        console.error(
          `[AG Grid Filters] Set filter values must be an array for column: ${columnName}`,
        );
        return;
      }

      if (filter.values.length === 0) {
        console.warn(
          `[AG Grid Filters] Empty set filter for column: ${columnName}`,
        );
        return;
      }

      // Set filters on metrics should go to HAVING clause as SQL
      if (isMetric) {
        const values = filter.values
          .map(v => (typeof v === 'string' ? `'${v}'` : v))
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
        // Compound filters on metrics go to HAVING clause
        if (isMetric) {
          complexHavingClauses.push(whereClause);
        } else {
          complexWhereClauses.push(whereClause);
        }
      }
      return;
    }

    const simpleFilter = filter as AgGridSimpleFilter;
    const { type, filter: value } = simpleFilter;

    if (!type) {
      console.error(
        `[AG Grid Filters] Missing filter type for column: ${columnName}`,
      );
      return;
    }

    const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];
    if (!operator) {
      console.error(
        `[AG Grid Filters] Unsupported filter operator: ${type} for column: ${columnName}`,
      );
      return;
    }

    // Handle BLANK and NOT_BLANK operators
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

    if (!validateFilterValue(value, type, columnName)) {
      return;
    }

    const formattedValue = formatValueForOperator(type, value!);

    // Simple filters on metrics go to HAVING clause as SQL
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

  const complexWhere =
    complexWhereClauses.length > 0
      ? `(${complexWhereClauses.join(' AND ')})`
      : undefined;

  const havingClause =
    complexHavingClauses.length > 0
      ? `(${complexHavingClauses.join(' AND ')})`
      : undefined;

  return {
    simpleFilters,
    complexWhere,
    havingClause,
  };
}
