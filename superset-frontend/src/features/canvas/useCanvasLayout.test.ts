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
import fetchMock from 'fetch-mock';
import { useCanvasLayout } from './useCanvasLayout';
import type { CanvasDefinitionResult, GridPlacement } from './types';

const endpoint = 'glob:*/api/v1/canvas/7/definition';

const KPI: GridPlacement = { col: 1, row: 1, colSpan: 6, rowSpan: 4 };
const TREND: GridPlacement = { col: 1, row: 5, colSpan: 24, rowSpan: 8 };
const MOVED: GridPlacement = { col: 7, row: 1, colSpan: 6, rowSpan: 4 };

const resultAt = (
  revision: number,
  canEdit = true,
  placements: Record<string, GridPlacement> = { kpi: KPI, trend: TREND },
) =>
  ({
    revision,
    canEdit,
    placements,
  }) as CanvasDefinitionResult;

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('placements come straight from the definition before any edit', () => {
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  expect(result.current.placements).toEqual({ kpi: KPI, trend: TREND });
  expect(result.current.error).toBeUndefined();
});

test('a placement shows at once and is sent as a place op', async () => {
  fetchMock.patch(endpoint, {
    result: { revision: 4, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  // Shown before the server has answered.
  expect(result.current.placements.kpi).toEqual(MOVED);

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(call.options.method?.toUpperCase()).toBe('PATCH');
  expect(JSON.parse(call.options.body as string)).toEqual({
    base_revision: 3,
    ops: [{ op: 'place', id: 'kpi', layout: MOVED }],
  });
});

test("the server's resolved placements replace the optimistic ones", async () => {
  // The server pushed the trend down to make room, which the client never
  // guesses for itself.
  const pushed: GridPlacement = { col: 1, row: 9, colSpan: 24, rowSpan: 8 };
  fetchMock.patch(endpoint, {
    result: { revision: 4, ops: [], placements: { kpi: MOVED, trend: pushed } },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(result.current.placements.trend).toEqual(pushed));
});

test('a refetch that catches up takes over from the pending view', async () => {
  fetchMock.patch(endpoint, {
    result: { revision: 4, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result, rerender } = renderHook(
    ({ revision }: { revision: number }) =>
      useCanvasLayout(7, resultAt(revision), jest.fn()),
    { initialProps: { revision: 3 } },
  );

  act(() => result.current.place('kpi', MOVED));
  await waitFor(() => expect(result.current.placements.kpi).toEqual(MOVED));

  // The realtime nudge's refetch arrives at the revision the write produced,
  // so the definition is authoritative again.
  rerender({ revision: 4 });

  expect(result.current.placements).toEqual({ kpi: KPI, trend: TREND });
});

test('a failed write snaps back and explains itself', async () => {
  fetchMock.patch(endpoint, 422);
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));
  expect(result.current.placements.kpi).toEqual(MOVED);

  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.placements.kpi).toEqual(KPI);

  act(() => result.current.dismissError());
  expect(result.current.error).toBeUndefined();
});

test('a conflicting write reloads the canvas and says so', async () => {
  fetchMock.patch(endpoint, 409);
  const reload = jest.fn();
  const { result } = renderHook(() => useCanvasLayout(7, resultAt(3), reload));

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect(result.current.error).toContain('changed while you were editing');
  expect(result.current.placements.kpi).toEqual(KPI);
});

test('a refused write names permission as the reason', async () => {
  fetchMock.patch(endpoint, 403);
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() =>
    expect(result.current.error).toContain('do not have permission'),
  );
});

test('a user without edit permission writes nothing', () => {
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3, false), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  expect(fetchMock.callHistory.calls()).toHaveLength(0);
  expect(result.current.placements.kpi).toEqual(KPI);
});

test('a second drag is based on the revision the first write returned', async () => {
  // The regression this guards: basing every write on the definition's
  // revision, which only advances when a realtime nudge triggers a refetch.
  // Without one, the second drag collided with the user's own first drag.
  fetchMock.patch(endpoint, {
    result: { revision: 4, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));

  const again: GridPlacement = { col: 13, row: 1, colSpan: 6, rowSpan: 4 };
  act(() => result.current.place('kpi', again));
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));

  const bases = fetchMock.callHistory
    .calls()
    .map(call => JSON.parse(call.options.body as string).base_revision);
  // 3 is the loaded definition; 4 is what the first write returned.
  expect(bases).toEqual([3, 4]);
});

test('drags made while a write is in flight are coalesced, not conflicted', async () => {
  fetchMock.patch(endpoint, {
    result: { revision: 4, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  const second: GridPlacement = { col: 13, row: 1, colSpan: 6, rowSpan: 4 };
  const third: GridPlacement = { col: 19, row: 1, colSpan: 6, rowSpan: 4 };
  act(() => {
    // Three gestures before the first response can land.
    result.current.place('kpi', MOVED);
    result.current.place('kpi', second);
    result.current.place('trend', third);
  });

  // The last intent per node is shown straight away.
  expect(result.current.placements.kpi).toEqual(second);
  expect(result.current.placements.trend).toEqual(third);

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));
  const [first, follow] = fetchMock.callHistory
    .calls()
    .map(call => JSON.parse(call.options.body as string));
  expect(first.ops).toEqual([{ op: 'place', id: 'kpi', layout: MOVED }]);
  // The queued gestures go out together, on the confirmed revision.
  expect(follow.base_revision).toBe(4);
  expect(follow.ops).toEqual([
    { op: 'place', id: 'kpi', layout: second },
    { op: 'place', id: 'trend', layout: third },
  ]);
  expect(result.current.error).toBeUndefined();
});
