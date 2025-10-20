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
 * software distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import '@testing-library/jest-dom';
import {
  convertAgGridFiltersToSQL,
  AgGridFilterModel,
  FILTER_OPERATORS,
  SQL_OPERATORS,
} from '../../src/utils/agGridFilterConverter';

test('converts simple text filter with equals operator', () => {
  const filterModel: AgGridFilterModel = {
    name: {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: 'John',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'name',
      op: SQL_OPERATORS.EQUALS,
      val: 'John',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple text filter with contains operator', () => {
  const filterModel: AgGridFilterModel = {
    description: {
      filterType: 'text',
      type: FILTER_OPERATORS.CONTAINS,
      filter: 'test',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'description',
      op: SQL_OPERATORS.ILIKE,
      val: '%test%',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple text filter with notContains operator', () => {
  const filterModel: AgGridFilterModel = {
    description: {
      filterType: 'text',
      type: FILTER_OPERATORS.NOT_CONTAINS,
      filter: 'test',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'description',
      op: SQL_OPERATORS.NOT_ILIKE,
      val: '%test%',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple text filter with startsWith operator', () => {
  const filterModel: AgGridFilterModel = {
    email: {
      filterType: 'text',
      type: FILTER_OPERATORS.STARTS_WITH,
      filter: 'admin',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'email',
      op: SQL_OPERATORS.ILIKE,
      val: 'admin%',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple text filter with endsWith operator', () => {
  const filterModel: AgGridFilterModel = {
    email: {
      filterType: 'text',
      type: FILTER_OPERATORS.ENDS_WITH,
      filter: '@example.com',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'email',
      op: SQL_OPERATORS.ILIKE,
      val: '%@example.com',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with equals operator', () => {
  const filterModel: AgGridFilterModel = {
    age: {
      filterType: 'number',
      type: FILTER_OPERATORS.EQUALS,
      filter: 25,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'age',
      op: SQL_OPERATORS.EQUALS,
      val: 25,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with notEqual operator', () => {
  const filterModel: AgGridFilterModel = {
    age: {
      filterType: 'number',
      type: FILTER_OPERATORS.NOT_EQUAL,
      filter: 25,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'age',
      op: SQL_OPERATORS.NOT_EQUALS,
      val: 25,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with lessThan operator', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      type: FILTER_OPERATORS.LESS_THAN,
      filter: 100,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'price',
      op: SQL_OPERATORS.LESS_THAN,
      val: 100,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with lessThanOrEqual operator', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      type: FILTER_OPERATORS.LESS_THAN_OR_EQUAL,
      filter: 100,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'price',
      op: SQL_OPERATORS.LESS_THAN_OR_EQUAL,
      val: 100,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with greaterThan operator', () => {
  const filterModel: AgGridFilterModel = {
    quantity: {
      filterType: 'number',
      type: FILTER_OPERATORS.GREATER_THAN,
      filter: 50,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'quantity',
      op: SQL_OPERATORS.GREATER_THAN,
      val: 50,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple number filter with greaterThanOrEqual operator', () => {
  const filterModel: AgGridFilterModel = {
    quantity: {
      filterType: 'number',
      type: FILTER_OPERATORS.GREATER_THAN_OR_EQUAL,
      filter: 50,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'quantity',
      op: SQL_OPERATORS.GREATER_THAN_OR_EQUAL,
      val: 50,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple filter with blank operator to IS NULL', () => {
  const filterModel: AgGridFilterModel = {
    notes: {
      filterType: 'text',
      type: FILTER_OPERATORS.BLANK,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'notes',
      op: SQL_OPERATORS.IS_NULL,
      val: null,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts simple filter with notBlank operator to IS NOT NULL', () => {
  const filterModel: AgGridFilterModel = {
    notes: {
      filterType: 'text',
      type: FILTER_OPERATORS.NOT_BLANK,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'notes',
      op: SQL_OPERATORS.IS_NOT_NULL,
      val: null,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts set filter with multiple values to IN operator', () => {
  const filterModel: AgGridFilterModel = {
    status: {
      filterType: 'set',
      values: ['active', 'pending', 'completed'],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'status',
      op: SQL_OPERATORS.IN,
      val: ['active', 'pending', 'completed'],
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts set filter with single value', () => {
  const filterModel: AgGridFilterModel = {
    category: {
      filterType: 'set',
      values: ['electronics'],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'category',
      op: SQL_OPERATORS.IN,
      val: ['electronics'],
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts set filter with numeric values', () => {
  const filterModel: AgGridFilterModel = {
    priority: {
      filterType: 'set',
      values: [1, 2, 3],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'priority',
      op: SQL_OPERATORS.IN,
      val: [1, 2, 3],
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts compound filter with AND operator to complex WHERE clause', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      operator: 'AND',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.GREATER_THAN,
        filter: 50,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.LESS_THAN,
        filter: 100,
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe('(price > 50 AND price < 100)');
});

test('converts compound filter with OR operator to complex WHERE clause', () => {
  const filterModel: AgGridFilterModel = {
    status: {
      filterType: 'text',
      operator: 'OR',
      condition1: {
        filterType: 'text',
        type: FILTER_OPERATORS.EQUALS,
        filter: 'active',
      },
      condition2: {
        filterType: 'text',
        type: FILTER_OPERATORS.EQUALS,
        filter: 'pending',
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe(
    "(status == 'active' OR status == 'pending')",
  );
});

test('converts compound filter with multiple conditions array', () => {
  const filterModel: AgGridFilterModel = {
    priority: {
      filterType: 'number',
      operator: 'OR',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.EQUALS,
        filter: 1,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.EQUALS,
        filter: 2,
      },
      conditions: [
        {
          filterType: 'number',
          type: FILTER_OPERATORS.EQUALS,
          filter: 1,
        },
        {
          filterType: 'number',
          type: FILTER_OPERATORS.EQUALS,
          filter: 2,
        },
        {
          filterType: 'number',
          type: FILTER_OPERATORS.EQUALS,
          filter: 3,
        },
      ],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe(
    '(priority == 1 OR priority == 2 OR priority == 3)',
  );
});

test('converts multiple simple filters into separate simple filter entries', () => {
  const filterModel: AgGridFilterModel = {
    name: {
      filterType: 'text',
      type: FILTER_OPERATORS.CONTAINS,
      filter: 'John',
    },
    age: {
      filterType: 'number',
      type: FILTER_OPERATORS.GREATER_THAN,
      filter: 25,
    },
    status: {
      filterType: 'set',
      values: ['active', 'pending'],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toHaveLength(3);
  expect(result.simpleFilters).toContainEqual({
    col: 'name',
    op: SQL_OPERATORS.ILIKE,
    val: '%John%',
  });
  expect(result.simpleFilters).toContainEqual({
    col: 'age',
    op: SQL_OPERATORS.GREATER_THAN,
    val: 25,
  });
  expect(result.simpleFilters).toContainEqual({
    col: 'status',
    op: SQL_OPERATORS.IN,
    val: ['active', 'pending'],
  });
  expect(result.complexWhere).toBeUndefined();
});

test('converts mix of simple and compound filters correctly', () => {
  const filterModel: AgGridFilterModel = {
    name: {
      filterType: 'text',
      type: FILTER_OPERATORS.CONTAINS,
      filter: 'John',
    },
    price: {
      filterType: 'number',
      operator: 'AND',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.GREATER_THAN,
        filter: 50,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.LESS_THAN,
        filter: 100,
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'name',
      op: SQL_OPERATORS.ILIKE,
      val: '%John%',
    },
  ]);
  expect(result.complexWhere).toBe('(price > 50 AND price < 100)');
});

test('combines multiple compound filters with AND in complex WHERE clause', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      operator: 'AND',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.GREATER_THAN,
        filter: 50,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.LESS_THAN,
        filter: 100,
      },
    },
    quantity: {
      filterType: 'number',
      operator: 'OR',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.LESS_THAN,
        filter: 10,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.GREATER_THAN,
        filter: 100,
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toContain('price > 50 AND price < 100');
  expect(result.complexWhere).toContain('quantity < 10 OR quantity > 100');
  expect(result.complexWhere).toMatch(/^\(.+ AND .+\)$/);
});

test('converts inRange filter to BETWEEN operator in simple filters', () => {
  const filterModel: AgGridFilterModel = {
    age: {
      filterType: 'number',
      type: FILTER_OPERATORS.IN_RANGE,
      filter: 25,
      filterTo: 65,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'age',
      op: SQL_OPERATORS.BETWEEN,
      val: 25,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts compound filter with inRange operator in WHERE clause', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      operator: 'AND',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.IN_RANGE,
        filter: 50,
        filterTo: 100,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.NOT_EQUAL,
        filter: 75,
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe(
    '(price BETWEEN 50 AND 100 AND price != 75)',
  );
});

test('handles empty filter model gracefully', () => {
  const filterModel: AgGridFilterModel = {};

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBeUndefined();
});

test('handles null filter model gracefully', () => {
  const result = convertAgGridFiltersToSQL(null as any);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBeUndefined();
});

test('handles undefined filter model gracefully', () => {
  const result = convertAgGridFiltersToSQL(undefined as any);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBeUndefined();
});

test('skips filter with empty column name', () => {
  const filterModel: AgGridFilterModel = {
    '': {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: 'test',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips filter with column name exceeding maximum length', () => {
  const longColumnName = 'a'.repeat(256);
  const filterModel: AgGridFilterModel = {
    [longColumnName]: {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: 'test',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips filter with invalid column name characters', () => {
  const filterModel: AgGridFilterModel = {
    'column@name!': {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: 'test',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips filter with missing value', () => {
  const filterModel: AgGridFilterModel = {
    name: {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips empty set filter', () => {
  const filterModel: AgGridFilterModel = {
    status: {
      filterType: 'set',
      values: [],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips set filter with non-array values', () => {
  const filterModel: AgGridFilterModel = {
    status: {
      filterType: 'set',
      values: 'invalid' as any,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips filter with missing type', () => {
  const filterModel: AgGridFilterModel = {
    name: {
      filterType: 'text',
      filter: 'test',
    } as any,
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('skips null filter object', () => {
  const filterModel: AgGridFilterModel = {
    name: null as any,
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
});

test('converts filter with boolean value', () => {
  const filterModel: AgGridFilterModel = {
    is_active: {
      filterType: 'boolean',
      type: FILTER_OPERATORS.EQUALS,
      filter: true,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'is_active',
      op: SQL_OPERATORS.EQUALS,
      val: true,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts filter with null value', () => {
  const filterModel: AgGridFilterModel = {
    middle_name: {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: null,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'middle_name',
      op: SQL_OPERATORS.EQUALS,
      val: null,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('accepts column names with valid spaces and dots', () => {
  const filterModel: AgGridFilterModel = {
    'user.first_name': {
      filterType: 'text',
      type: FILTER_OPERATORS.EQUALS,
      filter: 'John',
    },
    'Full Name': {
      filterType: 'text',
      type: FILTER_OPERATORS.CONTAINS,
      filter: 'Doe',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toHaveLength(2);
  expect(result.simpleFilters).toContainEqual({
    col: 'user.first_name',
    op: SQL_OPERATORS.EQUALS,
    val: 'John',
  });
  expect(result.simpleFilters).toContainEqual({
    col: 'Full Name',
    op: SQL_OPERATORS.ILIKE,
    val: '%Doe%',
  });
});

test('converts compound filter with blank and notBlank operators', () => {
  const filterModel: AgGridFilterModel = {
    notes: {
      filterType: 'text',
      operator: 'OR',
      condition1: {
        filterType: 'text',
        type: FILTER_OPERATORS.BLANK,
      },
      condition2: {
        filterType: 'text',
        type: FILTER_OPERATORS.EQUALS,
        filter: 'N/A',
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe("(notes IS NULL OR notes == 'N/A')");
});

test('converts filter with Date value', () => {
  const date = new Date('2024-01-15');
  const filterModel: AgGridFilterModel = {
    created_at: {
      filterType: 'date',
      type: FILTER_OPERATORS.EQUALS,
      filter: date,
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'created_at',
      op: SQL_OPERATORS.EQUALS,
      val: date,
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('handles compound filter with invalid conditions gracefully', () => {
  const filterModel: AgGridFilterModel = {
    price: {
      filterType: 'number',
      operator: 'AND',
      condition1: {
        filterType: 'number',
        type: FILTER_OPERATORS.GREATER_THAN,
        filter: 50,
      },
      condition2: {
        filterType: 'number',
        type: FILTER_OPERATORS.LESS_THAN,
        // missing filter value
      },
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([]);
  expect(result.complexWhere).toBe('price > 50');
});

test('formats startsWith filter value correctly with only trailing wildcard', () => {
  const filterModel: AgGridFilterModel = {
    product_code: {
      filterType: 'text',
      type: FILTER_OPERATORS.STARTS_WITH,
      filter: 'ABC',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'product_code',
      op: SQL_OPERATORS.ILIKE,
      val: 'ABC%',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('formats endsWith filter value correctly with only leading wildcard', () => {
  const filterModel: AgGridFilterModel = {
    product_code: {
      filterType: 'text',
      type: FILTER_OPERATORS.ENDS_WITH,
      filter: 'XYZ',
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'product_code',
      op: SQL_OPERATORS.ILIKE,
      val: '%XYZ',
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});

test('converts set filter with mixed value types', () => {
  const filterModel: AgGridFilterModel = {
    mixed_column: {
      filterType: 'set',
      values: ['text', 123, true, null],
    },
  };

  const result = convertAgGridFiltersToSQL(filterModel);

  expect(result.simpleFilters).toEqual([
    {
      col: 'mixed_column',
      op: SQL_OPERATORS.IN,
      val: ['text', 123, true, null],
    },
  ]);
  expect(result.complexWhere).toBeUndefined();
});
