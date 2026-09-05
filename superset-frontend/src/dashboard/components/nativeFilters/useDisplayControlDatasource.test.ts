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
import { renderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { DatasourceType } from '@superset-ui/core';
import { useDisplayControlDatasource } from './useDisplayControlDatasource';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('dataset branch issues the legacy bare-resource request and maps the payload', async () => {
  fetchMock.get('glob:*/api/v1/dataset/401', {
    result: {
      table_name: 'Vehicle Sales',
      columns: [{ column_name: 'city' }],
    },
  });

  const { result } = renderHook(() => useDisplayControlDatasource(401));

  await waitFor(() => expect(result.current.loading).toBe(false));
  const { url } = fetchMock.callHistory.calls('glob:*/api/v1/dataset/401')[0];
  expect(url.endsWith('/api/v1/dataset/401')).toBe(true);
  expect(result.current.name).toBe('Vehicle Sales');
  expect(result.current.columns).toEqual([{ column_name: 'city' }]);
});

test('semantic-view branch resolves only the structure endpoint and maps dimensions', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/402/structure', {
    result: {
      name: 'orders',
      dimensions: [
        { name: 'Orders Status', type: 'VARCHAR' },
        { name: 'Ordered At', type: 'TIMESTAMP' },
      ],
    },
  });
  fetchMock.get('glob:*/api/v1/dataset/*', 200);

  const { result } = renderHook(() =>
    useDisplayControlDatasource(402, DatasourceType.SemanticView),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));
  // The colliding dataset endpoint must never be touched.
  expect(fetchMock.callHistory.calls('glob:*/api/v1/dataset/*')).toHaveLength(
    0,
  );
  expect(result.current.name).toBe('orders');
  expect(result.current.columns).toEqual([
    expect.objectContaining({
      column_name: 'Orders Status',
      is_dttm: false,
      filterable: true,
    }),
    expect.objectContaining({ column_name: 'Ordered At', is_dttm: true }),
  ]);
});

test('same numeric id with a type flip refetches and discards the stale response', async () => {
  // Deliberately slow dataset response vs fast structure response: the
  // late dataset payload must not overwrite the semantic result.
  fetchMock.get(
    'glob:*/api/v1/dataset/403',
    new Promise(resolve =>
      setTimeout(
        () =>
          resolve({
            result: {
              table_name: 'Colliding Dataset',
              columns: [{ column_name: 'wrong_col' }],
            },
          }),
        150,
      ),
    ),
  );
  fetchMock.get('glob:*/api/v1/semantic_view/403/structure', {
    result: { name: 'right view', dimensions: [{ name: 'dim', type: 'TEXT' }] },
  });

  const { result, rerender } = renderHook(
    ({ type }: { type?: DatasourceType }) =>
      useDisplayControlDatasource(403, type),
    { initialProps: { type: undefined as DatasourceType | undefined } },
  );

  // Flip to semantic view while the dataset request is still in flight.
  rerender({ type: DatasourceType.SemanticView });

  await waitFor(() =>
    expect(result.current.columns).toEqual([
      expect.objectContaining({ column_name: 'dim' }),
    ]),
  );
  // Let the stale dataset response land, then confirm it was discarded.
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(result.current.name).toBe('right view');
  expect(result.current.columns).toEqual([
    expect.objectContaining({ column_name: 'dim' }),
  ]);
});

test('structure failure yields error and empty columns with no cross-type fallback', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/404/structure', 500);
  fetchMock.get('glob:*/api/v1/dataset/*', 200);

  const { result } = renderHook(() =>
    useDisplayControlDatasource(404, DatasourceType.SemanticView),
  );

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeDefined();
  expect(result.current.columns).toEqual([]);
  expect(fetchMock.callHistory.calls('glob:*/api/v1/dataset/*')).toHaveLength(
    0,
  );
});

// The hook scopes `error` to the current binding so a one-render-stale failure
// never surfaces against a new binding. That guard only bites during the single
// render between a binding change and the clearing effect — which renderHook's
// act()-wrapped rerender flushes past — so it cannot be observed here. It is
// guarded end-to-end where it matters, in GroupByFilterCard.test.tsx
// ('switching from a failed binding to a healthy one never toasts ...'), which
// fails if the gate is removed.

test('dataset-branch failure evicts the cache so a retry re-issues the request', async () => {
  // cachedSupersetGet caches the in-flight promise and never evicts a
  // rejected one; without eviction a single 500 poisons the endpoint for the
  // whole page session. A fresh consumer for the same id must hit the network
  // again rather than re-await the cached rejected promise.
  fetchMock.get('glob:*/api/v1/dataset/405', 500);

  const first = renderHook(() => useDisplayControlDatasource(405));
  await waitFor(() => expect(first.result.current.error).toBeDefined());
  const callsAfterFirst = fetchMock.callHistory.calls(
    'glob:*/api/v1/dataset/405',
  ).length;

  renderHook(() => useDisplayControlDatasource(405));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/405').length,
    ).toBeGreaterThan(callsAfterFirst),
  );
});

test('nullish id is inert: no fetch, empty columns, not loading', async () => {
  fetchMock.get('glob:*', 200);

  const { result } = renderHook(() => useDisplayControlDatasource(undefined));

  expect(result.current.loading).toBe(false);
  expect(result.current.columns).toEqual([]);
  expect(result.current.name).toBeUndefined();
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(fetchMock.callHistory.calls('glob:*')).toHaveLength(0);
});

test('legacy 0 null-sentinel id is inert: no fetch to /dataset/0, no toast', async () => {
  // migrateChartCustomization.extractDatasetId emits 0 for an unresolvable
  // legacy dataset; the falsy guard must treat it as unbound, not fetch it.
  fetchMock.get('glob:*', 200);

  const { result } = renderHook(() => useDisplayControlDatasource(0));

  expect(result.current.loading).toBe(false);
  expect(result.current.columns).toEqual([]);
  expect(result.current.name).toBeUndefined();
  expect(result.current.error).toBeUndefined();
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(fetchMock.callHistory.calls('glob:*')).toHaveLength(0);
});
