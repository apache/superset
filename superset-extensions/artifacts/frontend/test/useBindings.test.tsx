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

import { act, renderHook, waitFor } from '@testing-library/react';
import type { BindingSource } from '../src/data/bindings';
import useBindings from '../src/data/useBindings';
import type { HostManifest } from '../src/frames/api';

type Rows = Record<string, unknown>[];

/** Every data request waits here until the test answers it. */
function dataRequests() {
  const pending: {
    body: Record<string, unknown>;
    answer: (datasets: Record<string, Rows>) => void;
  }[] = [];
  globalThis.fetch = vi.fn(
    (_path: string, init?: RequestInit) =>
      new Promise<Response>(resolve => {
        pending.push({
          body: JSON.parse(String(init?.body ?? '{}')),
          answer: datasets =>
            resolve({
              ok: true,
              json: async () => ({
                result: {
                  datasets: Object.entries(datasets).map(([name, rows]) => ({
                    name,
                    inline_data: rows,
                  })),
                },
              }),
            } as Response),
        });
      }),
  ) as typeof fetch;
  return pending;
}

/** Answer data request `index` once it has been made. */
async function answer(
  pending: ReturnType<typeof dataRequests>,
  index: number,
  datasets: Record<string, Rows>,
) {
  await waitFor(() => expect(pending.length).toBeGreaterThan(index));
  await act(async () => pending[index].answer(datasets));
}

const manifestOf = (...names: string[]) =>
  ({
    bindings: Object.fromEntries(
      names.map(name => [name, { source: { kind: 'dataset', dataset_id: 1 } }]),
    ),
  }) as unknown as HostManifest;

const manifestOn = (datasetId: number) =>
  ({
    bindings: { b: { source: { kind: 'dataset', dataset_id: datasetId } } },
  }) as unknown as HostManifest;

const source: BindingSource = {
  kind: 'placement',
  canvasId: 1,
  placementId: 'node',
};

test('one request fetches every binding, sending only the filters', async () => {
  const pending = dataRequests();
  const manifest = manifestOf('sales', 'costs');
  const filters = [{ datasetId: 1, column: 'region', values: ['EMEA'] }];
  const { result } = renderHook(() => useBindings(manifest, source, filters));

  await answer(pending, 0, {
    sales: [{ revenue: 12 }],
    costs: [{ cost: 3 }],
    undeclared: [{ secret: 1 }],
  });

  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(pending).toHaveLength(1);
  expect(pending[0].body).toEqual({ runtime_filters: filters });
  expect(result.current.bindings).toEqual({
    sales: { rows: [{ revenue: 12 }] },
    costs: { rows: [{ cost: 3 }] },
  });
});

test('a binding the answer has no dataset for fails them all', async () => {
  const pending = dataRequests();
  const manifest = manifestOf('sales', 'costs');
  const { result } = renderHook(() => useBindings(manifest, source, []));

  await answer(pending, 0, { sales: [{ revenue: 12 }] });

  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error).toBe('no data for "costs"');
  expect(result.current.bindings).toEqual({});
});

test('a rerun replaces only the binding it names', async () => {
  const pending = dataRequests();
  const manifest = manifestOf('sales', 'costs');
  const { result } = renderHook(() => useBindings(manifest, source, []));
  await answer(pending, 0, { sales: [{ v: 1 }], costs: [{ v: 1 }] });
  await waitFor(() => expect(result.current.status).toBe('ok'));
  const costs = result.current.bindings.costs;

  let rerun: Promise<void> | undefined;
  act(() => {
    rerun = result.current.rerun('sales');
  });
  await answer(pending, 1, { sales: [{ v: 2 }], costs: [{ v: 2 }] });
  await act(async () => {
    await rerun;
  });

  expect(pending).toHaveLength(2);
  expect(result.current.bindings.sales.rows).toEqual([{ v: 2 }]);
  // The same object, so the frame host doesn't send it again.
  expect(result.current.bindings.costs).toBe(costs);
});

test("a new manifest's bindings stay empty until its own results land", async () => {
  const pending = dataRequests();
  const published = manifestOn(1);
  const draft = manifestOn(2);
  const { result, rerender } = renderHook(
    ({ manifest }) => useBindings(manifest, source, []),
    { initialProps: { manifest: published } },
  );
  await answer(pending, 0, { b: [{ region: 'OLD' }] });
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.bindings.b.rows).toEqual([{ region: 'OLD' }]);

  rerender({ manifest: draft });

  expect(result.current.bindings).toEqual({});
  expect(result.current.status).toBe('loading');
  await answer(pending, 1, { b: [{ region: 'NEW' }] });
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.bindings.b.rows).toEqual([{ region: 'NEW' }]);
});

test('results stand across a filter change until the new ones land', async () => {
  const pending = dataRequests();
  const manifest = manifestOn(1);
  const { result, rerender } = renderHook(
    ({ filters }) => useBindings(manifest, source, filters),
    { initialProps: { filters: [] as never[] } },
  );
  await answer(pending, 0, { b: [{ region: 'EMEA' }] });
  await waitFor(() => expect(result.current.status).toBe('ok'));

  rerender({
    filters: [{ datasetId: 1, column: 'region', values: ['EMEA'] }] as never[],
  });

  expect(result.current.bindings.b.rows).toEqual([{ region: 'EMEA' }]);
});

test('a rerun that a full fetch overtakes is dropped', async () => {
  const pending = dataRequests();
  const manifest = manifestOn(1);
  const { result } = renderHook(() => useBindings(manifest, source, []));
  await answer(pending, 0, { b: [{ v: 'first' }] });
  await waitFor(() => expect(result.current.status).toBe('ok'));

  let rerun: Promise<void> | undefined;
  act(() => {
    rerun = result.current.rerun('b');
  });
  await waitFor(() => expect(pending).toHaveLength(2));
  act(() => result.current.refresh());
  await answer(pending, 2, { b: [{ v: 'refreshed' }] });
  await waitFor(() =>
    expect(result.current.bindings.b.rows).toEqual([{ v: 'refreshed' }]),
  );
  await answer(pending, 1, { b: [{ v: 'stale rerun' }] });
  await act(async () => {
    await rerun;
  });

  expect(result.current.bindings.b.rows).toEqual([{ v: 'refreshed' }]);
});
