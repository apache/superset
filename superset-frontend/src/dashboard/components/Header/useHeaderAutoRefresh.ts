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
import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import { ChartState } from 'src/explore/types';
import {
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
} from 'src/logger/LogUtils';
import { useAutoRefreshTabPause } from 'src/dashboard/hooks/useAutoRefreshTabPause';
import { useRealTimeDashboard } from 'src/dashboard/hooks/useRealTimeDashboard';
import { useAutoRefreshContext } from 'src/dashboard/contexts/AutoRefreshContext';
import { AutoRefreshStatus } from 'src/dashboard/types/autoRefresh';

type RefreshLogEventPayload = {
  action: string;
  metadata: Record<string, number | boolean>;
};

type ChartCollection = Record<number, ChartState> & Record<string, ChartState>;

type AutoRefreshStoreState = {
  charts: ChartCollection;
};

type HeaderAutoRefreshProps = {
  chartIds: number[];
  dashboardId: number;
  refreshFrequency: number;
  timedRefreshImmuneSlices: number[];
  autoRefreshMode?: string;
  isLoading: boolean;
  onRefresh: (
    chartIds: number[],
    force: boolean,
    timeout: number,
    dashboardId: number,
    skipFiltersRefresh?: boolean,
  ) => unknown;
  setRefreshFrequency: (refreshFrequency: number, editMode?: boolean) => void;
  logEvent: (
    eventName: string,
    eventData: Record<string, number | boolean>,
  ) => void;
};

type HeaderAutoRefreshResult = {
  forceRefresh: () => Promise<void>;
  handlePauseToggle: () => void;
  autoRefreshPauseOnInactiveTab: boolean;
  setPauseOnInactiveTab: (pauseOnInactiveTab: boolean) => void;
};

