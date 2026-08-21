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
import buildQuery from '../../src/Butterfly/buildQuery';

const formData = {
  datasource: '1__table',
  viz_type: 'butterfly',
  groupby: ['category'],
  left_metric: 'left_sum',
  right_metric: 'right_sum',
};

test('defaults to ordering by the category column', () => {
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual(['category']);
  expect(query.metrics).toEqual(['left_sum', 'right_sum']);
  expect(query.orderby).toEqual([['category', true]]);
});

test('wraps the sort metric in a valid orderby tuple', () => {
  const sortMetric = {
    expressionType: 'SIMPLE',
    column: { column_name: 'left_sum' },
    aggregate: 'SUM',
    label: 'SUM(left_sum)',
  };
  const [query] = buildQuery({
    ...formData,
    orderby: sortMetric,
    order_desc: true,
  }).queries;
  expect(query.metrics).toEqual(['left_sum', 'right_sum', sortMetric]);
  expect(query.orderby).toEqual([[sortMetric, false]]);
});

test('appends the sort metric when it is not already selected', () => {
  const sortMetric = {
    expressionType: 'SIMPLE',
    column: { column_name: 'count' },
    aggregate: 'SUM',
    label: 'SUM(count)',
  };
  const [query] = buildQuery({
    ...formData,
    orderby: sortMetric,
    order_desc: false,
  }).queries;
  expect(query.metrics).toEqual(['left_sum', 'right_sum', sortMetric]);
  expect(query.orderby).toEqual([[sortMetric, true]]);
});

test('leaves orderby unset when no category column is selected', () => {
  const [query] = buildQuery({
    ...formData,
    groupby: [],
  }).queries;
  expect(query.columns).toEqual([]);
  expect(query.metrics).toEqual(['left_sum', 'right_sum']);
  expect(query.orderby).toBeUndefined();
});

test('issues no metrics when none are selected', () => {
  const [query] = buildQuery({
    datasource: '1__table',
    viz_type: 'butterfly',
    groupby: ['category'],
  }).queries;
  expect(query.metrics).toEqual([]);
});
