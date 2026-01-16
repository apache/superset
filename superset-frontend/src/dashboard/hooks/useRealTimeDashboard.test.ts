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
import {
  selectIsRealTimeDashboard,
  selectEffectiveRefreshStatus,
  selectIsPaused,
} from './useRealTimeDashboard';
import {
  AutoRefreshStatus,
  AUTO_REFRESH_STATE_DEFAULTS,
} from '../types/autoRefresh';

// Helper to create mock dashboard state
const createMockState = (overrides = {}) => ({
  dashboardState: {
    ...AUTO_REFRESH_STATE_DEFAULTS,
    refreshFrequency: 0,
    ...overrides,
  },
});

// Tests for selectIsRealTimeDashboard
test('selectIsRealTimeDashboard returns true when refreshFrequency > 0', () => {
  const state = createMockState({ refreshFrequency: 5 });
  expect(selectIsRealTimeDashboard(state)).toBe(true);
});

test('selectIsRealTimeDashboard returns false when refreshFrequency is 0', () => {
  const state = createMockState({ refreshFrequency: 0 });
  expect(selectIsRealTimeDashboard(state)).toBe(false);
});

test('selectIsRealTimeDashboard returns false when refreshFrequency is undefined', () => {
  const state = createMockState({ refreshFrequency: undefined });
  expect(selectIsRealTimeDashboard(state)).toBe(false);
});

// Tests for selectIsPaused
test('selectIsPaused returns true when manually paused', () => {
  const state = createMockState({ autoRefreshPaused: true });
  expect(selectIsPaused(state)).toBe(true);
});

test('selectIsPaused returns true when paused by tab', () => {
  const state = createMockState({ autoRefreshPausedByTab: true });
  expect(selectIsPaused(state)).toBe(true);
});

test('selectIsPaused returns true when both manually paused and paused by tab', () => {
  const state = createMockState({
    autoRefreshPaused: true,
    autoRefreshPausedByTab: true,
  });
  expect(selectIsPaused(state)).toBe(true);
});

test('selectIsPaused returns false when not paused', () => {
  const state = createMockState({
    autoRefreshPaused: false,
    autoRefreshPausedByTab: false,
  });
  expect(selectIsPaused(state)).toBe(false);
});

// Tests for selectEffectiveRefreshStatus
test('selectEffectiveRefreshStatus returns Paused when manually paused', () => {
  const state = createMockState({
    refreshFrequency: 5,
    autoRefreshPaused: true,
    autoRefreshStatus: AutoRefreshStatus.Success,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Paused);
});

test('selectEffectiveRefreshStatus returns Paused when paused by tab', () => {
  const state = createMockState({
    refreshFrequency: 5,
    autoRefreshPausedByTab: true,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Paused);
});

test('selectEffectiveRefreshStatus returns actual status when not paused', () => {
  const state = createMockState({
    refreshFrequency: 5,
    autoRefreshPaused: false,
    autoRefreshPausedByTab: false,
    autoRefreshStatus: AutoRefreshStatus.Success,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Success);
});

test('selectEffectiveRefreshStatus returns Delayed when fetch exceeds threshold', () => {
  const now = Date.now();
  const refreshFrequency = 10; // 10 seconds
  const fetchStartTime = now - 11000; // Started 11 seconds ago (> 10s)

  const state = createMockState({
    refreshFrequency,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
    autoRefreshFetchStartTime: fetchStartTime,
  });

  // Mock Date.now for consistent testing
  const originalDateNow = Date.now;
  Date.now = jest.fn(() => now);

  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Delayed);

  Date.now = originalDateNow;
});

test('selectEffectiveRefreshStatus returns Fetching when within threshold', () => {
  const now = Date.now();
  const refreshFrequency = 10; // 10 seconds
  const fetchStartTime = now - 2000; // Started 2 seconds ago (< 10s)

  const state = createMockState({
    refreshFrequency,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
    autoRefreshFetchStartTime: fetchStartTime,
  });

  const originalDateNow = Date.now;
  Date.now = jest.fn(() => now);

  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Fetching);

  Date.now = originalDateNow;
});

test('selectEffectiveRefreshStatus returns Error when fetch exceeds error threshold', () => {
  const now = Date.now();
  const refreshFrequency = 10; // 10 seconds
  const fetchStartTime = now - 21000; // Started 21 seconds ago (> 20s)

  const state = createMockState({
    refreshFrequency,
    autoRefreshStatus: AutoRefreshStatus.Fetching,
    autoRefreshFetchStartTime: fetchStartTime,
  });

  const originalDateNow = Date.now;
  Date.now = jest.fn(() => now);

  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Error);

  Date.now = originalDateNow;
});

test('selectEffectiveRefreshStatus returns Idle when not a real-time dashboard', () => {
  const state = createMockState({
    refreshFrequency: 0,
    autoRefreshStatus: AutoRefreshStatus.Success,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Idle);
});

test('selectEffectiveRefreshStatus returns Error status when error count >= 2', () => {
  const state = createMockState({
    refreshFrequency: 5,
    autoRefreshStatus: AutoRefreshStatus.Error,
    refreshErrorCount: 2,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Error);
});

test('selectEffectiveRefreshStatus returns Delayed status for 1 error', () => {
  const state = createMockState({
    refreshFrequency: 5,
    autoRefreshStatus: AutoRefreshStatus.Delayed,
    refreshErrorCount: 1,
  });
  expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Delayed);
});
