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
import { sortOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: VizType.Table,
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

test('should ignore the sortOperator', () => {
  expect(
    sortOperator(
      {
        ...formData,
        ...{
          x_axis_sort: undefined,
          x_axis_sort_asc: true,
        },
      },
      queryObject,
    ),
  ).toEqual(undefined);

  // sortOperator doesn't support multiple series
  expect(
    sortOperator(
      {
        ...formData,
        ...{
          x_axis_sort: 'metric label',
          x_axis_sort_asc: true,
          groupby: ['col1'],
          x_axis: 'axis column',
        },
      },
      queryObject,
    ),
  ).toEqual(undefined);
});

test('should sort by metric', () => {
  expect(
    sortOperator(
      {
        ...formData,
        ...{
          metrics: ['a metric label'],
          x_axis_sort: 'a metric label',
          x_axis_sort_asc: true,
        },
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      by: 'a metric label',
      ascending: true,
    },
  });
});

test('should sort by axis', () => {
  expect(
    sortOperator(
      {
        ...formData,
        ...{
          x_axis_sort: 'Categorical Column',
          x_axis_sort_asc: true,
          x_axis: 'Categorical Column',
        },
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      is_sort_index: true,
      ascending: true,
    },
  });
});

test('should sort by extra metric', () => {
  expect(
    sortOperator(
      {
        ...formData,
        x_axis_sort: 'my_limit_metric',
        x_axis_sort_asc: true,
        x_axis: 'Categorical Column',
        groupby: [],
        timeseries_limit_metric: 'my_limit_metric',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'sort',
    options: {
      by: 'my_limit_metric',
      ascending: true,
    },
  });
});
