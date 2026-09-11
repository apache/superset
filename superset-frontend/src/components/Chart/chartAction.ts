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
/* eslint no-param-reassign: ["error", { "props": false }] */
import {
  FeatureFlag,
  isDefined,
  SupersetClient,
  isFeatureEnabled,
  getClientErrorObject,
  QueryFormData,
  JsonObject,
  QueryData,
  AnnotationLayer,
  DataMask,
  DatasourceType,
  LatestQueryFormData,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { ControlStateMapping } from '@superset-ui/chart-controls';
import { getControlsState } from 'src/explore/store';
import {
  getAnnotationJsonUrl,
  buildV1ChartDataPayload,
  getQuerySettings,
  getChartDataUri,
} from 'src/explore/exploreUtils';
import {
  addDangerToast,
  addWarningToast,
} from 'src/components/MessageToasts/actions';
import { logEvent } from 'src/logger/actions';
import { Logger, LOG_ACTIONS_LOAD_CHART } from 'src/logger/LogUtils';
import { allowCrossDomain as domainShardingEnabled } from 'src/utils/hostNamesConfig';
import { updateDataMask } from 'src/dataMask/actions';
import { AsyncJob, waitForAsyncData } from 'src/middleware/asyncEvent';
import { getTabId } from 'src/hooks/useTabId';
import {
  resolveAsyncMode,
  selectAsyncModeOverride,
  AsyncModeOverride,
} from 'src/utils/asyncMode';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import { safeStringify } from 'src/utils/safeStringify';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import type { Dispatch, Action, AnyAction } from 'redux';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import type { History } from 'history';
import type { ChartState } from 'src/explore/types';

// Types for the Redux state
export interface ChartsState {
  [key: string]: ChartState;
}

export interface CommonState {
  conf: {
    SUPERSET_WEBSERVER_TIMEOUT?: number;
    [key: string]: unknown;
  };
}

export interface DashboardInfoState {
  common: CommonState;
  // Parsed dashboard json_metadata (when rendering within a dashboard); its
  // `async_mode` is the per-dashboard async override.
  metadata?: { async_mode?: AsyncModeOverride } & JsonObject;
}

export interface DataMaskState {
  [key: number]: {
    ownState?: JsonObject;
  };
}

// RootState uses flexible types to accommodate various state shapes
// across dashboard and explore views
export interface RootState {
  charts: ChartsState;
  common: CommonState;
  dashboardInfo: DashboardInfoState;
  dataMask: DataMaskState;
  explore: {
    form_data: QueryFormData;
    datasource?: { type: string };
    common?: { conf: { DEFAULT_VIZ_TYPE?: string } };
    [key: string]: unknown;
  };
}

// Action types
export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED' as const;
export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED' as const;
export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED' as const;
export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED' as const;
export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED' as const;
export const CHART_RENDERING_SUCCEEDED = 'CHART_RENDERING_SUCCEEDED' as const;
export const REMOVE_CHART = 'REMOVE_CHART' as const;
export const ANNOTATION_QUERY_SUCCESS = 'ANNOTATION_QUERY_SUCCESS' as const;
export const ANNOTATION_QUERY_STARTED = 'ANNOTATION_QUERY_STARTED' as const;
export const ANNOTATION_QUERY_FAILED = 'ANNOTATION_QUERY_FAILED' as const;
export const DYNAMIC_PLUGIN_CONTROLS_READY =
  'DYNAMIC_PLUGIN_CONTROLS_READY' as const;
export const TRIGGER_QUERY = 'TRIGGER_QUERY' as const;
export const RENDER_TRIGGERED = 'RENDER_TRIGGERED' as const;
export const UPDATE_QUERY_FORM_DATA = 'UPDATE_QUERY_FORM_DATA' as const;
export const UPDATE_CHART_ID = 'UPDATE_CHART_ID' as const;
export const ADD_CHART = 'ADD_CHART' as const;

// Action interfaces
export interface ChartUpdateStartedAction {
  type: typeof CHART_UPDATE_STARTED;
  queryController: AbortController;
  latestQueryFormData: QueryFormData | LatestQueryFormData;
  key: string | number;
}

export interface ChartUpdateSucceededAction {
  type: typeof CHART_UPDATE_SUCCEEDED;
  queriesResponse: QueryData[];
  key: string | number;
}

export interface ChartUpdateStoppedAction {
  type: typeof CHART_UPDATE_STOPPED;
  key: string | number;
  queryController?: AbortController;
}

export interface ChartUpdateFailedAction {
  type: typeof CHART_UPDATE_FAILED;
  queriesResponse: QueryData[] | JsonObject[];
  key: string | number;
}

export interface ChartRenderingFailedAction {
  type: typeof CHART_RENDERING_FAILED;
  error: string;
  key: string | number;
  stackTrace: string | null;
}

export interface ChartRenderingSucceededAction {
  type: typeof CHART_RENDERING_SUCCEEDED;
  key: string | number;
}

export interface RemoveChartAction {
  type: typeof REMOVE_CHART;
  key: string | number;
}

export interface AnnotationQuerySuccessAction {
  type: typeof ANNOTATION_QUERY_SUCCESS;
  annotation: AnnotationLayer;
  queryResponse: { data: unknown } | JsonObject;
  key: string | number;
}

export interface AnnotationQueryStartedAction {
  type: typeof ANNOTATION_QUERY_STARTED;
  annotation: AnnotationLayer;
  queryController: AbortController;
  key: string | number;
}

export interface AnnotationQueryFailedAction {
  type: typeof ANNOTATION_QUERY_FAILED;
  annotation: AnnotationLayer;
  queryResponse: { error: string } | JsonObject;
  key: string | number;
}

export interface DynamicPluginControlsReadyAction {
  type: typeof DYNAMIC_PLUGIN_CONTROLS_READY;
  key: string | number;
  controlsState: ControlStateMapping;
}

export interface TriggerQueryAction {
  type: typeof TRIGGER_QUERY;
  value: boolean;
  key: string | number;
}

export interface RenderTriggeredAction {
  type: typeof RENDER_TRIGGERED;
  value: number;
  key: string | number;
}

export interface UpdateQueryFormDataAction {
  type: typeof UPDATE_QUERY_FORM_DATA;
  value: QueryFormData | LatestQueryFormData;
  key: string | number;
}

export interface UpdateChartIdAction {
  type: typeof UPDATE_CHART_ID;
  newId: number;
  key: string | number;
}

export interface AddChartAction {
  type: typeof ADD_CHART;
  chart: ChartState;
  key: string | number;
}

export type ChartAction =
  | ChartUpdateStartedAction
  | ChartUpdateSucceededAction
  | ChartUpdateStoppedAction
  | ChartUpdateFailedAction
  | ChartRenderingFailedAction
  | ChartRenderingSucceededAction
  | RemoveChartAction
  | AnnotationQuerySuccessAction
  | AnnotationQueryStartedAction
  | AnnotationQueryFailedAction
  | DynamicPluginControlsReadyAction
  | TriggerQueryAction
  | RenderTriggeredAction
  | UpdateQueryFormDataAction
  | UpdateChartIdAction
  | AddChartAction;

// Type for thunk actions
export type ChartThunkDispatch = ThunkDispatch<RootState, undefined, AnyAction>;
export type ChartThunkAction<R = void> = ThunkAction<
  R,
  RootState,
  undefined,
  AnyAction
>;

// Request params interface
export interface RequestParams {
  signal?: AbortSignal;
  timeout?: number;
  dashboard_id?: number;
  mode?: string;
  credentials?: RequestCredentials;
  // Per-dashboard async-mode override (from json_metadata.async_mode). Resolves
  // whether this render requests async execution; never sent to the server as a
  // request option.
  async_mode_override?: AsyncModeOverride;
  [key: string]: unknown;
}

// Query settings type
export interface QuerySettings extends RequestParams {
  url?: string;
  postPayload?: { form_data: QueryFormData | LatestQueryFormData };
  parseMethod?: string;
  headers?: Record<string, string>;
  body?: string;
}

// API response type for chart data request. A 200 carries the query results in
// `result`; a 202 carries the async job whose tasks must be awaited instead (its
// body has no `result`, which only `requestChartDataResolved` has to reason
// about — every other consumer reads a synchronous response).
export interface ChartDataRequestResponse {
  response: Response;
  json: { result: QueryData[] } & Partial<AsyncJob>;
}

// getChartDataRequest params interface
export interface GetChartDataRequestParams {
  formData: QueryFormData | LatestQueryFormData;
  setDataMask?: (dataMask: DataMask) => void;
  resultFormat?: string;
  resultType?: string;
  force?: boolean;
  // Forced-refresh idempotency tokens for the synchronous read-back: each is the
  // async task's UUID for the query at the same index (from the 202 `task_ids`),
  // so a forced refresh reads the result its task warmed instead of recomputing
  // (see requestChartDataResolved). Only meaningful with `force`.
  queryForceNonces?: string[];
  requestParams?: RequestParams;
  ownState?: JsonObject;
  // Opt into asynchronous execution. Only set by callers that handle an HTTP 202
  // task response (via requestChartDataResolved / handleChartDataResponse);
  // direct consumers that read `response.json.result` must leave this false so
  // they keep the synchronous flow.
  enableAsyncMode?: boolean;
}

// runAnnotationQuery params interface
// Extended annotation layer with optional overrides for time range
// Using type intersection instead of interface extension because
// AnnotationLayer may have dynamic members
type AnnotationLayerWithOverrides = AnnotationLayer & {
  overrides?: Record<string, unknown>;
};

export interface RunAnnotationQueryParams {
  annotation: AnnotationLayerWithOverrides;
  timeout?: number;
  formData?: QueryFormData | LatestQueryFormData;
  key?: string | number;
  isDashboardRequest?: boolean;
  force?: boolean;
}

// Datasource samples params interface
export interface DatasourceSamplesSearchParams {
  force: boolean;
  datasource_type: DatasourceType;
  datasource_id: number;
  dashboard_id?: number;
  per_page?: number;
  page?: number;
}

// Action creators
export function chartUpdateStarted(
  queryController: AbortController,
  latestQueryFormData: QueryFormData | LatestQueryFormData,
  key: string | number,
): ChartUpdateStartedAction {
  return {
    type: CHART_UPDATE_STARTED,
    queryController,
    latestQueryFormData,
    key,
  };
}

export function chartUpdateSucceeded(
  queriesResponse: QueryData[],
  key: string | number,
): ChartUpdateSucceededAction {
  return { type: CHART_UPDATE_SUCCEEDED, queriesResponse, key };
}

export function chartUpdateStopped(
  key: string | number,
  queryController?: AbortController,
): ChartUpdateStoppedAction {
  return { type: CHART_UPDATE_STOPPED, key, queryController };
}

export function chartUpdateFailed(
  queriesResponse: QueryData[] | JsonObject[],
  key: string | number,
): ChartUpdateFailedAction {
  return { type: CHART_UPDATE_FAILED, queriesResponse, key };
}

export function chartRenderingFailed(
  error: string,
  key: string | number,
  stackTrace: string | null,
): ChartRenderingFailedAction {
  return { type: CHART_RENDERING_FAILED, error, key, stackTrace };
}

export function chartRenderingSucceeded(
  key: string | number,
): ChartRenderingSucceededAction {
  return { type: CHART_RENDERING_SUCCEEDED, key };
}

export function removeChart(key: string | number): RemoveChartAction {
  return { type: REMOVE_CHART, key };
}

export function annotationQuerySuccess(
  annotation: AnnotationLayer,
  queryResponse: { data: unknown } | JsonObject,
  key: string | number,
): AnnotationQuerySuccessAction {
  return { type: ANNOTATION_QUERY_SUCCESS, annotation, queryResponse, key };
}

export function annotationQueryStarted(
  annotation: AnnotationLayer,
  queryController: AbortController,
  key: string | number,
): AnnotationQueryStartedAction {
  return { type: ANNOTATION_QUERY_STARTED, annotation, queryController, key };
}

export function annotationQueryFailed(
  annotation: AnnotationLayer,
  queryResponse: { error: string } | JsonObject,
  key: string | number,
): AnnotationQueryFailedAction {
  return { type: ANNOTATION_QUERY_FAILED, annotation, queryResponse, key };
}

export const dynamicPluginControlsReady =
  (): ChartThunkAction =>
  (dispatch: Dispatch, getState: () => RootState): void => {
    const state = getState();
    // getControlsState expects datasource to be defined, provide a default
    const exploreState = {
      ...state.explore,
      datasource: state.explore.datasource || { type: 'table' },
    };
    const controlsState = getControlsState(
      exploreState,
      state.explore.form_data,
    ) as ControlStateMapping;
    const sliceIdControl = controlsState.slice_id as { value?: unknown };
    dispatch({
      type: DYNAMIC_PLUGIN_CONTROLS_READY,
      key: sliceIdControl?.value,
      controlsState,
    });
  };

const v1ChartDataRequest = async (
  formData: QueryFormData | LatestQueryFormData,
  resultFormat: string,
  resultType: string,
  force: boolean,
  requestParams: RequestParams,
  setDataMask: (dataMask: DataMask) => void,
  ownState: JsonObject,
  parseMethod: string | undefined,
  asyncMode: boolean,
  queryForceNonces?: string[],
): Promise<ChartDataRequestResponse> => {
  const payload = await buildV1ChartDataPayload({
    formData: formData as QueryFormData,
    resultType,
    resultFormat,
    force,
    queryForceNonces,
    setDataMask,
    ownState,
  });

  // The dashboard id is added to query params for tracking purposes
  const { slice_id: sliceId } = formData;
  const { dashboard_id: dashboardId } = requestParams;

  const qs: Record<string, string> = {};
  if (sliceId !== undefined) qs.form_data = `{"slice_id":${sliceId}}`;
  if (dashboardId !== undefined) qs.dashboard_id = String(dashboardId);
  if (force) qs.force = String(force);

  const allowDomainSharding = Boolean(
    // eslint-disable-next-line camelcase
    domainShardingEnabled && requestParams?.dashboard_id,
  );
  const url = getChartDataUri({
    path: '/api/v1/chart/data',
    qs,
    allowDomainSharding,
  }).toString();

  // In async mode, send the tab id so the backend can ref-count this tab as a
  // consumer of the (shared) chart-data task — a later cancel/navigate-away from
  // this tab then detaches only this tab rather than aborting a task another tab
  // of the same user is still awaiting.
  const body = JSON.stringify(
    asyncMode ? { ...payload, async_mode: true, tab_id: getTabId() } : payload,
  );

  const querySettings: QuerySettings = {
    ...requestParams,
    url,
    headers: { 'Content-Type': 'application/json' },
    body,
    parseMethod,
  };

  return SupersetClient.post(
    querySettings as Parameters<typeof SupersetClient.post>[0],
  ) as Promise<ChartDataRequestResponse>;
};

export async function getChartDataRequest({
  formData,
  setDataMask = () => {},
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  queryForceNonces,
  requestParams = {},
  ownState = {},
  enableAsyncMode = false,
}: GetChartDataRequestParams): Promise<ChartDataRequestResponse> {
  // Keep the async-mode inputs out of the request options: they resolve the
  // `async_mode` payload flag, they are not `SupersetClient.post` settings.
  const { async_mode_override: asyncModeOverride, ...postParams } =
    requestParams;

  // Opt full JSON chart-data renders into async execution per the resolved policy
  // (feature flag + deployment default + optional per-dashboard override). Only
  // callers that handle a 202 task response set enableAsyncMode; the server treats
  // an absent async_mode as synchronous, so this is additive.
  const asyncMode =
    enableAsyncMode &&
    resultFormat === 'json' &&
    resultType === 'full' &&
    resolveAsyncMode(asyncModeOverride);

  let querySettings: RequestParams = { ...postParams };

  if (domainShardingEnabled) {
    querySettings = {
      ...querySettings,
      mode: 'cors',
      credentials: 'include',
    };
  }
  const [parseMethod] = getQuerySettings(formData);
  return v1ChartDataRequest(
    formData,
    resultFormat,
    resultType,
    force,
    querySettings,
    setDataMask,
    ownState,
    parseMethod,
    asyncMode,
    queryForceNonces,
  );
}

export function runAnnotationQuery({
  annotation,
  timeout,
  formData,
  key,
  isDashboardRequest = false,
  force = false,
}: RunAnnotationQueryParams): ChartThunkAction<Promise<void | Action>> {
  return async function (
    dispatch: ChartThunkDispatch,
    getState: () => RootState,
  ): Promise<void | Action> {
    const { charts, common } = getState();
    const sliceKey = key || Object.keys(charts)[0];
    const queryTimeout = timeout || common.conf.SUPERSET_WEBSERVER_TIMEOUT || 0;

    // make a copy of formData, not modifying original formData
    const fd: JsonObject = {
      ...(formData || charts[sliceKey].latestQueryFormData),
    };

    if (!annotation.sourceType) {
      return Promise.resolve();
    }

    // In the original formData the `granularity` attribute represents the time grain (eg
    // `P1D`), but in the request payload it corresponds to the name of the column where
    // the time grain should be applied (eg, `Date`), so we need to move things around.
    fd.time_grain_sqla = fd.time_grain_sqla || fd.granularity;
    fd.granularity = fd.granularity_sqla;

    const overridesKeys = Object.keys(annotation.overrides || {});
    if (overridesKeys.includes('since') || overridesKeys.includes('until')) {
      annotation.overrides = {
        ...annotation.overrides,
        time_range: null,
      };
    }
    const sliceFormData: JsonObject = Object.keys(
      annotation.overrides || {},
    ).reduce(
      (d, k) => ({
        ...d,
        [k]: annotation.overrides?.[k] || fd[k],
      }),
      {},
    );

    if (!isDashboardRequest && fd) {
      const hasExtraFilters = fd.extra_filters && fd.extra_filters.length > 0;
      sliceFormData.extra_filters = hasExtraFilters
        ? fd.extra_filters
        : undefined;
    }

    const url = getAnnotationJsonUrl(annotation.value, force);
    // If url is null (slice_id was null/undefined), skip the request
    if (!url) {
      return Promise.resolve();
    }

    const controller = new AbortController();
    const { signal } = controller;

    dispatch(annotationQueryStarted(annotation, controller, sliceKey));

    const annotationIndex = fd?.annotation_layers?.findIndex(
      (it: AnnotationLayer) => it.name === annotation.name,
    );
    if (annotationIndex !== undefined && annotationIndex >= 0) {
      fd.annotation_layers[annotationIndex].overrides = sliceFormData;
    }

    const payload = await buildV1ChartDataPayload({
      formData: fd as QueryFormData,
      force,
      resultFormat: 'json',
      resultType: 'full',
    });

    return SupersetClient.post({
      url,
      signal,
      timeout: queryTimeout * 1000,
      headers: { 'Content-Type': 'application/json' },
      jsonPayload: payload,
    })
      .then(({ json }: { json: JsonObject }) => {
        const data = json?.result?.[0]?.annotation_data?.[annotation.name];
        return dispatch(annotationQuerySuccess(annotation, { data }, sliceKey));
      })
      .catch(response =>
        getClientErrorObject(response).then(err => {
          if (err.statusText === 'timeout') {
            dispatch(
              annotationQueryFailed(
                annotation,
                { error: 'Query timeout' },
                sliceKey,
              ),
            );
          } else if ((err.error || '').toLowerCase().includes('no data')) {
            dispatch(annotationQuerySuccess(annotation, err, sliceKey));
          } else if (err.statusText !== 'abort') {
            dispatch(annotationQueryFailed(annotation, err, sliceKey));
          }
        }),
      );
  };
}

export function triggerQuery(
  value = true,
  key: string | number,
): TriggerQueryAction {
  return { type: TRIGGER_QUERY, value, key };
}

// this action is used for forced re-render without fetch data
export function renderTriggered(
  value: number,
  key: string | number,
): RenderTriggeredAction {
  return { type: RENDER_TRIGGERED, value, key };
}

export function updateQueryFormData(
  value: QueryFormData | LatestQueryFormData,
  key: string | number,
): UpdateQueryFormDataAction {
  return { type: UPDATE_QUERY_FORM_DATA, value, key };
}

// in the sql lab -> explore flow, user can inline edit chart title,
// then the chart will be assigned a new slice_id
export function updateChartId(
  newId: number,
  key: string | number = 0,
): UpdateChartIdAction {
  return { type: UPDATE_CHART_ID, newId, key };
}

export function addChart(
  chart: ChartState,
  key: string | number,
): AddChartAction {
  return { type: ADD_CHART, chart, key };
}

// An async-flow chart-data body is `{result: [...]}`, or the results themselves
// when a caller (e.g. a chart component in superset-ui-core) has already
// unwrapped them.
const extractResult = (json: ChartDataRequestResponse['json']): QueryData[] =>
  ('result' in json ? json.result : json) as QueryData[];

export function handleChartDataResponse(
  response: Response,
  json: ChartDataRequestResponse['json'],
  refetch: (queryForceNonces?: string[]) => Promise<QueryData[]>,
  signal?: AbortSignal,
): Promise<QueryData[]> | QueryData[] {
  if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    switch (response.status) {
      case 200:
        // Query results returned synchronously, meaning query was already cached.
        return Promise.resolve(extractResult(json));
      case 202:
        // Query is running asynchronously as one GTF task per QueryObject. The
        // 202 body is the async job ({task_ids}); await every task, then
        // `refetch` to read the now-cached results. The optional signal lets a
        // caller abort the wait (Stop pressed, chart superseded or unmounted),
        // cancelling the outstanding tasks.
        return waitForAsyncData(json as AsyncJob, refetch, signal);
      default:
        throw new Error(
          `Received unexpected response status (${response.status}) while fetching chart data`,
        );
    }
  }
  return json.result;
}

