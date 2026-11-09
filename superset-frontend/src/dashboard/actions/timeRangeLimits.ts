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
  ErrorTypeEnum,
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
  type JsonObject,
  type LatestQueryFormData,
  type QueryFormData,
} from '@superset-ui/core';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import {
  chartUpdateFailed,
  chartUpdateStopped,
} from 'src/components/Chart/chartAction';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import {
  dashboardLimitLevels,
  fetchChartRanges,
  hasLimits,
  judgeChartRanges,
  RULE_NAMES,
  type ChartRangeFailure,
  type ChartRangesCall,
  type ChartRangesEntry,
  type ChartRangesLevels,
  type DashboardLimitsPayload,
} from 'src/utils/timeRangeLimits';
import { getAllActiveFilters } from 'src/dashboard/util/activeAllDashboardFilters';
import type { RootState } from 'src/dashboard/types';
import type {
  ChartHold,
  ChartHoldAttribution,
  TimeRangeLimitsState,
} from '../reducers/timeRangeLimits';

export const TIME_RANGE_LIMITS_LOADING = 'TIME_RANGE_LIMITS_LOADING';
export const TIME_RANGE_LIMITS_LOADED = 'TIME_RANGE_LIMITS_LOADED';
export const TIME_RANGE_LIMITS_FAILED = 'TIME_RANGE_LIMITS_FAILED';
export const CHART_RANGES_HOLD = 'CHART_RANGES_HOLD';
export const TIME_RANGE_USER_APPLY = 'TIME_RANGE_USER_APPLY';

export type TimeRangeLimitsAction =
  | {
      type: typeof TIME_RANGE_LIMITS_LOADING;
      dashboardId: number;
      request: number;
    }
  | {
      type: typeof TIME_RANGE_LIMITS_LOADED;
      request: number;
      payload: DashboardLimitsPayload;
    }
  | { type: typeof TIME_RANGE_LIMITS_FAILED; request: number }
  | {
      type: typeof CHART_RANGES_HOLD;
      dashboardId: number | null;
      chartId: number;
      hold: ChartHold;
    }
  | {
      type: typeof TIME_RANGE_USER_APPLY;
      filters: Record<string, string> | null;
    };

type LimitsState = Pick<
  RootState,
  'charts' | 'dataMask' | 'nativeFilters' | 'dashboardInfo' | 'dashboardState'
> & { timeRangeLimits: TimeRangeLimitsState };

type LimitsDispatch = ThunkDispatch<LimitsState, undefined, AnyAction>;

type ChartFormData = QueryFormData | LatestQueryFormData;

let lastRequest = 0;

/**
 * The Time Range filter values the user just applied (Apply filters or
 * "Use last …"), keyed by filter id; `null` forgets them.
 */
export function setTimeRangeUserApply(
  filters: Record<string, string> | null,
): TimeRangeLimitsAction {
  return { type: TIME_RANGE_USER_APPLY, filters };
}

/**
 * Load the dashboard's time range limits (flag on only): the full answer of
 * `GET /api/v1/dashboard/{id}/time_range_limits/`. Any error or no answer
 * in 10 s gives `failed`; there is no automatic retry, so a Retry is one more
 * dispatch, i.e. one more GET.
 */
