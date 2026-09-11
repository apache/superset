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
import { useCallback, useRef, useEffect } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useRealTimeDashboard } from './useRealTimeDashboard';
import { AutoRefreshStatus } from '../types/autoRefresh';

export interface UseAutoRefreshTabPauseOptions {
  onRefresh: () => Promise<void>;
  onRestartTimer: () => void;
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
    isPausedByTab,
    autoRefreshPauseOnInactiveTab,
    setPausedByTab,
    setStatus,
  } = useRealTimeDashboard();

  const shouldResumeRef = useRef(false);

  const handleHidden = useCallback(() => {
    if (!isRealTimeDashboard || !autoRefreshPauseOnInactiveTab) {
      return;
    }

    if (!isManuallyPaused) {
      shouldResumeRef.current = true;
      setPausedByTab(true);
      setStatus(AutoRefreshStatus.Paused);
      onStopTimer();
    }
  }, [
    isRealTimeDashboard,
    isManuallyPaused,
    autoRefreshPauseOnInactiveTab,
    setPausedByTab,
    setStatus,
    onStopTimer,
  ]);

  const handleVisible = useCallback(() => {
    if (!isRealTimeDashboard || !autoRefreshPauseOnInactiveTab) {
      return;
    }

    if (shouldResumeRef.current && !isManuallyPaused) {
      setPausedByTab(false);

      onRefresh()
        .then(() => {
          onRestartTimer();
        })
        .catch(() => {
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

  useEffect(() => {
    if (!isRealTimeDashboard || !autoRefreshPauseOnInactiveTab) {
      return;
    }

    if (document.visibilityState === 'hidden') {
      handleHidden();
    }
  }, [isRealTimeDashboard, autoRefreshPauseOnInactiveTab, handleHidden]);

  useEffect(() => {
    if (!isRealTimeDashboard || autoRefreshPauseOnInactiveTab) {
      return;
    }

    if (!isPausedByTab) {
      return;
    }

    shouldResumeRef.current = false;
    setPausedByTab(false);

    if (!isManuallyPaused) {
      setStatus(AutoRefreshStatus.Idle);
      onRestartTimer();
    }
  }, [
    isRealTimeDashboard,
    autoRefreshPauseOnInactiveTab,
    isPausedByTab,
    isManuallyPaused,
    setPausedByTab,
    setStatus,
    onRestartTimer,
  ]);
}

export default useAutoRefreshTabPause;