/**
 * Issue a chart-data request and resolve it to query results, transparently
 * awaiting asynchronous execution.
 *
 * On a 202 the body is the async job rather than data: every query task is
 * awaited, then the same request is re-issued *synchronously* so the server
 * serves it inline. Double execution (the async task computing, then the
 * re-issue recomputing the identical query) is prevented by a forced-refresh
 * idempotency nonce that IS the async task's UUID: the async submit carries no
 * nonce (the worker stamps each query with its own task UUID and records a marker
 * keyed by (task_uuid, cache_key) once cached), and the synchronous read-back
 * carries each query's task id — returned in the 202 `task_ids`, in query order —
 * as that query's `force_nonce`, so it reads the freshly-warmed cache instead of
 * recomputing. Because the token is the task's identity, a concurrent force
 * refresh that joins the same shared task (deduped by query cache key) reads back
 * under the same id — so it does NOT double-execute either. Non-forced requests
 * carry no nonce and keep the plain flow.
 *
 * `signal` aborts the wait (Stop pressed, chart superseded or unmounted) and
 * cancels the outstanding tasks.
 */
export async function requestChartDataResolved(
  params: Omit<GetChartDataRequestParams, 'enableAsyncMode'>,
  signal?: AbortSignal,
): Promise<QueryData[]> {
  // The synchronous read-back of a forced refresh stamps each query with its
  // task id (from the 202, index-aligned to queries) as the forced-refresh nonce.
  const reissueSynchronously = async (
    queryForceNonces?: string[],
  ): Promise<QueryData[]> => {
    const { response, json } = await getChartDataRequest({
      ...params,
      queryForceNonces: params.force ? queryForceNonces : undefined,
      enableAsyncMode: false,
    });
    if (response.status !== 200) {
      throw new Error(
        `Received unexpected response status (${response.status}) while fetching chart data`,
      );
    }
    return extractResult(json);
  };

  const { response, json } = await getChartDataRequest({
    ...params,
    enableAsyncMode: true,
  });
  return handleChartDataResponse(response, json, reissueSynchronously, signal);
}

