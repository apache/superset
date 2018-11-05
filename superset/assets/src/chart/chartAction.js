/* global window, AbortController */
/* eslint no-undef: 'error' */
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/core';
import { getExploreUrlAndPayload, getAnnotationJsonUrl } from '../explore/exploreUtils';
import { requiresQuery, ANNOTATION_SOURCE_TYPES } from '../modules/AnnotationTypes';
import { addDangerToast } from '../messageToasts/actions';
import { Logger, LOG_ACTIONS_LOAD_CHART } from '../logger';
import { TIME_RANGE_SEPARATOR } from '../utils/common';
import getClientErrorObject from '../utils/getClientErrorObject';

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryController, latestQueryFormData, key) {
  return { type: CHART_UPDATE_STARTED, queryController, latestQueryFormData, key };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queryResponse, key) {
  return { type: CHART_UPDATE_SUCCEEDED, queryResponse, key };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(key) {
  return { type: CHART_UPDATE_STOPPED, key };
}

export const CHART_UPDATE_TIMEOUT = 'CHART_UPDATE_TIMEOUT';
export function chartUpdateTimeout(statusText, timeout, key) {
  return { type: CHART_UPDATE_TIMEOUT, statusText, timeout, key };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queryResponse, key) {
  return { type: CHART_UPDATE_FAILED, queryResponse, key };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(error, key) {
  return { type: CHART_RENDERING_FAILED, error, key };
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

export function runAnnotationQuery(annotation, timeout = 60, formData = null, key) {
  return function (dispatch, getState) {
    const sliceKey = key || Object.keys(getState().charts)[0];
    // make a copy of formData, not modifying original formData
    const fd = { ...(formData || getState().charts[sliceKey].latestQueryFormData) };

    if (!requiresQuery(annotation.sourceType)) {
      return Promise.resolve();
    }

    const granularity = fd.time_grain_sqla || fd.granularity;
    fd.time_grain_sqla = granularity;
    fd.granularity = granularity;
    if (fd.time_range) {
      [fd.since, fd.until] = fd.time_range.split(TIME_RANGE_SEPARATOR);
    }

    const sliceFormData = Object.keys(annotation.overrides).reduce(
      (d, k) => ({
        ...d,
        [k]: annotation.overrides[k] || fd[k],
      }),
      {},
    );
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
      .then(({ json }) => dispatch(annotationQuerySuccess(annotation, json, sliceKey)))
      .catch(response => getClientErrorObject(response).then((err) => {
        if (err.statusText === 'timeout') {
          dispatch(annotationQueryFailed(annotation, { error: 'Query Timeout' }, sliceKey));
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

export const ADD_CHART = 'ADD_CHART';
export function addChart(chart, key) {
  return { type: ADD_CHART, chart, key };
}

export const RUN_QUERY = 'RUN_QUERY';
export function runQuery(formData, force = false, timeout = 60, key) {
  return (dispatch) => {
    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'json',
      force,
    });
    const logStart = Logger.getTimestamp();
    const controller = new AbortController();
    const { signal } = controller;

    dispatch(chartUpdateStarted(controller, payload, key));

    const queryPromise = SupersetClient.post({
      url,
      postPayload: { form_data: payload },
      signal,
      timeout: timeout * 1000,
    })
      .then(({ json }) => {
        Logger.append(LOG_ACTIONS_LOAD_CHART, {
          slice_id: key,
          is_cached: json.is_cached,
          force_refresh: force,
          row_count: json.rowcount,
          datasource: formData.datasource,
          start_offset: logStart,
          duration: Logger.getTimestamp() - logStart,
          has_extra_filters: formData.extra_filters && formData.extra_filters.length > 0,
          viz_type: formData.viz_type,
        });
        return dispatch(chartUpdateSucceeded(json, key));
      })
      .catch((response) => {
        const appendErrorLog = (errorDetails) => {
          Logger.append(LOG_ACTIONS_LOAD_CHART, {
            slice_id: key,
            has_err: true,
            error_details: errorDetails,
            datasource: formData.datasource,
            start_offset: logStart,
            duration: Logger.getTimestamp() - logStart,
          });
        };

        if (response.statusText === 'timeout') {
          appendErrorLog('timeout');
          return dispatch(chartUpdateTimeout(response.statusText, timeout, key));
        } else if (response.name === 'AbortError') {
          appendErrorLog('abort');
          return dispatch(chartUpdateStopped(key));
        }
        return getClientErrorObject(response).then((parsedResponse) => {
          appendErrorLog(parsedResponse.error);
          return dispatch(chartUpdateFailed(parsedResponse, key));
        });
      });

    const annotationLayers = formData.annotation_layers || [];

    return Promise.all([
      queryPromise,
      dispatch(triggerQuery(false, key)),
      dispatch(updateQueryFormData(payload, key)),
      ...annotationLayers.map(x => dispatch(runAnnotationQuery(x, timeout, formData, key))),
    ]);
  };
}

export function redirectSQLLab(formData) {
  return (dispatch) => {
    const { url } = getExploreUrlAndPayload({ formData, endpointType: 'query' });
    return SupersetClient.get({ url })
      .then(({ json }) => {
        const redirectUrl = new URL(window.location);
        redirectUrl.pathname = '/superset/sqllab';
        for (const key of redirectUrl.searchParams.keys()) {
          redirectUrl.searchParams.delete(key);
        }
        redirectUrl.searchParams.set('datasourceKey', formData.datasource);
        redirectUrl.searchParams.set('sql', json.query);
        window.open(redirectUrl.href, '_blank');
      })
      .catch(() => dispatch(addDangerToast(t('An error occurred while loading the SQL'))));
  };
}

export function refreshChart(chart, force, timeout) {
  return (dispatch) => {
    if (!chart.latestQueryFormData || Object.keys(chart.latestQueryFormData).length === 0) {
      return;
    }
    dispatch(runQuery(chart.latestQueryFormData, force, timeout, chart.id));
  };
}
