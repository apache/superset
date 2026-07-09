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
  /** Filters for the value selected at the deepest level, if any. */
  selectedLeafFilters?: BinaryQueryObjectFilterClause[];
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
  /** Unique chart instance id (dashboard grid assigns one per slot). */
  chartId: string | number;
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
  /**
   * Push a new level onto the drill stack. Called from the chart's click
   * handler with the filters that identify the clicked data point.
   */
  drillDown: (filters: BinaryQueryObjectFilterClause[], label: string) => void;
  /** Truncate the drill stack to the given depth (0 = back to start) */
  resetTo: (depth: number) => void;
}

/**
 * Pending eviction timers keyed by chart id. When a chart unmounts, we start
 * a timer to delete its drill state after a brief grace period. If the chart
 * remounts quickly (e.g. filter-change re-layout), the new mount cancels the
 * timer and reclaims the state from drillStateStore.
 */
const evictionTimers = new Map<
  string | number,
  ReturnType<typeof setTimeout>
>();

/**
 * Hook that manages a chart's drill-down state. Owns the drill stack,
 * computes the effective form_data for the current level, fetches the
 * data for that level, and exposes navigation helpers (drillDown / resetTo).
 *
 * The hook never mutates the upstream Redux store: closing or refreshing
 * the dashboard wipes the drill state and restores the original chart.
 */
