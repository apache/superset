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
import { ControlStateMapping } from '@superset-ui/chart-controls';
import {
  FeatureFlag,
  isFeatureEnabled,
  JsonObject,
  SupersetClient,
  type Level,
  type Policy,
  type QueryFormData,
} from '@superset-ui/core';
import { isEmpty, omit } from 'lodash-es';
import { Dispatch } from 'redux';
import { triggerQuery } from 'src/components/Chart/chartAction';
import {
  allFailures,
  ChartRangeFailure,
  ChartRangeSource,
  DashboardLimitsPayload,
  describeFailure,
  exploreLimitLevels,
  hasLimits,
  NO_LIMITS,
  parseServerDate,
} from 'src/utils/timeRangeLimits';

/** `time_range_limits` of `GET /api/v1/explore/`. */
export type ExploreLimitsPayload = {
  global?: Policy | null;
  dataset?: Policy | null;
  timezone?: string;
  error?: JsonObject;
};

/** The dashboard policy of the page's `dashboardId`, once the check names it. */
export type ExploreDashboardLimits = { id: number } & (
  | { status: 'loading' }
  | { status: 'loaded'; policy: Policy | null }
  | { status: 'absent' }
  | { status: 'failed' }
);

export type ExploreTimeRangeLimits = {
  refreshing?: boolean;
  dashboard?: ExploreDashboardLimits;
} & (
  | { status: 'failed' }
  | {
      status: 'loaded';
      levels: Level[];
      timezone?: string;
      datasetId: number | null;
    }
);

export type TimeRangeCheckStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'unbounded'
  | 'error'
  | 'unavailable';

export type ExploreTimeRangeCheck = {
  key: string;
  status: TimeRangeCheckStatus;
  failures: ChartRangeFailure[];
  // The errors this check put on each control, and those it puts on Update chart.
  controlErrors: Record<string, string[]>;
  buttonErrors: string[];
  // Why each fixed choice of a time comparison control breaks a limit, by
  // control and option; the options are disabled with it.
  optionReasons: Record<string, Record<string, string>>;
};

/** The run a guard held back: the page-open run, or `onQuery`. */
export type TimeRangeRunOnValid = 'mount' | 'query';

/** A request to focus the first of these controls in the control panel. */
export type TimeRangeFocusRequest = { id: number; controls: string[] };

type LimitsExploreState = {
  controls?: ControlStateMapping;
  form_data?: QueryFormData;
  slice?: { slice_id?: number } | null;
  datasource?: { id: number; type: string };
  timeRangeLimits?: ExploreTimeRangeLimits;
  timeRangeCheck?: ExploreTimeRangeCheck;
};

export type LimitsRootState = {
  explore: LimitsExploreState;
  dataMask?: Record<number, { ownState?: JsonObject }>;
};

const REQUEST = { timeout: 10000, fetchRetryOptions: { retries: 0 } };

/**
 * The Explore policy state for the load payload: nothing with the flag off or
 * no payload, `failed` for an `{ error }` payload.
 */
export function exploreLimitsState(
  payload: ExploreLimitsPayload | undefined,
  datasetId: number | null,
): ExploreTimeRangeLimits | undefined {
  if (!isFeatureEnabled(FeatureFlag.TimeRangeLimits)) {
    return undefined;
  }
  if (!payload) {
    return undefined;
  }
  if (payload.error) {
    return { status: 'failed' };
  }
  return {
    status: 'loaded',
    levels: exploreLimitLevels(payload),
    timezone: payload.timezone,
    datasetId,
  };
}

/** The page's `dashboardId`, as `ExploreViewContainer` reads it. */
export function exploreDashboardId(
  formData: QueryFormData | undefined,
): number | undefined {
  const id = Number(formData?.dashboardId);
  return Number.isNaN(id) ? undefined : id;
}

export const limitsFailed = (limits: ExploreTimeRangeLimits | undefined) =>
  limits?.status === 'failed' || limits?.dashboard?.status === 'failed';

/**
 * Whether Explore checks its runs: a policy was loaded (or failed to load),
 * and a level sets a rule or the dashboard limits are still unknown.
 */
