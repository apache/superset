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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logging } from '@superset-ui/core';
import { setWhatIfModifications } from 'src/dashboard/actions/dashboardState';
import {
  triggerQuery,
  saveOriginalChartData,
} from 'src/components/Chart/chartAction';
import { RootState, WhatIfFilter } from 'src/dashboard/types';
import { useNumericColumns } from 'src/dashboard/util/useNumericColumns';
import { fetchRelatedColumnSuggestions } from './whatIfApi';
import { ExtendedWhatIfModification, WhatIfModification } from './types';

export interface UseWhatIfApplyParams {
  selectedColumn: string | undefined;
  sliderValue: number;
  filters: WhatIfFilter[];
  enableCascadingEffects: boolean;
}

export interface UseWhatIfApplyReturn {
  appliedModifications: ExtendedWhatIfModification[];
  affectedChartIds: number[];
  isLoadingSuggestions: boolean;
  applyCounter: number;
  handleApply: () => Promise<void>;
  handleDismissLoader: () => void;
  aiInsightsModifications: WhatIfModification[];
}

/**
 * Custom hook for managing what-if apply logic and modifications state.
 * Handles:
 * - Applied modifications tracking
 * - AI suggestions fetching with cascading effects
 * - Redux dispatching for what-if state
 * - Chart query triggering
 */
export function useWhatIfApply({
  selectedColumn,
  sliderValue,
  filters,
  enableCascadingEffects,
}: UseWhatIfApplyParams): UseWhatIfApplyReturn {
  const dispatch = useDispatch();

  const [appliedModifications, setAppliedModifications] = useState<
    ExtendedWhatIfModification[]
  >([]);
  const [affectedChartIds, setAffectedChartIds] = useState<number[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // Counter that increments each time Apply is clicked, used as key to reset AI insights
  const [applyCounter, setApplyCounter] = useState(0);

  // AbortController for cancelling in-flight /suggest_related requests
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null);

  const { numericColumns, columnToChartIds } = useNumericColumns();
  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);

  // Cleanup: cancel any pending requests on unmount
  useEffect(
    () => () => {
      suggestionsAbortControllerRef.current?.abort();
    },
    [],
  );

  const handleApply = useCallback(async () => {
    if (!selectedColumn) return;

    // Cancel any in-flight suggestions request
    suggestionsAbortControllerRef.current?.abort();

    // Immediately clear previous results and increment counter to reset AI insights component
    setAppliedModifications([]);
    setAffectedChartIds([]);
    setApplyCounter(c => c + 1);

    const multiplier = 1 + sliderValue / 100;

    // Base user modification with filters
    const userModification: ExtendedWhatIfModification = {
      column: selectedColumn,
      multiplier,
      isAISuggested: false,
      filters: filters.length > 0 ? filters : undefined,
    };

    let allModifications: ExtendedWhatIfModification[] = [userModification];

    // If cascading effects enabled, fetch AI suggestions
    if (enableCascadingEffects) {
      // Create a new AbortController for this request
      const abortController = new AbortController();
      suggestionsAbortControllerRef.current = abortController;

      setIsLoadingSuggestions(true);
      try {
        const suggestions = await fetchRelatedColumnSuggestions(
          {
            selectedColumn,
            userMultiplier: multiplier,
            availableColumns: numericColumns.map(col => ({
              columnName: col.columnName,
              description: col.description,
              verboseName: col.verboseName,
              datasourceId: col.datasourceId,
            })),
            dashboardName: dashboardInfo?.dash_edit_perm
              ? dashboardInfo?.dashboard_title
              : undefined,
          },
          abortController.signal,
        );

        // Add AI suggestions to modifications (with same filters as user modification)
        const aiModifications: ExtendedWhatIfModification[] =
          suggestions.suggestedModifications.map(mod => ({
            column: mod.column,
            multiplier: mod.multiplier,
            isAISuggested: true,
            reasoning: mod.reasoning,
            confidence: mod.confidence,
            filters: filters.length > 0 ? filters : undefined,
          }));

        allModifications = [...allModifications, ...aiModifications];
      } catch (error) {
        // Don't log or update state if the request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        logging.error('Failed to get AI suggestions:', error);
        // Continue with just user modification
      }
      setIsLoadingSuggestions(false);
    }

    setAppliedModifications(allModifications);

    // Collect all affected chart IDs from all modifications
    const allAffectedChartIds = new Set<number>();
    allModifications.forEach(mod => {
      const chartIds = columnToChartIds.get(mod.column) || [];
      chartIds.forEach(id => allAffectedChartIds.add(id));
    });
    const chartIdsArray = Array.from(allAffectedChartIds);

    // Save original chart data before applying what-if modifications
    chartIdsArray.forEach(chartId => {
      dispatch(saveOriginalChartData(chartId));
    });

    // Set the what-if modifications in Redux state (all modifications)
    dispatch(
      setWhatIfModifications(
        allModifications.map(mod => ({
          column: mod.column,
          multiplier: mod.multiplier,
          filters: mod.filters,
        })),
      ),
    );

    // Trigger queries for all affected charts
    // This sets chart status to 'loading', which is important for AI insights timing
    chartIdsArray.forEach(chartId => {
      dispatch(triggerQuery(true, chartId));
    });

    // Set affected chart IDs AFTER Redux updates and query triggers
    // This ensures WhatIfAIInsights mounts when charts are already loading,
    // preventing it from immediately fetching with stale data
    setAffectedChartIds(chartIdsArray);
  }, [
    dispatch,
    selectedColumn,
    sliderValue,
    columnToChartIds,
    enableCascadingEffects,
    numericColumns,
    dashboardInfo,
    filters,
  ]);

  const handleDismissLoader = useCallback(() => {
    suggestionsAbortControllerRef.current?.abort();
    setIsLoadingSuggestions(false);
  }, []);

  // Memoize modifications array for WhatIfAIInsights to prevent unnecessary re-renders
  const aiInsightsModifications = useMemo(
    () =>
      appliedModifications.map(mod => ({
        column: mod.column,
        multiplier: mod.multiplier,
        filters: mod.filters,
      })),
    [appliedModifications],
  );

  return {
    appliedModifications,
    affectedChartIds,
    isLoadingSuggestions,
    applyCounter,
    handleApply,
    handleDismissLoader,
    aiInsightsModifications,
  };
}

export default useWhatIfApply;
