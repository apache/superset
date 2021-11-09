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
import { sortOperator } from '../../../src';

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
            operator: 'sum',
          },
        },
      },
    },
  ],
};

test('skip sort', () => {
  expect(sortOperator(formData, queryObject)).toEqual(undefined);
  expect(
    sortOperator(formData, { ...queryObject, is_timeseries: false }),
  ).toEqual(undefined);
  expect(
    sortOperator(
      { ...formData, rolling_type: 'xxxx' },
      { ...queryObject, is_timeseries: true },
    ),
  ).toEqual(undefined);
  expect(
    sortOperator(formData, { ...queryObject, is_timeseries: true }),
  ).toEqual(undefined);
});

test('sort by __timestamp', () => {
  expect(
    sortOperator(
      { ...formData, rolling_type: 'cumsum' },
      { ...queryObject, is_timeseries: true },
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      columns: {
        __timestamp: true,
      },
    },
  });

  expect(
    sortOperator(
      { ...formData, rolling_type: 'sum' },
      { ...queryObject, is_timeseries: true },
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      columns: {
        __timestamp: true,
      },
    },
  });

  expect(
    sortOperator(
      { ...formData, rolling_type: 'mean' },
      { ...queryObject, is_timeseries: true },
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      columns: {
        __timestamp: true,
      },
    },
  });

  expect(
    sortOperator(
      { ...formData, rolling_type: 'std' },
      { ...queryObject, is_timeseries: true },
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      columns: {
        __timestamp: true,
      },
    },
  });
});
