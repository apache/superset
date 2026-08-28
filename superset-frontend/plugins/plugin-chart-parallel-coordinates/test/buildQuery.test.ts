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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../src/buildQuery';

const basicFormData: QueryFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  time_range: 'No filter',
  viz_type: 'para',
  series: 'gender',
  metrics: ['sum__num', 'avg__num'],
};

test('builds columns from series and keeps all metrics', () => {
  const [query] = buildQuery(basicFormData).queries;
  expect(query.columns).toEqual(['gender']);
  expect(query.metrics).toEqual(['sum__num', 'avg__num']);
});

test('includes the secondary (color) metric in the query', () => {
  const [query] = buildQuery({
    ...basicFormData,
    secondary_metric: 'count',
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'avg__num', 'count']);
});

test('maps granularity_sqla from legacy saved form data', () => {
  const [query] = buildQuery(basicFormData).queries;
  expect(query.granularity).toEqual('ds');
});

test('appends the sort metric to the select list when missing', () => {
  const [query] = buildQuery({
    ...basicFormData,
    timeseries_limit_metric: 'count',
    order_desc: false,
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'avg__num', 'count']);
  expect(query.orderby).toBeUndefined();
});

test('does not duplicate the sort metric when already selected', () => {
  const [query] = buildQuery({
    ...basicFormData,
    timeseries_limit_metric: 'sum__num',
    order_desc: true,
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'avg__num']);
  expect(query.orderby).toEqual([['sum__num', false]]);
});

test('orders by the sort metric descending only when order_desc is set', () => {
  const [query] = buildQuery({
    ...basicFormData,
    timeseries_limit_metric: 'count',
    order_desc: true,
  }).queries;
  expect(query.orderby).toEqual([['count', false]]);
});

test('ignores residual order_by_cols from other viz types', () => {
  const [query] = buildQuery({
    ...basicFormData,
    order_by_cols: ['["count", false]'],
  }).queries;
  expect(query.orderby).toBeUndefined();
});

test('supports adhoc sort metrics', () => {
  const adhocMetric = {
    expressionType: 'SIMPLE' as const,
    aggregate: 'SUM' as const,
    column: { column_name: 'num' },
    label: 'SUM(num)',
  };
  const [query] = buildQuery({
    ...basicFormData,
    timeseries_limit_metric: adhocMetric,
    order_desc: true,
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'avg__num', adhocMetric]);
  expect(query.orderby).toEqual([[adhocMetric, false]]);
});
