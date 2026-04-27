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
import { QueryFormColumn } from '@superset-ui/core';
import buildQuery, { H3FormData } from './buildQuery';

const baseFormData: H3FormData = {
  datasource: '1__table',
  viz_type: 'deck_h3_hexagon',
  h3_index: 'h3_col',
};

test('H3 buildQuery should throw when h3_index is missing', () => {
  const formData = {
    ...baseFormData,
    h3_index: '',
  };

  expect(() => buildQuery(formData)).toThrow('H3 index is required');
});

test('H3 buildQuery should throw when h3_index is undefined', () => {
  const formData = {
    ...baseFormData,
    h3_index: undefined as unknown as QueryFormColumn,
  };

  expect(() => buildQuery(formData)).toThrow('H3 index is required');
});

test('H3 buildQuery should build basic query with minimal form data', () => {
  const queryContext = buildQuery(baseFormData);
  const [query] = queryContext.queries;

  expect(query.columns).toEqual(['h3_col']);
  expect(query.metrics).toEqual([]);
  expect(query.is_timeseries).toBe(false);
  expect(query.filters).toContainEqual({
    col: 'h3_col',
    op: 'IS NOT NULL',
  });
});

test('H3 buildQuery should extract first element when h3_index is an array', () => {
  const formData: H3FormData = {
    ...baseFormData,
    h3_index: ['h3_resolution_7', 'h3_resolution_9'],
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('h3_resolution_7');
  expect(query.filters).toContainEqual({
    col: 'h3_resolution_7',
    op: 'IS NOT NULL',
  });
});

test('H3 buildQuery should throw when h3_index array is empty', () => {
  const formData: H3FormData = {
    ...baseFormData,
    h3_index: [],
  };

  expect(() => buildQuery(formData)).toThrow('H3 index is required');
});

test('H3 buildQuery should derive label from adhoc column object', () => {
  const adhocColumn: QueryFormColumn = {
    label: 'h3_expr',
    sqlExpression: "h3_index('foo')",
    expressionType: 'SQL',
  };
  const formData: H3FormData = {
    ...baseFormData,
    h3_index: adhocColumn,
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContainEqual(adhocColumn);
  expect(query.filters).toContainEqual({
    col: 'h3_expr',
    op: 'IS NOT NULL',
  });
});

test('H3 buildQuery should include metric when provided', () => {
  const formData: H3FormData = {
    ...baseFormData,
    metric: 'count',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual(['count']);
});

test('H3 buildQuery should have empty metrics when metric is not provided', () => {
  const queryContext = buildQuery(baseFormData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('H3 buildQuery should include js_columns in query columns', () => {
  const formData: H3FormData = {
    ...baseFormData,
    js_columns: ['city', 'population'],
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toEqual(['h3_col', 'city', 'population']);
});

test('H3 buildQuery should deduplicate js_columns that match h3_index', () => {
  const formData: H3FormData = {
    ...baseFormData,
    js_columns: ['h3_col', 'extra_col'],
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toEqual(['h3_col', 'extra_col']);
});

test('H3 buildQuery should include tooltip_contents columns', () => {
  const formData: H3FormData = {
    ...baseFormData,
    tooltip_contents: [
      { item_type: 'column', column_name: 'tooltip_field' },
      'another_field',
    ],
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('tooltip_field');
  expect(query.columns).toContain('another_field');
});

test('H3 buildQuery should set orderby from metric when provided', () => {
  const formData: H3FormData = {
    ...baseFormData,
    metric: 'sum_value',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.orderby).toEqual([['sum_value', false]]);
});

test('H3 buildQuery should build comprehensive query with all fields', () => {
  const formData: H3FormData = {
    ...baseFormData,
    metric: 'avg_elevation',
    js_columns: ['region'],
    tooltip_contents: [{ item_type: 'column', column_name: 'info' }],
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('h3_col');
  expect(query.columns).toContain('region');
  expect(query.columns).toContain('info');
  expect(query.metrics).toEqual(['avg_elevation']);
  expect(query.is_timeseries).toBe(false);
  expect(query.filters).toContainEqual({
    col: 'h3_col',
    op: 'IS NOT NULL',
  });
});