export const useHeaderAutoRefresh = ({
  chartIds,
  dashboardId,
  refreshFrequency,
  timedRefreshImmuneSlices,
  autoRefreshMode,
  isLoading,
  onRefresh,
  setRefreshFrequency,
  logEvent,
}: HeaderAutoRefreshProps): HeaderAutoRefreshResult => {
  const store = useStore<AutoRefreshStoreState>();
  const { startAutoRefresh, endAutoRefresh, setRefreshInFlight } =
    useAutoRefreshContext();
  const {
    isPaused,
    setStatus,
    setPaused,
    setPausedByTab,
    recordSuccess,
    recordError,
    setFetchStartTime,
    autoRefreshPauseOnInactiveTab = false,
    setPauseOnInactiveTab,
  } = useRealTimeDashboard();

  const refreshInFlightRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSequenceRef = useRef(0);
  const isPeriodicRefreshStoppedRef = useRef(true);

  const executeRefresh = useCallback(
    (
      affectedCharts: number[],
      force = false,
      suppressSpinners = false,
      interval = 0,
      logEventPayload: RefreshLogEventPayload | null = null,
      updateLastRefreshTime = false,
    ): Promise<void> => {
      if (affectedCharts.length === 0) {
        return Promise.resolve();
      }

      if (refreshInFlightRef.current && refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const { charts: chartsState } = store.getState();
      const chartsToRefresh = affectedCharts.filter(chartId => {
        const chart = chartsState[chartId];
        return (
          chart?.latestQueryFormData &&
          Object.keys(chart.latestQueryFormData).length > 0
        );
      });

      if (chartsToRefresh.length === 0) {
        return Promise.resolve();
      }

      refreshInFlightRef.current = true;
      setRefreshInFlight(true);

      if (logEventPayload) {
        logEvent(logEventPayload.action, logEventPayload.metadata);
      }

      if (suppressSpinners) {
        startAutoRefresh();
        setStatus(AutoRefreshStatus.Fetching);
        setFetchStartTime(Date.now());
      }

      let innerPromise: Promise<unknown>;
      if (!suppressSpinners) {
        innerPromise = Promise.resolve(
          onRefresh(chartsToRefresh, force, 0, dashboardId),
        );
      } else if (updateLastRefreshTime) {
        innerPromise = Promise.resolve(
          onRefresh(chartsToRefresh, force, 0, dashboardId, true),
        );
      } else {
        innerPromise = Promise.resolve(
          onRefresh(chartsToRefresh, force, interval * 0.2, dashboardId, true),
        );
      }

      const wrappedPromise: Promise<void> = new Promise((resolve, reject) => {
        innerPromise
          .then(() => {
            if (suppressSpinners) {
              const { charts } = store.getState();
              const anyFailed = chartsToRefresh.some(
                chartId => charts[chartId]?.chartStatus === 'failed',
              );
              if (anyFailed) {
                const failedChart = chartsToRefresh.find(
                  chartId => charts[chartId]?.chartStatus === 'failed',
                );
                if (failedChart !== undefined) {
                  const errorMsg =
                    charts[failedChart]?.chartAlert || 'Chart refresh failed';
                  recordError(errorMsg);
                } else {
                  recordError('Chart refresh failed');
                }
              } else {
                recordSuccess();
              }
              setFetchStartTime(null);
            }

            if (suppressSpinners) {
              requestAnimationFrame(() => {
                endAutoRefresh();
                refreshInFlightRef.current = false;
                refreshPromiseRef.current = null;
                setRefreshInFlight(false);
                resolve();
              });
            } else {
              refreshInFlightRef.current = false;
              refreshPromiseRef.current = null;
              setRefreshInFlight(false);
              resolve();
            }
          })
          .catch(error => {
            if (suppressSpinners) {
              recordError(error?.message || 'Refresh failed');
              setFetchStartTime(null);
              requestAnimationFrame(() => {
                endAutoRefresh();
                refreshInFlightRef.current = false;
                refreshPromiseRef.current = null;
                setRefreshInFlight(false);
                reject(error);
              });
            } else {
              refreshInFlightRef.current = false;
              refreshPromiseRef.current = null;
              setRefreshInFlight(false);
              reject(error);
            }
          });
      });

      refreshPromiseRef.current = wrappedPromise;
      return wrappedPromise;
    },
    [
      dashboardId,
      endAutoRefresh,
      logEvent,
      onRefresh,
      recordError,
      recordSuccess,
      setFetchStartTime,
      setRefreshInFlight,
      setStatus,
      startAutoRefresh,
      store,
    ],
  );

  const stopPeriodicRender = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    isPeriodicRefreshStoppedRef.current = true;
    refreshSequenceRef.current += 1;
  }, []);

  const startPeriodicRender = useCallback(
    (intervalMs: number) => {
      stopPeriodicRender();

      if (intervalMs <= 0) {
        return;
      }

      isPeriodicRefreshStoppedRef.current = false;
      const sequenceId = refreshSequenceRef.current;

      const runPeriodicRefresh = () => {
        if (
          isPeriodicRefreshStoppedRef.current ||
          refreshSequenceRef.current !== sequenceId
        ) {
          return;
        }

        const affectedCharts = chartIds.filter(
          chartId => timedRefreshImmuneSlices.indexOf(chartId) === -1,
        );
        const force = autoRefreshMode !== 'fetch';

        Promise.resolve(
          executeRefresh(
            affectedCharts,
            force,
            true,
            intervalMs,
            {
              action: LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
              metadata: {
                interval: intervalMs,
                chartCount: affectedCharts.length,
              },
            },
            false,
          ),
        )
          .catch(() => undefined)
          .finally(() => {
            if (
              isPeriodicRefreshStoppedRef.current ||
              refreshSequenceRef.current !== sequenceId
            ) {
              return;
            }
            refreshTimerRef.current = setTimeout(
              runPeriodicRefresh,
              intervalMs,
            );
          });
      };

      refreshTimerRef.current = setTimeout(runPeriodicRefresh, intervalMs);
    },
    [
      autoRefreshMode,
      chartIds,
      executeRefresh,
      stopPeriodicRender,
      timedRefreshImmuneSlices,
    ],
  );

  useEffect(() => {
    if (isPaused) {
      stopPeriodicRender();
      return;
    }

    startPeriodicRender(refreshFrequency * 1000);
  }, [isPaused, refreshFrequency, startPeriodicRender, stopPeriodicRender]);

  const forceRefresh = useCallback(() => {
    if (refreshInFlightRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    if (isLoading) {
      return Promise.resolve();
    }
    return executeRefresh(chartIds, true, false, 0, {
      action: LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
      metadata: {
        force: true,
        interval: 0,
        chartCount: chartIds.length,
      },
    });
  }, [chartIds, executeRefresh, isLoading]);

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      setPaused(false);
      setPausedByTab(false);
      const affectedCharts = chartIds.filter(
        chartId => timedRefreshImmuneSlices.indexOf(chartId) === -1,
      );
      executeRefresh(affectedCharts, true, true, 0, null, true).finally(() => {
        startPeriodicRender(refreshFrequency * 1000);
      });
    } else {
      setPaused(true);
      setStatus(AutoRefreshStatus.Paused);
      stopPeriodicRender();
    }
  }, [
    chartIds,
    executeRefresh,
    isPaused,
    refreshFrequency,
    setPaused,
    setPausedByTab,
    setStatus,
    startPeriodicRender,
    stopPeriodicRender,
    timedRefreshImmuneSlices,
  ]);

  const handleTabVisibilityRefresh = useCallback(() => {
    if (refreshInFlightRef.current && refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    if (isLoading) {
      return Promise.resolve();
    }
    const affectedCharts = chartIds.filter(
      chartId => timedRefreshImmuneSlices.indexOf(chartId) === -1,
    );
    return executeRefresh(affectedCharts, true, true, 0, null, true);
  }, [chartIds, executeRefresh, isLoading, timedRefreshImmuneSlices]);

  const handleRestartTimer = useCallback(() => {
    startPeriodicRender(refreshFrequency * 1000);
  }, [refreshFrequency, startPeriodicRender]);

  const handleStopTimer = useCallback(() => {
    stopPeriodicRender();
  }, [stopPeriodicRender]);

  useAutoRefreshTabPause({
    onRefresh: handleTabVisibilityRefresh,
    onRestartTimer: handleRestartTimer,
    onStopTimer: handleStopTimer,
  });

  useEffect(
    () => () => {
      stopPeriodicRender();
      setRefreshFrequency(0);
    },
    [setRefreshFrequency, stopPeriodicRender],
  );

  return {
    forceRefresh,
    handlePauseToggle,
    autoRefreshPauseOnInactiveTab,
    setPauseOnInactiveTab,
  };
};

export default useHeaderAutoRefresh;
