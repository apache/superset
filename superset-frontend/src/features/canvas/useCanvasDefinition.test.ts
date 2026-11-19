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

import { act } from 'react';
import {
  renderHook as baseRenderHook,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { createWrapper } from 'spec/helpers/testing-library';
import * as bootstrap from 'src/utils/getBootstrapData';
import { store } from 'src/views/store';
import { useCanvasDefinition } from './useCanvasDefinition';

// The app store, so the dispatches the hook makes are the ones observed
// below; `useRedux` alone would give the wrapper a store of its own.
const wrapper = createWrapper({ store });
const renderHook: typeof baseRenderHook = (callback, options) =>
  baseRenderHook(callback, { wrapper, ...options });

const DEFINITION = 'glob:*/api/v1/canvas/9/definition';
const DRAFT = 'glob:*/api/v1/canvas/draft';

const result = {
  revision: 2,
  definition: { version: 1, nodes: { a: {} } },
};

/** The canvas event names dispatched so far. */
const events = (): string[] =>
  (store.dispatch as jest.Mock).mock.calls
    .map(([action]) => {
      if (typeof action !== 'function') return undefined;
      const inner = jest.fn();
      action(inner);
      return inner.mock.calls[0]?.[0]?.payload?.eventName;
    })
    .filter((name): name is string => typeof name === 'string')
    .filter(name => name.startsWith('canvas_'));

beforeEach(() => {
  jest
    .spyOn(store, 'dispatch')
    .mockImplementation(((action: unknown) => action) as typeof store.dispatch);
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  jest.restoreAllMocks();
});

test('a reloaded definition is reported once, not on every poll', async () => {
  // `load` runs again on every draft poll and on every window focus. Logging
  // each one would write a row every few seconds per open tab.
  fetchMock.get(DEFINITION, { result });
  const { result: hook } = renderHook(() => useCanvasDefinition(9));

  await waitFor(() => expect(hook.current.state.status).toBe('complete'));
  expect(events()).toEqual(['canvas_load_definition']);

  hook.current.reload();
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));

  expect(events()).toEqual(['canvas_load_definition']);
});

test('a draft that keeps failing is reported once, not on every poll', async () => {
  // A failing draft keeps being asked for -- by the poll until it is found
  // gone, and by every resync. Reporting each failure would write a row for
  // every one of them describing one unchanging broken state.
  fetchMock.get(DRAFT, 404);
  const { result: hook } = renderHook(() => useCanvasDefinition(9, 'token'));

  await waitFor(() => expect(hook.current.state.status).toBe('error'));
  expect(events()).toEqual(['canvas_error']);

  hook.current.reload();
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));

  expect(events()).toEqual(['canvas_error']);
});

test('a failure after a recovery is reported again', async () => {
  // Reporting once per source must not mean reporting once ever: a canvas
  // that breaks, recovers and breaks again is two separate failures.
  fetchMock.get(DEFINITION, 500);
  const { result: hook } = renderHook(() => useCanvasDefinition(9));

  await waitFor(() => expect(events()).toEqual(['canvas_error']));

  fetchMock.removeRoutes();
  fetchMock.get(DEFINITION, { result });
  hook.current.reload();
  await waitFor(() => expect(hook.current.state.status).toBe('complete'));

  fetchMock.removeRoutes();
  fetchMock.get(DEFINITION, 500);
  hook.current.reload();

  await waitFor(() =>
    expect(events()).toEqual([
      'canvas_error',
      'canvas_load_definition',
      'canvas_error',
    ]),
  );
});

/** A draft's definition at `revision`, as the draft route returns it. */
const draftAt = (revision: number) => ({
  result: { ...result, revision, canvasId: 9 },
});

const held = <T>() => {
  let release: (value: T) => void = () => {};
  const promise = new Promise<T>(resolve => {
    release = resolve;
  });
  return { promise, release };
};

/**
 * Serves the draft route by token, a reply per request in turn; the last
 * reply keeps answering. A reply may be a promise, to hold the response, and
 * a number answers with that status.
 */
const serveDrafts = (replies: Record<string, unknown[]>) => {
  fetchMock.get(DRAFT, ({ options }) => {
    const token = (options.headers as Record<string, string> | undefined)?.[
      'x-canvas-draft'
    ];
    const queue = token ? replies[token] : undefined;
    if (!queue?.length) return 404;
    return queue.length > 1 ? queue.shift() : queue[0];
  });
};

const draftGets = () => fetchMock.callHistory.calls(DRAFT);

