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
  collectSqlExpressionsFromSlice,
  findColumnsInSqlExpressions,
  sliceUsesColumn,
} from './whatIf';
import { Slice } from '../types';

const createMockSlice = (formData: Record<string, unknown>): Slice =>
  ({
    slice_id: 1,
    slice_name: 'Test Slice',
    form_data: formData,
  }) as Slice;

test('collectSqlExpressionsFromSlice extracts SQL from metrics', () => {
  const slice = createMockSlice({
    metrics: [
      {
        expressionType: 'SQL',
        sqlExpression: 'AVG(orders / customers)',
        label: 'Avg Orders',
      },
    ],
  });

  const expressions = collectSqlExpressionsFromSlice(slice);
  expect(expressions).toEqual(['AVG(orders / customers)']);
});

test('collectSqlExpressionsFromSlice extracts SQL from filters', () => {
  const slice = createMockSlice({
    adhoc_filters: [
      {
        expressionType: 'SQL',
        sqlExpression: 'revenue > 1000',
        clause: 'WHERE',
      },
    ],
  });

  const expressions = collectSqlExpressionsFromSlice(slice);
  expect(expressions).toEqual(['revenue > 1000']);
});

test('collectSqlExpressionsFromSlice extracts SQL from adhoc columns in groupby', () => {
  const slice = createMockSlice({
    groupby: [
      {
        sqlExpression: "DATE_TRUNC('month', order_date)",
        label: 'Month',
      },
    ],
  });

  const expressions = collectSqlExpressionsFromSlice(slice);
  expect(expressions).toEqual(["DATE_TRUNC('month', order_date)"]);
});

test('collectSqlExpressionsFromSlice extracts SQL from singular metric', () => {
  const slice = createMockSlice({
    metric: {
      expressionType: 'SQL',
      sqlExpression: 'SUM(amount)',
      label: 'Total Amount',
    },
  });

  const expressions = collectSqlExpressionsFromSlice(slice);
  expect(expressions).toEqual(['SUM(amount)']);
});

test('collectSqlExpressionsFromSlice ignores SIMPLE expression types', () => {
  const slice = createMockSlice({
    metrics: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'revenue' },
        aggregate: 'SUM',
      },
    ],
    adhoc_filters: [
      {
        expressionType: 'SIMPLE',
        subject: 'status',
        operator: '==',
        comparator: 'active',
      },
    ],
  });

  const expressions = collectSqlExpressionsFromSlice(slice);
  expect(expressions).toEqual([]);
});

test('findColumnsInSqlExpressions finds exact column matches', () => {
  const sqlExpressions = ['AVG(orders / customers)', 'SUM(revenue)'];
  const columnNames = ['orders', 'customers', 'revenue', 'total'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  expect(found).toEqual(new Set(['orders', 'customers', 'revenue']));
});

test('findColumnsInSqlExpressions avoids false positives with similar names', () => {
  const sqlExpressions = ['SUM(order_count)', 'AVG(reorder_rate)'];
  const columnNames = ['order', 'orders', 'order_count', 'reorder_rate'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  // Should only match exact column names, not partial matches
  expect(found).toEqual(new Set(['order_count', 'reorder_rate']));
  expect(found.has('order')).toBe(false);
  expect(found.has('orders')).toBe(false);
});

test('findColumnsInSqlExpressions handles columns at start and end of expression', () => {
  const sqlExpressions = ['revenue + cost'];
  const columnNames = ['revenue', 'cost'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  expect(found).toEqual(new Set(['revenue', 'cost']));
});

test('findColumnsInSqlExpressions handles columns in parentheses', () => {
  const sqlExpressions = ['SUM(amount)', '(price * quantity)'];
  const columnNames = ['amount', 'price', 'quantity'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  expect(found).toEqual(new Set(['amount', 'price', 'quantity']));
});

test('findColumnsInSqlExpressions handles special regex characters in column names', () => {
  const sqlExpressions = ['SUM(col.name) + AVG(col$value)'];
  const columnNames = ['col.name', 'col$value'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  expect(found).toEqual(new Set(['col.name', 'col$value']));
});

test('findColumnsInSqlExpressions returns empty set when no matches', () => {
  const sqlExpressions = ['SUM(total)'];
  const columnNames = ['revenue', 'cost'];

  const found = findColumnsInSqlExpressions(sqlExpressions, columnNames);
  expect(found.size).toBe(0);
});

test('findColumnsInSqlExpressions returns empty set with empty inputs', () => {
  expect(findColumnsInSqlExpressions([], ['col1']).size).toBe(0);
  expect(findColumnsInSqlExpressions(['SUM(col)'], []).size).toBe(0);
  expect(findColumnsInSqlExpressions([], []).size).toBe(0);
});

test('sliceUsesColumn detects columns in SQL expressions', () => {
  const slice = createMockSlice({
    metrics: [
      {
        expressionType: 'SQL',
        sqlExpression: 'AVG(orders / customers)',
        label: 'Avg',
      },
    ],
  });

  expect(sliceUsesColumn(slice, 'orders')).toBe(true);
  expect(sliceUsesColumn(slice, 'customers')).toBe(true);
  expect(sliceUsesColumn(slice, 'revenue')).toBe(false);
});

test('sliceUsesColumn detects explicitly referenced columns', () => {
  const slice = createMockSlice({
    groupby: ['category', 'region'],
  });

  expect(sliceUsesColumn(slice, 'category')).toBe(true);
  expect(sliceUsesColumn(slice, 'region')).toBe(true);
  expect(sliceUsesColumn(slice, 'country')).toBe(false);
});

test('sliceUsesColumn detects columns in both explicit and SQL references', () => {
  const slice = createMockSlice({
    groupby: ['category'],
    metrics: [
      {
        expressionType: 'SQL',
        sqlExpression: 'SUM(revenue)',
        label: 'Total',
      },
    ],
  });

  expect(sliceUsesColumn(slice, 'category')).toBe(true);
  expect(sliceUsesColumn(slice, 'revenue')).toBe(true);
});
