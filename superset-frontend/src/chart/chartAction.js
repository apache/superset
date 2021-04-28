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
import moment from 'moment';
import { t, SupersetClient } from '@superset-ui/core';
import { getControlsState } from 'src/explore/store';
import { isFeatureEnabled, FeatureFlag } from '../featureFlags';
import {
  getAnnotationJsonUrl,
  getExploreUrl,
  getLegacyEndpointType,
  buildV1ChartDataPayload,
  postForm,
  shouldUseLegacyApi,
  getChartDataUri,
} from '../explore/exploreUtils';
import {
  requiresQuery,
  ANNOTATION_SOURCE_TYPES,
} from '../modules/AnnotationTypes';

import { addDangerToast } from '../messageToasts/actions';
import { logEvent } from '../logger/actions';
import { Logger, LOG_ACTIONS_LOAD_CHART } from '../logger/LogUtils';
import { getClientErrorObject } from '../utils/getClientErrorObject';
import { allowCrossDomain as domainShardingEnabled } from '../utils/hostNamesConfig';
import { updateDataMask } from '../dataMask/actions';
import { waitForAsyncData } from '../middleware/asyncEvent';

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryController, latestQueryFormData, key) {
  return {
    type: CHART_UPDATE_STARTED,
    queryController,
    latestQueryFormData,
    key,
  };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queriesResponse, key) {
  return { type: CHART_UPDATE_SUCCEEDED, queriesResponse, key };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(key) {
  return { type: CHART_UPDATE_STOPPED, key };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queriesResponse, key) {
  return { type: CHART_UPDATE_FAILED, queriesResponse, key };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(error, key, stackTrace) {
  return { type: CHART_RENDERING_FAILED, error, key, stackTrace };
}

export const CHART_RENDERING_SUCCEEDED = 'CHART_RENDERING_SUCCEEDED';
export function chartRenderingSucceeded(key) {
  return { type: CHART_RENDERING_SUCCEEDED, key };
}

export const REMOVE_CHART = 'REMOVE_CHART';
export function removeChart(key) {
  return { type: REMOVE_CHART, key };
}

export const ANNOTATION_QUERY_SUCCESS = 'ANNOTATION_QUERY_SUCCESS';
export function annotationQuerySuccess(annotation, queryResponse, key) {
  return { type: ANNOTATION_QUERY_SUCCESS, annotation, queryResponse, key };
}

export const ANNOTATION_QUERY_STARTED = 'ANNOTATION_QUERY_STARTED';
export function annotationQueryStarted(annotation, queryController, key) {
  return { type: ANNOTATION_QUERY_STARTED, annotation, queryController, key };
}

export const ANNOTATION_QUERY_FAILED = 'ANNOTATION_QUERY_FAILED';
export function annotationQueryFailed(annotation, queryResponse, key) {
  return { type: ANNOTATION_QUERY_FAILED, annotation, queryResponse, key };
}

export const DYNAMIC_PLUGIN_CONTROLS_READY = 'DYNAMIC_PLUGIN_CONTROLS_READY';
export const dynamicPluginControlsReady = () => (dispatch, getState) => {
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
  formData,
  resultFormat,
  resultType,
  force,
  method = 'POST',
  requestParams = {},
) => {
  const endpointType = getLegacyEndpointType({ resultFormat, resultType });
  const allowDomainSharding =
    // eslint-disable-next-line camelcase
    domainShardingEnabled && requestParams?.dashboard_id;
  const url = getExploreUrl({
    formData,
    endpointType,
    force,
    allowDomainSharding,
    method,
    requestParams: requestParams.dashboard_id
      ? { dashboard_id: requestParams.dashboard_id }
      : {},
  });
  const querySettings = {
    ...requestParams,
    url,
    postPayload: { form_data: formData },
  };

  const clientMethod =
    'GET' && isFeatureEnabled(FeatureFlag.CLIENT_CACHE)
      ? SupersetClient.get
      : SupersetClient.post;
  return clientMethod(querySettings).then(({ json }) =>
    // Make the legacy endpoint return a payload that corresponds to the
    // V1 chart data endpoint response signature.
    ({
      result: [json],
    }),
  );
};

const v1ChartDataRequest = async (
  formData,
  resultFormat,
  resultType,
  force,
  requestParams,
  setDataMask,
  ownState,
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
  if (sliceId !== undefined) qs.form_data = `{"slice_id":${sliceId}}`;
  if (dashboardId !== undefined) qs.dashboard_id = dashboardId;
  if (force !== false) qs.force = force;

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
  };
  return SupersetClient.post(querySettings).then(({ json }) => json);
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
}) {
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

  if (shouldUseLegacyApi(formData)) {
    return legacyChartDataRequest(
      formData,
      resultFormat,
      resultType,
      force,
      method,
      querySettings,
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
  );
}

export function runAnnotationQuery(
  annotation,
  timeout = 60,
  formData = null,
  key,
  isDashboardRequest = false,
) {
  return function (dispatch, getState) {
    const sliceKey = key || Object.keys(getState().charts)[0];
    // make a copy of formData, not modifying original formData
    const fd = {
      ...(formData || getState().charts[sliceKey].latestQueryFormData),
    };

    if (!requiresQuery(annotation.sourceType)) {
      return Promise.resolve();
    }

    const granularity = fd.time_grain_sqla || fd.granularity;
    fd.time_grain_sqla = granularity;
    fd.granularity = granularity;
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
      sliceFormData.extra_filters = hasExtraFilters
        ? fd.extra_filters
        : undefined;
    }

    const isNative = annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE;
    const url = getAnnotationJsonUrl(annotation.value, sliceFormData, isNative);
    const controller = new AbortController();
    const { signal } = controller;

    dispatch(annotationQueryStarted(annotation, controller, sliceKey));

    return SupersetClient.get({
      url,
      signal,
      timeout: timeout * 1000,
    })
      .then(({ json }) =>
        dispatch(annotationQuerySuccess(annotation, json, sliceKey)),
      )
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
export function triggerQuery(value = true, key) {
  return { type: TRIGGER_QUERY, value, key };
}

// this action is used for forced re-render without fetch data
export const RENDER_TRIGGERED = 'RENDER_TRIGGERED';
export function renderTriggered(value, key) {
  return { type: RENDER_TRIGGERED, value, key };
}

export const UPDATE_QUERY_FORM_DATA = 'UPDATE_QUERY_FORM_DATA';
export function updateQueryFormData(value, key) {
  return { type: UPDATE_QUERY_FORM_DATA, value, key };
}

// in the sql lab -> explore flow, user can inline edit chart title,
// then the chart will be assigned a new slice_id
export const UPDATE_CHART_ID = 'UPDATE_CHART_ID';
export function updateChartId(newId, key = 0) {
  return { type: UPDATE_CHART_ID, newId, key };
}

export const ADD_CHART = 'ADD_CHART';
export function addChart(chart, key) {
  return { type: ADD_CHART, chart, key };
}

export function exploreJSON(
  formData,
  force = false,
  timeout = 60,
  key,
  method,
  dashboardId,
  ownState,
) {
  return async dispatch => {
    const logStart = Logger.getTimestamp();
    const controller = new AbortController();

    const requestParams = {
      signal: controller.signal,
      timeout: timeout * 1000,
    };
    if (dashboardId) requestParams.dashboard_id = dashboardId;

    const setDataMask = dataMask => {
      dispatch(updateDataMask(formData.slice_id, dataMask));
    };
    const chartDataRequest = getChartDataRequest({
      setDataMask,
      formData,
      resultFormat: 'json',
      resultType: 'full',
      force,
      method,
      requestParams,
      ownState,
    });

    dispatch(chartUpdateStarted(controller, formData, key));

    const chartDataRequestCaught = chartDataRequest
      .then(response => {
        const queriesResponse = response.result;
        if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
          // deal with getChartDataRequest transforming the response data
          const result = 'result' in response ? response.result[0] : response;
          return waitForAsyncData(result);
        }
        return queriesResponse;
      })
      .then(queriesResponse => {
        queriesResponse.forEach(resultItem =>
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
                ? moment(new Date()).diff(moment.utc(resultItem.cached_dttm))
                : null,
            }),
          ),
        );
        return dispatch(chartUpdateSucceeded(queriesResponse, key));
      })
      .catch(response => {
        if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
          return dispatch(chartUpdateFailed([response], key));
        }

        const appendErrorLog = (errorDetails, isCached) => {
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
          appendErrorLog('abort');
          return dispatch(chartUpdateStopped(key));
        }
        return getClientErrorObject(response).then(parsedResponse => {
          if (response.statusText === 'timeout') {
            appendErrorLog('timeout');
          } else {
            appendErrorLog(parsedResponse.error, parsedResponse.is_cached);
          }
          return dispatch(chartUpdateFailed([parsedResponse], key));
        });
      });

    // only retrieve annotations when calling the legacy API
    const annotationLayers = shouldUseLegacyApi(formData)
      ? formData.annotation_layers || []
      : [];
    const isDashboardRequest = dashboardId > 0;

    return Promise.all([
      chartDataRequestCaught,
      dispatch(triggerQuery(false, key)),
      dispatch(updateQueryFormData(formData, key)),
      ...annotationLayers.map(x =>
        dispatch(
          runAnnotationQuery(x, timeout, formData, key, isDashboardRequest),
        ),
      ),
    ]);
  };
}

