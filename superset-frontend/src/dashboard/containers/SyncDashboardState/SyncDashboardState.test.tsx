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
import { act, render } from 'spec/helpers/testing-library';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { useDashboardStateStore } from 'src/dashboard/stores';
import SyncDashboardState from '.';

const DEBOUNCE_MS = 200;

beforeEach(() => {
  setItem(LocalStorageKeys.DashboardExploreContext, {});
});

test('writes the dashboard context to localStorage synchronously on mount', () => {
  render(<SyncDashboardState dashboardPageId="page-1" />, { useRedux: true });
  expect(getItem(LocalStorageKeys.DashboardExploreContext, {})).toEqual({
    'page-1': expect.objectContaining({ dashboardPageId: 'page-1' }),
  });
});

test('debounces subsequent writes when state changes rapidly', () => {
  jest.useFakeTimers();
  try {
    render(<SyncDashboardState dashboardPageId="page-2" />, { useRedux: true });

    const writeSpy = jest.spyOn(Storage.prototype, 'setItem');
    writeSpy.mockClear();

    // Fire 5 store updates within the debounce window. Only ONE write should
    // land after the window elapses (vs 5 with the pre-optimization version).
    act(() => {
      useDashboardStateStore.getState().setColorScheme('a');
      useDashboardStateStore.getState().setColorScheme('b');
      useDashboardStateStore.getState().setColorScheme('c');
      useDashboardStateStore.getState().setColorScheme('d');
      useDashboardStateStore.getState().setColorScheme('e');
    });

    // Before the debounce window: no writes yet from the rapid bursts.
    expect(writeSpy).toHaveBeenCalledTimes(0);

    act(() => {
      jest.advanceTimersByTime(DEBOUNCE_MS + 10);
    });

    // After the window: exactly one batched write to the dashboard-context key.
    const dashboardContextWrites = writeSpy.mock.calls.filter(
      ([key]) => key === LocalStorageKeys.DashboardExploreContext,
    );
    expect(dashboardContextWrites).toHaveLength(1);
    writeSpy.mockRestore();
  } finally {
    jest.useRealTimers();
  }
});

test('marks the page id as redundant on unmount so it can be GC-ed', () => {
  const { unmount } = render(<SyncDashboardState dashboardPageId="page-3" />, {
    useRedux: true,
  });

  expect(
    getItem(LocalStorageKeys.DashboardExploreContext, {})['page-3'],
  ).not.toHaveProperty('isRedundant', true);

  unmount();

  expect(
    getItem(LocalStorageKeys.DashboardExploreContext, {})['page-3'],
  ).toMatchObject({ isRedundant: true });
});

test('stops writing after unmount (subscriptions cleaned up)', () => {
  jest.useFakeTimers();
  try {
    const { unmount } = render(
      <SyncDashboardState dashboardPageId="page-4" />,
      { useRedux: true },
    );
    unmount();

    const writeSpy = jest.spyOn(Storage.prototype, 'setItem');
    writeSpy.mockClear();

    act(() => {
      useDashboardStateStore.getState().setColorScheme('post-unmount');
      jest.advanceTimersByTime(DEBOUNCE_MS + 10);
    });

    const dashboardContextWrites = writeSpy.mock.calls.filter(
      ([key]) => key === LocalStorageKeys.DashboardExploreContext,
    );
    expect(dashboardContextWrites).toHaveLength(0);
    writeSpy.mockRestore();
  } finally {
    jest.useRealTimers();
  }
});
