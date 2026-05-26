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
import { useDispatch, useSelector } from 'react-redux';
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
import {
  pushDrillLevel,
  resetDrillTo,
  setDrillLeaf,
} from './drillDownSlice';

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
  baseQueriesResponse?: QueryData[] | null;
  chartId?: number;
}

interface UseDrillDownStateResult {
  /** True if the user has drilled at least one level deep */
  isDrilling: boolean;
  /** The breadcrumb path showing where the user is in the hierarchy */
  drillStack: DrillDownLevel[];
  /** Value selected at the deepest level (leaf) */
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
  cacheBuster: string;
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
  chartId,
}: UseDrillDownStateArgs): UseDrillDownStateResult {
  const dispatch = useDispatch();

  // Read drill state from Redux (survives unmount/mount)
  const reduxState = useSelector((state: Record<string, any>) =>
    chartId !== undefined ? state.drillDown?.[chartId] : undefined,
  );
  const drillStack: DrillDownLevel[] = reduxState?.stack ?? [];
  const selectedLeaf: string | undefined = reduxState?.selectedLeaf;

  const [drillData, setDrillData] = useState<QueryData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Force ChartRenderer to re-render when drill data or depth changes
  const [cacheBuster, setCacheBuster] = useState('');

  const hierarchy = useMemo<string[]>(
    () => {
      const fd = formData as Record<string, unknown>;

      // Option 1: x_axis is an array (multi-column, the new UX)
      const xAxis = fd.x_axis ?? fd.xAxis;
      if (Array.isArray(xAxis) && xAxis.length > 1) {
        // eslint-disable-next-line no-console
        console.log('[DrillDown] hierarchy from x_axis array:', xAxis);
        return xAxis as string[];
      }

      // Option 2: explicit drilldown_hierarchy field (legacy/separate control)
      const drillLevels = ensureIsArray(fd[HIERARCHY_FIELD] ?? fd[HIERARCHY_FIELD_CAMEL]) as string[];
      if (drillLevels.length > 0) {
        const xAxisStr = (typeof xAxis === 'string' ? xAxis : undefined);
        if (xAxisStr && !drillLevels.includes(xAxisStr)) {
          return [xAxisStr, ...drillLevels];
        }
        return drillLevels;
      }

      // Option 3: single x_axis or single groupby column — enable filtering to clicked value
      // (treats the same column as both "level 0" and "level 1" so a click
      // adds a filter and shows just the clicked bar)
      // x_axis can be a string OR an array with one element
      let xAxisStr: string | undefined;
      if (typeof xAxis === 'string') {
        xAxisStr = xAxis;
      } else if (Array.isArray(xAxis) && xAxis.length === 1 && typeof xAxis[0] === 'string') {
        xAxisStr = xAxis[0];
      }
      if (xAxisStr) {
        // eslint-disable-next-line no-console
        console.log('[DrillDown] hierarchy from single x_axis:', xAxisStr);
        return [xAxisStr, xAxisStr];
      }

      const groupby = fd.groupby;
      const groupbyArr = ensureIsArray(groupby) as string[];
      if (groupbyArr.length === 1) {
        // eslint-disable-next-line no-console
        console.log('[DrillDown] hierarchy from single groupby:', groupbyArr);
        return [groupbyArr[0], groupbyArr[0]];
      }
      if (groupbyArr.length > 1) {
        // eslint-disable-next-line no-console
        console.log('[DrillDown] hierarchy from multi groupby:', groupbyArr);
        return groupbyArr;
      }

      // eslint-disable-next-line no-console
      console.log('[DrillDown] no hierarchy for', fd.viz_type, 'slice', fd.slice_id,
        'x_axis:', JSON.stringify(fd.x_axis),
        'groupby:', JSON.stringify(fd.groupby),
        'xAxis:', JSON.stringify(fd.xAxis),
      );
      return [];
    },
    [formData],
  );

  const hasHierarchy = hierarchy.length > 0;
  const currentDepth = drillStack.length;
  const hasMoreLevels = hasHierarchy && currentDepth < hierarchy.length - 1;

  useEffect(() => {
    setCacheBuster(`drill-${currentDepth}-${Date.now()}`);
  }, [drillData, currentDepth]);

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

    // eslint-disable-next-line no-console
    console.log('[DrillDown] FETCHING for slice', formData.slice_id,
      'depth', currentDepth,
      'extra_form_data:', JSON.stringify((formData as Record<string, unknown>).extra_form_data),
    );

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
          setError(err?.message || 'Failed to load drill-down data');
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

  const drillDown = useCallback(
    (filters: BinaryQueryObjectFilterClause[], label: string) => {
      if (chartId === undefined) return;
      if (drillStack.length >= hierarchy.length - 1) {
        // At last level — set leaf
        dispatch(setDrillLeaf({ chartId, leaf: label }));
        return;
      }
      const nextColumn = hierarchy[drillStack.length];
      dispatch(pushDrillLevel({ chartId, level: { column: nextColumn, filters, label } }));
    },
    [chartId, dispatch, drillStack.length, hierarchy],
  );

  const resetTo = useCallback(
    (depth: number) => {
      if (chartId === undefined) return;
      dispatch(resetDrillTo({ chartId, depth }));
    },
    [chartId, dispatch],
  );

  const reset = useCallback(() => {
    if (chartId === undefined) return;
    dispatch(resetDrillTo({ chartId, depth: 0 }));
  }, [chartId, dispatch]);

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
    cacheBuster,
    drillDown,
    resetTo,
    reset,
  };
}
