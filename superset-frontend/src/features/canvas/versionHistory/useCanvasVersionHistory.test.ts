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
import { useCanvasVersionHistory } from './useCanvasVersionHistory';

const wrapper = createWrapper({ store });
const renderHook: typeof baseRenderHook = (callback, options) =>
  baseRenderHook(callback, { wrapper, ...options });

const UUID = '9f1c7e30-0000-0000-0000-000000000000';
const VERSIONS = `glob:*/api/v1/canvas/${UUID}/versions/`;

const canvasEvents = (): string[] =>
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

test('a viewer being refused the version list is not reported as an error', async () => {
  // The list doubles as the permission check, so every non-editor is refused
  // on every page view. Reporting those would drown the ones that mean
  // something.
  fetchMock.get(VERSIONS, 403);

  const { result } = renderHook(() => useCanvasVersionHistory(UUID, true, 7));

  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(canvasEvents()).toEqual([]);
});

test('the version list failing for any other reason is reported', async () => {
  fetchMock.get(VERSIONS, 500);

  const { result } = renderHook(() => useCanvasVersionHistory(UUID, true, 7));

  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(canvasEvents()).toEqual(['canvas_error']);
});

test('a superseded preview that fails is still reported, but not shown', async () => {
  fetchMock.get(VERSIONS, { result: [] });
  let failA: (value: number) => void = () => {};
  fetchMock.get(
    `glob:*/api/v1/canvas/${UUID}/versions/aaa*`,
    new Promise<number>(resolve => {
      failA = resolve;
    }),
  );
  fetchMock.get(`glob:*/api/v1/canvas/${UUID}/versions/bbb*`, {
    result: { _version: { version_uuid: 'bbb', version_number: 2 } },
  });

  const { result } = renderHook(() => useCanvasVersionHistory(UUID, true, 7));
  await waitFor(() => expect(result.current.versions).toEqual([]));

  const first = result.current.showVersion('aaa');
  await result.current.showVersion('bbb');
  await waitFor(() =>
    expect(result.current.preview?._version.version_uuid).toBe('bbb'),
  );
  failA(500);
  await first;

  expect(result.current.preview?._version.version_uuid).toBe('bbb');
  expect(result.current.error).toBeUndefined();
  expect(result.current.loading).toBeUndefined();
  expect(canvasEvents()).toEqual(['canvas_error']);
});
