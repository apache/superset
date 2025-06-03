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
/* eslint no-undef: 'error' */
/* eslint no-param-reassign: ["error", { "props": false }] */
import {
  FeatureFlag,
  isDefined,
  SupersetClient,
  t,
  isFeatureEnabled,
  getClientErrorObject,
} from '@superset-ui/core';
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

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(
  queryController: $TSFixMe,
  latestQueryFormData: $TSFixMe,
  key: $TSFixMe,
) {
  return {
    type: CHART_UPDATE_STARTED,
    queryController,
    latestQueryFormData,
    key,
  };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queriesResponse: $TSFixMe, key: $TSFixMe) {
  return { type: CHART_UPDATE_SUCCEEDED, queriesResponse, key };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(key: $TSFixMe) {
  return { type: CHART_UPDATE_STOPPED, key };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queriesResponse: $TSFixMe, key: $TSFixMe) {
  return { type: CHART_UPDATE_FAILED, queriesResponse, key };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(
  error: $TSFixMe,
  key: $TSFixMe,
  stackTrace: $TSFixMe,
) {
  return { type: CHART_RENDERING_FAILED, error, key, stackTrace };
}

export const CHART_RENDERING_SUCCEEDED = 'CHART_RENDERING_SUCCEEDED';
export function chartRenderingSucceeded(key: $TSFixMe) {
  return { type: CHART_RENDERING_SUCCEEDED, key };
}

export const REMOVE_CHART = 'REMOVE_CHART';
export function removeChart(key: $TSFixMe) {
  return { type: REMOVE_CHART, key };
}

export const ANNOTATION_QUERY_SUCCESS = 'ANNOTATION_QUERY_SUCCESS';
export function annotationQuerySuccess(
  annotation: $TSFixMe,
  queryResponse: $TSFixMe,
  key: $TSFixMe,
) {
  return { type: ANNOTATION_QUERY_SUCCESS, annotation, queryResponse, key };
}

export const ANNOTATION_QUERY_STARTED = 'ANNOTATION_QUERY_STARTED';
export function annotationQueryStarted(
  annotation: $TSFixMe,
  queryController: $TSFixMe,
  key: $TSFixMe,
) {
  return { type: ANNOTATION_QUERY_STARTED, annotation, queryController, key };
}

export const ANNOTATION_QUERY_FAILED = 'ANNOTATION_QUERY_FAILED';
export function annotationQueryFailed(
  annotation: $TSFixMe,
  queryResponse: $TSFixMe,
  key: $TSFixMe,
) {
  return { type: ANNOTATION_QUERY_FAILED, annotation, queryResponse, key };
}

export const DYNAMIC_PLUGIN_CONTROLS_READY = 'DYNAMIC_PLUGIN_CONTROLS_READY';
export const dynamicPluginControlsReady =
  () => (dispatch: $TSFixMe, getState: $TSFixMe) => {
    const state = getState();
    const controlsState = getControlsState(
      state.explore,
      state.explore.form_data,
    );
    dispatch({
      type: DYNAMIC_PLUGIN_CONTROLS_READY,
      key: controlsState.slice_id.value,
      controlsState,
    });
  };

const legacyChartDataRequest = async (
  formData: $TSFixMe,
  resultFormat: $TSFixMe,
  resultType: $TSFixMe,
  force: $TSFixMe,
  method = 'POST',
  requestParams = {},
  parseMethod: $TSFixMe,
) => {
  const endpointType = getLegacyEndpointType({ resultFormat, resultType });
  const allowDomainSharding =
    // @ts-expect-error TS(2339): Property 'dashboard_id' does not exist on type '{}... Remove this comment to see the full error message
    // eslint-disable-next-line camelcase
    domainShardingEnabled && requestParams?.dashboard_id;
  const url = getExploreUrl({
    formData,
    endpointType,
    force,
    allowDomainSharding,
    method,
    // @ts-expect-error TS(2339): Property 'dashboard_id' does not exist on type '{}... Remove this comment to see the full error message
    requestParams: requestParams.dashboard_id
      ? // @ts-expect-error TS(2339): Property 'dashboard_id' does not exist on type '{}... Remove this comment to see the full error message
        { dashboard_id: requestParams.dashboard_id }
      : {},
  });
  const querySettings = {
    ...requestParams,
    url,
    postPayload: { form_data: formData },
    parseMethod,
  };

  // @ts-expect-error TS(2345): Argument of type '{ url: string | null; postPayloa... Remove this comment to see the full error message
  return SupersetClient.post(querySettings).then(({ json, response }) =>
    // Make the legacy endpoint return a payload that corresponds to the
    // V1 chart data endpoint response signature.
    ({
      response,
      json: { result: [json] },
    }),
  );
};

const v1ChartDataRequest = async (
  formData: $TSFixMe,
  resultFormat: $TSFixMe,
  resultType: $TSFixMe,
  force: $TSFixMe,
  requestParams: $TSFixMe,
  setDataMask: $TSFixMe,
  ownState: $TSFixMe,
  parseMethod: $TSFixMe,
) => {
  const payload = buildV1ChartDataPayload({
    formData,
    resultType,
    resultFormat,
    force,
    setDataMask,
    ownState,
  });

  // The dashboard id is added to query params for tracking purposes
  const { slice_id: sliceId } = formData;
  const { dashboard_id: dashboardId } = requestParams;

  const qs = {};
  // @ts-expect-error TS(2339): Property 'form_data' does not exist on type '{}'.
  if (sliceId !== undefined) qs.form_data = `{"slice_id":${sliceId}}`;
  // @ts-expect-error TS(2339): Property 'dashboard_id' does not exist on type '{}... Remove this comment to see the full error message
  if (dashboardId !== undefined) qs.dashboard_id = dashboardId;
  // @ts-expect-error TS(2339): Property 'force' does not exist on type '{}'.
  if (force) qs.force = force;

  const allowDomainSharding =
    // eslint-disable-next-line camelcase
    domainShardingEnabled && requestParams?.dashboard_id;
  const url = getChartDataUri({
    path: '/api/v1/chart/data',
    qs,
    allowDomainSharding,
  }).toString();

  const querySettings = {
    ...requestParams,
    url,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    parseMethod,
  };

  return SupersetClient.post(querySettings);
};

export async function getChartDataRequest({
  formData,
  setDataMask = () => {},
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  method = 'POST',
  requestParams = {},
  ownState = {},
}: $TSFixMe) {
  let querySettings = {
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
}: $TSFixMe) {
  return function (dispatch: $TSFixMe, getState: $TSFixMe) {
    const { charts, common } = getState();
    const sliceKey = key || Object.keys(charts)[0];
    const queryTimeout = timeout || common.conf.SUPERSET_WEBSERVER_TIMEOUT;

    // make a copy of formData, not modifying original formData
    const fd = {
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

    const overridesKeys = Object.keys(annotation.overrides);
    if (overridesKeys.includes('since') || overridesKeys.includes('until')) {
      annotation.overrides = {
        ...annotation.overrides,
        time_range: null,
      };
    }
    const sliceFormData = Object.keys(annotation.overrides).reduce(
      (d, k) => ({
        ...d,
        [k]: annotation.overrides[k] || fd[k],
      }),
      {},
    );

    if (!isDashboardRequest && fd) {
      const hasExtraFilters = fd.extra_filters && fd.extra_filters.length > 0;
      // @ts-expect-error TS(2339): Property 'extra_filters' does not exist on type '{... Remove this comment to see the full error message
      sliceFormData.extra_filters = hasExtraFilters
        ? fd.extra_filters
        : undefined;
    }

    const url = getAnnotationJsonUrl(annotation.value, force);
    const controller = new AbortController();
    const { signal } = controller;

    dispatch(annotationQueryStarted(annotation, controller, sliceKey));

    const annotationIndex = fd?.annotation_layers?.findIndex(
      (it: $TSFixMe) => it.name === annotation.name,
    );
    if (annotationIndex >= 0) {
      fd.annotation_layers[annotationIndex].overrides = sliceFormData;
    }

    return SupersetClient.post({
      // @ts-expect-error TS(2322): Type 'string | null' is not assignable to type 'st... Remove this comment to see the full error message
      url,
      signal,
      timeout: queryTimeout * 1000,
      headers: { 'Content-Type': 'application/json' },
      jsonPayload: buildV1ChartDataPayload({
        formData: fd,
        force,
        resultFormat: 'json',
        resultType: 'full',
      }),
    })
      .then(({ json }) => {
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

export const TRIGGER_QUERY = 'TRIGGER_QUERY';
export function triggerQuery(value = true, key: $TSFixMe) {
  return { type: TRIGGER_QUERY, value, key };
}

// this action is used for forced re-render without fetch data
export const RENDER_TRIGGERED = 'RENDER_TRIGGERED';
export function renderTriggered(value: $TSFixMe, key: $TSFixMe) {
  return { type: RENDER_TRIGGERED, value, key };
}

export const UPDATE_QUERY_FORM_DATA = 'UPDATE_QUERY_FORM_DATA';
export function updateQueryFormData(value: $TSFixMe, key: $TSFixMe) {
  return { type: UPDATE_QUERY_FORM_DATA, value, key };
}

// in the sql lab -> explore flow, user can inline edit chart title,
// then the chart will be assigned a new slice_id
export const UPDATE_CHART_ID = 'UPDATE_CHART_ID';
export function updateChartId(newId: $TSFixMe, key = 0) {
  return { type: UPDATE_CHART_ID, newId, key };
}

export const ADD_CHART = 'ADD_CHART';
export function addChart(chart: $TSFixMe, key: $TSFixMe) {
  return { type: ADD_CHART, chart, key };
}

export function handleChartDataResponse(
  response: $TSFixMe,
  json: $TSFixMe,
  useLegacyApi: $TSFixMe,
) {
  if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    // deal with getChartDataRequest transforming the response data
    const result = 'result' in json ? json.result : json;
    switch (response.status) {
      case 200:
        // Query results returned synchronously, meaning query was already cached.
        return Promise.resolve(result);
      case 202:
        // Query is running asynchronously and we must await the results
        if (useLegacyApi) {
          return waitForAsyncData(result[0]);
        }
        return waitForAsyncData(result);
      default:
        throw new Error(
          `Received unexpected response status (${response.status}) while fetching chart data`,
        );
    }
  }
  return json.result;
}

export function exploreJSON(
  formData: $TSFixMe,
  force = false,
  timeout: $TSFixMe,
  key: $TSFixMe,
  dashboardId: $TSFixMe,
  ownState: $TSFixMe,
) {
  return async (dispatch: $TSFixMe, getState: $TSFixMe) => {
    const logStart = Logger.getTimestamp();
    const controller = new AbortController();
    const queryTimeout =
      timeout || getState().common.conf.SUPERSET_WEBSERVER_TIMEOUT;

    const requestParams = {
      signal: controller.signal,
      timeout: queryTimeout * 1000,
    };
    // @ts-expect-error TS(2339): Property 'dashboard_id' does not exist on type '{ ... Remove this comment to see the full error message
    if (dashboardId) requestParams.dashboard_id = dashboardId;

    const setDataMask = (dataMask: $TSFixMe) => {
      dispatch(updateDataMask(formData.slice_id, dataMask));
    };
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

    dispatch(chartUpdateStarted(controller, formData, key));

    const [useLegacyApi] = getQuerySettings(formData);
    const chartDataRequestCaught = chartDataRequest
      .then(({ response, json }) =>
        handleChartDataResponse(response, json, useLegacyApi),
      )
      .then(queriesResponse => {
        queriesResponse.forEach((resultItem: $TSFixMe) =>
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
        return dispatch(chartUpdateSucceeded(queriesResponse, key));
      })
      .catch(response => {
        if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
          return dispatch(chartUpdateFailed([response], key));
        }

        const appendErrorLog = (errorDetails: $TSFixMe, isCached: $TSFixMe) => {
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
        if (response.name === 'AbortError') {
          // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
          appendErrorLog('abort');
          return dispatch(chartUpdateStopped(key));
        }
        return getClientErrorObject(response).then(parsedResponse => {
          if (response.statusText === 'timeout') {
            // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
            appendErrorLog('timeout');
          } else {
            // @ts-expect-error TS(2339): Property 'is_cached' does not exist on type 'Clien... Remove this comment to see the full error message
            appendErrorLog(parsedResponse.error, parsedResponse.is_cached);
          }
          return dispatch(chartUpdateFailed([parsedResponse], key));
        });
      });

    // only retrieve annotations when calling the legacy API
    const annotationLayers = useLegacyApi
      ? formData.annotation_layers || []
      : [];
    const isDashboardRequest = dashboardId > 0;

    return Promise.all([
      chartDataRequestCaught,
      dispatch(triggerQuery(false, key)),
      dispatch(updateQueryFormData(formData, key)),
      ...annotationLayers.map((annotation: $TSFixMe) =>
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

export const POST_CHART_FORM_DATA = 'POST_CHART_FORM_DATA';
export function postChartFormData(
  formData: $TSFixMe,
  force = false,
  timeout: $TSFixMe,
  key: $TSFixMe,
  dashboardId: $TSFixMe,
  ownState: $TSFixMe,
) {
  return exploreJSON(formData, force, timeout, key, dashboardId, ownState);
}

export function redirectSQLLab(formData: $TSFixMe, history: $TSFixMe) {
  return (dispatch: $TSFixMe) => {
    getChartDataRequest({ formData, resultFormat: 'json', resultType: 'query' })
      .then(({ json }) => {
        const redirectUrl = '/sqllab/';
        const payload = {
          datasourceKey: formData.datasource,
          sql: json.result[0].query,
        };
        if (history) {
          history.push({
            pathname: redirectUrl,
            state: {
              requestedQuery: payload,
            },
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
  chartKey: $TSFixMe,
  force: $TSFixMe,
  dashboardId: $TSFixMe,
) {
  return (dispatch: $TSFixMe, getState: $TSFixMe) => {
    const chart = (getState().charts || {})[chartKey];
    const timeout =
      getState().dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT;

    if (
      !chart.latestQueryFormData ||
      Object.keys(chart.latestQueryFormData).length === 0
    ) {
      return;
    }
    dispatch(
      postChartFormData(
        chart.latestQueryFormData,
        force,
        timeout,
        chart.id,
        dashboardId,
        getState().dataMask[chart.id]?.ownState,
      ),
    );
  };
}

export const getDatasourceSamples = async (
  datasourceType: $TSFixMe,
  datasourceId: $TSFixMe,
  force: $TSFixMe,
  jsonPayload: $TSFixMe,
  perPage: $TSFixMe,
  page: $TSFixMe,
) => {
  try {
    const searchParams = {
      force,
      datasource_type: datasourceType,
      datasource_id: datasourceId,
    };

    if (isDefined(perPage) && isDefined(page)) {
      // @ts-expect-error TS(2339): Property 'per_page' does not exist on type '{ forc... Remove this comment to see the full error message
      searchParams.per_page = perPage;
      // @ts-expect-error TS(2339): Property 'page' does not exist on type '{ force: a... Remove this comment to see the full error message
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