export function exploreLimitsOn(
  limits: ExploreTimeRangeLimits | undefined,
  dashboardId: number | undefined,
): boolean {
  if (!limits) {
    return false;
  }
  if (limits.status === 'failed') {
    return true;
  }
  if (hasLimits(limits.levels)) {
    return true;
  }
  if (dashboardId === undefined) {
    return false;
  }
  const { dashboard } = limits;
  if (dashboard?.id !== dashboardId) {
    return true;
  }
  if (dashboard.status === 'absent') {
    return false;
  }
  return (
    dashboard.status !== 'loaded' ||
    hasLimits([{ source: 'dashboard', policy: dashboard.policy }])
  );
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stable((value as JsonObject)[key])]),
    );
  }
  return value;
};

/**
 * What the check's answer is valid for: the controls Explore's "chart is stale"
 * rule watches (not `renderTrigger`, not `dontRefreshOnChange`), the chart's
 * own state and the page's `dashboardId`.
 */
export function timeRangeCheckKey(
  controls: ControlStateMapping,
  ownState: JsonObject | undefined,
  dashboardId: number | undefined,
): string {
  // The chart's view state (`clientView`, `chartState`) sends no query, and an
  // empty own state is no own state.
  const queryOwnState = omit(ownState ?? {}, ['clientView', 'chartState']);
  const values = Object.keys(controls)
    .filter(
      name =>
        !controls[name]?.renderTrigger && !controls[name]?.dontRefreshOnChange,
    )
    .map(name => [name, controls[name]?.value]);
  return JSON.stringify(
    stable({
      values: Object.fromEntries(values),
      ownState: isEmpty(queryOwnState) ? null : queryOwnState,
      dashboardId: dashboardId ?? null,
    }),
  );
}

/** `timeRangeCheckKey` from the store, as `ExploreViewContainer` reads it. */
export function exploreCheckKey(state: LimitsRootState): string {
  const { explore, dataMask } = state;
  const controls = explore.controls ?? {};
  const sliceId = Number(
    controls.slice_id?.value ?? explore.slice?.slice_id ?? 0,
  );
  return timeRangeCheckKey(
    controls,
    dataMask?.[sliceId]?.ownState,
    exploreDashboardId(explore.form_data),
  );
}

/** Whether a chart request with this key may leave Explore. */
export function exploreRunAllowed(
  limits: ExploreTimeRangeLimits | undefined,
  check: ExploreTimeRangeCheck | undefined,
  key: string,
): boolean {
  return (
    limits?.status === 'loaded' &&
    !limits.refreshing &&
    !limitsFailed(limits) &&
    limits.dashboard?.status !== 'loading' &&
    check?.key === key &&
    (check.status === 'valid' || check.status === 'error')
  );
}

/** Whether the check for this key answered with a range that can't run. */
export const exploreRunRefused = (
  check: ExploreTimeRangeCheck | undefined,
  key: string,
) =>
  check?.key === key &&
  (check.status === 'invalid' || check.status === 'unbounded');

const sameRange = (a: ChartRangeFailure, b: ChartRangeFailure) =>
  a.reason === b.reason &&
  a.range.since === b.range.since &&
  a.range.until === b.range.until &&
  a.range.time_offset === b.range.time_offset;

const failureMessage = (failure: ChartRangeFailure) => {
  if (failure.reason !== 'UNBOUNDED_RANGE') {
    return describeFailure(failure);
  }
  // The judge words an open range for the dashboard screen when the dashboard
  // limit applies; Explore keeps the picker's own text.
  const [unbounded] = allFailures(
    {
      since: parseServerDate(failure.range.since),
      until: parseServerDate(failure.range.until),
    },
    NO_LIMITS,
    { timeOffset: failure.range.time_offset ?? undefined },
  );
  return unbounded ? describeFailure(unbounded) : describeFailure(failure);
};

/**
 * The control each failing range came from, read from the range's `source`.
 * A series limit range of a chart with no series limit goes on its
 * `time_range` control. A range with no source, or
 * whose source maps to no control, goes on the chart's first time control:
 * `time_range`, else the filters (both queries' filters for Mixed Timeseries),
 * else Update chart. The same failure on the same range is shown once.
 */
