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
  // Inside act, so what it sets is rendered before it is read below.
  await act(async () => {
    failA(500);
    await first;
  });

  expect(result.current.preview?._version.version_uuid).toBe('bbb');
  expect(result.current.error).toBeUndefined();
  expect(result.current.loading).toBeUndefined();
  expect(canvasEvents()).toEqual(['canvas_error']);
});

const versionRoute = (uuid: string) =>
  `glob:*/api/v1/canvas/${UUID}/versions/${uuid}/`;

const snapshotOf = (uuid: string, number: number) => ({
  result: { _version: { version_uuid: uuid, version_number: number } },
});

const held = <T>() => {
  let release: (value: T) => void = () => {};
  const promise = new Promise<T>(resolve => {
    release = resolve;
  });
  return { promise, release };
};

/** The history of a canvas whose version list has loaded. */
const renderLoaded = async (enabled = true) => {
  fetchMock.get(VERSIONS, { result: [] });
  const rendered = renderHook(
    ({ on }: { on: boolean }) => useCanvasVersionHistory(UUID, on, 7),
    { initialProps: { on: enabled } },
  );
  await waitFor(() => expect(rendered.result.current.versions).toEqual([]));
  return rendered;
};

const previewed = (history: {
  preview?: { _version: { version_uuid: string } };
}) => history.preview?._version.version_uuid;

test('of two versions asked for in turn, the second is previewed even if the first answers last', async () => {
  const first = held<unknown>();
  fetchMock.get(versionRoute('aaa'), () => first.promise);
  fetchMock.get(versionRoute('bbb'), snapshotOf('bbb', 2));
  const { result } = await renderLoaded();

  let asked: Promise<void> = Promise.resolve();
  act(() => {
    asked = result.current.showVersion('aaa');
  });
  await act(() => result.current.showVersion('bbb'));
  expect(previewed(result.current)).toBe('bbb');

  await act(async () => {
    first.release(snapshotOf('aaa', 1));
    await asked;
  });

  expect(previewed(result.current)).toBe('bbb');
  expect(result.current.loading).toBeUndefined();
});

test('a superseded preview that lands first leaves the newer one loading', async () => {
  const first = held<unknown>();
  const second = held<unknown>();
  fetchMock.get(versionRoute('aaa'), () => first.promise);
  fetchMock.get(versionRoute('bbb'), () => second.promise);
  const { result } = await renderLoaded();

  let askedFirst: Promise<void> = Promise.resolve();
  let askedSecond: Promise<void> = Promise.resolve();
  act(() => {
    askedFirst = result.current.showVersion('aaa');
  });
  act(() => {
    askedSecond = result.current.showVersion('bbb');
  });
  await act(async () => {
    first.release(snapshotOf('aaa', 1));
    await askedFirst;
  });

  expect(result.current.loading).toBe('bbb');
  expect(result.current.preview).toBeUndefined();

  await act(async () => {
    second.release(snapshotOf('bbb', 2));
    await askedSecond;
  });

  expect(previewed(result.current)).toBe('bbb');
  expect(result.current.loading).toBeUndefined();
});

test('going back to the current canvas drops a preview still loading', async () => {
  const late = held<unknown>();
  fetchMock.get(versionRoute('aaa'), () => late.promise);
  const { result } = await renderLoaded();

  let asked: Promise<void> = Promise.resolve();
  act(() => {
    asked = result.current.showVersion('aaa');
  });
  expect(result.current.loading).toBe('aaa');
  act(() => result.current.showCurrent());
  expect(result.current.loading).toBeUndefined();

  await act(async () => {
    late.release(snapshotOf('aaa', 1));
    await asked;
  });

  expect(result.current.preview).toBeUndefined();
  expect(result.current.loading).toBeUndefined();
});

test('restoring a version ends its preview', async () => {
  fetchMock.get(versionRoute('aaa'), snapshotOf('aaa', 1));
  fetchMock.post(`glob:*/api/v1/canvas/${UUID}/versions/aaa/restore`, {
    result: { revision: 4, skippedPlacements: [] },
  });
  const { result } = await renderLoaded();
  await act(() => result.current.showVersion('aaa'));
  expect(previewed(result.current)).toBe('aaa');

  await act(async () => {
    await result.current.restore('aaa');
  });

  expect(result.current.preview).toBeUndefined();
});

test('a version still loading when another is restored is not shown after it', async () => {
  fetchMock.get(versionRoute('aaa'), snapshotOf('aaa', 1));
  const oldest = held<unknown>();
  fetchMock.get(versionRoute('bbb'), () => oldest.promise);
  fetchMock.post(`glob:*/api/v1/canvas/${UUID}/versions/aaa/restore`, {
    result: { revision: 4, skippedPlacements: [] },
  });
  const { result } = await renderLoaded();
  await act(() => result.current.showVersion('aaa'));

  // Another version is asked for, then the one on screen is restored.
  let asked: Promise<void> = Promise.resolve();
  act(() => {
    asked = result.current.showVersion('bbb');
  });
  await act(async () => {
    await result.current.restore('aaa');
  });
  expect(result.current.loading).toBeUndefined();
  await act(async () => {
    oldest.release(snapshotOf('bbb', 0));
    await asked;
  });

  expect(result.current.preview).toBeUndefined();
});

test('a preview still loading when the history is turned off is not shown', async () => {
  // Opening a draft turns the history off: a version that answers after
  // that would be shown in place of the draft.
  const late = held<unknown>();
  fetchMock.get(versionRoute('aaa'), () => late.promise);
  const { result, rerender } = await renderLoaded();

  let asked: Promise<void> = Promise.resolve();
  act(() => {
    asked = result.current.showVersion('aaa');
  });
  rerender({ on: false });
  await act(async () => {
    late.release(snapshotOf('aaa', 1));
    await asked;
  });

  expect(result.current.preview).toBeUndefined();
  expect(result.current.loading).toBeUndefined();
});
