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
import { fetchSemanticViewStructure } from './semanticViewStructure';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  supersetGetCache.clear();
});

test('maps the structure payload', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/501/structure', {
    result: {
      name: 'orders',
      dimensions: [{ name: 'Status', type: 'VARCHAR' }],
      metrics: [{ name: 'revenue', definition: 'SUM(amount)' }],
    },
  });

  const structure = await fetchSemanticViewStructure(501);

  expect(structure.name).toBe('orders');
  expect(structure.dimensions).toEqual([{ name: 'Status', type: 'VARCHAR' }]);
  expect(structure.metrics).toEqual([
    { name: 'revenue', definition: 'SUM(amount)' },
  ]);
});

test('evicts the cache on failure so a later call refetches after recovery', async () => {
  const endpoint = 'glob:*/api/v1/semantic_view/502/structure';
  // First response fails: without eviction, the rejected promise would stay
  // cached and every later call would replay the failure for the session.
  fetchMock.getOnce(endpoint, 500);

  await expect(fetchSemanticViewStructure(502)).rejects.toBeTruthy();
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/semantic_view/502/structure'),
  ).toHaveLength(1);

  // Endpoint healthy again: the second call must hit the network, not a
  // poisoned cache entry.
  fetchMock.get(endpoint, {
    result: { name: 'orders', dimensions: [], metrics: [] },
  });

  const structure = await fetchSemanticViewStructure(502);

  expect(structure.name).toBe('orders');
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/semantic_view/502/structure'),
  ).toHaveLength(2);
});