/** Lets responses already released land. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const focusWindow = () => fireEvent.focus(window);

/** The hook on a draft, or on the published canvas once `token` is unset. */
const renderOn = (token?: string) =>
  renderHook(
    ({ draftToken }: { draftToken?: string }) =>
      useCanvasDefinition(9, draftToken),
    { initialProps: { draftToken: token } },
  );

type Hook = ReturnType<typeof renderOn>['result'];

/** The revision on screen and how the last refresh went, once complete. */
const shown = (hook: Hook) => {
  const { state } = hook.current;
  return state.status === 'complete'
    ? {
        revision: state.result.revision,
        draftToken: state.draftToken,
        refreshFailed: state.refreshFailed,
      }
    : { status: state.status };
};

const settled = (revision: number, draftToken = 'tok-a') => ({
  revision,
  draftToken,
  refreshFailed: undefined,
});

/** The published canvas on screen at `revision`. */
const publishedAt = (revision: number) => ({
  revision,
  draftToken: undefined,
  refreshFailed: undefined,
});

test('a draft is refetched when the window regains focus', async () => {
  serveDrafts({ 'tok-a': [draftAt(3), draftAt(4)] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(3)));

  focusWindow();

  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));
});

test('a refresh that fails keeps the definition, marked failed until one succeeds', async () => {
  // What is on screen may no longer be the draft's latest.
  serveDrafts({ 'tok-a': [draftAt(2), 500, draftAt(3)] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));

  focusWindow();
  await waitFor(() =>
    expect(shown(hook)).toStrictEqual({
      ...settled(2),
      refreshFailed: 'failed',
    }),
  );

  focusWindow();

  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(3)));
});

test.each([404, 403])(
  'a refresh answering %i finds the draft gone and keeps what is on screen',
  async status => {
    // Published, discarded or expired elsewhere, or out of the user's reach.
    serveDrafts({ 'tok-a': [draftAt(2), status] });
    const { result: hook } = renderOn('tok-a');
    await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));

    focusWindow();

    await waitFor(() =>
      expect(shown(hook)).toStrictEqual({
        ...settled(2),
        refreshFailed: 'gone',
      }),
    );
  },
);

test.each([404, 403])(
  'a draft found gone with %i is neither polled nor refetched on focus',
  async status => {
    // Asking again can only fail again, every few seconds, forever.
    jest.useFakeTimers();
    const conf = bootstrap.default();
    jest.spyOn(bootstrap, 'default').mockReturnValue({
      ...conf,
      common: {
        ...conf.common,
        conf: { ...conf.common.conf, CANVAS_DRAFT_POLL_INTERVAL: 5 },
      },
    });
    serveDrafts({ 'tok-a': [draftAt(2), status] });
    try {
      const { result: hook } = renderOn('tok-a');
      await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));

      // The poll is what finds it gone.
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      await waitFor(() =>
        expect(shown(hook)).toMatchObject({ refreshFailed: 'gone' }),
      );
      expect(draftGets()).toHaveLength(2);

      await act(async () => {
        jest.advanceTimersByTime(20000);
      });
      focusWindow();
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(draftGets()).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  },
);

test('a draft found gone stays gone when a newer refresh then fails otherwise', async () => {
  // Two refreshes in flight: the older is answered 403, then the newer fails
  // for another reason, such as going offline. That says nothing about
  // whether the draft came back, and must not turn it into a pending draft,
  // which it would then stay with nothing left to refresh it.
  const older = held<unknown>();
  const newer = held<unknown>();
  serveDrafts({
    'tok-a': [draftAt(2), older.promise, newer.promise, draftAt(3)],
  });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));
  focusWindow();
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(3));

  older.release(403);
  await waitFor(() =>
    expect(shown(hook)).toStrictEqual({ ...settled(2), refreshFailed: 'gone' }),
  );
  newer.release(500);
  await settle();

  expect(shown(hook)).toStrictEqual({ ...settled(2), refreshFailed: 'gone' });

  // Only a read that succeeds brings it back.
  await act(async () => {
    await hook.current.reload();
  });

  expect(shown(hook)).toStrictEqual(settled(3));
});

test('a read that succeeds after the draft was found gone refreshes it again', async () => {
  // The newer of two refreshes in flight succeeds after the older was
  // answered 404: the draft is there after all, so it is kept current again.
  const older = held<unknown>();
  const newer = held<unknown>();
  serveDrafts({
    'tok-a': [draftAt(2), older.promise, newer.promise, draftAt(4)],
  });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));
  focusWindow();
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(3));
  older.release(404);
  await waitFor(() =>
    expect(shown(hook)).toMatchObject({ refreshFailed: 'gone' }),
  );

  newer.release(draftAt(3));
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(3)));
  focusWindow();

  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));
  expect(draftGets()).toHaveLength(4);
});

