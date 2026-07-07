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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import {
  BinaryQueryObjectFilterClause,
  ensureIsArray,
  getClientErrorObject,
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

/**
 * Drill navigation is kept in a module-level store keyed by chart id so it
 * survives incidental remounts of the chart component. On a dashboard, an
 * unrelated filter change (e.g. removing another chart's cross-filter) can
 * cause the grid to re-render and remount the chart, which would otherwise
 * reset the local React state and make the breadcrumb vanish mid-drill,
 * stranding the user with no way to navigate back up. The store is process
 * memory only — a full page reload still starts fresh.
 */
interface StoredDrillState {
  drillStack: DrillDownLevel[];
  selectedLeaf?: string;
}
const drillStateStore = new Map<string | number, StoredDrillState>();

/**
 * Clear persisted drill state. Without arguments clears everything (used by
 * tests to isolate cases); with a chart id clears just that chart.
 */
export function clearDrillDownState(chartKey?: string | number): void {
  if (chartKey === undefined) {
    drillStateStore.clear();
  } else {
    drillStateStore.delete(chartKey);
  }
}

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
  drillDown: (filters: BinaryQueryObjectFilterClause[], label: string) => void;
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
  const chartKey = formData.slice_id;

  const [drillStack, setDrillStack] = useState<DrillDownLevel[]>(
    () =>
      (chartKey != null
        ? drillStateStore.get(chartKey)?.drillStack
        : undefined) ?? [],
  );
  const [selectedLeaf, setSelectedLeaf] = useState<string | undefined>(() =>
    chartKey != null ? drillStateStore.get(chartKey)?.selectedLeaf : undefined,
  );
  const [drillData, setDrillData] = useState<QueryData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Persist drill navigation synchronously so it survives remounts (see
  // drillStateStore) without racing. Writing on a deferred effect would let a
  // remount triggered by the same interaction (e.g. clearing a cross-filter)
  // restore stale state before the effect runs, so the mutators below write
  // through this helper immediately instead.
  const persist = useCallback(
    (stack: DrillDownLevel[], leaf: string | undefined) => {
      if (chartKey == null) {
        return;
      }
      if (stack.length === 0 && !leaf) {
        drillStateStore.delete(chartKey);
      } else {
        drillStateStore.set(chartKey, {
          drillStack: stack,
          selectedLeaf: leaf,
        });
      }
    },
    [chartKey],
  );

  // Reset only when the chart is actually reconfigured (chart id or viz type
  // changes) — e.g. the dashboard owner edited the chart and saved. A ref
  // guard ensures the initial mount (which restores persisted state) does not
  // wipe it, and that incidental re-renders from filter changes don't either.
  // useLayoutEffect runs synchronously before paint so the stale drill state
  // is cleared without a visible flash when the chart is reconfigured.
  const configKey = `${formData.slice_id}__${formData.viz_type}`;
  const prevConfigKeyRef = useRef(configKey);
  useLayoutEffect(() => {
    if (prevConfigKeyRef.current === configKey) {
      return;
    }
    prevConfigKeyRef.current = configKey;
    if (chartKey != null) {
      drillStateStore.delete(chartKey);
    }
    setDrillStack([]);
    setSelectedLeaf(undefined);
    setDrillData(null);
    setError(undefined);
  }, [configKey, chartKey]);

  const hierarchy = useMemo<string[]>(() => {
    const fd = formData as Record<string, unknown>;

    // The drill-down hierarchy is defined via the `drilldown_hierarchy` field
    // on the chart's form_data — an ordered list of column names representing
    // the levels to drill through. The first entry is the initial grouping
    // column shown at the base level.
    const drillLevels = ensureIsArray(
      fd[HIERARCHY_FIELD] ?? fd[HIERARCHY_FIELD_CAMEL],
    ) as string[];
    if (drillLevels.length > 1) {
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

    const extractMessage = async (err: unknown): Promise<string> => {
      let message = (err as { message?: string })?.message;
      try {
        const clientError = await getClientErrorObject(
          err as Parameters<typeof getClientErrorObject>[0],
        );
        message =
          clientError?.message ||
          clientError?.error ||
          (clientError?.errors && clientError.errors[0]?.message) ||
          message;
      } catch {
        // fall back to err.message
      }
      return message || t('Failed to load chart data');
    };

    // The backend can intermittently fail under the burst of concurrent chart
    // queries a drill click triggers (it also emits a cross-filter, which
    // re-queries every dashboard chart at once). These failures are transient,
    // so retry a few times with a short backoff before surfacing the error.
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 400;

    const runWithRetry = async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const { response, json } = await getChartDataRequest({
            formData: effectiveFormData,
          });
          // eslint-disable-next-line no-await-in-loop
          const queriesResponse = await handleChartDataResponse(
            response,
            json,
            useLegacyApi,
          );
          if (!cancelled) {
            setDrillData(queriesResponse as QueryData[]);
          }
          return;
        } catch (err) {
          if (cancelled) {
            return;
          }
          if (attempt < MAX_ATTEMPTS) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => {
              setTimeout(resolve, RETRY_DELAY_MS * attempt);
            });
            if (cancelled) {
              return;
            }
          } else {
            // eslint-disable-next-line no-await-in-loop
            const message = await extractMessage(err);
            // eslint-disable-next-line no-console
            console.error('[DrillDown] query failed', {
              message,
              effectiveFormData,
            });
            if (!cancelled) {
              setError(message);
            }
          }
        }
      }
    };

    runWithRetry().finally(() => {
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
      let nextStack: DrillDownLevel[];
      let nextLeaf: string | undefined;
      // If we're at the last level, can't drill deeper — just record the selection
      if (drillStack.length >= hierarchy.length - 1) {
        nextStack = drillStack;
        nextLeaf = label;
      } else {
        // Clear any previous leaf selection when drilling deeper
        nextStack = [
          ...drillStack,
          { column: hierarchy[drillStack.length], filters, label },
        ];
        nextLeaf = undefined;
      }
      setDrillStack(nextStack);
      setSelectedLeaf(nextLeaf);
      persist(nextStack, nextLeaf);
    },
    [drillStack, hierarchy, persist],
  );

  const resetTo = useCallback(
    (depth: number) => {
      const nextStack = drillStack.slice(0, depth);
      setDrillStack(nextStack);
      setSelectedLeaf(undefined);
      persist(nextStack, undefined);
    },
    [drillStack, persist],
  );

  const reset = useCallback(() => {
    setDrillStack([]);
    setSelectedLeaf(undefined);
    persist([], undefined);
  }, [persist]);

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
