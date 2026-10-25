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
  ComparisonType,
  QueryObject,
  SqlaFormData,
  VizType,
} from '@superset-ui/core';
import { contributionOperator } from '@superset-ui/chart-controls';

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
};

test('should skip contributionOperator', () => {
  expect(contributionOperator(formData, queryObject)).toEqual(undefined);
});

test('should do contributionOperator', () => {
  expect(
    contributionOperator({ ...formData, contributionMode: 'row' }, queryObject),
  ).toEqual({
    operation: 'contribution',
    options: {
      orientation: 'row',
    },
  });
});

const sortByFormData: SqlaFormData = {
  ...formData,
  metrics: ['count'],
  groupby: ['platform'],
  x_axis: 'ds',
  contributionMode: 'row',
  timeseries_limit_metric: 'sales',
  x_axis_sort: 'sales',
};
const sortByQueryObject: QueryObject = {
  ...queryObject,
  metrics: ['count'],
};

test('should leave the sort-only metric out of the row contribution', () => {
  expect(contributionOperator(sortByFormData, sortByQueryObject)).toEqual({
    operation: 'contribution',
    options: { orientation: 'row', columns: ['count'] },
  });
});

test('should leave the sort-only metric out with time comparison values', () => {
  expect(
    contributionOperator(
      {
        ...sortByFormData,
        time_compare: ['1 year ago'],
        comparison_type: ComparisonType.Values,
      },
      sortByQueryObject,
      ['1 year ago'],
    ),
  ).toEqual({
    operation: 'contribution',
    options: {
      orientation: 'row',
      time_shifts: ['1 year ago'],
      columns: ['count', 'count__1 year ago'],
    },
  });
});

test('should not restrict columns when no metric is sort-only', () => {
  expect(
    contributionOperator(
      {
        ...sortByFormData,
        timeseries_limit_metric: 'count',
        x_axis_sort: 'count',
      },
      sortByQueryObject,
    ),
  ).toEqual({
    operation: 'contribution',
    options: { orientation: 'row' },
  });
});
