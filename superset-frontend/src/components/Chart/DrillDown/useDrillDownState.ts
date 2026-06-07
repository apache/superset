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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  BinaryQueryObjectFilterClause,
  ensureIsArray,
  QueryData,
  QueryFormData,
} from '@superset-ui/core';
import { simpleFilterToAdhoc } from 'src/utils/simpleFilterToAdhoc';
import {
  getChartDataRequest,
  handleChartDataResponse,
} from 'src/components/Chart/chartAction';
import { getQuerySettings } from 'src/explore/exploreUtils';
import { DrillDownLevel } from './types';

/**
 * The form-data field name that stores the ordered list of drill columns.
 * The chart starts at hierarchy[0] and advances one level per click.
 */
const HIERARCHY_FIELD = 'drilldown_hierarchy';
const HIERARCHY_FIELD_CAMEL = 'drilldownHierarchy';

/**
 * Default form-data field that holds the chart's grouping dimension.
 * Most echarts plugins use 'groupby'; Sunburst uses 'columns'. The click
 * handler can override this on a per-event basis.
 */
const DEFAULT_GROUPBY_FIELD = 'groupby';
const DEFAULT_ADHOC_FILTERS_FIELD = 'adhoc_filters';

interface UseDrillDownStateArgs {
  formData: QueryFormData;
  /** Original chart data, shown when the drill stack is empty */
  baseQueriesResponse?: QueryData[] | null;
}

interface UseDrillDownStateResult {
  /** True if the user has drilled at least one level deep */
  isDrilling: boolean;
  /** The breadcrumb path showing where the user is in the hierarchy */
  drillStack: DrillDownLevel[];
  /** Value selected at the deepest level */
  selectedLeaf?: string;
  /** The computed hierarchy of column names */
  hierarchy: string[];
  /** form_data adjusted for the current drill level */
  effectiveFormData: QueryFormData;
  /** Chart data for the current drill level (or base data when not drilling) */
  effectiveQueriesResponse: QueryData[] | null | undefined;
  /** True while the next-level data is being fetched */
  isLoading: boolean;
  /** Error message if the drill query failed */
  error?: string;
  /** Whether the chart has a configured drill-down hierarchy */
  hasHierarchy: boolean;
  /** Whether there are more levels to drill into from the current state */
  hasMoreLevels: boolean;
  /**
   * Push a new level onto the drill stack. Called from the chart's click
   * handler with the filters that identify the clicked data point.
   */
  drillDown: (
    filters: BinaryQueryObjectFilterClause[],
    label: string,
    options?: { groupbyFieldName?: string; adhocFilterFieldName?: string },
  ) => void;
  /** Truncate the drill stack to the given depth (0 = back to start) */
  resetTo: (depth: number) => void;
  /** Reset to base data (depth 0) */
  reset: () => void;
}

/**
 * Hook that manages a chart's drill-down state. Owns the drill stack,
 * computes the effective form_data for the current level, fetches the
 * data for that level, and exposes navigation helpers (drillDown / resetTo).
 *
 * The hook never mutates the upstream Redux store: closing or refreshing
 * the dashboard wipes the drill state and restores the original chart.
 */
