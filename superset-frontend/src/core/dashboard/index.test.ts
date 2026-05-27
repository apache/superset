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

// ---------------------------------------------------------------------------
// Captured listeners — allows tests to trigger action notifications manually.
// ---------------------------------------------------------------------------
type ListenerEntry = {
  predicate: (action: { type: string }) => boolean;
  effect: (action: { type: string }) => void;
};

const capturedListeners: ListenerEntry[] = [];

// Declared before jest.mock so the factory closure can reference it.
let mockState: Record<string, unknown>;

jest.mock('src/views/store', () => ({
  store: { getState: () => mockState, dispatch: jest.fn() },
  listenerMiddleware: {
    startListening: (opts: {
      predicate: (action: { type: string }) => boolean;
      effect: (action: { type: string }) => void;
    }) => {
      const entry = { predicate: opts.predicate, effect: opts.effect };
      capturedListeners.push(entry);
      return () => {
        const idx = capturedListeners.indexOf(entry);
        if (idx !== -1) capturedListeners.splice(idx, 1);
      };
    },
  },
}));

jest.mock('../navigation', () => ({
  navigation: { getPageType: jest.fn(() => 'dashboard') },
}));

function dispatch(actionType: string) {
  const action = { type: actionType };
  capturedListeners
    .filter(e => e.predicate(action))
    .forEach(e => e.effect(action));
}

// Imported after mocks
// eslint-disable-next-line import/first
import { dashboard } from './index';

function makeState(
  overrides: Partial<{
    dashboardInfo: unknown;
    nativeFilters: unknown;
    dataMask: unknown;
  }> = {},
) {
  return {
    dashboardInfo: { id: 1, dashboard_title: 'Sales', slug: 'sales' },
    nativeFilters: { filters: { 'filter-1': { name: 'Region' } } },
    dataMask: { 'filter-1': { filterState: { value: ['West'] } } },
    ...overrides,
  };
}

beforeEach(() => {
  mockState = makeState();
});

afterEach(() => {
  capturedListeners.length = 0;
  jest.restoreAllMocks();
});

test('getCurrentDashboard returns undefined when not on dashboard page', () => {
  const { navigation } = jest.requireMock('../navigation');
  (navigation.getPageType as jest.Mock).mockReturnValueOnce('explore');
  expect(dashboard.getCurrentDashboard()).toBeUndefined();
});


test('getCurrentDashboard returns undefined when dashboardInfo is absent', () => {
  mockState = makeState({ dashboardInfo: undefined });
  expect(dashboard.getCurrentDashboard()).toBeUndefined();
});

test('getCurrentDashboard returns dashboard context with active filters', () => {
  expect(dashboard.getCurrentDashboard()).toEqual({
    dashboardId: 1,
    title: 'Sales',
    filters: [{ filterId: 'filter-1', label: 'Region', value: ['West'] }],
  });
});

test('getCurrentDashboard excludes filters with null value', () => {
  mockState = makeState({
    dataMask: { 'filter-1': { filterState: { value: null } } },
  });
  expect(dashboard.getCurrentDashboard()?.filters).toHaveLength(0);
});

test('getCurrentDashboard excludes dataMask entries not in nativeFilters', () => {
  mockState = makeState({
    dataMask: { 'chart-filter': { filterState: { value: 'foo' } } },
  });
  expect(dashboard.getCurrentDashboard()?.filters).toHaveLength(0);
});

test('filter array value is a defensive copy — mutation does not affect Redux state', () => {
  const ctx = dashboard.getCurrentDashboard();
  const original = [...(mockState as any).dataMask['filter-1'].filterState.value];
  (ctx!.filters[0].value as string[]).push('East');
  expect((mockState as any).dataMask['filter-1'].filterState.value).toEqual(original);
});

// Action type strings match the constants in src/dashboard/actions/hydrate
// and src/dataMask/actions — kept as literals so this test file has no
// import dependency on those modules.
test.each([
  'HYDRATE_DASHBOARD',
  'UPDATE_DATA_MASK',
  'SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE',
])('onDidChangeDashboard fires on action type %s', actionType => {
  const listener = jest.fn();
  const disposable = dashboard.onDidChangeDashboard(listener);

  dispatch(actionType);

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ dashboardId: 1, title: 'Sales' }),
  );
  disposable.dispose();
});

test('onDidChangeDashboard does not fire when not on dashboard page', () => {
  const { navigation } = jest.requireMock('../navigation');
  (navigation.getPageType as jest.Mock).mockReturnValue('explore');

  const listener = jest.fn();
  const disposable = dashboard.onDidChangeDashboard(listener);
  dispatch('HYDRATE_DASHBOARD');

  expect(listener).not.toHaveBeenCalled();
  (navigation.getPageType as jest.Mock).mockReturnValue('dashboard');
  disposable.dispose();
});

test('disposed listener is not called', () => {
  const listener = jest.fn();
  const disposable = dashboard.onDidChangeDashboard(listener);
  disposable.dispose();
  dispatch('HYDRATE_DASHBOARD');
  expect(listener).not.toHaveBeenCalled();
});
