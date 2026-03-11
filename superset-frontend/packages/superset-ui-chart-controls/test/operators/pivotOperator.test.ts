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
import { QueryObject, SqlaFormData, VizType } from '@superset-ui/core';
import { pivotOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: VizType.Table,
  show_empty_columns: true,
};
const queryObject: QueryObject = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'month',
  post_processing: [
    {
      operation: 'pivot',
      options: {
        index: ['__timestamp'],
        columns: ['nation'],
        aggregates: {
          'count(*)': {
            operator: 'mean',
          },
        },
        drop_missing_columns: false,
      },
    },
  ],
};

test('skip pivot', () => {
  expect(pivotOperator(formData, queryObject)).toEqual(undefined);
  expect(
    pivotOperator(formData, {
      ...queryObject,
      metrics: [],
    }),
  ).toEqual(undefined);
});

test('pivot by __timestamp without columns', () => {
  expect(
    pivotOperator(
      { ...formData, granularity_sqla: 'time_column' },
      queryObject,
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['__timestamp'],
      columns: [],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});

test('pivot by __timestamp with columns', () => {
  expect(
    pivotOperator(
      { ...formData, granularity_sqla: 'time_column' },
      {
        ...queryObject,
        columns: ['foo', 'bar'],
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['__timestamp'],
      columns: ['foo', 'bar'],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});

test('pivot by __timestamp with series_columns', () => {
  expect(
    pivotOperator(
      { ...formData, granularity_sqla: 'time_column' },
      {
        ...queryObject,
        series_columns: ['foo', 'bar'],
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['__timestamp'],
      columns: ['foo', 'bar'],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});

test('pivot by x_axis with groupby', () => {
  expect(
    pivotOperator(
      {
        ...formData,
        x_axis: 'baz',
      },
      {
        ...queryObject,
        series_columns: ['foo', 'bar'],
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['baz'],
      columns: ['foo', 'bar'],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});

test('pivot by adhoc x_axis', () => {
  expect(
    pivotOperator(
      {
        ...formData,
        x_axis: {
          label: 'my_case_expr',
          expressionType: 'SQL',
          sqlExpression: 'case when a = 1 then 1 else 0 end',
        },
      },
      {
        ...queryObject,
        series_columns: ['foo', 'bar'],
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['my_case_expr'],
      columns: ['foo', 'bar'],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});

test('pivot by x_axis with extra metrics', () => {
  expect(
    pivotOperator(
      {
        ...formData,
        x_axis: 'foo',
        x_axis_sort: 'bar',
        groupby: [],
        timeseries_limit_metric: 'bar',
      },
      {
        ...queryObject,
        series_columns: [],
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      index: ['foo'],
      columns: [],
      aggregates: {
        'count(*)': { operator: 'mean' },
        'sum(val)': { operator: 'mean' },
        bar: { operator: 'mean' },
      },
      drop_missing_columns: false,
    },
  });
});
