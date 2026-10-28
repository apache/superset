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
import { DatasourceType } from '@superset-ui/core';
import buildQuery from './buildQuery';

test('semantic ranges issue no bounds query, preserving source identity', () => {
  const context = buildQuery({
    datasource: '3__semantic_view',
    viz_type: 'filter_range',
    groupby: ['Orders.usersAge'],
    semantic_selection_version: 'cube-member-id-v1',
  });
  expect(context.queries).toEqual([]);
  expect(context.datasource).toEqual({
    id: 3,
    type: DatasourceType.SemanticView,
  });
  expect(context.form_data?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test('SQL dataset ranges retain their MIN/MAX discovery query', () => {
  const context = buildQuery({
    datasource: '3__table',
    viz_type: 'filter_range',
    groupby: ['age'],
  });
  expect(context.queries).toHaveLength(1);
  expect(context.queries[0].metrics).toEqual([
    expect.objectContaining({ aggregate: 'MIN', label: 'min' }),
    expect.objectContaining({ aggregate: 'MAX', label: 'max' }),
  ]);
});
