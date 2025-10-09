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

/**
 * AG Grid Filter Model types
 */
export type AgGridFilterType =
  | 'text'
  | 'number'
  | 'date'
  | 'set'
  | 'boolean';

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

export interface AgGridSimpleFilter {
  filterType: AgGridFilterType;
  type: AgGridFilterOperator;
  filter?: any;
  filterTo?: any;
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
  values: string[];
}

export type AgGridFilterModel = Record<
  string,
  AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter
>;

/**
 * SQLAlchemy Filter Object (Superset format)
 */
export interface SQLAlchemyFilter {
  col: string;
  op: string;
  val: any;
}

/**
 * Converted Filter Result
 */
export interface ConvertedFilter {
  simpleFilters: SQLAlchemyFilter[];
  complexWhere?: string;
}

/**
 * AG Grid to SQLAlchemy operator mapping
 */
const AG_GRID_TO_SQLA_OPERATOR_MAP: Record<AgGridFilterOperator, string> = {
  equals: '==',
  notEqual: '!=',
  contains: 'ILIKE',
  notContains: 'NOT ILIKE',
  startsWith: 'ILIKE',
  endsWith: 'ILIKE',
  lessThan: '<',
  lessThanOrEqual: '<=',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  inRange: 'BETWEEN',
  blank: 'IS NULL',
  notBlank: 'IS NOT NULL',
};

/**
 * Format value for SQL based on operator
 */
function formatValueForOperator(
  operator: AgGridFilterOperator,
  value: any,
): any {
  if (operator === 'contains' || operator === 'notContains') {
    return `%${value}%`;
  }
  if (operator === 'startsWith') {
    return `${value}%`;
  }
  if (operator === 'endsWith') {
    return `%${value}`;
  }
  return value;
}

/**
 * Convert a simple AG Grid filter condition to SQL WHERE clause string
 */
function simpleFilterToWhereClause(
  columnName: string,
  filter: AgGridSimpleFilter,
): string {
  const { type, filter: value, filterTo } = filter;
  const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];

  if (type === 'blank') {
    return `${columnName} IS NULL`;
  }

  if (type === 'notBlank') {
    return `${columnName} IS NOT NULL`;
  }

  if (type === 'inRange' && filterTo !== undefined) {
    return `${columnName} BETWEEN ${value} AND ${filterTo}`;
  }

  const formattedValue = formatValueForOperator(type, value);

  // For ILIKE operators, wrap value in quotes
  if (operator === 'ILIKE' || operator === 'NOT ILIKE') {
    return `${columnName} ${operator} '${formattedValue}'`;
  }

  // For string values, wrap in quotes
  if (typeof formattedValue === 'string') {
    return `${columnName} ${operator} '${formattedValue}'`;
  }

  return `${columnName} ${operator} ${formattedValue}`;
}

/**
 * Check if filter is a compound filter (has operator AND/OR)
 */
function isCompoundFilter(
  filter: AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter,
): filter is AgGridCompoundFilter {
  return 'operator' in filter && ('condition1' in filter || 'conditions' in filter);
}

/**
 * Check if filter is a set filter
 */
function isSetFilter(
  filter: AgGridSimpleFilter | AgGridCompoundFilter | AgGridSetFilter,
): filter is AgGridSetFilter {
  return filter.filterType === 'set' && 'values' in filter;
}

/**
 * Convert compound AG Grid filter to SQL WHERE clause
 */
function compoundFilterToWhereClause(
  columnName: string,
  filter: AgGridCompoundFilter,
): string {
  const { operator, condition1, condition2, conditions } = filter;

  // Handle new multi-condition format
  if (conditions && conditions.length > 0) {
    const clauses = conditions.map(cond =>
      simpleFilterToWhereClause(columnName, cond),
    );
    return `(${clauses.join(` ${operator} `)})`;
  }

  // Handle legacy two-condition format
  const clause1 = simpleFilterToWhereClause(columnName, condition1);
  const clause2 = simpleFilterToWhereClause(columnName, condition2);

  return `(${clause1} ${operator} ${clause2})`;
}

/**
 * Convert AG Grid filter model to SQLAlchemy filters
 *
 * Simple filters (single condition) are converted to SQLAlchemy filter objects.
 * Complex filters (AND/OR conditions) are converted to SQL WHERE clause strings.
 *
 * @param filterModel - AG Grid filter model from onFilterChanged event
 * @returns Object containing simple filters and complex WHERE clause
 */
export function convertAgGridFiltersToSQL(
  filterModel: AgGridFilterModel,
): ConvertedFilter {
  const simpleFilters: SQLAlchemyFilter[] = [];
  const complexWhereClauses: string[] = [];

  Object.entries(filterModel).forEach(([columnName, filter]) => {
    // Handle Set Filter (multiple values)
    if (isSetFilter(filter)) {
      simpleFilters.push({
        col: columnName,
        op: 'IN',
        val: filter.values,
      });
      return;
    }

    // Handle Compound Filter (AND/OR)
    if (isCompoundFilter(filter)) {
      const whereClause = compoundFilterToWhereClause(columnName, filter);
      complexWhereClauses.push(whereClause);
      return;
    }

    // Handle Simple Filter
    const simpleFilter = filter as AgGridSimpleFilter;
    const { type, filter: value } = simpleFilter;

    // For blank/notBlank, we can use simple filter format
    if (type === 'blank') {
      simpleFilters.push({
        col: columnName,
        op: 'IS NULL',
        val: null,
      });
      return;
    }

    if (type === 'notBlank') {
      simpleFilters.push({
        col: columnName,
        op: 'IS NOT NULL',
        val: null,
      });
      return;
    }

    // For other operators, convert to simple filter objects
    const operator = AG_GRID_TO_SQLA_OPERATOR_MAP[type];
    const formattedValue = formatValueForOperator(type, value);

    // ALL single-condition filters can be simple filter objects
    simpleFilters.push({
      col: columnName,
      op: operator,
      val: formattedValue,
    });
  });

  // Combine all complex WHERE clauses with AND
  const complexWhere =
    complexWhereClauses.length > 0
      ? `(${complexWhereClauses.join(' AND ')})`
      : undefined;

  return {
    simpleFilters,
    complexWhere,
  };
}

/**
 * Log AG Grid filter conversion for debugging
 */
export function logFilterConversion(
  filterModel: AgGridFilterModel,
  converted: ConvertedFilter,
): void {
  console.log('========== AG Grid Filter Conversion ==========');
  console.log('Input Filter Model:', filterModel);
  console.log('\nConverted Results:');
  console.log('  Simple Filters:', converted.simpleFilters);
  console.log('  Complex WHERE:', converted.complexWhere);
  console.log('===============================================');
}
