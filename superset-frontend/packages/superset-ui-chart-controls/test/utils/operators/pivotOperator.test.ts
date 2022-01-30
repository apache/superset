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
import { QueryObject, SqlaFormData } from '@superset-ui/core';
import { pivotOperator } from '../../../src';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: 'table',
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
    pivotOperator(formData, { ...queryObject, is_timeseries: false }),
  ).toEqual(undefined);
  expect(
    pivotOperator(formData, {
      ...queryObject,
      is_timeseries: true,
      metrics: [],
    }),
  ).toEqual(undefined);
});

test('pivot by __timestamp without groupby', () => {
  expect(
    pivotOperator(formData, { ...queryObject, is_timeseries: true }),
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

test('pivot by __timestamp with groupby', () => {
  expect(
    pivotOperator(formData, {
      ...queryObject,
      columns: ['foo', 'bar'],
      is_timeseries: true,
    }),
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
        columns: ['foo', 'bar'],
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

test('timecompare in formdata', () => {
  expect(
    pivotOperator(
      {
        ...formData,
        comparison_type: 'values',
        time_compare: ['1 year ago', '1 year later'],
      },
      {
        ...queryObject,
        columns: ['foo', 'bar'],
        is_timeseries: true,
      },
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      aggregates: {
        'count(*)': { operator: 'mean' },
        'count(*)__1 year ago': { operator: 'mean' },
        'count(*)__1 year later': { operator: 'mean' },
        'sum(val)': {
          operator: 'mean',
        },
        'sum(val)__1 year ago': {
          operator: 'mean',
        },
        'sum(val)__1 year later': {
          operator: 'mean',
        },
      },
      drop_missing_columns: false,
      columns: ['foo', 'bar'],
      index: ['__timestamp'],
    },
  });
});
