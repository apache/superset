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
const QUEUED: GridPlacement = { col: 1, row: 14, colSpan: 24, rowSpan: 8 };
/** What the server resolves a queued placement to, after its push-down. */
const SETTLED: GridPlacement = { col: 1, row: 18, colSpan: 24, rowSpan: 8 };

const resultAt = (
  revision: number,
  canEdit = true,
  placements: Record<string, GridPlacement> = { kpi: KPI, trend: TREND },
) =>
  ({
    revision,
    canEdit,
    placements,
    // The stored layouts behind them. These happen to match because the
    // fixture places everything explicitly.
    layouts: placements,
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

test('a gesture queued behind a write is not undone by that write landing', async () => {
  // The first write resolves; the follow-up is held open so the window
  // between them is observable. Inside it the queued gesture must still show.
  let releaseFollowUp: () => void = () => {};
  const followUp = new Promise<Response>(resolve => {
    releaseFollowUp = () =>
      resolve(
        new Response(
          JSON.stringify({
            result: {
              revision: 5,
              ops: [],
              // The server pushed trend down to fit, so this differs from the
              // optimistic QUEUED: the assertions below can only pass if the
              // follow-up's response was actually consumed.
              placements: { kpi: MOVED, trend: SETTLED },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
  });
  fetchMock
    .patch(
      endpoint,
      {
        result: {
          revision: 4,
          ops: [],
          placements: { kpi: MOVED, trend: TREND },
        },
      },
      { repeat: 1 },
    )
    .patch(endpoint, () => followUp);

  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => {
    result.current.place('kpi', MOVED);
    // Queued: the first request is already in flight.
    result.current.place('trend', QUEUED);
  });

  // Both requests have gone out, so the first one's response has landed.
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));

  // The regression: the first response's placements have trend at TREND, and
  // overwriting with them would snap the widget back mid-flight.
  expect(result.current.placements.trend).toEqual(QUEUED);
  expect(result.current.placements.kpi).toEqual(MOVED);

  // Not yet acknowledged, so the revision is still the first write's.
  expect(result.current.revision).toBe(4);

  releaseFollowUp();

  // The follow-up's acknowledgement is consumed: its own placement for trend
  // replaces the optimistic one, and its revision becomes the base the next
  // write will use. Leaving `confirmed` stale here is what made later writes
  // conflict, so the revision is the real assertion.
  await waitFor(() => expect(result.current.revision).toBe(5));
  expect(result.current.placements.trend).toEqual(SETTLED);
  expect(result.current.placements.kpi).toEqual(MOVED);
});

test('with a draft open, the write goes to the draft and not the canvas', async () => {
  const draftEndpoint = 'glob:*/api/v1/canvas/draft';
  fetchMock.patch(draftEndpoint, {
    result: { revision: 1, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result } = renderHook(() =>
    // A draft counts its own revisions, starting at 0.
    useCanvasLayout(7, resultAt(0), jest.fn(), 'tok-123'),
  );

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(call.url).toContain('/api/v1/canvas/draft');
  expect(call.url).not.toContain('/definition');
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');
  // The draft route takes `revision`, not `base_revision`.
  expect(JSON.parse(call.options.body as string)).toEqual({
    revision: 0,
    ops: [{ op: 'place', id: 'kpi', layout: MOVED }],
  });
});

test('switching surface drops the revision confirmed on the other one', async () => {
  fetchMock.patch(endpoint, {
    result: { revision: 29, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  fetchMock.patch('glob:*/api/v1/canvas/draft', {
    result: { revision: 1, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result, rerender } = renderHook(
    ({ token, revision }: { token?: string; revision: number }) =>
      useCanvasLayout(7, resultAt(revision), jest.fn(), token),
    { initialProps: { token: undefined as string | undefined, revision: 28 } },
  );

  act(() => result.current.place('kpi', MOVED));
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));

  // Opening a draft: revision 29 confirmed on the canvas must not become the
  // base of a draft write, which would be a revision the draft never had.
  rerender({ token: 'tok-123', revision: 0 });
  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));
  const draftCall = fetchMock.callHistory.calls()[1];
  expect(JSON.parse(draftCall.options.body as string).revision).toBe(0);
});

test('a write still in flight when the surface changes is dropped', async () => {
  // The test above switches surface only after the canvas write has returned.
  // A pending one still returns, and consuming it would put revision 29 into
  // `confirmed` for a draft that counts from zero -- so the draft's next
  // write would be based on a revision it never had. It would also clear
  // `writing`, letting a second draft write go out alongside the first.
  let answerCanvas: () => void = () => {};
  const canvasResponse = new Promise<Response>(resolve => {
    answerCanvas = () =>
      resolve(
        new Response(
          JSON.stringify({
            result: {
              revision: 29,
              ops: [],
              placements: { kpi: MOVED, trend: TREND },
              layouts: { kpi: MOVED, trend: TREND },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
  });
  fetchMock.patch(endpoint, () => canvasResponse);
  fetchMock.patch('glob:*/api/v1/canvas/draft', {
    result: {
      revision: 1,
      ops: [],
      placements: { kpi: MOVED, trend: TREND },
      layouts: { kpi: MOVED, trend: TREND },
    },
  });

  const { result, rerender } = renderHook(
    ({ token, revision }: { token?: string; revision: number }) =>
      useCanvasLayout(7, resultAt(revision), jest.fn(), token),
    { initialProps: { token: undefined as string | undefined, revision: 28 } },
  );

  act(() => result.current.place('kpi', MOVED));
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));

  // The plan opens while that write is still open, and only then does the
  // canvas answer.
  rerender({ token: 'tok-123', revision: 0 });
  await act(async () => {
    answerCanvas();
  });

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));
  const draftCall = fetchMock.callHistory.calls()[1];
  expect(JSON.parse(draftCall.options.body as string).revision).toBe(0);
  // And the stale revision never surfaced as the draft's own.
  expect(result.current.revision).toBe(1);
});

test("a write's stored layouts replace the fetched ones", async () => {
  // The server resolves placement from stored layouts and writes a pushed
  // node's new row back into its own, so after one drop the fetched layouts
  // are behind. A drag preview resolving from them would disagree with the
  // write that follows it.
  const pushedLayout = { col: 1, row: 9, colSpan: 24, rowSpan: 8 };
  fetchMock.patch(endpoint, {
    result: {
      revision: 4,
      ops: [],
      placements: { kpi: MOVED, trend: pushedLayout },
      layouts: { kpi: MOVED, trend: pushedLayout },
    },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  expect(result.current.layouts).toEqual({ kpi: KPI, trend: TREND });

  act(() => result.current.place('kpi', MOVED));

  // The moved node's layout is known at once: the op sends this placement as
  // its layout, so that is what the server will store.
  expect(result.current.layouts.kpi).toEqual(MOVED);

  await waitFor(() =>
    expect(result.current.layouts.trend).toEqual(pushedLayout),
  );
});

test('the reported revision follows the writes, so a commit can use it', async () => {
  // The regression this guards: publishing a draft sends the revision the
  // definition was fetched at. A drag moves the draft on immediately, so a
  // commit right after a drag was rejected until the next poll caught up.
  fetchMock.patch('glob:*/api/v1/canvas/draft', {
    result: { revision: 1, ops: [], placements: { kpi: MOVED, trend: TREND } },
  });
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(0), jest.fn(), 'tok-123'),
  );

  // A freshly opened draft is at the revision it was fetched at.
  expect(result.current.revision).toBe(0);

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(result.current.revision).toBe(1));
});

test('the reported revision is never an optimistic guess', () => {
  // Nothing has been confirmed, so a write in flight must not advance it:
  // a commit naming a revision the server has not reached is rejected too.
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(4), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  expect(result.current.revision).toBe(4);
});

test('saving is set while a write is in flight and clears once the queue drains', async () => {
  // Guards the race a reviewer found: Publish stays clickable during a write,
  // commits the older revision, deletes the draft, and the move is lost.
  let releaseFirst: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    releaseFirst = () =>
      resolve(
        new Response(
          JSON.stringify({
            result: { revision: 4, ops: [], placements: { kpi: MOVED } },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
  });
  fetchMock
    .patch(endpoint, () => held, { repeat: 1 })
    .patch(endpoint, {
      result: { revision: 5, ops: [], placements: { kpi: MOVED } },
    });

  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  expect(result.current.saving).toBe(false);

  act(() => {
    result.current.place('kpi', MOVED);
    // Queued behind the first, so saving must stay set across both.
    result.current.place('trend', QUEUED);
  });
  expect(result.current.saving).toBe(true);

  releaseFirst();

  // Only false once the queued follow-up has landed too.
  await waitFor(() => expect(result.current.saving).toBe(false));
  expect(fetchMock.callHistory.calls()).toHaveLength(2);
  expect(result.current.revision).toBe(5);
});

test('saving clears after a failed write, so publishing is not blocked forever', async () => {
  fetchMock.patch(endpoint, 422);
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  act(() => result.current.place('kpi', MOVED));

  await waitFor(() => expect(result.current.saving).toBe(false));
  expect(result.current.error).toBeDefined();
});

test('a failed write keeps the layout the server already acknowledged', async () => {
  // The regression this guards: falling back to the fetched definition, which
  // is behind every acknowledged drag, so an earlier accepted move vanished
  // from the screen until the next poll even though the server had it.
  const pushed: GridPlacement = { col: 1, row: 9, colSpan: 24, rowSpan: 8 };
  fetchMock
    .patch(
      endpoint,
      {
        result: {
          revision: 4,
          ops: [],
          placements: { kpi: MOVED, trend: pushed },
        },
      },
      { repeat: 1 },
    )
    .patch(endpoint, 422);
  const { result } = renderHook(() =>
    useCanvasLayout(7, resultAt(3), jest.fn()),
  );

  // First drag is accepted; the server also pushed the trend down.
  act(() => result.current.place('kpi', MOVED));
  await waitFor(() => expect(result.current.revision).toBe(4));

  // Second drag is rejected.
  const again: GridPlacement = { col: 13, row: 1, colSpan: 6, rowSpan: 4 };
  act(() => result.current.place('kpi', again));
  await waitFor(() => expect(result.current.error).toBeDefined());

  // The rejected drag is undone, but the accepted one survives -- both the
  // widget that moved and the sibling the server pushed.
  expect(result.current.placements.kpi).toEqual(MOVED);
  expect(result.current.placements.trend).toEqual(pushed);
  expect(result.current.revision).toBe(4);
});
