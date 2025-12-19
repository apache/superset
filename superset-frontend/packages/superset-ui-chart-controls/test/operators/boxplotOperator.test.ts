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
import { boxplotOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  time_grain_sqla: 'P1Y',
  datasource: 'foo',
  viz_type: VizType.Table,
};
const queryObject: QueryObject = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'P1Y',
};

test('should skip boxplotOperator', () => {
  expect(boxplotOperator(formData, queryObject)).toEqual(undefined);
});

test('should do tukey boxplot', () => {
  expect(
    boxplotOperator(
      {
        ...formData,
        whiskerOptions: 'Tukey',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'boxplot',
    options: {
      whisker_type: 'tukey',
      percentiles: undefined,
      groupby: [],
      metrics: ['count(*)', 'sum(val)'],
    },
  });
});

test('should do min/max boxplot', () => {
  expect(
    boxplotOperator(
      {
        ...formData,
        whiskerOptions: 'Min/max (no outliers)',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'boxplot',
    options: {
      whisker_type: 'min/max',
      percentiles: undefined,
      groupby: [],
      metrics: ['count(*)', 'sum(val)'],
    },
  });
});

test('should do percentile boxplot', () => {
  expect(
    boxplotOperator(
      {
        ...formData,
        whiskerOptions: '1/4 percentiles',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'boxplot',
    options: {
      whisker_type: 'percentile',
      percentiles: [1, 4],
      groupby: [],
      metrics: ['count(*)', 'sum(val)'],
    },
  });
});

test('should throw an error', () => {
  expect(() =>
    boxplotOperator(
      {
        ...formData,
        whiskerOptions: 'foobar',
      },
      queryObject,
    ),
  ).toThrow('Unsupported whisker type: foobar');
});