export function useDrillDownState({
  formData,
  baseQueriesResponse,
}: UseDrillDownStateArgs): UseDrillDownStateResult {
  const [drillStack, setDrillStack] = useState<DrillDownLevel[]>([]);
  const [selectedLeaf, setSelectedLeaf] = useState<string | undefined>();
  const [drillData, setDrillData] = useState<QueryData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Reset whenever the underlying form_data (chart configuration) changes —
  // e.g. the dashboard owner edited the chart and saved.
  useEffect(() => {
    setDrillStack([]);
    setSelectedLeaf(undefined);
    setDrillData(null);
    setError(undefined);
  }, [formData.slice_id, formData.viz_type]);

  const hierarchy = useMemo<string[]>(() => {
    const fd = formData as Record<string, unknown>;

    // Option 1: x_axis is an array (multi-column, the new UX)
    const xAxis = fd.x_axis ?? fd.xAxis;
    if (Array.isArray(xAxis) && xAxis.length > 1) {
      return xAxis as string[];
    }

    // Option 2: explicit drilldown_hierarchy field (legacy/separate control)
    const drillLevels = ensureIsArray(
      fd[HIERARCHY_FIELD] ?? fd[HIERARCHY_FIELD_CAMEL],
    ) as string[];
    if (drillLevels.length > 0) {
      const xAxisStr = typeof xAxis === 'string' ? xAxis : undefined;
      if (xAxisStr && !drillLevels.includes(xAxisStr)) {
        return [xAxisStr, ...drillLevels];
      }
      return drillLevels;
    }

    return [];
  }, [formData]);

  const hasHierarchy = hierarchy.length > 0;
  const currentDepth = drillStack.length;
  const hasMoreLevels = hasHierarchy && currentDepth < hierarchy.length - 1;

  const effectiveFormData = useMemo<QueryFormData>(() => {
    if (currentDepth === 0) {
      return formData;
    }
    const nextColumn = hierarchy[currentDepth];

    // Merge accumulated filters from every level into adhoc_filters.
    const accumulatedFilters = drillStack.flatMap(level => level.filters);
    const baseAdhoc = ensureIsArray(
      (formData as Record<string, unknown>)[DEFAULT_ADHOC_FILTERS_FIELD],
    );

    const fdRecord = formData as Record<string, unknown>;

    // Determine which field to swap with the next hierarchy level.
    // Bar/Line/Area charts use x_axis as the primary dimension when groupby is empty.
    const groupbyValue = fdRecord[DEFAULT_GROUPBY_FIELD];
    const hasGroupby = Array.isArray(groupbyValue)
      ? groupbyValue.length > 0
      : !!groupbyValue;

    const updated = { ...formData } as Record<string, unknown>;

    if (hasGroupby) {
      // Chart uses groupby — swap it
      const isArrayGroupby = Array.isArray(groupbyValue);
      updated[DEFAULT_GROUPBY_FIELD] = isArrayGroupby
        ? [nextColumn]
        : nextColumn;
    } else if (fdRecord.x_axis !== undefined || fdRecord.xAxis !== undefined) {
      // Chart uses x_axis (Bar/Line/Timeseries) — swap it
      if (fdRecord.x_axis !== undefined) {
        updated.x_axis = nextColumn;
      }
      if (fdRecord.xAxis !== undefined) {
        updated.xAxis = nextColumn;
      }
    } else {
      // Fallback: set groupby
      updated[DEFAULT_GROUPBY_FIELD] = [nextColumn];
    }

    updated[DEFAULT_ADHOC_FILTERS_FIELD] = [
      ...baseAdhoc,
      ...accumulatedFilters.map(f => simpleFilterToAdhoc(f)),
    ];

    return updated as QueryFormData;
  }, [formData, drillStack, currentDepth, hierarchy]);

  // Fetch data whenever the user drills (stack changes and is non-empty).
  useEffect(() => {
    if (currentDepth === 0) {
      setDrillData(null);
      setError(undefined);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    const [useLegacyApi] = getQuerySettings(effectiveFormData);
    getChartDataRequest({ formData: effectiveFormData })
      .then(({ response, json }) =>
        handleChartDataResponse(response, json, useLegacyApi),
      )
      .then(queriesResponse => {
        if (!cancelled) {
          setDrillData(queriesResponse as QueryData[]);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || t('Failed to load chart data'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveFormData, currentDepth]);

  const drillDown = useCallback<UseDrillDownStateResult['drillDown']>(
    (filters, label) => {
      setDrillStack(prev => {
        // If we're at the last level, can't drill deeper — just record the selection
        if (prev.length >= hierarchy.length - 1) {
          setSelectedLeaf(label);
          return prev;
        }
        // Clear any previous leaf selection when drilling deeper
        setSelectedLeaf(undefined);
        const nextColumn = hierarchy[prev.length];
        return [...prev, { column: nextColumn, filters, label }];
      });
    },
    [hierarchy],
  );

  const resetTo = useCallback((depth: number) => {
    setDrillStack(prev => prev.slice(0, depth));
    setSelectedLeaf(undefined);
  }, []);

  const reset = useCallback(() => {
    setDrillStack([]);
    setSelectedLeaf(undefined);
  }, []);

  return {
    isDrilling: currentDepth > 0,
    drillStack,
    selectedLeaf,
    hierarchy,
    effectiveFormData,
    effectiveQueriesResponse:
      currentDepth === 0 ? baseQueriesResponse : drillData,
    isLoading,
    error,
    hasHierarchy,
    hasMoreLevels,
    drillDown,
    resetTo,
    reset,
  };
}
