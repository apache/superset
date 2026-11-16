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
import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getClientErrorObject } from '@superset-ui/core';
import {
  CanvasDraftContext,
  CanvasVersionContext,
  useWidgetRows,
} from './useWidgetRows';
import { fetchPlacementData, PlacementData } from './echarts/chartData';

jest.mock('./echarts/chartData', () => ({
  ...jest.requireActual('./echarts/chartData'),
  fetchPlacementData: jest.fn(),
}));
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getClientErrorObject: jest.fn(),
}));

const fetchData = jest.mocked(fetchPlacementData);
const clientError = jest.mocked(getClientErrorObject);
const actualClientError =
  jest.requireActual<typeof import('@superset-ui/core')>(
    '@superset-ui/core',
  ).getClientErrorObject;
const widget = {
  canvasId: 1,
  nodeId: 'chart',
  props: { dataBinding: { datasetId: 13, metrics: ['count'] } },
};
const data: PlacementData = {
  rows: [{ restricted: 'old row' }],
  query: 'SELECT restricted FROM old_source',
  language: 'sql',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetAllMocks();
  clientError.mockImplementation(actualClientError);
});

test.each([
  [
    'dataset',
    { ...widget, props: { dataBinding: { datasetId: 14, metrics: [] } } },
    0,
  ],
  ['canvas', { ...widget, canvasId: 2 }, 0],
  ['placement', { ...widget, nodeId: 'other' }, 0],
  ['refresh', widget, 1],
])(
  'clears rows and query synchronously when %s changes',
  async (_name, nextWidget, refresh) => {
    fetchData
      .mockResolvedValueOnce(data)
      .mockReturnValue(new Promise(() => {}));
    const snapshots: ReturnType<typeof useWidgetRows>[] = [];
    const { result, rerender } = renderHook(
      ({ source, refreshKey }) => {
        const rows = useWidgetRows(source, [], refreshKey);
        snapshots.push(rows);
        return rows;
      },
      { initialProps: { source: widget, refreshKey: 0 } },
    );
    await waitFor(() => expect(result.current.rows).toEqual(data.rows));
    snapshots.length = 0;
    rerender({ source: nextWidget, refreshKey: refresh });
    expect(
      snapshots.every(value => value.rows.length === 0 && !value.query),
    ).toBe(true);
    expect(result.current.loading).toBe(true);
  },
);

test('clears data for an unbound widget', async () => {
  fetchData.mockResolvedValue(data);
  const { result, rerender } = renderHook(
    ({ props }) => useWidgetRows({ ...widget, props }, [], 0),
    { initialProps: { props: widget.props as Record<string, unknown> } },
  );
  await waitFor(() => expect(result.current.query).toBe(data.query));
  rerender({ props: {} });
  expect(result.current).toEqual({
    rows: [],
    loading: false,
    datasource: undefined,
  });
});

test.each(['draft', 'version'])(
  'clears data when %s context changes',
  async context => {
    let value: string | undefined;
    const Context =
      context === 'draft' ? CanvasDraftContext : CanvasVersionContext;
    fetchData
      .mockResolvedValueOnce(data)
      .mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(
      () => useWidgetRows(widget, [], 0),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <Context.Provider value={value}>{children}</Context.Provider>
        ),
      },
    );
    await waitFor(() => expect(result.current.query).toBe(data.query));
    value = 'another-context';
    rerender();
    expect(result.current.rows).toEqual([]);
    expect(result.current.query).toBeUndefined();
    expect(fetchData).toHaveBeenLastCalledWith(
      expect.objectContaining(
        context === 'draft' ? { draftToken: value } : { versionUuid: value },
      ),
    );
  },
);

test('ignores a previous source response after a newer response', async () => {
  const old = deferred<PlacementData>();
  fetchData
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ rows: [{ current: 1 }] });
  const { result, rerender } = renderHook(
    ({ canvasId }) => useWidgetRows({ ...widget, canvasId }, [], 0),
    { initialProps: { canvasId: 1 } },
  );
  rerender({ canvasId: 2 });
  await waitFor(() => expect(result.current.rows).toEqual([{ current: 1 }]));
  await act(async () => old.resolve(data));
  expect(result.current.rows).toEqual([{ current: 1 }]);
  expect(result.current.query).toBeUndefined();
});