export function timeRangeCheckErrors(
  failures: ChartRangeFailure[],
  {
    controls,
    formData,
  }: {
    controls: ControlStateMapping;
    formData: QueryFormData;
  },
): Pick<ExploreTimeRangeCheck, 'controlErrors' | 'buttonErrors'> {
  const has = (name: string) => (name in controls ? name : null);
  const seriesLimit = Boolean(formData.limit || formData.series_limit);
  const controlFor = ({ kind, query_index: query }: ChartRangeSource) => {
    const suffix = query === 1 ? '_b' : '';
    const filters = has(`adhoc_filters${suffix}`);
    const comparison = has(`time_compare${suffix}`);
    switch (kind) {
      case 'time_range':
        return has('time_range') ?? filters;
      case 'granularity':
      case 'adhoc_filter':
        return filters;
      case 'time_comparison':
        return comparison;
      case 'time_shift':
        return has('time_shift') ?? comparison;
      case 'series_limit':
        return seriesLimit
          ? (has('limit') ?? has('series_limit'))
          : has('time_range');
      default:
        return null;
    }
  };
  const timeControls = has('time_range')
    ? ['time_range']
    : [has('adhoc_filters'), has('adhoc_filters_b')].filter(
        (name): name is string => name !== null,
      );
  const shown = failures.filter(
    failure =>
      !failure.range.source?.some(origin => origin.kind === 'series_limit') ||
      !failures.some(
        other =>
          other !== failure &&
          !other.range.source?.some(origin => origin.kind === 'series_limit') &&
          sameRange(other, failure),
      ),
  );
  const controlErrors: Record<string, string[]> = {};
  const buttonErrors: string[] = [];
  const add = (list: string[], message: string) => {
    if (!list.includes(message)) {
      list.push(message);
    }
  };
  shown.forEach(failure => {
    const message = failureMessage(failure);
    const named = [
      ...new Set(
        (failure.range.source ?? [])
          .map(controlFor)
          .filter((name): name is string => name !== null),
      ),
    ];
    const names = named.length ? named : timeControls;
    if (!names.length) {
      add(buttonErrors, message);
      return;
    }
    names.forEach(name => {
      controlErrors[name] = controlErrors[name] ?? [];
      add(controlErrors[name], message);
    });
  });
  return { controlErrors, buttonErrors };
}

export const SET_EXPLORE_TIME_RANGE_LIMITS =
  'SET_EXPLORE_TIME_RANGE_LIMITS' as const;
export function setExploreTimeRangeLimits(
  limits: ExploreTimeRangeLimits | undefined,
) {
  return { type: SET_EXPLORE_TIME_RANGE_LIMITS, limits };
}

export const SET_TIME_RANGE_CHECK = 'SET_TIME_RANGE_CHECK' as const;
/**
 * Store the check of the current request and put its errors on the controls
 * the failing ranges came from, replacing the last check's errors.
 */
export function setTimeRangeCheck(
  check: Pick<ExploreTimeRangeCheck, 'key' | 'status'> &
    Partial<ExploreTimeRangeCheck>,
) {
  return {
    type: SET_TIME_RANGE_CHECK,
    check: {
      failures: [],
      controlErrors: {},
      buttonErrors: [],
      optionReasons: {},
      ...check,
    } as ExploreTimeRangeCheck,
  };
}

export const SET_TIME_RANGE_RUN_ON_VALID =
  'SET_TIME_RANGE_RUN_ON_VALID' as const;
export function setTimeRangeRunOnValid(run: TimeRangeRunOnValid | null) {
  return { type: SET_TIME_RANGE_RUN_ON_VALID, run };
}

export const REQUEST_TIME_RANGE_FOCUS = 'REQUEST_TIME_RANGE_FOCUS' as const;
let lastFocusRequest = 0;
/**
 * Ask the control panel to focus the first of these controls (the Data tab,
 * its section opened); `null` once it is done.
 */
export function requestTimeRangeFocus(controls: string[] | null) {
  lastFocusRequest += 1;
  return {
    type: REQUEST_TIME_RANGE_FOCUS,
    request: controls
      ? ({ id: lastFocusRequest, controls } as TimeRangeFocusRequest)
      : null,
  };
}

export type TimeRangeLimitsAction =
  | ReturnType<typeof setExploreTimeRangeLimits>
  | ReturnType<typeof setTimeRangeCheck>
  | ReturnType<typeof setTimeRangeRunOnValid>
  | ReturnType<typeof requestTimeRangeFocus>;

const responseStatus = (error: unknown) =>
  (error as { status?: number } | undefined)?.status;