export function fetchTimeRangeLimits(dashboardId: number) {
  return (dispatch: LimitsDispatch): Promise<void> => {
    if (!isFeatureEnabled(FeatureFlag.TimeRangeLimits)) {
      return Promise.resolve();
    }
    lastRequest += 1;
    const request = lastRequest;
    dispatch({ type: TIME_RANGE_LIMITS_LOADING, dashboardId, request });
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}/time_range_limits/`,
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    })
      .then(({ json }) => {
        dispatch({
          type: TIME_RANGE_LIMITS_LOADED,
          request,
          payload: (json as { result: DashboardLimitsPayload }).result,
        });
      })
      .catch(() => {
        dispatch({ type: TIME_RANGE_LIMITS_FAILED, request });
      });
  };
}

/**
 * Acknowledge the editor notice (flag on only): `PUT
 * /api/v1/time_range_limits/notice/` stores the current global time range
 * limits as the user's. Never rejects: a failed call leaves the notice for
 * the next load.
 */
export function acknowledgeEditorNotice(): Promise<void> {
  if (!isFeatureEnabled(FeatureFlag.TimeRangeLimits)) {
    return Promise.resolve();
  }
  return SupersetClient.put({
    endpoint: '/api/v1/time_range_limits/notice/',
  })
    .then(() => undefined)
    .catch(() => undefined);
}

const ruleValues = (policy: JsonObject | null | undefined) =>
  RULE_NAMES.map(rule => policy?.[rule] ?? null);

/**
 * After a dashboard save or a policy PUT: load the limits again unless they are
 * off or for another dashboard, or already loaded with the saved rules.
 */
export function refetchTimeRangeLimitsAfterSave(
  dashboardId: number,
  savedLimits: JsonObject | null | undefined,
) {
  return (
    dispatch: LimitsDispatch,
    getState: () => LimitsState,
  ): Promise<void> => {
    const limits = getState().timeRangeLimits;
    if (!limits) {
      return Promise.resolve();
    }
    const { status, payload, dashboardId: loadedId } = limits;
    if (
      status === 'off' ||
      loadedId !== dashboardId ||
      (status === 'loaded' &&
        JSON.stringify(ruleValues(payload?.dashboard)) ===
          JSON.stringify(ruleValues(savedLimits)))
    ) {
      return Promise.resolve();
    }
    return dispatch(fetchTimeRangeLimits(dashboardId));
  };
}

export type ChartHoldMode = 'off' | 'loading' | 'failed' | 'on';

/**
 * Whether the dashboard's charts wait for their time ranges: `off` with the
 * flag off or when no level sets a rule, `loading` / `failed` while the
 * limits aren't known, `on` when every query is checked first.
 */
export function chartHoldMode(
  limits: TimeRangeLimitsState | undefined,
): ChartHoldMode {
  if (
    !limits ||
    limits.status === 'off' ||
    !isFeatureEnabled(FeatureFlag.TimeRangeLimits)
  ) {
    return 'off';
  }
  if (limits.status !== 'loaded') {
    return limits.status;
  }
  return limits.payload &&
    ((limits.payload.datasets ?? []).some(dataset => dataset.error) ||
      hasLimits(dashboardLimitLevels(limits.payload)))
    ? 'on'
    : 'off';
}

export const chartSignature = (formData: ChartFormData) =>
  JSON.stringify(formData);

const holdChart = (
  dispatch: LimitsDispatch,
  dashboardId: number | null,
  chartId: number,
  hold: ChartHold,
) => dispatch({ type: CHART_RANGES_HOLD, dashboardId, chartId, hold });

/*
 * Every chart that asks for its ranges in the same tick goes into one call;
 * `fetchChartRanges` splits it by `CHART_RANGES_MAX_CHARTS`.
 */
type QueuedEntry = {
  entry: Promise<ChartRangesEntry | null>;
  resolve: (calls: ChartRangesCall[]) => void;
};

let queued: QueuedEntry[] = [];
let lastKey = 0;

function flushQueue() {
  const batch = queued;
  queued = [];
  Promise.all(batch.map(item => item.entry))
    .then(entries =>
      fetchChartRanges(
        entries.filter((entry): entry is ChartRangesEntry => entry !== null),
      ),
    )
    .then(calls => batch.forEach(item => item.resolve(calls)));
}

function queueChartRanges(
  entry: Promise<ChartRangesEntry | null>,
): Promise<ChartRangesCall[]> {
  return new Promise(resolve => {
    if (!queued.length) {
      setTimeout(flushQueue, 0);
    }
    queued.push({ entry, resolve });
  });
}

type QueryContext = Awaited<ReturnType<typeof buildV1ChartDataPayload>>;

type Prebuilt = {
  signature: string;
  ownState: string;
  queryContext: QueryContext;
};

/*
 * The query context built for a chart's check, kept for the chart-data request
 * of the same form data and own state, which would build the same one.
 * Explore's request posts a copy of the checked form data, so its one query
 * context is kept apart and matched by value.
 */
const prebuilt = new WeakMap<object, Prebuilt>();
let explorePrebuilt: Prebuilt | undefined;

/** Keep the query context Explore's check built, for its next request. */
export function keepExploreQueryContext(
  formData: ChartFormData,
  ownState: JsonObject | undefined,
  queryContext: QueryContext,
) {
  explorePrebuilt = {
    signature: chartSignature(formData),
    ownState: JSON.stringify(ownState ?? {}),
    queryContext,
  };
}

/**
 * The query context the check of `formData` built, once; `undefined` when the
 * check built none for this form data and own state.
 */
export function takePrebuiltQueryContext(
  formData: ChartFormData,
  ownState: JsonObject | undefined,
  force: boolean,
): QueryContext | undefined {
  const entry = prebuilt.get(formData) ?? explorePrebuilt;
  prebuilt.delete(formData);
  explorePrebuilt = undefined;
  if (
    !entry ||
    entry.signature !== chartSignature(formData) ||
    entry.ownState !== JSON.stringify(ownState ?? {})
  ) {
    return undefined;
  }
  const { queryContext } = entry;
  return queryContext.force === force
    ? queryContext
    : {
        ...queryContext,
        force,
        form_data: { ...queryContext.form_data, force } as QueryFormData,
      };
}

/** The body the chart-data request sends, as the endpoint takes it. */
async function chartRangesEntry(
  key: string,
  formData: ChartFormData,
  ownState: JsonObject,
): Promise<ChartRangesEntry> {
  const queryContext = await buildV1ChartDataPayload({
    formData: formData as QueryFormData,
    force: false,
    resultFormat: 'json',
    resultType: 'full',
    setDataMask: () => {},
    ownState,
  });
  prebuilt.set(formData, {
    signature: chartSignature(formData),
    ownState: JSON.stringify(ownState),
    queryContext,
  });
  return { key, query_context: queryContext as unknown as JsonObject };
}

/**
 * Whether no level that judges the chart (the global policy, the chart's
 * dataset and the dashboard) sets a rule, so its ranges can't fail.
 */
function hasNoRule(
  payload: DashboardLimitsPayload,
  formData: ChartFormData,
): boolean {
  const [datasetId, type] = String(formData.datasource ?? '').split('__');
  if (!/^\d+$/.test(datasetId) || type !== 'table') {
    return false;
  }
  if (
    (payload.datasets ?? []).some(
      dataset => dataset.id === Number(datasetId) && dataset.error,
    )
  ) {
    return false;
  }
  return !hasLimits(
    dashboardLimitLevels({
      ...payload,
      datasets: (payload.datasets ?? []).filter(
        dataset => dataset.id === Number(datasetId),
      ),
    }),
  );
}

const levelsOf = (
  payload: DashboardLimitsPayload | null,
): ChartRangesLevels => ({
  global: payload?.global ?? null,
  dashboard: payload?.dashboard ?? null,
  datasets: payload?.datasets ?? [],
});

/**
 * The Time Range filter whose value reached the chart, by the dashboard's own merge
 * (`getExtraFormData`): the last filter in the chart's scope, in `dataMask`
 * order, that sets `time_range`.
 */
export function timeRangeFilterOfChart(
  chartId: number,
  formData: ChartFormData,
  state: LimitsState,
): { filterId: string; value: string } | null {
  const nativeFilters = state.nativeFilters?.filters ?? {};
  const activeFilters = getAllActiveFilters({
    chartConfiguration: state.dashboardInfo?.metadata?.chart_configuration,
    nativeFilters,
    dataMask: state.dataMask,
    allSliceIds: state.dashboardState?.sliceIds ?? [],
  });
  const lastSetter = Object.entries(activeFilters)
    .filter(([, filter]) => filter.scope.includes(chartId))
    .map(([filterId]) => filterId)
    .filter(
      filterId =>
        state.dataMask[filterId]?.extraFormData?.time_range !== undefined,
    )
    .pop();
  if (
    !lastSetter ||
    (nativeFilters[lastSetter] as { filterType?: string } | undefined)
      ?.filterType !== 'filter_time'
  ) {
    return null;
  }
  const value = state.dataMask[lastSetter]?.extraFormData?.time_range;
  const reached = (formData.extra_form_data as JsonObject | undefined)
    ?.time_range;
  return typeof value === 'string' && value === reached
    ? { filterId: lastSetter, value }
    : null;
}

/**
 * Where each failing range came from. A `time_range` range is the filter's
 * only when a filter's value reached the chart; so is a `granularity` range,
 * which the server builds from the query's `time_range`, i.e. that same value.
 * Every other origin, or none, is the chart's own range.
 */
export function attributeChartFailures(
  failures: ChartRangeFailure[],
  filter: { filterId: string; value: string } | null,
): ChartHoldAttribution {
  let filterSourced = false;
  let chartOwn = false;
  failures.forEach(({ range }) => {
    if (!range.source?.length) {
      chartOwn = true;
      return;
    }
    range.source.forEach(({ kind }) => {
      if (filter && (kind === 'time_range' || kind === 'granularity')) {
        filterSourced = true;
      } else {
        chartOwn = true;
      }
    });
  });
  return {
    filterId: filterSourced && filter ? filter.filterId : null,
    filterValue: filterSourced && filter ? filter.value : null,
    chart: chartOwn,
  };
}

/** Per store, the checks still waiting for their answer, by dashboard, chart and request. */
const runningChecks = new WeakMap<
  () => LimitsState,
  Map<string, Promise<boolean>>
>();

function runChartRangesCheck(
  chartId: number,
  formData: ChartFormData,
  ownState: JsonObject,
) {
  return async (
    dispatch: LimitsDispatch,
    getState: () => LimitsState,
  ): Promise<boolean> => {
    const signature = chartSignature(formData);
    const { dashboardId, payload } = getState().timeRangeLimits;
    if (payload && hasNoRule(payload, formData)) {
      holdChart(dispatch, dashboardId, chartId, { signature, status: 'valid' });
      return true;
    }
    const rejected = (hold?: ChartHold) =>
      hold?.signature === signature && hold.status === 'rejected';
    if (!rejected(getState().timeRangeLimits.charts[chartId])) {
      holdChart(dispatch, dashboardId, chartId, {
        signature,
        status: 'checking',
      });
    }
    lastKey += 1;
    const key = String(lastKey);
    const entry = chartRangesEntry(key, formData, ownState).catch(() => null);
    const calls = await queueChartRanges(entry);
    const built = await entry;

    const state = getState();
    const current = state.timeRangeLimits.charts[chartId];
    if (
      state.timeRangeLimits.dashboardId !== dashboardId ||
      current?.signature !== signature ||
      chartHoldMode(state.timeRangeLimits) !== 'on'
    ) {
      return false;
    }
    if (!built) {
      // No request can be built either: let the chart run it and show its error.
      holdChart(dispatch, dashboardId, chartId, { signature, status: 'valid' });
      return true;
    }
    const judgement = judgeChartRanges(
      calls.filter(call => call.keys.includes(key)),
      levelsOf(state.timeRangeLimits.payload),
    )[key] ?? { status: 'unavailable' };

    if (judgement.status === 'valid') {
      holdChart(dispatch, dashboardId, chartId, { signature, status: 'valid' });
      return true;
    }
    if (judgement.status === 'invalid' || judgement.status === 'unbounded') {
      // A rejected chart stays rejected; its failures only name the source.
      holdChart(dispatch, dashboardId, chartId, {
        signature,
        status: rejected(current) ? 'rejected' : judgement.status,
        failures: judgement.failures,
        attribution: attributeChartFailures(
          judgement.failures,
          timeRangeFilterOfChart(chartId, formData, state),
        ),
      });
      return false;
    }
    if (judgement.status === 'error') {
      holdChart(dispatch, dashboardId, chartId, {
        signature,
        status: 'error',
        error: judgement.error,
      });
      const parsed = await getClientErrorObject(
        new Response(JSON.stringify(judgement.error.body), {
          status: judgement.error.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      dispatch(chartUpdateFailed([parsed as unknown as JsonObject], chartId));
      return false;
    }
    holdChart(dispatch, dashboardId, chartId, {
      signature,
      status: 'unavailable',
    });
    dispatch(chartUpdateStopped(chartId));
    return false;
  };
}

/**
 * Check one chart's request before it runs: its ranges from the chart ranges
 * endpoint (one call per tick for every chart that asks), judged with the
 * chart's own levels. Resolves `true` only when the request may be sent. A
 * chart the server rejected keeps its rejection while its ranges still fail.
 * The same check asked again while it runs gets the running one.
 */
export function checkChartRanges(
  chartId: number,
  formData: ChartFormData,
  ownState: JsonObject = {},
) {
  return (
    dispatch: LimitsDispatch,
    getState: () => LimitsState,
  ): Promise<boolean> => {
    const key = JSON.stringify([
      getState().timeRangeLimits.dashboardId,
      chartId,
      chartSignature(formData),
      ownState,
    ]);
    const running = runningChecks.get(getState) ?? new Map();
    runningChecks.set(getState, running);
    const pending = running.get(key);
    if (pending) {
      return pending;
    }
    const check = runChartRangesCheck(
      chartId,
      formData,
      ownState,
    )(dispatch, getState).finally(() => running.delete(key));
    running.set(key, check);
    return check;
  };
}

/**
 * A chart the server answered with a date-range error (400, or 503
 * `POLICY_UNAVAILABLE`): it keeps the chart's display of the server's message and
 * isn't posted again while its ranges fail, and the limits are loaded again
 * once.
 */
export function noteChartRejection(chartId: number) {
  return (dispatch: LimitsDispatch, getState: () => LimitsState): void => {
    const state = getState();
    const limits = state.timeRangeLimits;
    const chart = state.charts[chartId];
    const error = (chart?.queriesResponse?.[0] as JsonObject | undefined)
      ?.errors?.[0];
    if (
      limits?.status === 'off' ||
      limits?.dashboardId === null ||
      !isFeatureEnabled(FeatureFlag.TimeRangeLimits) ||
      chart?.chartStatus !== 'failed' ||
      error?.error_type !== ErrorTypeEnum.TIME_RANGE_LIMIT_ERROR ||
      !chart.latestQueryFormData ||
      Object.keys(chart.latestQueryFormData).length === 0
    ) {
      return;
    }
    const signature = chartSignature(chart.latestQueryFormData);
    const hold = limits.charts[chartId];
    if (
      hold?.status === 'error' ||
      (hold?.signature === signature && hold.status === 'rejected')
    ) {
      return;
    }
    holdChart(dispatch, limits.dashboardId, chartId, {
      signature,
      status: 'rejected',
    });
    if (limits.status !== 'loading') {
      dispatch(fetchTimeRangeLimits(limits.dashboardId));
    }
  };
}
