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
import buildQuery from '../../src/Sankey/buildQuery';
import { SankeyFormData } from '../../src/Sankey/types';

const baseFormData: SankeyFormData = {
  colorScheme: 'supersetColors',
  datasource: '1__table',
  metric: 'count',
  source: 'source_col',
  target: 'target_col',
  viz_type: 'sankey_v2',
};

test('two-column form data builds a single source/target groupby', () => {
  const [query] = buildQuery(baseFormData).queries;
  expect(query.groupby).toEqual(['source_col', 'target_col']);
});

test('intermediate levels are included in order between source and target', () => {
  const [query] = buildQuery({
    ...baseFormData,
    intermediate_levels: ['level_1', 'level_2'],
  }).queries;
  expect(query.groupby).toEqual([
    'source_col',
    'level_1',
    'level_2',
    'target_col',
  ]);
});

test('empty intermediate levels behaves as two-column form data', () => {
  const [query] = buildQuery({
    ...baseFormData,
    intermediate_levels: [],
  }).queries;
  expect(query.groupby).toEqual(['source_col', 'target_col']);
});

test('orderby covers all level columns when row_limit is set', () => {
  const [query] = buildQuery({
    ...baseFormData,
    intermediate_levels: ['level_1'],
    row_limit: 100,
  }).queries;
  expect(query.orderby).toEqual([
    ['source_col', true],
    ['level_1', true],
    ['target_col', true],
  ]);
});

test('sort_by_metric orders by metric before level columns', () => {
  const [query] = buildQuery({
    ...baseFormData,
    intermediate_levels: ['level_1'],
    sort_by_metric: true,
    row_limit: 100,
  }).queries;
  expect(query.orderby?.[0]).toEqual(['count', false]);
  expect(query.orderby).toHaveLength(4);
});
