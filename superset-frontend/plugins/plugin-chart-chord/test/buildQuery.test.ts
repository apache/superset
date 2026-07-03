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
  viz_type: 'chord',
  groupby: ['source_col'],
  columns: ['target_col'],
  metric: 'sum__value',
};

test('groups by source then target and selects the single metric', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual(['source_col', 'target_col']);
  expect(query.metrics).toEqual(['sum__value']);
  expect(query.orderby).toBeUndefined();
});

test('orders by the metric descending when sort_by_metric is on', () => {
  const [query] = buildQuery({ ...formData, sort_by_metric: true }).queries;
  expect(query.orderby).toEqual([['sum__value', false]]);
});

test('handles bare-string source/target as stored by the single-value controls', () => {
  const [query] = buildQuery({
    ...formData,
    groupby: 'source_col',
    columns: 'target_col',
  } as unknown as QueryFormData).queries;
  expect(query.columns).toEqual(['source_col', 'target_col']);
});

test('maps legacy granularity_sqla saved form data', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.granularity).toEqual('ds');
});