export const GET_SAVED_CHART = 'GET_SAVED_CHART';
export function getSavedChart(
  formData,
  force = false,
  timeout = 60,
  key,
  dashboardId,
  ownState,
) {
  /*
   * Perform a GET request to `/explore_json`.
   *
   * This will return the payload of a saved chart, optionally filtered by
   * ad-hoc or extra filters from dashboards. Eg:
   *
   *  GET  /explore_json?{"chart_id":1}
   *  GET  /explore_json?{"chart_id":1,"extra_filters":"..."}
   *
   */
  return exploreJSON(
    formData,
    force,
    timeout,
    key,
    'GET',
    dashboardId,
    ownState,
  );
}

export const POST_CHART_FORM_DATA = 'POST_CHART_FORM_DATA';
export function postChartFormData(
  formData,
  force = false,
  timeout = 60,
  key,
  dashboardId,
  ownState,
) {
  /*
   * Perform a POST request to `/explore_json`.
   *
   * This will post the form data to the endpoint, returning a new chart.
   *
   */
  return exploreJSON(
    formData,
    force,
    timeout,
    key,
    'POST',
    dashboardId,
    ownState,
  );
}

export function redirectSQLLab(formData) {
  return dispatch => {
    getChartDataRequest({ formData, resultFormat: 'json', resultType: 'query' })
      .then(({ result }) => {
        const redirectUrl = '/superset/sqllab/';
        const payload = {
          datasourceKey: formData.datasource,
          sql: result[0].query,
        };
        postForm(redirectUrl, payload);
      })
      .catch(() =>
        dispatch(addDangerToast(t('An error occurred while loading the SQL'))),
      );
  };
}

export function refreshChart(chartKey, force, dashboardId) {
  return (dispatch, getState) => {
    const chart = (getState().charts || {})[chartKey];
    const timeout = getState().dashboardInfo.common.conf
      .SUPERSET_WEBSERVER_TIMEOUT;

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