export function exploreJSON(
  formData: QueryFormData | LatestQueryFormData,
  force = false,
  timeout?: number,
  key?: string | number,
  dashboardId?: number,
  ownState?: JsonObject,
): ChartThunkAction<Promise<unknown[]>> {
  return async (
    dispatch: ChartThunkDispatch,
    getState: () => RootState,
  ): Promise<unknown[]> => {
    const state = getState();
    const logStart = Logger.getTimestamp();
    const controller = new AbortController();
    const prevController = key ? state.charts?.[key]?.queryController : null;
    const queryTimeout =
      timeout || state.common.conf.SUPERSET_WEBSERVER_TIMEOUT || 0;

    const requestParams: RequestParams = {
      signal: controller.signal,
      timeout: queryTimeout * 1000,
    };
    if (dashboardId) requestParams.dashboard_id = dashboardId;
    // Honor the per-dashboard async override when rendering within a dashboard.
    const asyncModeOverride = selectAsyncModeOverride(state);
    if (asyncModeOverride)
      requestParams.async_mode_override = asyncModeOverride;

    const setDataMask = (dataMask: DataMask): void => {
      dispatch(updateDataMask(formData.slice_id, dataMask));
    };
    dispatch(chartUpdateStarted(controller, formData, key as string | number));
    /**
     * Abort in-flight requests after the new controller has been stored in
     * state. Delaying ensures we do not mutate the Redux state between
     * dispatches while still cancelling the previous request promptly.
     */
    if (prevController) {
      setTimeout(() => prevController.abort(), 0);
    }

    const chartDataRequestCaught = requestChartDataResolved(
      {
        setDataMask,
        formData,
        resultFormat: 'json',
        resultType: 'full',
        force,
        requestParams,
        ownState,
      },
      controller.signal,
    )
      .then(queriesResponse => {
        // Drop stale responses: if this request was aborted (Stop, or a newer
        // query that aborted ours), or a newer query has since replaced our
        // controller in state, ignore the result so we don't clobber newer
        // data or a 'stopped' status. Checking the signal is authoritative
        // because the reducer nulls out queryController when a query stops.
        if (key != null) {
          const currentController = getState().charts?.[key]?.queryController;
          if (
            controller.signal.aborted ||
            (currentController != null && currentController !== controller)
          ) {
            return undefined;
          }
        }
        queriesResponse.forEach(
          (resultItem: QueryData & { applied_filters?: JsonObject[] }) =>
            dispatch(
              logEvent(LOG_ACTIONS_LOAD_CHART, {
                slice_id: key,
                applied_filters: resultItem.applied_filters,
                is_cached: resultItem.is_cached,
                force_refresh: force,
                row_count: resultItem.rowcount,
                datasource: formData.datasource,
                start_offset: logStart,
                ts: new Date().getTime(),
                duration: Logger.getTimestamp() - logStart,
                has_extra_filters:
                  formData.extra_filters && formData.extra_filters.length > 0,
                viz_type: formData.viz_type,
                data_age: resultItem.is_cached
                  ? extendedDayjs(new Date()).diff(
                      extendedDayjs.utc(resultItem.cached_dttm),
                    )
                  : null,
              }),
            ),
        );
        queriesResponse.forEach(response => {
          const { warning } = response as { warning?: string | null };
          if (warning) {
            dispatch(addWarningToast(warning, { noDuplicate: true }));
          }
        });
        return dispatch(chartUpdateSucceeded(queriesResponse, key as number));
      })
      .catch(
        (
          response: Error & {
            name?: string;
            statusText?: string;
          },
        ) => {
          // Ignore abort errors - they're expected when filters change quickly
          const isAbort =
            response?.name === 'AbortError' || response?.statusText === 'abort';
          if (isAbort) {
            // Abort is expected: filters changed, chart unmounted, etc.
            return dispatch(
              chartUpdateStopped(key as string | number, controller),
            );
          }

          // Drop stale failures the same way we drop stale successes,
          // so a slow earlier request can't mark a newer one as failed.
          if (key != null) {
            const currentController = getState().charts?.[key]?.queryController;
            if (
              controller.signal.aborted ||
              (currentController != null && currentController !== controller)
            ) {
              return undefined;
            }
          }

          if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
            // `waitForAsyncData` rejects with an already-normalized async-event
            // error object (JOB_STATUS.ERROR) or with an array of client error
            // objects (cached-data fetch failure). Those carry a usable
            // `error`/`errors` field and can be passed straight through.
            // Synchronous HTTP failures — e.g. a QueryObjectValidationError
            // surfaced by the pre-cache probe in `_run_async` — reject with a
            // raw response that still needs parsing, otherwise the chart error
            // banner renders a bare "Data error" with no description.
            if (Array.isArray(response)) {
              return dispatch(
                chartUpdateFailed(
                  response as JsonObject[],
                  key as string | number,
                ),
              );
            }
            if (
              response != null &&
              typeof response === 'object' &&
              !(response instanceof Response) &&
              ('error' in response || 'errors' in response)
            ) {
              return dispatch(
                chartUpdateFailed(
                  [response as JsonObject],
                  key as string | number,
                ),
              );
            }
            return getClientErrorObject(
              response as unknown as Parameters<typeof getClientErrorObject>[0],
            ).then((parsedResponse: JsonObject) =>
              dispatch(
                chartUpdateFailed([parsedResponse], key as string | number),
              ),
            );
          }

          const appendErrorLog = (
            errorDetails: string | undefined,
            isCached?: boolean,
          ): void => {
            dispatch(
              logEvent(LOG_ACTIONS_LOAD_CHART, {
                slice_id: key,
                has_err: true,
                is_cached: isCached,
                error_details: errorDetails,
                datasource: formData.datasource,
                start_offset: logStart,
                ts: new Date().getTime(),
                duration: Logger.getTimestamp() - logStart,
              }),
            );
          };

          return getClientErrorObject(
            response as unknown as Parameters<typeof getClientErrorObject>[0],
          ).then((parsedResponse: JsonObject) => {
            if (
              (response as { statusText?: string }).statusText === 'timeout'
            ) {
              appendErrorLog('timeout');
            } else {
              appendErrorLog(parsedResponse.error, parsedResponse.is_cached);
            }
            return dispatch(
              chartUpdateFailed([parsedResponse], key as string | number),
            );
          });
        },
      );

    return Promise.all([
      chartDataRequestCaught,
      dispatch(triggerQuery(false, key as string | number)),
      dispatch(updateQueryFormData(formData, key as string | number)),
    ]);
  };
}

