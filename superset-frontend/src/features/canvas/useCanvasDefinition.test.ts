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

import { renderHook as baseRenderHook, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { createWrapper } from 'spec/helpers/testing-library';
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
  // An expired draft keeps polling. Reporting each failure would write a row
  // every few seconds describing one unchanging broken state.
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
