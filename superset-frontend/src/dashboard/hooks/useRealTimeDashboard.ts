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
import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AutoRefreshStatus } from '../types/autoRefresh';
import { DashboardState, RootState } from '../types';
import {
  setAutoRefreshStatus,
  setAutoRefreshPaused,
  setAutoRefreshPausedByTab,
  recordAutoRefreshSuccess,
  recordAutoRefreshError,
  setAutoRefreshFetchStartTime,
  setAutoRefreshPauseOnInactiveTab,
} from '../actions/autoRefresh';

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
  const dispatch = useDispatch();

  // Selectors
  const isRealTimeDashboard = useSelector(selectIsRealTimeDashboard);
  const isManuallyPaused = useSelector(selectIsManuallyPaused);
  const isPaused = useSelector(selectIsPaused);
  const effectiveStatus = useSelector(selectEffectiveRefreshStatus);

  const lastSuccessfulRefresh = useSelector(
    (state: RootState) => state.dashboardState?.lastSuccessfulRefresh ?? null,
  );

  const lastAutoRefreshTime = useSelector(
    (state: RootState) => state.dashboardState?.lastAutoRefreshTime ?? null,
  );

  const lastError = useSelector(
    (state: RootState) => state.dashboardState?.lastRefreshError ?? null,
  );

  const refreshErrorCount = useSelector(
    (state: RootState) => state.dashboardState?.refreshErrorCount ?? 0,
  );

  const refreshFrequency = useSelector(
    (state: RootState) => state.dashboardState?.refreshFrequency ?? 0,
  );

  const autoRefreshFetchStartTime = useSelector(
    (state: RootState) =>
      state.dashboardState?.autoRefreshFetchStartTime ?? null,
  );

  const autoRefreshPauseOnInactiveTab = useSelector(
    (state: RootState) =>
      state.dashboardState?.autoRefreshPauseOnInactiveTab ?? false,
  );

  const isPausedByTab = useSelector(
    (state: RootState) => state.dashboardState?.autoRefreshPausedByTab ?? false,
  );

  // Action dispatchers
  const setStatus = useCallback(
    (status: AutoRefreshStatus) => {
      dispatch(setAutoRefreshStatus(status));
    },
    [dispatch],
  );

  const setPaused = useCallback(
    (paused: boolean) => {
      dispatch(setAutoRefreshPaused(paused));
    },
    [dispatch],
  );

  const setPausedByTab = useCallback(
    (pausedByTab: boolean) => {
      dispatch(setAutoRefreshPausedByTab(pausedByTab));
    },
    [dispatch],
  );

  const recordSuccess = useCallback(() => {
    dispatch(recordAutoRefreshSuccess());
  }, [dispatch]);

  const recordError = useCallback(
    (error?: string) => {
      dispatch(recordAutoRefreshError(error));
    },
    [dispatch],
  );

  const setFetchStartTime = useCallback(
    (timestamp: number | null) => {
      dispatch(setAutoRefreshFetchStartTime(timestamp));
    },
    [dispatch],
  );

  const setPauseOnInactiveTab = useCallback(
    (pauseOnInactiveTab: boolean) => {
      dispatch(setAutoRefreshPauseOnInactiveTab(pauseOnInactiveTab));
    },
    [dispatch],
  );

  return useMemo(
    () => ({
      // State
      isRealTimeDashboard,
      isManuallyPaused,
      isPaused,
      isPausedByTab,
      effectiveStatus,
      lastSuccessfulRefresh,
      lastAutoRefreshTime,
      lastError,
      refreshErrorCount,
      refreshFrequency,
      autoRefreshFetchStartTime,
      autoRefreshPauseOnInactiveTab,
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
      isPausedByTab,
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
