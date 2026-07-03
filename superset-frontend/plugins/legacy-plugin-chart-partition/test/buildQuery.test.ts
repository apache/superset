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
  time_range: 'No filter',
  viz_type: 'partition',
  groupby: ['gender', 'state'],
  metrics: ['sum__num'],
};

test('is not a timeseries query for the not-time option', () => {
  const [query] = buildQuery({
    ...formData,
    time_series_option: 'not_time',
  }).queries;
  expect(query.is_timeseries).toBe(false);
  expect(query.columns).toEqual(['gender', 'state']);
});

test('is a timeseries query for time-based options', () => {
  const [query] = buildQuery({
    ...formData,
    time_series_option: 'point_diff',
  }).queries;
  expect(query.is_timeseries).toBe(true);
});

test('appends the sort metric like the legacy engine', () => {
  const [query] = buildQuery({
    ...formData,
    timeseries_limit_metric: 'count',
    order_desc: true,
  }).queries;
  expect(query.metrics).toEqual(['sum__num', 'count']);
  expect(query.orderby).toEqual([['count', false]]);
});