export function postChartFormData(
  formData: QueryFormData | LatestQueryFormData,
  force = false,
  timeout?: number,
  key?: string | number,
  dashboardId?: number,
  ownState?: JsonObject,
): ChartThunkAction<Promise<unknown[]>> {
  return exploreJSON(formData, force, timeout, key, dashboardId, ownState);
}

export function redirectSQLLab(
  formData: QueryFormData | LatestQueryFormData,
  history?: History,
): ChartThunkAction {
  return (dispatch: ChartThunkDispatch): void => {
    getChartDataRequest({
      formData,
      resultFormat: 'json',
      resultType: 'query',
    })
      .then(({ json }) => {
        if (!json.result || json.result.length === 0) {
          dispatch(addDangerToast(t('No SQL query found')));
          return;
        }
        const redirectUrl = '/sqllab/';
        const payload = {
          datasourceKey: formData.datasource,
          sql: json.result[0].query,
        };
        if (history) {
          // Use two-argument form for history.push with state
          history.push(redirectUrl, {
            requestedQuery: payload,
          });
        } else {
          SupersetClient.postForm(ensureAppRoot(redirectUrl), {
            form_data: safeStringify(payload),
          });
        }
      })
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while loading the SQL'))),
      );
  };
}

export function refreshChart(
  chartKey: string | number,
  force: boolean,
  dashboardId?: number,
): ChartThunkAction<Promise<void>> {
  return (
    dispatch: ChartThunkDispatch,
    getState: () => RootState,
  ): Promise<void> => {
    const chart = (getState().charts || {})[chartKey];
    if (!chart) {
      return Promise.resolve();
    }
    const timeout =
      getState().dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT;

    if (
      !chart.latestQueryFormData ||
      Object.keys(chart.latestQueryFormData).length === 0
    ) {
      return Promise.resolve();
    }
    return dispatch(
      postChartFormData(
        chart.latestQueryFormData,
        force,
        timeout,
        chart.id,
        dashboardId,
        getState().dataMask[chart.id]?.ownState,
      ),
    ) as unknown as Promise<void>;
  };
}

export const getDatasourceSamples = async (
  datasourceType: DatasourceType,
  datasourceId: number,
  force: boolean,
  jsonPayload: JsonObject,
  perPage?: number,
  page?: number,
  dashboardId?: number,
): Promise<JsonObject> => {
  try {
    const searchParams: DatasourceSamplesSearchParams = {
      force,
      datasource_type: datasourceType,
      datasource_id: datasourceId,
    };

    if (isDefined(dashboardId)) {
      searchParams.dashboard_id = dashboardId;
    }

    if (isDefined(perPage) && isDefined(page)) {
      searchParams.per_page = perPage;
      searchParams.page = page;
    }

    const response = await SupersetClient.post({
      endpoint: '/datasource/samples',
      jsonPayload,
      searchParams,
      parseMethod: 'json-bigint',
    });

    return response.json.result;
  } catch (err) {
    const clientError = await getClientErrorObject(err);
    throw new Error(
      clientError.message || clientError.error || t('Sorry, an error occurred'),
      { cause: err },
    );
  }
};
