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

// Action type constants
export const SET_AUTO_REFRESH_STATUS = 'SET_AUTO_REFRESH_STATUS';
export const SET_AUTO_REFRESH_PAUSED = 'SET_AUTO_REFRESH_PAUSED';
export const SET_AUTO_REFRESH_PAUSED_BY_TAB = 'SET_AUTO_REFRESH_PAUSED_BY_TAB';
export const RECORD_AUTO_REFRESH_SUCCESS = 'RECORD_AUTO_REFRESH_SUCCESS';
export const RECORD_AUTO_REFRESH_ERROR = 'RECORD_AUTO_REFRESH_ERROR';
export const SET_AUTO_REFRESH_FETCH_START_TIME =
  'SET_AUTO_REFRESH_FETCH_START_TIME';
export const SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB =
  'SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB';

// Action interfaces
export interface SetAutoRefreshStatusAction {
  type: typeof SET_AUTO_REFRESH_STATUS;
  status: AutoRefreshStatus;
}

export interface SetAutoRefreshPausedAction {
  type: typeof SET_AUTO_REFRESH_PAUSED;
  isPaused: boolean;
}

export interface SetAutoRefreshPausedByTabAction {
  type: typeof SET_AUTO_REFRESH_PAUSED_BY_TAB;
  isPausedByTab: boolean;
}

export interface RecordAutoRefreshSuccessAction {
  type: typeof RECORD_AUTO_REFRESH_SUCCESS;
  timestamp: number;
}

export interface RecordAutoRefreshErrorAction {
  type: typeof RECORD_AUTO_REFRESH_ERROR;
  error: string | undefined;
}

export interface SetAutoRefreshFetchStartTimeAction {
  type: typeof SET_AUTO_REFRESH_FETCH_START_TIME;
  timestamp: number | null;
}

export interface SetAutoRefreshPauseOnInactiveTabAction {
  type: typeof SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB;
  pauseOnInactiveTab: boolean;
}

export type AutoRefreshAction =
  | SetAutoRefreshStatusAction
  | SetAutoRefreshPausedAction
  | SetAutoRefreshPausedByTabAction
  | RecordAutoRefreshSuccessAction
  | RecordAutoRefreshErrorAction
  | SetAutoRefreshFetchStartTimeAction
  | SetAutoRefreshPauseOnInactiveTabAction;

/**
 * Sets the current auto-refresh status for the indicator.
 */
export function setAutoRefreshStatus(
  status: AutoRefreshStatus,
): SetAutoRefreshStatusAction {
  return { type: SET_AUTO_REFRESH_STATUS, status };
}

/**
 * Sets whether auto-refresh is manually paused by the user.
 */
export function setAutoRefreshPaused(
  isPaused: boolean,
): SetAutoRefreshPausedAction {
  return { type: SET_AUTO_REFRESH_PAUSED, isPaused };
}

/**
 * Sets whether auto-refresh is paused due to tab visibility.
 */
export function setAutoRefreshPausedByTab(
  isPausedByTab: boolean,
): SetAutoRefreshPausedByTabAction {
  return { type: SET_AUTO_REFRESH_PAUSED_BY_TAB, isPausedByTab };
}

/**
 * Records a successful auto-refresh with current timestamp.
 * Resets error count and clears any previous error.
 */
export function recordAutoRefreshSuccess(): RecordAutoRefreshSuccessAction {
  return {
    type: RECORD_AUTO_REFRESH_SUCCESS,
    timestamp: Date.now(),
  };
}

/**
 * Records an auto-refresh error.
 * Increments the error count for threshold-based status determination.
 */
export function recordAutoRefreshError(
  error: string | undefined,
): RecordAutoRefreshErrorAction {
  return { type: RECORD_AUTO_REFRESH_ERROR, error };
}

/**
 * Sets the timestamp when a fetch operation started.
 * Used to detect "delayed" status when fetch takes > 50% of interval.
 * Pass null to clear when fetch completes.
 */
export function setAutoRefreshFetchStartTime(
  timestamp: number | null,
): SetAutoRefreshFetchStartTimeAction {
  return { type: SET_AUTO_REFRESH_FETCH_START_TIME, timestamp };
}

/**
 * Sets user preference for pausing auto-refresh when tab is inactive.
 * Default is false (OFF) - auto-refresh continues when tab is inactive.
 */
export function setAutoRefreshPauseOnInactiveTab(
  pauseOnInactiveTab: boolean,
): SetAutoRefreshPauseOnInactiveTabAction {
  return { type: SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB, pauseOnInactiveTab };
}