test('ignores error parsing that finishes after the context changed', async () => {
  const parsed = deferred<Awaited<ReturnType<typeof getClientErrorObject>>>();
  fetchData
    .mockRejectedValueOnce(new Response('{}', { status: 400 }))
    .mockResolvedValueOnce({ rows: [{ current: 1 }] });
  clientError.mockReturnValue(parsed.promise);
  const { result, rerender } = renderHook(
    ({ canvasId }) => useWidgetRows({ ...widget, canvasId }, [], 0),
    { initialProps: { canvasId: 1 } },
  );
  await waitFor(() => expect(clientError).toHaveBeenCalled());
  rerender({ canvasId: 2 });
  await waitFor(() => expect(result.current.rows).toEqual([{ current: 1 }]));
  await act(async () =>
    parsed.resolve({ error: 'old diagnostic' } as Awaited<
      ReturnType<typeof getClientErrorObject>
    >),
  );
  expect(result.current.error).toBeUndefined();
});

test.each([false, true])(
  'uses a safe fallback when error normalization fails (%s)',
  async throws => {
    fetchData.mockRejectedValue(new Response('{}', { status: 400 }));
    if (throws)
      clientError.mockRejectedValue(new Error('sensitive parser detail'));
    else
      clientError.mockResolvedValue(
        {} as Awaited<ReturnType<typeof getClientErrorObject>>,
      );
    const { result } = renderHook(() => useWidgetRows(widget, [], 0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("The widget's query failed");
  },
);

test('preserves an actionable server query diagnostic', async () => {
  fetchData.mockRejectedValue(
    new Response(
      JSON.stringify({
        errors: [
          {
            message: 'Columns missing in dataset',
            error_type: 'GENERIC_DB_ENGINE_ERROR',
            level: 'error',
          },
        ],
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  const { result } = renderHook(() => useWidgetRows(widget, [], 0));
  await waitFor(() =>
    expect(result.current.error).toBe('Columns missing in dataset'),
  );
});

test('clears the old result when runtime filters change', async () => {
  fetchData.mockResolvedValueOnce(data).mockReturnValue(new Promise(() => {}));
  const filters = [
    {
      filterNodeId: 'region',
      value: { datasetId: 13, column: 'region', values: ['north'] },
    },
  ];
  const { result, rerender } = renderHook(
    ({ currentFilters }) => useWidgetRows(widget, currentFilters, 0),
    { initialProps: { currentFilters: filters } },
  );
  await waitFor(() => expect(result.current.query).toBe(data.query));
  rerender({
    currentFilters: [
      { ...filters[0], value: { ...filters[0].value, values: ['south'] } },
    ],
  });
  expect(result.current.rows).toEqual([]);
  expect(result.current.query).toBeUndefined();
  expect(fetchData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filters: [{ datasetId: 13, column: 'region', values: ['south'] }],
    }),
  );
});

test.each([
  ['exception', new Error('sensitive transport body')],
  ['string', 'sensitive transport body'],
  ['message object', { message: 'sensitive transport body' }],
  ['null', null],
])(
  'does not expose a bare transport %s through the real normalizer',
  async (_name, failure) => {
    fetchData.mockRejectedValue(failure);
    const { result } = renderHook(() => useWidgetRows(widget, [], 0));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("The widget's query failed");
  },
);

test.each([false, true])(
  'preserves a real server Response diagnostic (wrapped: %s)',
  async wrapped => {
    const response = new Response(
      JSON.stringify({
        message: 'Columns missing in dataset',
        error_type: 'QueryError',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
    fetchData.mockRejectedValue(wrapped ? { response } : response);
    const { result } = renderHook(() => useWidgetRows(widget, [], 0));
    await waitFor(() =>
      expect(result.current.error).toBe('Columns missing in dataset'),
    );
    expect(clientError).toHaveBeenCalledTimes(1);
  },
);

test('does not fall back to the status text of an already consumed response', async () => {
  const response = new Response('{}', {
    status: 500,
    statusText: 'sensitive transport body',
  });
  await response.text();
  fetchData.mockRejectedValue(response);
  const { result } = renderHook(() => useWidgetRows(widget, [], 0));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe("The widget's query failed");
  expect(clientError).not.toHaveBeenCalled();
});