export function useDrillDownState({
  chartId,
  formData,
  baseQueriesResponse,
}: UseDrillDownStateArgs): UseDrillDownStateResult {
  const chartKey = chartId;

  // On mount: cancel any pending eviction from a previous unmount.
  // On unmount: schedule eviction after a grace period.
  useEffect(() => {
    const pending = evictionTimers.get(chartKey);
    if (pending) {
      clearTimeout(pending);
      evictionTimers.delete(chartKey);
    }
    return () => {
      if (chartKey == null) return;
      const key = chartKey;
      const timer = setTimeout(() => {
        drillStateStore.delete(key);
        evictionTimers.delete(key);
      }, 1000);
      evictionTimers.set(key, timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey]);

  const [drillStack, setDrillStack] = useState<DrillDownLevel[]>(
    () =>
      (chartKey != null
        ? drillStateStore.get(chartKey)?.drillStack
        : undefined) ?? [],
  );
  const [selectedLeaf, setSelectedLeaf] = useState<string | undefined>(() =>
    chartKey != null ? drillStateStore.get(chartKey)?.selectedLeaf : undefined,
  );
  // Filters for the value picked at the deepest level. Applied to the drilled
  // chart's own query so it narrows to the selected leaf (a single bar),
  // independent of the dashboard's cross-filter scope config. Without this the
  // drilled chart keeps showing the full leaf distribution and only charts that
  // happen to include themselves in their cross-filter scope look "filtered".
  const [selectedLeafFilters, setSelectedLeafFilters] = useState<
    BinaryQueryObjectFilterClause[] | undefined
  >(() =>
    chartKey != null
      ? drillStateStore.get(chartKey)?.selectedLeafFilters
      : undefined,
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
    (
      stack: DrillDownLevel[],
      leaf: string | undefined,
      leafFilters: BinaryQueryObjectFilterClause[] | undefined,
    ) => {
      if (chartKey == null) {
        return;
      }
      if (stack.length === 0 && !leaf) {
        drillStateStore.delete(chartKey);
      } else {
        drillStateStore.set(chartKey, {
          drillStack: stack,
          selectedLeaf: leaf,
          selectedLeafFilters: leafFilters,
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
  const configKey = `${chartId}__${formData.viz_type}`;
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
    setSelectedLeafFilters(undefined);
    setDrillData(null);
    setError(undefined);
  }, [configKey, chartKey]);

  const hierarchy = useMemo<string[]>(() => {
    const fd = formData as Record<string, unknown>;
    const xAxis = fd.x_axis ?? fd.xAxis;

    // Primary source: the dedicated `drilldown_hierarchy` control. The chart's
    // own primary dimension (x_axis for axis charts, the first groupby column
    // for groupby charts) is the top level and is prepended automatically when
    // the author lists only the deeper levels.
    const drillLevels = ensureIsArray(
      fd[HIERARCHY_FIELD] ?? fd[HIERARCHY_FIELD_CAMEL],
    ) as string[];
    if (drillLevels.length > 0) {
      const xAxisStr = typeof xAxis === 'string' ? xAxis : undefined;
      if (xAxisStr) {
        return drillLevels.includes(xAxisStr)
          ? drillLevels
          : [xAxisStr, ...drillLevels];
      }
      const firstGroupby = ensureIsArray(fd[DEFAULT_GROUPBY_FIELD]).find(
        col => typeof col === 'string',
      ) as string | undefined;
      if (firstGroupby && !drillLevels.includes(firstGroupby)) {
        return [firstGroupby, ...drillLevels];
      }
      return drillLevels;
    }

    return [];
  }, [formData]);

  // A hierarchy needs at least two levels to be drillable; a single column
  // (e.g. the author listed only the chart's own dimension) is a no-op that
  // would otherwise hijack the normal cross-filter click without ever
  // advancing.
  const hasHierarchy = hierarchy.length >= 2;
  const currentDepth = drillStack.length;

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

    // Swap the field the hierarchy is anchored to. When the chart has an
    // x-axis, the hierarchy is x-axis driven (the groupby, if any, is only a
    // series breakdown and must be preserved), so swap x_axis. Only groupby-
    // based charts (Pie/Funnel/…, no x_axis) swap the groupby.
    const xAxisIsSet =
      typeof fdRecord.x_axis === 'string' || typeof fdRecord.xAxis === 'string';
    const groupbyValue = fdRecord[DEFAULT_GROUPBY_FIELD];

    const updated = { ...formData } as Record<string, unknown>;

    if (xAxisIsSet) {
      // Axis charts (Bar/Line/Area/…): advance the x-axis column.
      if (typeof fdRecord.x_axis === 'string') {
        updated.x_axis = nextColumn;
      }
      if (typeof fdRecord.xAxis === 'string') {
        updated.xAxis = nextColumn;
      }
    } else {
      // Groupby-based charts: advance the grouping dimension.
      updated[DEFAULT_GROUPBY_FIELD] = Array.isArray(groupbyValue)
        ? [nextColumn]
        : nextColumn;
    }

    // At the deepest level a picked value narrows the chart to that single
    // leaf (matching the breadcrumb selection), rather than showing the full
    // leaf distribution.
    const leafFilters = selectedLeafFilters ?? [];

    updated[DEFAULT_ADHOC_FILTERS_FIELD] = [
      ...baseAdhoc,
      ...accumulatedFilters.map(f => simpleFilterToAdhoc(f)),
      ...leafFilters.map(f => simpleFilterToAdhoc(f)),
    ];

    return updated as QueryFormData;
  }, [formData, drillStack, currentDepth, hierarchy, selectedLeafFilters]);

  // Keep the latest effective form-data reachable from the fetch effect
  // without listing the object itself as a dependency (its identity churns on
  // every unrelated dashboard re-render).
  const effectiveFormDataRef = useRef(effectiveFormData);
  effectiveFormDataRef.current = effectiveFormData;

  // Re-run the fetch only when the *content* of the drill query changes, not
  // when an unrelated re-render (e.g. a cross-filter update elsewhere on the
  // dashboard) hands us a new formData object with identical values. Without
  // this guard those identity-only changes re-run the effect and cancel the
  // in-flight request before it can clear the loading flag, leaving the chart
  // spinning until the 60s query timeout.
  // Only serialize while actually drilling — at depth 0 effectiveFormData is
  // just the base formData and the fetch effect early-returns, so there is no
  // need to stringify it on every render of every chart in the app.
  const effectiveFormDataKey = useMemo(
    () => (currentDepth > 0 ? JSON.stringify(effectiveFormData) : ''),
    [currentDepth, effectiveFormData],
  );

  // Fetch data whenever the user drills (stack changes and is non-empty).
  useEffect(() => {
    if (currentDepth === 0) {
      setDrillData(null);
      setError(undefined);
      return undefined;
    }

    const activeFormData = effectiveFormDataRef.current;
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

    const [useLegacyApi] = getQuerySettings(activeFormData);

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
            formData: activeFormData,
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
            console.error('[DrillDown] query failed:', message);
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
      // If the component unmounts while the query is still in-flight, the
      // finally block above will see `cancelled === true` and skip the state
      // update. Eagerly clear isLoading here so that any parent reading it
      // (e.g. via ref) sees the correct value immediately.
      setIsLoading(false);
    };
    // effectiveFormDataKey is a stable serialization of effectiveFormData; the
    // object itself is read via effectiveFormDataRef to avoid re-running on
    // identity-only changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFormDataKey, currentDepth]);

  const drillDown = useCallback<UseDrillDownStateResult['drillDown']>(
    (filters, label) => {
      let nextStack: DrillDownLevel[];
      let nextLeaf: string | undefined;
      let nextLeafFilters: BinaryQueryObjectFilterClause[] | undefined;
      // If we're at the last level, can't drill deeper — record the selection
      // and keep its filters so the chart narrows to the picked leaf.
      if (drillStack.length >= hierarchy.length - 1) {
        nextStack = drillStack;
        nextLeaf = label;
        nextLeafFilters = filters;
      } else {
        // Clear any previous leaf selection when drilling deeper
        nextStack = [...drillStack, { filters, label }];
        nextLeaf = undefined;
        nextLeafFilters = undefined;
      }
      setDrillStack(nextStack);
      setSelectedLeaf(nextLeaf);
      setSelectedLeafFilters(nextLeafFilters);
      persist(nextStack, nextLeaf, nextLeafFilters);
    },
    [drillStack, hierarchy, persist],
  );

  const resetTo = useCallback(
    (depth: number) => {
      const nextStack = drillStack.slice(0, depth);
      setDrillStack(nextStack);
      setSelectedLeaf(undefined);
      setSelectedLeafFilters(undefined);
      persist(nextStack, undefined, undefined);
    },
    [drillStack, persist],
  );

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
    drillDown,
    resetTo,
  };
}
