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

/**
 * Status states for the auto-refresh indicator.
 *
 * Per requirements:
 * - Green (Success): Refreshed on schedule
 * - Blue (Idle): Waiting for first refresh
 * - Blue (Fetching): Currently fetching data
 * - Yellow (Delayed): Refresh taking longer than expected OR 1 consecutive error
 * - Red (Error): 2+ consecutive errors
 * - White (Paused): Auto-refresh is paused (manually or by tab visibility)
 */
export enum AutoRefreshStatus {
  Idle = 'idle',
  Success = 'success',
  Fetching = 'fetching',
  Delayed = 'delayed',
  Error = 'error',
  Paused = 'paused',
}

export interface AutoRefreshState {
  autoRefreshStatus: AutoRefreshStatus;
  autoRefreshPaused: boolean;
  autoRefreshPausedByTab: boolean;
  lastSuccessfulRefresh: number | null;
  lastAutoRefreshTime: number | null;
  lastRefreshError: string | null;
  refreshErrorCount: number;
  autoRefreshFetchStartTime: number | null;
  autoRefreshPauseOnInactiveTab: boolean;
}

export const AUTO_REFRESH_STATE_DEFAULTS: AutoRefreshState = {
  autoRefreshStatus: AutoRefreshStatus.Idle,
  autoRefreshPaused: false,
  autoRefreshPausedByTab: false,
  lastSuccessfulRefresh: null,
  lastAutoRefreshTime: null,
  lastRefreshError: null,
  refreshErrorCount: 0,
  autoRefreshFetchStartTime: null,
  autoRefreshPauseOnInactiveTab: false,
};

export const ERROR_THRESHOLD_COUNT = 2;
