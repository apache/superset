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
import { shallowEqual, useSelector } from 'react-redux';
import { QueryData } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  ActiveTabs,
  DashboardLayout,
  RootState,
  Slice,
} from 'src/dashboard/types';
import { ChartComparison, ChartMetricComparison } from './types';
import { CHART_TYPE, TAB_TYPE } from 'src/dashboard/util/componentTypes';

interface ChartStateWithOriginal {
  chartStatus?: string;
  queriesResponse?: QueryData[] | null;
  originalQueriesResponse?: QueryData[] | null;
}

interface QueryResponse {
  data?: Array<Record<string, unknown>>;
  colnames?: string[];
  coltypes?: GenericDataType[];
}

function extractMetricValue(
  data: Array<Record<string, unknown>> | undefined,
  metricName: string,
): number | null {
  if (!data || data.length === 0) return null;

  // Sum all values for the metric across rows
  let total = 0;
  let found = false;

  for (const row of data) {
    if (metricName in row) {
      const value = row[metricName];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        total += value;
        found = true;
      }
    }
  }

  return found ? total : null;
}

function isNumericColumn(
  data: Array<Record<string, unknown>> | undefined,
  colName: string,
): boolean {
  if (!data || data.length === 0) return false;

  for (const row of data) {
    if (colName in row) {
      const value = row[colName];
      return typeof value === 'number';
    }
  }
  return false;
}

/**
 * Hook to get a function that checks if a chart is in an active tab.
 * A chart is considered visible if:
 * 1. It has no tab parents (not inside any tab)
 * 2. All of its tab parents are in the active tabs list
 */
export function useIsChartInActiveTab() {
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout?.present,
  );
  const activeTabs = useSelector<RootState, ActiveTabs>(
    state => state.dashboardState?.activeTabs,
  );

  const layoutChartItems = useMemo(
    () =>
      Object.values(dashboardLayout || {}).filter(
        item => item.type === CHART_TYPE,
      ),
    [dashboardLayout],
  );

  return useCallback(
    (chartId: number): boolean => {
      const chartLayoutItem = layoutChartItems.find(
        layoutItem => layoutItem.meta?.chartId === chartId,
      );
      const tabParents = chartLayoutItem?.parents?.filter(
        (parent: string) => dashboardLayout[parent]?.type === TAB_TYPE,
      );

      // Chart is visible if it has no tab parents or all tab parents are active
      return (
        !tabParents ||
        tabParents.length === 0 ||
        tabParents.every(tab => activeTabs?.includes(tab))
      );
    },
    [dashboardLayout, layoutChartItems, activeTabs],
  );
}

/**
 * Filter chart IDs to only include those in active tabs.
 */
export function useChartsInActiveTabs(chartIds: number[]): number[] {
  const isChartInActiveTab = useIsChartInActiveTab();

  return useMemo(() => {
    const visibleCharts = chartIds.filter(isChartInActiveTab);
    console.log('[useChartsInActiveTabs] Visible charts:', visibleCharts);
    return visibleCharts;
  }, [chartIds, isChartInActiveTab]);
}

interface ChartComparisonData {
  chartStatus?: string;
  originalData?: Array<Record<string, unknown>>;
  modifiedData?: Array<Record<string, unknown>>;
  colnames?: string[];
  coltypes?: GenericDataType[];
}

/**
 * Selector that extracts only the comparison-relevant data for specific chart IDs.
 * This avoids re-renders when unrelated chart data changes.
 */
function useChartComparisonData(
  chartIds: number[],
): Record<number, ChartComparisonData> {
  return useSelector((state: RootState) => {
    const result: Record<number, ChartComparisonData> = {};
    for (const chartId of chartIds) {
      const chartState = state.charts[chartId] as
        | ChartStateWithOriginal
        | undefined;
      if (chartState) {
        const originalResponse = chartState.originalQueriesResponse?.[0] as
          | QueryResponse
          | undefined;
        const modifiedResponse = chartState.queriesResponse?.[0] as
          | QueryResponse
          | undefined;
        result[chartId] = {
          chartStatus: chartState.chartStatus,
          originalData: originalResponse?.data,
          modifiedData: modifiedResponse?.data,
          colnames: modifiedResponse?.colnames,
          coltypes: modifiedResponse?.coltypes,
        };
      }
    }
    return result;
  }, shallowEqual);
}

/**
 * Selector that extracts chart display names and viz types for specific chart IDs.
 * Uses sliceNameOverride from dashboard layout if available, otherwise falls back to slice_name.
 */
