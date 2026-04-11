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
import { PostProcessingRule, QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/Heatmap/buildQuery';

const isRankOperation = (op?: PostProcessingRule) => op?.operation === 'rank';
const baseFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  metric: 'count',
  x_axis: 'category',
  groupby: ['region'],
  viz_type: 'heatmap',
} as QueryFormData;

test('Heatmap buildQuery omits orderby for value-based ascending X-axis sort', () => {
  const formData = { ...baseFormData, sort_x_axis: 'value_asc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery omits orderby for value-based descending X-axis sort', () => {
  const formData = { ...baseFormData, sort_x_axis: 'value_desc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery adds column orderby for alpha ascending X-axis sort', () => {
  const formData = { ...baseFormData, sort_x_axis: 'alpha_asc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([['category', true]]);
});

test('Heatmap buildQuery adds column orderby for alpha descending X-axis sort', () => {
  const formData = { ...baseFormData, sort_x_axis: 'alpha_desc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([['category', false]]);
});

test('Heatmap buildQuery omits X-axis orderby when sort_x_axis is not set', () => {
  const [query] = buildQuery({ ...baseFormData }).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery omits orderby for value-based ascending Y-axis sort', () => {
  const formData = { ...baseFormData, sort_y_axis: 'value_asc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery omits orderby for value-based descending Y-axis sort', () => {
  const formData = { ...baseFormData, sort_y_axis: 'value_desc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery adds column orderby for alpha ascending Y-axis sort', () => {
  const formData = { ...baseFormData, sort_y_axis: 'alpha_asc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([['region', true]]);
});

test('Heatmap buildQuery adds column orderby for alpha descending Y-axis sort', () => {
  const formData = { ...baseFormData, sort_y_axis: 'alpha_desc' };
  const [query] = buildQuery(formData).queries;

  expect(query.orderby).toEqual([['region', false]]);
});

test('Heatmap buildQuery omits Y-axis orderby when sort_y_axis is not set', () => {
  const [query] = buildQuery({ ...baseFormData }).queries;

  expect(query.orderby).toEqual([]);
});

test('Heatmap buildQuery always includes rank operation when normalized is true', () => {
  const [query] = buildQuery({ ...baseFormData, normalized: true }).queries;
  const rankOperation = query.post_processing?.find(isRankOperation);

  expect(rankOperation).toBeDefined();
  expect(rankOperation?.operation).toBe('rank');
});

test('Heatmap buildQuery always includes rank operation when normalized is false', () => {
  const [query] = buildQuery({ ...baseFormData, normalized: false }).queries;
  const rankOperation = query.post_processing?.find(isRankOperation);

  expect(rankOperation).toBeDefined();
  expect(rankOperation?.operation).toBe('rank');
});

test('Heatmap buildQuery always includes rank operation when normalized is unset', () => {
  const [query] = buildQuery({ ...baseFormData }).queries;
  const rankOperation = query.post_processing?.find(isRankOperation);

  expect(rankOperation).toBeDefined();
  expect(rankOperation?.operation).toBe('rank');
});
