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
import dashboardStateReducer from './dashboardState';
import {
  setAutoRefreshStatus,
  setAutoRefreshPaused,
  setAutoRefreshPausedByTab,
  recordAutoRefreshSuccess,
  recordAutoRefreshError,
  setAutoRefreshFetchStartTime,
  setAutoRefreshPauseOnInactiveTab,
} from '../actions/autoRefresh';
import {
  AutoRefreshStatus,
  AUTO_REFRESH_STATE_DEFAULTS,
} from '../types/autoRefresh';

// Helper to create initial state with auto-refresh defaults
const createInitialState = (overrides = {}) => ({
  ...AUTO_REFRESH_STATE_DEFAULTS,
  refreshFrequency: 5,
  editMode: false,
  isPublished: false,
  directPathToChild: [],
  activeTabs: [],
  fullSizeChartId: null,
  isRefreshing: false,
  isFiltersRefreshing: false,
  hasUnsavedChanges: false,
  dashboardIsSaving: false,
  colorScheme: '',
  sliceIds: [],
  directPathLastUpdated: 0,
  nativeFiltersBarOpen: false,
  ...overrides,
});

test('SET_AUTO_REFRESH_STATUS updates status', () => {
  const initialState = createInitialState({
    autoRefreshStatus: AutoRefreshStatus.Idle,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshStatus(AutoRefreshStatus.Fetching),
  );

  expect(result.autoRefreshStatus).toBe(AutoRefreshStatus.Fetching);
});

test('SET_AUTO_REFRESH_STATUS preserves other state', () => {
  const initialState = createInitialState({
    autoRefreshStatus: AutoRefreshStatus.Idle,
    refreshFrequency: 10,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshStatus(AutoRefreshStatus.Success),
  );

  expect(result.refreshFrequency).toBe(10);
  expect(result.autoRefreshStatus).toBe(AutoRefreshStatus.Success);
});

test('SET_AUTO_REFRESH_PAUSED sets paused to true', () => {
  const initialState = createInitialState({
    autoRefreshPaused: false,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshPaused(true),
  );

  expect(result.autoRefreshPaused).toBe(true);
});

test('SET_AUTO_REFRESH_PAUSED sets paused to false', () => {
  const initialState = createInitialState({
    autoRefreshPaused: true,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshPaused(false),
  );

  expect(result.autoRefreshPaused).toBe(false);
});

test('SET_AUTO_REFRESH_PAUSED_BY_TAB sets pausedByTab', () => {
  const initialState = createInitialState({
    autoRefreshPausedByTab: false,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshPausedByTab(true),
  );

  expect(result.autoRefreshPausedByTab).toBe(true);
});

test('RECORD_AUTO_REFRESH_SUCCESS updates timestamp and resets errors', () => {
  const initialState = createInitialState({
    lastSuccessfulRefresh: null,
    lastRefreshError: 'Previous error',
    refreshErrorCount: 2,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
  });

  const action = recordAutoRefreshSuccess();
  const result = dashboardStateReducer(initialState, action);

  expect(result.lastSuccessfulRefresh).toBe(action.timestamp);
  expect(result.lastAutoRefreshTime).toBe(action.timestamp);
  expect(result.lastRefreshError).toBeNull();
  expect(result.refreshErrorCount).toBe(0);
  expect(result.autoRefreshStatus).toBe(AutoRefreshStatus.Success);
});

test('RECORD_AUTO_REFRESH_ERROR increments error count', () => {
  const initialState = createInitialState({
    refreshErrorCount: 0,
    lastRefreshError: null,
  });

  const action = recordAutoRefreshError('Network error');
  const result = dashboardStateReducer(initialState, action);

  expect(result.refreshErrorCount).toBe(1);
  expect(result.lastRefreshError).toBe('Network error');
  expect(result.lastAutoRefreshTime).toBe(action.timestamp);
});

test('RECORD_AUTO_REFRESH_ERROR sets delayed status for 1 error', () => {
  const initialState = createInitialState({
    refreshErrorCount: 0,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
  });

  const result = dashboardStateReducer(
    initialState,
    recordAutoRefreshError('Timeout'),
  );

  // 1st error should set delayed status
  expect(result.refreshErrorCount).toBe(1);
  expect(result.autoRefreshStatus).toBe(AutoRefreshStatus.Delayed);
});

test('RECORD_AUTO_REFRESH_ERROR sets error status for 2+ errors', () => {
  const initialState = createInitialState({
    refreshErrorCount: 1,
    autoRefreshStatus: AutoRefreshStatus.Delayed,
  });

  const result = dashboardStateReducer(
    initialState,
    recordAutoRefreshError('Server error'),
  );

  // 2nd error should set error status
  expect(result.refreshErrorCount).toBe(2);
  expect(result.autoRefreshStatus).toBe(AutoRefreshStatus.Error);
});

test('SET_AUTO_REFRESH_FETCH_START_TIME sets timestamp', () => {
  const initialState = createInitialState({
    autoRefreshFetchStartTime: null,
  });
  const timestamp = Date.now();

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshFetchStartTime(timestamp),
  );

  expect(result.autoRefreshFetchStartTime).toBe(timestamp);
});

test('SET_AUTO_REFRESH_FETCH_START_TIME clears with null', () => {
  const initialState = createInitialState({
    autoRefreshFetchStartTime: Date.now(),
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshFetchStartTime(null),
  );

  expect(result.autoRefreshFetchStartTime).toBeNull();
});

test('SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB enables setting', () => {
  const initialState = createInitialState({
    autoRefreshPauseOnInactiveTab: false,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshPauseOnInactiveTab(true),
  );

  expect(result.autoRefreshPauseOnInactiveTab).toBe(true);
});

test('SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB disables setting', () => {
  const initialState = createInitialState({
    autoRefreshPauseOnInactiveTab: true,
  });

  const result = dashboardStateReducer(
    initialState,
    setAutoRefreshPauseOnInactiveTab(false),
  );

  expect(result.autoRefreshPauseOnInactiveTab).toBe(false);
});

test('reducer returns unchanged state for unknown action', () => {
  const initialState = createInitialState();

  const result = dashboardStateReducer(initialState, {
    type: 'UNKNOWN_ACTION',
  });

  expect(result).toBe(initialState);
});
