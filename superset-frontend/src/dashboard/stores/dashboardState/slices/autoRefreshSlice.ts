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

import type { StateCreator } from 'zustand';
import type { DashboardStateStore } from '../types';
import {
  AutoRefreshStatus,
  AUTO_REFRESH_STATE_DEFAULTS,
  ERROR_THRESHOLD_COUNT,
} from '../../../types/autoRefresh';

export interface AutoRefreshSlice {
  autoRefreshStatus: AutoRefreshStatus;
  autoRefreshPaused: boolean;
  autoRefreshPausedByTab: boolean;
  lastSuccessfulRefresh: number | null;
  lastAutoRefreshTime: number | null;
  lastRefreshError: string | null;
  refreshErrorCount: number;
  autoRefreshFetchStartTime: number | null;
  autoRefreshPauseOnInactiveTab: boolean;
  setAutoRefreshStatus: (status: AutoRefreshStatus) => void;
  setAutoRefreshPaused: (isPaused: boolean) => void;
  setAutoRefreshPausedByTab: (isPausedByTab: boolean) => void;
  recordAutoRefreshSuccess: (timestamp?: number) => void;
  /** 1 error -> Delayed, 2+ -> Error. */
  recordAutoRefreshError: (
    error: string | undefined,
    timestamp?: number,
  ) => void;
  setAutoRefreshFetchStartTime: (timestamp: number | null) => void;
  setAutoRefreshPauseOnInactiveTab: (pauseOnInactiveTab: boolean) => void;
}

export const autoRefreshInitialState = { ...AUTO_REFRESH_STATE_DEFAULTS };

export const createAutoRefreshSlice: StateCreator<
  DashboardStateStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  AutoRefreshSlice
> = set => ({
  ...autoRefreshInitialState,

  setAutoRefreshStatus: status =>
    set(
      { autoRefreshStatus: status },
      false,
      'dashboardState/setAutoRefreshStatus',
    ),

  setAutoRefreshPaused: isPaused =>
    set(
      { autoRefreshPaused: isPaused },
      false,
      'dashboardState/setAutoRefreshPaused',
    ),

  setAutoRefreshPausedByTab: isPausedByTab =>
    set(
      { autoRefreshPausedByTab: isPausedByTab },
      false,
      'dashboardState/setAutoRefreshPausedByTab',
    ),

  recordAutoRefreshSuccess: (timestamp = Date.now()) =>
    set(
      {
        autoRefreshStatus: AutoRefreshStatus.Success,
        lastSuccessfulRefresh: timestamp,
        lastAutoRefreshTime: timestamp,
        lastRefreshError: null,
        refreshErrorCount: 0,
      },
      false,
      'dashboardState/recordAutoRefreshSuccess',
    ),

  recordAutoRefreshError: (error, timestamp = Date.now()) =>
    set(
      state => {
        const refreshErrorCount = (state.refreshErrorCount || 0) + 1;
        return {
          autoRefreshStatus:
            refreshErrorCount >= ERROR_THRESHOLD_COUNT
              ? AutoRefreshStatus.Error
              : AutoRefreshStatus.Delayed,
          lastRefreshError: error ?? null,
          refreshErrorCount,
          lastAutoRefreshTime: timestamp,
        };
      },
      false,
      'dashboardState/recordAutoRefreshError',
    ),

  setAutoRefreshFetchStartTime: timestamp =>
    set(
      { autoRefreshFetchStartTime: timestamp },
      false,
      'dashboardState/setAutoRefreshFetchStartTime',
    ),

  setAutoRefreshPauseOnInactiveTab: pauseOnInactiveTab =>
    set(
      { autoRefreshPauseOnInactiveTab: pauseOnInactiveTab },
      false,
      'dashboardState/setAutoRefreshPauseOnInactiveTab',
    ),
});
