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
import { AutoRefreshStatus } from '../types/autoRefresh';
import {
  SET_AUTO_REFRESH_STATUS,
  SET_AUTO_REFRESH_PAUSED,
  SET_AUTO_REFRESH_PAUSED_BY_TAB,
  RECORD_AUTO_REFRESH_SUCCESS,
  RECORD_AUTO_REFRESH_ERROR,
  SET_AUTO_REFRESH_FETCH_START_TIME,
  SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB,
  setAutoRefreshStatus,
  setAutoRefreshPaused,
  setAutoRefreshPausedByTab,
  recordAutoRefreshSuccess,
  recordAutoRefreshError,
  setAutoRefreshFetchStartTime,
  setAutoRefreshPauseOnInactiveTab,
} from './autoRefresh';

test('setAutoRefreshStatus creates correct action', () => {
  const action = setAutoRefreshStatus(AutoRefreshStatus.Fetching);
  expect(action).toEqual({
    type: SET_AUTO_REFRESH_STATUS,
    status: AutoRefreshStatus.Fetching,
  });
});

test('setAutoRefreshPaused creates correct action for pausing', () => {
  const action = setAutoRefreshPaused(true);
  expect(action).toEqual({
    type: SET_AUTO_REFRESH_PAUSED,
    isPaused: true,
  });
});

test('setAutoRefreshPaused creates correct action for resuming', () => {
  const action = setAutoRefreshPaused(false);
  expect(action).toEqual({
    type: SET_AUTO_REFRESH_PAUSED,
    isPaused: false,
  });
});

test('setAutoRefreshPausedByTab creates correct action', () => {
  const action = setAutoRefreshPausedByTab(true);
  expect(action).toEqual({
    type: SET_AUTO_REFRESH_PAUSED_BY_TAB,
    isPausedByTab: true,
  });
});

test('recordAutoRefreshSuccess creates action with current timestamp', () => {
  const before = Date.now();
  const action = recordAutoRefreshSuccess();
  const after = Date.now();

  expect(action.type).toBe(RECORD_AUTO_REFRESH_SUCCESS);
  expect(action.timestamp).toBeGreaterThanOrEqual(before);
  expect(action.timestamp).toBeLessThanOrEqual(after);
});

test('recordAutoRefreshError creates action with error message', () => {
  const errorMessage = 'Network timeout';
  const action = recordAutoRefreshError(errorMessage);

  expect(action).toEqual({
    type: RECORD_AUTO_REFRESH_ERROR,
    error: errorMessage,
  });
});

test('recordAutoRefreshError handles undefined error', () => {
  const action = recordAutoRefreshError(undefined);

  expect(action).toEqual({
    type: RECORD_AUTO_REFRESH_ERROR,
    error: undefined,
  });
});

test('setAutoRefreshFetchStartTime creates action with timestamp', () => {
  const timestamp = Date.now();
  const action = setAutoRefreshFetchStartTime(timestamp);

  expect(action).toEqual({
    type: SET_AUTO_REFRESH_FETCH_START_TIME,
    timestamp,
  });
});

test('setAutoRefreshFetchStartTime creates action with null to clear', () => {
  const action = setAutoRefreshFetchStartTime(null);

  expect(action).toEqual({
    type: SET_AUTO_REFRESH_FETCH_START_TIME,
    timestamp: null,
  });
});

test('setAutoRefreshPauseOnInactiveTab creates action to enable', () => {
  const action = setAutoRefreshPauseOnInactiveTab(true);

  expect(action).toEqual({
    type: SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB,
    pauseOnInactiveTab: true,
  });
});

test('setAutoRefreshPauseOnInactiveTab creates action to disable', () => {
  const action = setAutoRefreshPauseOnInactiveTab(false);

  expect(action).toEqual({
    type: SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB,
    pauseOnInactiveTab: false,
  });
});
