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
import buildQuery from './buildQuery';

const formData: QueryFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  time_grain_sqla: 'P1D',
  time_range: 'No filter',
  viz_type: 'time_table',
  metrics: ['sum__num', 'count'],
};

test('builds a timeseries query ordered by the first metric ascending', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.metrics).toEqual(['sum__num', 'count']);
  expect(query.is_timeseries).toBe(true);
  expect(query.orderby).toEqual([['sum__num', true]]);
  expect(query.granularity).toEqual('ds');
});

test('orders descending when order_desc is set', () => {
  const [query] = buildQuery({ ...formData, order_desc: true }).queries;
  expect(query.orderby).toEqual([['sum__num', false]]);
});

test('keeps the groupby columns for grouped mode', () => {
  const [query] = buildQuery({
    ...formData,
    metrics: ['sum__num'],
    groupby: ['gender'],
  }).queries;
  expect(query.columns).toEqual(['gender']);
});

test('rejects multiple metrics in grouped mode like the legacy backend', () => {
  expect(() => buildQuery({ ...formData, groupby: ['gender'] })).toThrow(
    'single metric',
  );
});