async function loadDashboardLimits(
  id: number,
): Promise<ExploreDashboardLimits> {
  try {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${id}/time_range_limits/`,
      ...REQUEST,
    });
    return {
      id,
      status: 'loaded',
      policy: (json as { result: Pick<DashboardLimitsPayload, 'dashboard'> })
        .result.dashboard,
    };
  } catch (error) {
    const status = responseStatus(error);
    return status === 403 || status === 404
      ? { id, status: 'absent' }
      : { id, status: 'failed' };
  }
}

/**
 * Load the policy of the dashboard the check named, once per page: a 403 or
 * 404 means no dashboard level, any other error or no answer in 10 s fails.
 */
export function fetchExploreDashboardLimits(id: number) {
  return async (dispatch: Dispatch, getState: () => LimitsRootState) => {
    const limits = getState().explore.timeRangeLimits;
    if (!limits || limits.dashboard?.id === id) {
      return;
    }
    dispatch(
      setExploreTimeRangeLimits({
        ...limits,
        dashboard: { id, status: 'loading' },
      }),
    );
    const dashboard = await loadDashboardLimits(id);
    const current = getState().explore.timeRangeLimits;
    if (current?.dashboard?.id === id) {
      dispatch(setExploreTimeRangeLimits({ ...current, dashboard }));
    }
  };
}

/**
 * Read the limits again for the current dataset: `GET /api/v1/explore/` with
 * the dataset in the store, plus the dashboard policy when the check named
 * one. One request set per call, no retry.
 */
let latestRefresh = 0;

export function refreshExploreTimeRangeLimits() {
  return async (dispatch: Dispatch, getState: () => LimitsRootState) => {
    const { explore } = getState();
    const limits = explore.timeRangeLimits;
    if (
      !isFeatureEnabled(FeatureFlag.TimeRangeLimits) ||
      !limits ||
      !explore.datasource
    ) {
      return;
    }
    const { id, type } = explore.datasource;
    const dashboardId = limits.dashboard?.id;
    latestRefresh += 1;
    const call = latestRefresh;
    dispatch(setExploreTimeRangeLimits({ ...limits, refreshing: true }));
    const [payload, dashboard] = await Promise.all([
      SupersetClient.get({
        endpoint: `/api/v1/explore/?datasource_id=${id}&datasource_type=${type}`,
        ...REQUEST,
      })
        .then(
          ({ json }) =>
            (json as { result?: { time_range_limits?: JsonObject } }).result
              ?.time_range_limits as ExploreLimitsPayload,
        )
        .catch(() => ({ error: {} })),
      dashboardId === undefined ? undefined : loadDashboardLimits(dashboardId),
    ]);
    if (call !== latestRefresh) {
      return;
    }
    const current = getState().explore;
    if (current.datasource?.id !== id) {
      if (current.timeRangeLimits) {
        dispatch(
          setExploreTimeRangeLimits({
            ...current.timeRangeLimits,
            refreshing: false,
          }),
        );
      }
      return;
    }
    const next = exploreLimitsState(payload ?? { error: {} }, id);
    dispatch(
      setExploreTimeRangeLimits(
        next && {
          ...next,
          refreshing: false,
          ...(dashboard && { dashboard }),
        },
      ),
    );
  };
}

/**
 * The OAuth2 retry of an Explore chart: unchanged without limits; with limits, it
 * runs only when the check is valid for the current request, else once the
 * check answers valid.
 */
export function retryExploreQuery(chartId: number) {
  return (dispatch: Dispatch, getState: () => LimitsRootState) => {
    const state = getState();
    const { explore } = state;
    if (
      !exploreLimitsOn(
        explore?.timeRangeLimits,
        exploreDashboardId(explore?.form_data),
      ) ||
      exploreRunAllowed(
        explore.timeRangeLimits,
        explore.timeRangeCheck,
        exploreCheckKey(state),
      )
    ) {
      dispatch(triggerQuery(true, chartId));
      return;
    }
    dispatch(setTimeRangeRunOnValid('mount'));
  };
}

export const timeRangeLimitsActions = {
  setTimeRangeCheck,
  setTimeRangeRunOnValid,
  requestTimeRangeFocus,
  fetchExploreDashboardLimits,
  refreshExploreTimeRangeLimits,
};
