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
import fetchMock from 'fetch-mock';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import {
  fetchSemanticViewStructure,
  semanticViewDimensionsToColumns,
} from './semanticViewStructure';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  supersetGetCache.clear();
});

test('marks semantic dimensions as groupable for drill by', () => {
  expect(
    semanticViewDimensionsToColumns([
      { name: 'Orders Status', type: 'VARCHAR' },
      { name: 'Created At', type: 'TIMESTAMP' },
    ]),
  ).toEqual([
    expect.objectContaining({ column_name: 'Orders Status', groupby: true }),
    expect.objectContaining({ column_name: 'Created At', groupby: true }),
  ]);
});

test('maps the structure payload', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/501/structure', {
    result: {
      name: 'orders',
      semantic_selection_version: 'cube-member-id-v1',
      dimensions: [{ name: 'Status', type: 'VARCHAR' }],
      metrics: [{ name: 'revenue', definition: 'SUM(amount)' }],
    },
  });

  const structure = await fetchSemanticViewStructure(501);

  expect(structure.name).toBe('orders');
  expect(structure.semantic_selection_version).toBe('cube-member-id-v1');
  expect(structure.dimensions).toEqual([{ name: 'Status', type: 'VARCHAR' }]);
  expect(structure.metrics).toEqual([
    { name: 'revenue', definition: 'SUM(amount)' },
  ]);
});

test('refetches the structure after a transient failure', async () => {
  const endpoint = 'glob:*/api/v1/semantic_view/502/structure';
  fetchMock.getOnce(endpoint, 500);

  await expect(fetchSemanticViewStructure(502)).rejects.toBeTruthy();
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/semantic_view/502/structure'),
  ).toHaveLength(1);

  fetchMock.get(endpoint, {
    result: { name: 'orders', dimensions: [], metrics: [] },
  });

  const structure = await fetchSemanticViewStructure(502);

  expect(structure.name).toBe('orders');
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/semantic_view/502/structure'),
  ).toHaveLength(2);
});

test.each([undefined, null])(
  'does not invent a selection version for an unversioned structure (%s)',
  async version => {
    fetchMock.get('glob:*/api/v1/semantic_view/503/structure', {
      result: { name: 'orders', semantic_selection_version: version },
    });
    const structure = await fetchSemanticViewStructure(503);
    expect(structure.semantic_selection_version).toBeUndefined();
  },
);
