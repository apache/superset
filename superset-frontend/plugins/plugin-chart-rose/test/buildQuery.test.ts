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
  time_range: '2023 : 2024',
  viz_type: 'rose',
  groupby: ['gender'],
  metrics: ['sum__num'],
};

test('orders by the first metric like the legacy engine', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.orderby).toEqual([['sum__num', true]]);
  const [descQuery] = buildQuery({ ...formData, order_desc: true }).queries;
  expect(descQuery.orderby).toEqual([['sum__num', false]]);
});

test('builds a pivot + flatten post-processing pipeline', () => {
  const [query] = buildQuery(formData).queries;
  const operations = (query.post_processing || [])
    .filter(Boolean)
    .map(op => op!.operation);
  expect(operations).toEqual(['pivot', 'flatten']);
  expect(query.is_timeseries).toBe(true);
  expect(query.time_offsets).toEqual([]);
});

test('adds rolling, resample and contribution operators when configured', () => {
  const [query] = buildQuery({
    ...formData,
    rolling_type: 'mean',
    rolling_periods: 7,
    resample_rule: '1D',
    resample_method: 'ffill',
    contribution: true,
  }).queries;
  const operations = (query.post_processing || [])
    .filter(Boolean)
    .map(op => op!.operation);
  expect(operations).toEqual([
    'pivot',
    'resample',
    'rolling',
    'contribution',
    'flatten',
  ]);
});

test('normalizes the legacy absolute comparison type to difference', () => {
  const [query] = buildQuery({
    ...formData,
    time_compare: ['1 week ago'],
    comparison_type: 'absolute',
  }).queries;
  const compare = (query.post_processing || [])
    .filter(Boolean)
    .find(op => op!.operation === 'compare');
  expect((compare?.options as { compare_type?: string })?.compare_type).toEqual(
    'difference',
  );
});

test('requests time offsets and compares when time_compare is set', () => {
  const [query] = buildQuery({
    ...formData,
    time_compare: ['1 week ago'],
    comparison_type: 'difference',
  }).queries;
  expect(query.time_offsets).toEqual(['1 week ago']);
  const operations = (query.post_processing || [])
    .filter(Boolean)
    .map(op => op!.operation);
  expect(operations).toContain('compare');
});