function useChartDisplayData(
  chartIds: number[],
): Record<number, { displayName: string; viz_type: string }> {
  return useSelector((state: RootState) => {
    const slices = state.sliceEntities.slices as { [id: number]: Slice };
    const dashboardLayout = state.dashboardLayout?.present;
    const result: Record<number, { displayName: string; viz_type: string }> =
      {};

    // Build a map of chartId -> sliceNameOverride from dashboard layout
    const nameOverrides: Record<number, string | undefined> = {};
    if (dashboardLayout) {
      for (const item of Object.values(dashboardLayout)) {
        if (item.type === CHART_TYPE && item.meta?.chartId) {
          nameOverrides[item.meta.chartId] = item.meta.sliceNameOverride;
        }
      }
    }

    for (const chartId of chartIds) {
      const slice = slices[chartId];
      if (slice) {
        result[chartId] = {
          displayName: nameOverrides[chartId] || slice.slice_name,
          viz_type: slice.viz_type,
        };
      }
    }
    return result;
  }, shallowEqual);
}

export function useChartComparison(
  affectedChartIds: number[],
): ChartComparison[] {
  const visibleChartIds = useChartsInActiveTabs(affectedChartIds);
  const chartData = useChartComparisonData(visibleChartIds);
  const chartDisplayData = useChartDisplayData(visibleChartIds);

  return useMemo(() => {
    const comparisons: ChartComparison[] = [];

    console.log(
      '[useChartComparison] Processing visible charts:',
      visibleChartIds,
    );

    for (const chartId of visibleChartIds) {
      const chartState = chartData[chartId];
      const displayData = chartDisplayData[chartId];

      if (!chartState || !displayData) continue;

      const { originalData, modifiedData } = chartState;

      if (!originalData || !modifiedData) continue;

      // Skip if original and modified data are the same reference
      // This indicates the what-if query hasn't completed yet (race condition guard)
      if (originalData === modifiedData) {
        console.warn(
          `[useChartComparison] Chart ${chartId}: originalData === modifiedData (same reference), skipping`,
        );
        continue;
      }

      // Get column names and types from the response
      const colnames = chartState.colnames || [];
      const coltypes = chartState.coltypes || [];
      const metrics: ChartMetricComparison[] = [];

      for (let i = 0; i < colnames.length; i++) {
        const metricName = colnames[i];
        const coltype = coltypes[i];

        // Only include numeric columns (not temporal/date, string, or boolean)
        // This filters out x-axis date columns and dimension columns
        // If coltypes is available, use it; otherwise fall back to runtime check
        if (coltype !== undefined && coltype !== GenericDataType.Numeric) {
          continue;
        }

        // Runtime check: verify the column actually contains numeric values
        // This also catches cases where coltypes is not available
        if (!isNumericColumn(modifiedData, metricName)) continue;

        const originalValue = extractMetricValue(originalData, metricName);
        const modifiedValue = extractMetricValue(modifiedData, metricName);

        if (
          originalValue !== null &&
          modifiedValue !== null &&
          originalValue !== 0
        ) {
          const percentageChange =
            ((modifiedValue - originalValue) / Math.abs(originalValue)) * 100;

          metrics.push({
            metricName,
            originalValue,
            modifiedValue,
            percentageChange,
          });
        }
      }

      if (metrics.length > 0) {
        comparisons.push({
          chartId,
          chartName: displayData.displayName,
          chartType: displayData.viz_type,
          metrics,
        });
      }
    }

    return comparisons;
  }, [chartData, chartDisplayData, visibleChartIds]);
}

/**
 * Selector that extracts only loading statuses for specific chart IDs.
 */
function useChartLoadingStatuses(
  chartIds: number[],
): Record<number, string | undefined> {
  return useSelector((state: RootState) => {
    const result: Record<number, string | undefined> = {};
    for (const chartId of chartIds) {
      const chartState = state.charts[chartId] as
        | ChartStateWithOriginal
        | undefined;
      result[chartId] = chartState?.chartStatus;
    }
    return result;
  }, shallowEqual);
}

/**
 * Check if all affected charts (in active tabs) have finished loading.
 * Returns true only if ALL visible charts are in a definitive complete state
 * ('success' or 'rendered'). This prevents race conditions where charts
 * might briefly be in an intermediate state.
 */
export function useAllChartsLoaded(chartIds: number[]): boolean {
  const visibleChartIds = useChartsInActiveTabs(chartIds);
  const chartStatuses = useChartLoadingStatuses(visibleChartIds);

  return useMemo(() => {
    const statuses = visibleChartIds.map(id => ({
      id,
      status: chartStatuses[id],
    }));
    console.log('[useAllChartsLoaded] Chart statuses:', statuses);

    // Require explicit completion status, not just "not loading"
    // This prevents race conditions during state transitions
    // Include 'failed' to avoid waiting indefinitely for charts that errored
    const completeStatuses = ['success', 'rendered', 'failed'];
    return (
      visibleChartIds.length > 0 &&
      visibleChartIds.every(id =>
        completeStatuses.includes(chartStatuses[id] ?? ''),
      )
    );
  }, [chartStatuses, visibleChartIds]);
}
