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
  viz_type: 'horizon',
  groupby: ['gender'],
  metrics: ['sum__num'],
  limit: 25,
};

test('builds a grouped timeseries query with a series limit', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual(['gender']);
  expect(query.metrics).toEqual(['sum__num']);
  expect(query.is_timeseries).toBe(true);
  expect(query.series_limit).toEqual(25);
  expect(query.granularity).toEqual('ds');
  // legacy engine default: order by the first metric ascending
  expect(query.orderby).toEqual([['sum__num', true]]);
});

test('keeps the semantic series limit inferred from timeseries columns', () => {
  const [query] = buildQuery({
    ...formData,
    datasource: '5__semantic_view',
  }).queries;
  expect(query.is_timeseries).toBe(true);
  expect(query.columns).toEqual(['gender']);
  expect(query.series_columns).toBeUndefined();
  expect(query.series_limit).toBe(25);
});

test('orders descending when order_desc is set', () => {
  const [query] = buildQuery({ ...formData, order_desc: true }).queries;
  expect(query.orderby).toEqual([['sum__num', false]]);
});
