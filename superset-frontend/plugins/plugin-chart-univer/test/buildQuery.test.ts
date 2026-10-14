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
import buildQuery from '../src/plugin/buildQuery';
import { UniverQueryFormData } from '../src/types';

const formData = {
  datasource: '1__table',
  viz_type: 'univer_sheet',
  query_mode: 'pivot',
  univer_pivot_rows: ['genre'],
  univer_pivot_columns: ['platform', 'genre'],
  metrics: ['count'],
} as UniverQueryFormData;

test('pivot mode groups by rows and columns and pivots on the backend', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual(['genre', 'platform']);
  expect(query.post_processing).toEqual([
    {
      operation: 'pivot',
      options: {
        index: ['genre'],
        columns: ['platform'],
        aggregates: { count: { operator: 'sum' } },
        drop_missing_columns: true,
        marginal_distributions: true,
        marginal_distribution_name: 'Total',
      },
    },
    { operation: 'flatten' },
  ]);
});

test('pivot totals can be turned off', () => {
  const [query] = buildQuery({
    ...formData,
    univer_pivot_totals: false,
  }).queries;
  expect(query.post_processing?.[0]).toMatchObject({
    options: { marginal_distributions: false },
  });
});
