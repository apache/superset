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
import {
  AutoRefreshStatus,
  DELAY_THRESHOLD_PERCENTAGE,
} from '../types/autoRefresh';
import {
  setAutoRefreshStatus,
  setAutoRefreshPaused,
  setAutoRefreshPausedByTab,
  recordAutoRefreshSuccess,
  recordAutoRefreshError,
  setAutoRefreshFetchStartTime,
  setAutoRefreshPauseOnInactiveTab,
} from '../actions/autoRefresh';

interface RootState {
  dashboardState: {
    refreshFrequency: number;
    autoRefreshStatus?: AutoRefreshStatus;
    autoRefreshPaused?: boolean;
    autoRefreshPausedByTab?: boolean;
    lastSuccessfulRefresh?: number | null;
    lastRefreshError?: string | null;
    refreshErrorCount?: number;
    autoRefreshFetchStartTime?: number | null;
    autoRefreshPauseOnInactiveTab?: boolean;
  };
}

/**
 * Selector: Determines if this is a "real-time" dashboard.
 * A dashboard is real-time if it has an auto-refresh frequency > 0.
 */
export const selectIsRealTimeDashboard = (state: RootState): boolean =>
  (state.dashboardState?.refreshFrequency ?? 0) > 0;

/**
 * Selector: Determines if auto-refresh is manually paused (by user action).
 * Does NOT include tab visibility pause.
 */
export const selectIsManuallyPaused = (state: RootState): boolean =>
  state.dashboardState?.autoRefreshPaused === true;

/**
 * Selector: Determines if auto-refresh is paused.
 * Paused can be due to manual pause or tab visibility.
 */
export const selectIsPaused = (state: RootState): boolean =>
  state.dashboardState?.autoRefreshPaused === true ||
  state.dashboardState?.autoRefreshPausedByTab === true;

/**
 * Selector: Computes the effective refresh status for the indicator.
 *
 * Priority order:
 * 1. If not a real-time dashboard → Idle
 * 2. If paused (manually or by tab) → Paused
 * 3. If fetching and exceeds delay threshold → Delayed
 * 4. Otherwise → Current status from state
 */
export const selectEffectiveRefreshStatus = (
  state: RootState,
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

  // Check for delay during fetch
  if (
    currentStatus === AutoRefreshStatus.Fetching &&
    dashboardState?.autoRefreshFetchStartTime
  ) {
    const elapsed = Date.now() - dashboardState.autoRefreshFetchStartTime;
    const threshold =
      dashboardState.refreshFrequency * 1000 * DELAY_THRESHOLD_PERCENTAGE;

    if (elapsed > threshold) {
      return AutoRefreshStatus.Delayed;
    }
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

  const lastError = useSelector(
    (state: RootState) => state.dashboardState?.lastRefreshError ?? null,
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
      lastError,
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
      lastError,
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
