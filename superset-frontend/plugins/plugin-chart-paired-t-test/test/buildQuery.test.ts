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

const formData: QueryFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: 'No filter',
  viz_type: 'paired_ttest',
  groupby: ['gender'],
  metrics: ['sum__num'],
};

test('builds a timeseries query grouped by the group columns', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual(['gender']);
  expect(query.metrics).toEqual(['sum__num']);
  expect(query.is_timeseries).toBe(true);
  expect(query.granularity).toEqual('ds');
});

test('appends the sort metric and orders when order_desc is set', () => {
  const [query] = buildQuery({
    ...formData,
    timeseries_limit_metric: 'count',
    order_desc: true,
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'count']);
  expect(query.orderby).toEqual([['count', false]]);
});

test('ignores residual order_by_cols from other viz types', () => {
  const [query] = buildQuery({
    ...formData,
    order_by_cols: ['["count", false]'],
  }).queries;
  expect(query.orderby).toBeUndefined();
});
