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
  time_range: 'Last year',
  viz_type: 'cal_heatmap',
  metrics: ['sum__num'],
  domain_granularity: 'month',
  subdomain_granularity: 'day',
};

test('forces the time grain from the subdomain granularity', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.extras?.time_grain_sqla).toEqual('P1D');
  expect(query.is_timeseries).toBe(true);
  expect(query.metrics).toEqual(['sum__num']);
});

test('defaults the time grain to minutes like the legacy backend', () => {
  const [query] = buildQuery({
    ...formData,
    subdomain_granularity: undefined,
  }).queries;
  expect(query.extras?.time_grain_sqla).toEqual('PT1M');
});

test('falls back to minutes for an unrecognized subdomain granularity', () => {
  const [query] = buildQuery({
    ...formData,
    subdomain_granularity: 'fortnight',
  }).queries;
  expect(query.extras?.time_grain_sqla).toEqual('PT1M');
});
