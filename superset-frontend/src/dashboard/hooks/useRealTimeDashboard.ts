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
import { useMemo } from 'react';
import { useDashboardStateStore } from 'src/dashboard/stores';
import { AutoRefreshStatus } from '../types/autoRefresh';
import { DashboardState } from '../types';

type DashboardStateRoot = {
  dashboardState: Partial<DashboardState>;
};

/**
 * Selector: Determines if this is a "real-time" dashboard.
 * A dashboard is real-time if it has an auto-refresh frequency > 0.
 */
export const selectIsRealTimeDashboard = (state: DashboardStateRoot): boolean =>
  (state.dashboardState?.refreshFrequency ?? 0) > 0;

/**
 * Selector: Determines if auto-refresh is manually paused (by user action).
 * Does NOT include tab visibility pause.
 */
export const selectIsManuallyPaused = (state: DashboardStateRoot): boolean =>
  state.dashboardState?.autoRefreshPaused === true;

/**
 * Selector: Determines if auto-refresh is paused.
 * Paused can be due to manual pause or tab visibility.
 */
export const selectIsPaused = (state: DashboardStateRoot): boolean =>
  state.dashboardState?.autoRefreshPaused === true ||
  state.dashboardState?.autoRefreshPausedByTab === true;

/**
 * Selector: Computes the effective refresh status for the indicator.
 *
 * Priority order:
 * 1. If not a real-time dashboard → Idle
 * 2. If paused (manually or by tab) → Paused
 * 3. If fetching → Fetching
 * 4. If refreshErrorCount >= 2 → Error
 * 5. If refreshErrorCount === 1 → Delayed
 * 6. Otherwise → Current status from state
 */
export const selectEffectiveRefreshStatus = (
  state: DashboardStateRoot,
): AutoRefreshStatus => {
  const { dashboardState } = state;

  // Not a real-time dashboard
  if ((dashboardState?.refreshFrequency ?? 0) <= 0) {
    return AutoRefreshStatus.Idle;
  }

  // Check if paused
  if (
    dashboardState?.autoRefreshPaused ||
    dashboardState?.autoRefreshPausedByTab
  ) {
    return AutoRefreshStatus.Paused;
  }

  const currentStatus =
    dashboardState?.autoRefreshStatus ?? AutoRefreshStatus.Idle;
  const refreshErrorCount = dashboardState?.refreshErrorCount ?? 0;

  if (currentStatus === AutoRefreshStatus.Fetching) {
    return AutoRefreshStatus.Fetching;
  }

  if (refreshErrorCount >= 2) {
    return AutoRefreshStatus.Error;
  }

  if (refreshErrorCount === 1) {
    return AutoRefreshStatus.Delayed;
  }

  return currentStatus;
};

export const useRealTimeDashboard = () => {
  // Auto-refresh state lives in the dashboard Zustand store.
  const refreshFrequency = useDashboardStateStore(s => s.refreshFrequency);
  const autoRefreshPaused = useDashboardStateStore(s => s.autoRefreshPaused);
  const autoRefreshPausedByTab = useDashboardStateStore(
    s => s.autoRefreshPausedByTab,
  );
  const autoRefreshStatus = useDashboardStateStore(s => s.autoRefreshStatus);
  const refreshErrorCount = useDashboardStateStore(s => s.refreshErrorCount);
  const lastSuccessfulRefresh = useDashboardStateStore(
    s => s.lastSuccessfulRefresh,
  );
  const lastAutoRefreshTime = useDashboardStateStore(
    s => s.lastAutoRefreshTime,
  );
  const lastError = useDashboardStateStore(s => s.lastRefreshError);
  const autoRefreshFetchStartTime = useDashboardStateStore(
    s => s.autoRefreshFetchStartTime,
  );
  const autoRefreshPauseOnInactiveTab = useDashboardStateStore(
    s => s.autoRefreshPauseOnInactiveTab,
  );

  // Zustand action methods are stable references.
  const setStatus = useDashboardStateStore(s => s.setAutoRefreshStatus);
  const setPaused = useDashboardStateStore(s => s.setAutoRefreshPaused);
  const setPausedByTab = useDashboardStateStore(
    s => s.setAutoRefreshPausedByTab,
  );
  const recordSuccess = useDashboardStateStore(s => s.recordAutoRefreshSuccess);
  const recordError = useDashboardStateStore(s => s.recordAutoRefreshError);
  const setFetchStartTime = useDashboardStateStore(
    s => s.setAutoRefreshFetchStartTime,
  );
  const setPauseOnInactiveTab = useDashboardStateStore(
    s => s.setAutoRefreshPauseOnInactiveTab,
  );

  const stateForSelectors = useMemo<DashboardStateRoot>(
    () => ({
      dashboardState: {
        refreshFrequency,
        autoRefreshPaused,
        autoRefreshPausedByTab,
        autoRefreshStatus,
        refreshErrorCount,
      },
    }),
    [
      refreshFrequency,
      autoRefreshPaused,
      autoRefreshPausedByTab,
      autoRefreshStatus,
      refreshErrorCount,
    ],
  );

  const isRealTimeDashboard = selectIsRealTimeDashboard(stateForSelectors);
  const isManuallyPaused = selectIsManuallyPaused(stateForSelectors);
  const isPaused = selectIsPaused(stateForSelectors);
  const effectiveStatus = selectEffectiveRefreshStatus(stateForSelectors);

  return useMemo(
    () => ({
      // State
      isRealTimeDashboard,
      isManuallyPaused,
      isPaused,
      isPausedByTab: autoRefreshPausedByTab ?? false,
      effectiveStatus,
      lastSuccessfulRefresh: lastSuccessfulRefresh ?? null,
      lastAutoRefreshTime: lastAutoRefreshTime ?? null,
      lastError: lastError ?? null,
      refreshErrorCount: refreshErrorCount ?? 0,
      refreshFrequency: refreshFrequency ?? 0,
      autoRefreshFetchStartTime: autoRefreshFetchStartTime ?? null,
      autoRefreshPauseOnInactiveTab: autoRefreshPauseOnInactiveTab ?? false,
      // Actions
      setStatus,
      setPaused,
      setPausedByTab,
      recordSuccess,
      recordError,
      setFetchStartTime,
      setPauseOnInactiveTab,
    }),
    [
      isRealTimeDashboard,
      isManuallyPaused,
      isPaused,
      autoRefreshPausedByTab,
      effectiveStatus,
      lastSuccessfulRefresh,
      lastAutoRefreshTime,
      lastError,
      refreshErrorCount,
      refreshFrequency,
      autoRefreshFetchStartTime,
      autoRefreshPauseOnInactiveTab,
      setStatus,
      setPaused,
      setPausedByTab,
      recordSuccess,
      recordError,
      setFetchStartTime,
      setPauseOnInactiveTab,
    ],
  );
};

export default useRealTimeDashboard;
