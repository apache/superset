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

export const SET_AUTO_REFRESH_STATUS = 'SET_AUTO_REFRESH_STATUS';
export const SET_AUTO_REFRESH_PAUSED = 'SET_AUTO_REFRESH_PAUSED';
export const SET_AUTO_REFRESH_PAUSED_BY_TAB = 'SET_AUTO_REFRESH_PAUSED_BY_TAB';
export const RECORD_AUTO_REFRESH_SUCCESS = 'RECORD_AUTO_REFRESH_SUCCESS';
export const RECORD_AUTO_REFRESH_ERROR = 'RECORD_AUTO_REFRESH_ERROR';
export const SET_AUTO_REFRESH_FETCH_START_TIME =
  'SET_AUTO_REFRESH_FETCH_START_TIME';
export const SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB =
  'SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB';

export interface SetAutoRefreshStatusAction {
  type: typeof SET_AUTO_REFRESH_STATUS;
  status: AutoRefreshStatus;
  [key: string]: unknown;
}

export interface SetAutoRefreshPausedAction {
  type: typeof SET_AUTO_REFRESH_PAUSED;
  isPaused: boolean;
  [key: string]: unknown;
}

export interface SetAutoRefreshPausedByTabAction {
  type: typeof SET_AUTO_REFRESH_PAUSED_BY_TAB;
  isPausedByTab: boolean;
  [key: string]: unknown;
}

export interface RecordAutoRefreshSuccessAction {
  type: typeof RECORD_AUTO_REFRESH_SUCCESS;
  timestamp: number;
  [key: string]: unknown;
}

export interface RecordAutoRefreshErrorAction {
  type: typeof RECORD_AUTO_REFRESH_ERROR;
  error: string | undefined;
  timestamp: number;
  [key: string]: unknown;
}

export interface SetAutoRefreshFetchStartTimeAction {
  type: typeof SET_AUTO_REFRESH_FETCH_START_TIME;
  timestamp: number | null;
  [key: string]: unknown;
}

export interface SetAutoRefreshPauseOnInactiveTabAction {
  type: typeof SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB;
  pauseOnInactiveTab: boolean;
  [key: string]: unknown;
}

export type AutoRefreshAction =
  | SetAutoRefreshStatusAction
  | SetAutoRefreshPausedAction
  | SetAutoRefreshPausedByTabAction
  | RecordAutoRefreshSuccessAction
  | RecordAutoRefreshErrorAction
  | SetAutoRefreshFetchStartTimeAction
  | SetAutoRefreshPauseOnInactiveTabAction;

export function setAutoRefreshStatus(
  status: AutoRefreshStatus,
): SetAutoRefreshStatusAction {
  return { type: SET_AUTO_REFRESH_STATUS, status };
}

export function setAutoRefreshPaused(
  isPaused: boolean,
): SetAutoRefreshPausedAction {
  return { type: SET_AUTO_REFRESH_PAUSED, isPaused };
}

export function setAutoRefreshPausedByTab(
  isPausedByTab: boolean,
): SetAutoRefreshPausedByTabAction {
  return { type: SET_AUTO_REFRESH_PAUSED_BY_TAB, isPausedByTab };
}

export function recordAutoRefreshSuccess(): RecordAutoRefreshSuccessAction {
  return {
    type: RECORD_AUTO_REFRESH_SUCCESS,
    timestamp: Date.now(),
  };
}

export function recordAutoRefreshError(
  error: string | undefined,
): RecordAutoRefreshErrorAction {
  return { type: RECORD_AUTO_REFRESH_ERROR, error, timestamp: Date.now() };
}

export function setAutoRefreshFetchStartTime(
  timestamp: number | null,
): SetAutoRefreshFetchStartTimeAction {
  return { type: SET_AUTO_REFRESH_FETCH_START_TIME, timestamp };
}

export function setAutoRefreshPauseOnInactiveTab(
  pauseOnInactiveTab: boolean,
): SetAutoRefreshPauseOnInactiveTabAction {
  return { type: SET_AUTO_REFRESH_PAUSE_ON_INACTIVE_TAB, pauseOnInactiveTab };
}
