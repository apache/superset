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
import { useCallback, useRef } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useRealTimeDashboard } from './useRealTimeDashboard';
import { AutoRefreshStatus } from '../types/autoRefresh';

export interface UseAutoRefreshTabPauseOptions {
  /** Callback to trigger immediate refresh */
  onRefresh: () => Promise<void>;
  /** Callback to restart the periodic timer */
  onRestartTimer: () => void;
  /** Callback to stop the periodic timer */
  onStopTimer: () => void;
}

/**
 * Hook that automatically pauses auto-refresh when the browser tab is inactive.
 *
 * Behavior:
 * - When tab becomes hidden: Stop the refresh timer, set status to paused
 * - When tab becomes visible: If not manually paused, fetch data immediately and restart timer
 *
 * This behavior is enabled for real-time dashboards when the user opts in.
 * Manual pause state is respected - if the user manually paused, returning to the tab won't auto-resume.
 */
export function useAutoRefreshTabPause({
  onRefresh,
  onRestartTimer,
  onStopTimer,
}: UseAutoRefreshTabPauseOptions): void {
  const {
    isRealTimeDashboard,
    isManuallyPaused,
    autoRefreshPauseOnInactiveTab,
    setPausedByTab,
    setStatus,
  } = useRealTimeDashboard();

  // Track if we should resume on visibility change
  const shouldResumeRef = useRef(false);

  const handleHidden = useCallback(() => {
    // Only act if dashboard has auto-refresh enabled and not already manually paused
    if (!isRealTimeDashboard || !autoRefreshPauseOnInactiveTab) {
      return;
    }

    // Don't track tab pause if already manually paused
    if (!isManuallyPaused) {
      shouldResumeRef.current = true;
      setPausedByTab(true);
      setStatus(AutoRefreshStatus.Paused);
      onStopTimer();
    }
  }, [
    isRealTimeDashboard,
    isManuallyPaused,
    setPausedByTab,
    setStatus,
    onStopTimer,
  ]);

  const handleVisible = useCallback(() => {
    // Only act if dashboard has auto-refresh enabled
    if (!isRealTimeDashboard || !autoRefreshPauseOnInactiveTab) {
      return;
    }

    // Only resume if we paused due to tab visibility (not manual pause)
    if (shouldResumeRef.current && !isManuallyPaused) {
      setPausedByTab(false);

      // Immediate refresh then restart timer
      onRefresh()
        .then(() => {
          onRestartTimer();
        })
        .catch(() => {
          // Still restart timer even on error
          onRestartTimer();
        });

      shouldResumeRef.current = false;
    }
  }, [
    isRealTimeDashboard,
    isManuallyPaused,
    autoRefreshPauseOnInactiveTab,
    setPausedByTab,
    onRefresh,
    onRestartTimer,
  ]);

  useTabVisibility({
    onVisible: handleVisible,
    onHidden: handleHidden,
    enabled: isRealTimeDashboard && autoRefreshPauseOnInactiveTab,
  });
}

export default useAutoRefreshTabPause;