test('a later refresh answering an older revision does not take the draft back', async () => {
  // Requests are answered in order, but a read can still lag behind one
  // answered before it.
  serveDrafts({ 'tok-a': [draftAt(4), draftAt(6), draftAt(5)] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));

  focusWindow();
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(6)));
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(3));
  await settle();

  expect(shown(hook)).toStrictEqual(settled(6));
});

test('an older revision answered after a failed refresh still clears the failure', async () => {
  // The read lags behind what is on screen, which stays; but it did succeed,
  // so the draft is no longer one whose last refresh failed.
  serveDrafts({ 'tok-a': [draftAt(4), draftAt(6), 500, draftAt(5), 500] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));
  focusWindow();
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(6)));
  focusWindow();
  await waitFor(() =>
    expect(shown(hook)).toStrictEqual({
      ...settled(6),
      refreshFailed: 'failed',
    }),
  );
  const before = hook.current.state;

  focusWindow();

  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(6)));
  const after = hook.current.state;
  expect(after.status === 'complete' && after.result).toBe(
    before.status === 'complete' && before.result,
  );

  // A recovery like any other: the next failure is news again.
  focusWindow();
  await waitFor(() =>
    expect(shown(hook)).toMatchObject({ refreshFailed: 'failed' }),
  );
  expect(events()).toEqual([
    'canvas_load_definition',
    'canvas_error',
    'canvas_error',
  ]);
});

test('an older response that lands last does not take the draft back', async () => {
  const slow = held<unknown>();
  serveDrafts({ 'tok-a': [draftAt(4), slow.promise, draftAt(6)] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));

  focusWindow();
  focusWindow();
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(6)));

  slow.release(draftAt(5));
  await settle();

  expect(shown(hook)).toStrictEqual(settled(6));
});

test('an older refresh failing after a newer one succeeded leaves the draft settled', async () => {
  const slowFailure = held<unknown>();
  serveDrafts({ 'tok-a': [draftAt(2), slowFailure.promise, draftAt(3)] });
  const { result: hook } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));

  focusWindow();
  focusWindow();
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(3)));

  slowFailure.release(500);
  await settle();

  expect(shown(hook)).toStrictEqual(settled(3));
});

test.each([
  ['the published canvas', undefined],
  ['another draft', 'tok-b'],
])(
  'a refetch of a draft left for %s is dropped when it lands',
  async (_, next) => {
    // A discard leaves for the published canvas while an undo's refetch is
    // still in flight; switching drafts can leave one behind the same way.
    const late = held<unknown>();
    serveDrafts({ 'tok-a': [draftAt(2), late.promise], 'tok-b': [draftAt(0)] });
    fetchMock.get(DEFINITION, { result: { ...result, revision: 9 } });
    const { result: hook, rerender } = renderOn('tok-a');
    await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));
    focusWindow();
    await waitFor(() => expect(draftGets()).toHaveLength(2));

    rerender({ draftToken: next });
    const arrived = next ? settled(0, next) : publishedAt(9);
    await waitFor(() => expect(shown(hook)).toStrictEqual(arrived));

    late.release(draftAt(3));
    await settle();

    expect(shown(hook)).toStrictEqual(arrived);
  },
);

test('reopening a draft does not bring back what was asked before leaving it', async () => {
  // A refresh of the draft is still in flight when the user leaves and comes
  // back before the published canvas answers; that refresh then answers
  // before the request sent on coming back.
  const beforeLeaving = held<unknown>();
  const afterReturning = held<unknown>();
  serveDrafts({
    'tok-a': [draftAt(2), beforeLeaving.promise, afterReturning.promise],
  });
  const publishedReply = held<unknown>();
  fetchMock.get(DEFINITION, () => publishedReply.promise);
  const { result: hook, rerender } = renderOn('tok-a');
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(2)));
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(2));

  rerender({ draftToken: undefined });
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DEFINITION)).toHaveLength(1),
  );
  rerender({ draftToken: 'tok-a' });
  await waitFor(() => expect(draftGets()).toHaveLength(3));

  beforeLeaving.release(draftAt(3));
  await settle();

  expect(shown(hook)).toStrictEqual(settled(2));

  afterReturning.release(draftAt(4));
  await waitFor(() => expect(shown(hook)).toStrictEqual(settled(4)));
  publishedReply.release({ result });
  await settle();

  expect(shown(hook)).toStrictEqual(settled(4));
});
