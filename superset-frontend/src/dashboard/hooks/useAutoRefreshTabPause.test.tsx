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
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { createStore, AnyAction } from 'redux';
import { ReactNode } from 'react';
import { useAutoRefreshTabPause } from './useAutoRefreshTabPause';
import {
  AUTO_REFRESH_STATE_DEFAULTS,
  AutoRefreshStatus,
} from '../types/autoRefresh';
import {
  SET_AUTO_REFRESH_PAUSED_BY_TAB,
  SET_AUTO_REFRESH_STATUS,
} from '../actions/autoRefresh';

// Helper to create mock Redux store with proper reducer
const createMockStore = (overrides = {}) => {
  const initialState = {
    dashboardState: {
      ...AUTO_REFRESH_STATE_DEFAULTS,
      refreshFrequency: 5,
      ...overrides,
    },
  };

  const reducer = (
    state = initialState,
    action: AnyAction,
  ): typeof initialState => {
    switch (action.type) {
      case SET_AUTO_REFRESH_PAUSED_BY_TAB:
        return {
          ...state,
          dashboardState: {
            ...state.dashboardState,
            autoRefreshPausedByTab: action.isPausedByTab,
          },
        };
      case SET_AUTO_REFRESH_STATUS:
        return {
          ...state,
          dashboardState: {
            ...state.dashboardState,
            autoRefreshStatus: action.status as AutoRefreshStatus,
          },
        };
      default:
        return state;
    }
  };

  return createStore(reducer);
};

// Wrapper component for Redux
const createWrapper = (store: ReturnType<typeof createMockStore>) =>
  function ReduxWrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

// Helper to mock document.visibilityState
const mockVisibilityState = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
};

// Helper to fire visibilitychange event
const fireVisibilityChange = () => {
  document.dispatchEvent(new Event('visibilitychange'));
};

// Store original visibility state
let originalVisibilityState: PropertyDescriptor | undefined;

beforeEach(() => {
  originalVisibilityState = Object.getOwnPropertyDescriptor(
    document,
    'visibilityState',
  );
  mockVisibilityState('visible');
});

afterEach(() => {
  if (originalVisibilityState) {
    Object.defineProperty(document, 'visibilityState', originalVisibilityState);
  }
});

test('does nothing when not a real-time dashboard (refreshFrequency = 0)', () => {
  const store = createMockStore({ refreshFrequency: 0 });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // Simulate tab hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onStopTimer).not.toHaveBeenCalled();
});

test('pauses immediately when mounted in a hidden tab', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  mockVisibilityState('hidden');

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  expect(onStopTimer).toHaveBeenCalledTimes(1);
});

test('stops timer when tab becomes hidden for real-time dashboard', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // Simulate tab hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onStopTimer).toHaveBeenCalledTimes(1);
});

test('does not stop timer when manually paused', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPaused: true,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // Simulate tab hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  // Should not stop timer because already manually paused
  expect(onStopTimer).not.toHaveBeenCalled();
});

test('refreshes and restarts timer when tab becomes visible after being paused by tab', async () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  // Start with tab visible
  mockVisibilityState('visible');

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // First, simulate tab becoming hidden (this sets shouldResumeRef)
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onStopTimer).toHaveBeenCalledTimes(1);

  // Now simulate tab becoming visible again
  await act(async () => {
    mockVisibilityState('visible');
    fireVisibilityChange();
    // Wait for promise to resolve
    await Promise.resolve();
  });

  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(onRestartTimer).toHaveBeenCalledTimes(1);
});

test('does not refresh when returning to visible if manually paused', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPausedByTab: true,
    autoRefreshPaused: true,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  // Start with tab hidden
  mockVisibilityState('hidden');

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // Simulate tab becoming visible
  act(() => {
    mockVisibilityState('visible');
    fireVisibilityChange();
  });

  // Should not refresh because manually paused
  expect(onRefresh).not.toHaveBeenCalled();
});

test('restarts timer when refresh fails after tab resumes', async () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: true,
  });
  const onRefresh = jest.fn().mockRejectedValue(new Error('boom'));
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  // Start with tab visible
  mockVisibilityState('visible');

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  // First, simulate tab becoming hidden
  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  // Now simulate tab becoming visible
  await act(async () => {
    mockVisibilityState('visible');
    fireVisibilityChange();
    await Promise.resolve();
  });

  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(onRestartTimer).toHaveBeenCalledTimes(1);
});

test('does nothing when pause-on-inactive is disabled', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: false,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  act(() => {
    mockVisibilityState('hidden');
    fireVisibilityChange();
  });

  expect(onStopTimer).not.toHaveBeenCalled();
});

test('clears tab pause and restarts timer when pause-on-inactive is disabled', () => {
  const store = createMockStore({
    refreshFrequency: 5,
    autoRefreshPauseOnInactiveTab: false,
    autoRefreshPausedByTab: true,
  });
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  const onRestartTimer = jest.fn();
  const onStopTimer = jest.fn();

  renderHook(
    () =>
      useAutoRefreshTabPause({
        onRefresh,
        onRestartTimer,
        onStopTimer,
      }),
    { wrapper: createWrapper(store) },
  );

  expect(onRestartTimer).toHaveBeenCalledTimes(1);
});
