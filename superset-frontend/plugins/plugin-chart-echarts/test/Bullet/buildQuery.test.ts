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
import buildQuery from '../../src/Bullet/buildQuery';

test('issues a single ungrouped aggregate of the metric', () => {
  const [query] = buildQuery({
    datasource: '5__table',
    viz_type: 'bullet',
    metric: 'sum__num',
  }).queries;
  expect(query.metrics).toEqual(['sum__num']);
  expect(query.columns).toEqual([]);
});

test('issues no metrics when none is selected', () => {
  const [query] = buildQuery({
    datasource: '5__table',
    viz_type: 'bullet',
  }).queries;
  expect(query.metrics).toEqual([]);
});

test('passes the groupby through as query columns', () => {
  const [query] = buildQuery({
    datasource: '5__table',
    viz_type: 'bullet',
    metric: 'sum__num',
    groupby: ['state'],
  }).queries;
  expect(query.columns).toEqual(['state']);
  expect(query.metrics).toEqual(['sum__num']);
});
