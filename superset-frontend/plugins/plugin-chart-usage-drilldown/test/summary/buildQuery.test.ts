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
import buildQuery from '../../src/summary/buildQuery';

test('buildQuery fetches the metric per hour of the time column', () => {
  const metric = {
    expressionType: 'SQL' as const,
    sqlExpression: 'SUM(api_calls)',
    label: 'API Calls',
  };
  const [query] = buildQuery({
    datasource: '22__table',
    viz_type: 'usage_summary',
    x_axis: 'created_at',
    metric,
  }).queries;
  expect(query.metrics).toEqual([metric]);
  expect(query.columns).toEqual([
    expect.objectContaining({ sqlExpression: 'created_at', timeGrain: 'PT1H' }),
  ]);
});

test('buildQuery defaults to the last 7 days without a time filter', () => {
  const [query, oneRow] = buildQuery({
    datasource: '22__table',
    viz_type: 'usage_summary',
    x_axis: 'created_at',
    metric: 'count',
  }).queries;
  expect(query.time_range).toBe('Last week');
  expect(query.filters).toContainEqual({
    col: 'created_at',
    op: 'TEMPORAL_RANGE',
    val: 'Last week',
  });
  expect(oneRow.time_range).toBe('Last week');
});

test('buildQuery keeps a time range the user picked', () => {
  const [query] = buildQuery({
    datasource: '22__table',
    viz_type: 'usage_summary',
    x_axis: 'created_at',
    metric: 'count',
    time_range: 'Last month',
  }).queries;
  expect(query.time_range).toBe('Last month');
});
