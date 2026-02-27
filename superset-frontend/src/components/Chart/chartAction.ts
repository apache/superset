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
import { t } from '@apache-superset/core/ui';
import type { ControlStateMapping } from '@superset-ui/chart-controls';
import { getControlsState } from 'src/explore/store';
import {
  getAnnotationJsonUrl,
  getExploreUrl,
  getLegacyEndpointType,
  buildV1ChartDataPayload,
  getQuerySettings,
  getChartDataUri,
} from 'src/explore/exploreUtils';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { logEvent } from 'src/logger/actions';
import { Logger, LOG_ACTIONS_LOAD_CHART } from 'src/logger/LogUtils';
import { allowCrossDomain as domainShardingEnabled } from 'src/utils/hostNamesConfig';
import { updateDataMask } from 'src/dataMask/actions';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import { ensureAppRoot } from 'src/utils/pathUtils';
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

// API response type for chart data request
export interface ChartDataRequestResponse {
  response: Response;
  json: {
    result: QueryData[];
  };
}

// getChartDataRequest params interface
export interface GetChartDataRequestParams {
  formData: QueryFormData | LatestQueryFormData;
  setDataMask?: (dataMask: DataMask) => void;
  resultFormat?: string;
  resultType?: string;
  force?: boolean;
  method?: 'GET' | 'POST';
  requestParams?: RequestParams;
  ownState?: JsonObject;
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

const legacyChartDataRequest = async (
  formData: QueryFormData | LatestQueryFormData,
  resultFormat: string,
  resultType: string,
  force: boolean,
  method: 'GET' | 'POST' = 'POST',
  requestParams: RequestParams = {},
  parseMethod?: string,
): Promise<ChartDataRequestResponse> => {
  const endpointType = getLegacyEndpointType({ resultFormat, resultType });
  const allowDomainSharding = Boolean(
    // eslint-disable-next-line camelcase
    domainShardingEnabled && requestParams?.dashboard_id,
  );
  const url = getExploreUrl({
    formData: formData as QueryFormData & {
      label_colors?: Record<string, string>;
    },
    endpointType,
    force,
    allowDomainSharding,
    method,
    requestParams: requestParams.dashboard_id
      ? { dashboard_id: String(requestParams.dashboard_id) }
      : {},
  });
  const querySettings: QuerySettings = {
    ...requestParams,
    url: url ?? undefined,
    postPayload: { form_data: formData },
    parseMethod,
  };

  return SupersetClient.post(
    querySettings as Parameters<typeof SupersetClient.post>[0],
  ).then(({ json, response }: { json: JsonObject; response: Response }) =>
    // Make the legacy endpoint return a payload that corresponds to the
    // V1 chart data endpoint response signature.
    ({
      response,
      json: { result: [json] },
    }),
  );
};

const v1ChartDataRequest = async (
  formData: QueryFormData | LatestQueryFormData,
  resultFormat: string,
  resultType: string,
  force: boolean,
  requestParams: RequestParams,
  setDataMask: (dataMask: DataMask) => void,
  ownState: JsonObject,
  parseMethod?: string,
): Promise<ChartDataRequestResponse> => {
  const payload = await buildV1ChartDataPayload({
    formData: formData as QueryFormData,
    resultType,
    resultFormat,
    force,
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

  const querySettings: QuerySettings = {
    ...requestParams,
    url,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  method = 'POST' as const,
  requestParams = {},
  ownState = {},
}: GetChartDataRequestParams): Promise<ChartDataRequestResponse> {
  let querySettings: RequestParams = {
    ...requestParams,
  };

  if (domainShardingEnabled) {
    querySettings = {
      ...querySettings,
      mode: 'cors',
      credentials: 'include',
    };
  }
  const [useLegacyApi, parseMethod] = getQuerySettings(formData);
  if (useLegacyApi) {
    return legacyChartDataRequest(
      formData,
      resultFormat,
      resultType,
      force,
      method,
      querySettings,
      parseMethod,
    );
  }
  return v1ChartDataRequest(
    formData,
    resultFormat,
    resultType,
    force,
    querySettings,
    setDataMask,
    ownState,
    parseMethod,
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

export function handleChartDataResponse(
  response: Response,
  json: { result: QueryData[] },
  useLegacyApi?: boolean,
): Promise<QueryData[]> | QueryData[] {
  if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    // deal with getChartDataRequest transforming the response data
    const result = 'result' in json ? json.result : json;
    switch (response.status) {
      case 200:
        // Query results returned synchronously, meaning query was already cached.
        return Promise.resolve(result);
      case 202:
        // Query is running asynchronously and we must await the results.
        // When status is 202, result contains async event data (job_id, channel_id, etc.)
        // which differs from QueryData. We cast through unknown to handle this safely.
        if (useLegacyApi) {
          return waitForAsyncData(
            result[0] as unknown as Parameters<typeof waitForAsyncData>[0],
          ) as Promise<QueryData[]>;
        }
        return waitForAsyncData(
          result as unknown as Parameters<typeof waitForAsyncData>[0],
        ) as Promise<QueryData[]>;
      default:
        throw new Error(
          `Received unexpected response status (${response.status}) while fetching chart data`,
        );
    }
  }
  return json.result;
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

    const chartDataRequest = getChartDataRequest({
      setDataMask,
      formData,
      resultFormat: 'json',
      resultType: 'full',
      force,
      method: 'POST',
      requestParams,
      ownState,
    });

    const [useLegacyApi] = getQuerySettings(formData);
    const chartDataRequestCaught = chartDataRequest
      .then(({ response, json }) =>
        handleChartDataResponse(response, json, useLegacyApi),
      )
      .then(queriesResponse => {
        (queriesResponse as QueryData[]).forEach(
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
        return dispatch(
          chartUpdateSucceeded(queriesResponse as QueryData[], key as number),
        );
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

          if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
            // In async mode we just pass the raw error response through
            return dispatch(
              chartUpdateFailed(
                [response as JsonObject],
                key as string | number,
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

    // only retrieve annotations when calling the legacy API
    const annotationLayers: AnnotationLayer[] = useLegacyApi
      ? (formData.annotation_layers as AnnotationLayer[]) || []
      : [];
    const isDashboardRequest = (dashboardId ?? 0) > 0;

    return Promise.all([
      chartDataRequestCaught,
      dispatch(triggerQuery(false, key as string | number)),
      dispatch(updateQueryFormData(formData, key as string | number)),
      ...annotationLayers.map((annotation: AnnotationLayer) =>
        dispatch(
          runAnnotationQuery({
            annotation,
            timeout,
            formData,
            key,
            isDashboardRequest,
            force,
          }),
        ),
      ),
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
