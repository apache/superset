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
/**
 * @fileoverview The lookup that supplies the delete copy its answer.
 *
 * B1 was fixed by teaching the copy helpers to take a `governed` boolean,
 * and those helpers were tested with booleans written by hand. Nothing
 * tested the thing that actually *supplies* them, so returning an empty map
 * here -- or dropping the request altogether -- reinstated the whole defect
 * silently: `deleteIsGoverned(undefined)` falls back to the feature flag,
 * which is the pre-fix wording.
 *
 * So these tests assert the map reaches the caller, that the request asks
 * about the right assets, and that the fallbacks are the deliberate ones.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { FeatureFlag, SupersetClient } from '@superset-ui/core';
import { announceChangeCaptured } from './events';
import { useGovernedDeletes } from './useGovernedDeletes';

const get = jest.spyOn(SupersetClient, 'get');

const answers = (result: Record<string, boolean>) =>
  get.mockResolvedValue({ json: { result }, response: new Response() } as any);

beforeEach(() => {
  get.mockReset();
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
});

afterEach(() => {
  window.featureFlags = {};
});

test('the answer reaches the caller, keyed by asset id', async () => {
  answers({ '6': true, '7': false });

  const { result } = renderHook(() => useGovernedDeletes('dashboard', [6, 7]));

  await waitFor(() => expect(result.current).toEqual({ '6': true, '7': false }));
});

test('it asks about exactly the assets it was given', async () => {
  answers({});

  renderHook(() => useGovernedDeletes('dashboard', [6, 7]));

  await waitFor(() => expect(get).toHaveBeenCalled());
  const { endpoint } = get.mock.calls[0][0] as { endpoint: string };
  expect(endpoint).toContain('/change_request/governed/dashboard');
  expect(endpoint).toContain('ids=6,7');
});

test('and about the asset kind it was given', async () => {
  answers({});

  renderHook(() => useGovernedDeletes('chart', [9]));

  await waitFor(() => expect(get).toHaveBeenCalled());
  expect((get.mock.calls[0][0] as { endpoint: string }).endpoint).toContain(
    '/governed/chart',
  );
});

test('an empty list is not a request', async () => {
  answers({});

  const { result } = renderHook(() => useGovernedDeletes('dashboard', []));

  await waitFor(() => expect(result.current).toEqual({}));
  expect(get).not.toHaveBeenCalled();
});

test('with review off it asks nothing', async () => {
  window.featureFlags = {};
  answers({ '6': true });

  const { result } = renderHook(() => useGovernedDeletes('dashboard', [6]));

  await waitFor(() => expect(result.current).toEqual({}));
  expect(get).not.toHaveBeenCalled();
});

test('a lookup that fails leaves every asset unanswered rather than guessed', async () => {
  // Unanswered reads as the feature flag's own answer, which is the wording
  // this lookup replaced. A list that cannot reach the endpoint is still a
  // usable list, and the copy it shows is the one it showed before.
  get.mockRejectedValue(new Error('no'));

  const { result } = renderHook(() => useGovernedDeletes('dashboard', [6]));

  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(result.current).toEqual({});
});

test('the same ids in another order do not refetch', async () => {
  answers({ '6': true, '7': true });

  const { rerender } = renderHook(
    ({ ids }) => useGovernedDeletes('dashboard', ids),
    { initialProps: { ids: [6, 7] } },
  );

  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  rerender({ ids: [7, 6] });
  // The caller's array is new on every render of a list, so keying on its
  // identity would fetch in a loop.
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
});

test('a different set of ids does refetch', async () => {
  answers({});

  const { rerender } = renderHook(
    ({ ids }) => useGovernedDeletes('dashboard', ids),
    { initialProps: { ids: [6] } },
  );

  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  rerender({ ids: [6, 7] });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});

test('a captured change re-reads it', async () => {
  // Publishing a dashboard is itself a captured change, and approving it
  // makes every later delete of that dashboard governed. A page that read
  // the answer on mount and never again would go on offering the draft
  // wording for a dashboard that is now live.
  answers({ '6': false });

  renderHook(() => useGovernedDeletes('dashboard', [6]));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

  answers({ '6': true });
  act(() => {
    announceChangeCaptured();
  });

  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
});
