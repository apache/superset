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
import buildQuery from './buildQuery';

const baseFormData: QueryFormData = {
  datasource: '1__table',
  viz_type: 'deck_vector_tile',
};

const CONSTANT_COLUMN = {
  expressionType: 'SQL',
  sqlExpression: '1',
  label: 'one',
};

test('requests a single constant row', () => {
  const queryContext = buildQuery(baseFormData);

  expect(queryContext.datasource).toEqual({ id: 1, type: 'table' });
  expect(queryContext.queries).toHaveLength(1);

  const [query] = queryContext.queries;
  expect(query.columns).toEqual([CONSTANT_COLUMN]);
  expect(query.metrics).toEqual([]);
  expect(query.row_limit).toBe(1);
  expect(query.is_timeseries).toBe(false);
});
