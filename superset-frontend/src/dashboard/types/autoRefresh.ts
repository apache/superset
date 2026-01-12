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
 * - Green (Success/Idle): Refreshed on schedule
 * - Blue (Fetching): Currently fetching data
 * - Yellow (Delayed): Refresh taking longer than expected OR 1-2 consecutive errors
 * - Red (Error): 3+ consecutive errors
 * - White (Paused): Auto-refresh is paused (manually or by tab visibility)
 */
export enum AutoRefreshStatus {
  /** Initial state or successful refresh completed */
  Idle = 'idle',
  /** Refresh completed successfully */
  Success = 'success',
  /** Currently fetching data */
  Fetching = 'fetching',
  /** Refresh is taking longer than expected (> 50% of interval) */
  Delayed = 'delayed',
  /** Refresh failed with error (3+ consecutive errors) */
  Error = 'error',
  /** Auto-refresh is paused */
  Paused = 'paused',
}

/**
 * Auto-refresh related state stored in Redux.
 */
export interface AutoRefreshState {
  /** Current auto-refresh status for the indicator */
  autoRefreshStatus: AutoRefreshStatus;
  /** Whether auto-refresh is manually paused by the user */
  autoRefreshPaused: boolean;
  /** Whether auto-refresh is paused due to tab being hidden */
  autoRefreshPausedByTab: boolean;
  /** Timestamp of last successful refresh (ms since epoch) */
  lastSuccessfulRefresh: number | null;
  /** Error message from the last failed refresh */
  lastRefreshError: string | null;
  /** Count of consecutive refresh errors */
  refreshErrorCount: number;
  /** Timestamp when current fetch started (for delay detection) */
  autoRefreshFetchStartTime: number | null;
  /** User preference: pause auto-refresh when tab is inactive */
  autoRefreshPauseOnInactiveTab: boolean;
}

/**
 * Default values for auto-refresh state.
 */
export const AUTO_REFRESH_STATE_DEFAULTS: AutoRefreshState = {
  autoRefreshStatus: AutoRefreshStatus.Idle,
  autoRefreshPaused: false,
  autoRefreshPausedByTab: false,
  lastSuccessfulRefresh: null,
  lastRefreshError: null,
  refreshErrorCount: 0,
  autoRefreshFetchStartTime: null,
  autoRefreshPauseOnInactiveTab: false,
};

/**
 * Threshold for determining "delayed" status.
 * If fetch takes longer than this percentage of the refresh interval,
 * the status changes to "delayed".
 */
export const DELAY_THRESHOLD_PERCENTAGE = 0.5;

/**
 * Number of consecutive errors before showing "error" status.
 * 1-2 errors show "delayed", 3+ show "error".
 */
export const ERROR_THRESHOLD_COUNT = 3;
