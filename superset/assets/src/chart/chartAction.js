import URI from 'urijs';

import { getExploreUrlAndPayload, getAnnotationJsonUrl } from '../explore/exploreUtils';
import { requiresQuery, ANNOTATION_SOURCE_TYPES } from '../modules/AnnotationTypes';
import { Logger, LOG_ACTIONS_LOAD_CHART } from '../logger';
import { COMMON_ERR_MESSAGES } from '../utils/common';
import { t } from '../locales';

const $ = (window.$ = require('jquery'));

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryRequest, latestQueryFormData, key) {
  return { type: CHART_UPDATE_STARTED, queryRequest, latestQueryFormData, key };
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
export function annotationQueryStarted(annotation, queryRequest, key) {
  return { type: ANNOTATION_QUERY_STARTED, annotation, queryRequest, key };
}

export const ANNOTATION_QUERY_FAILED = 'ANNOTATION_QUERY_FAILED';
export function annotationQueryFailed(annotation, queryResponse, key) {
  return { type: ANNOTATION_QUERY_FAILED, annotation, queryResponse, key };
}

export function runAnnotationQuery(annotation, timeout = 60, formData = null, key) {
  return function (dispatch, getState) {
    const sliceKey = key || Object.keys(getState().charts)[0];
    const fd = formData || getState().charts[sliceKey].latestQueryFormData;

    if (!requiresQuery(annotation.sourceType)) {
      return Promise.resolve();
    }

    const granularity = fd.time_grain_sqla || fd.granularity;
    fd.time_grain_sqla = granularity;
    fd.granularity = granularity;

    const sliceFormData = Object.keys(annotation.overrides).reduce(
      (d, k) => ({
        ...d,
        [k]: annotation.overrides[k] || fd[k],
      }),
      {},
    );
    const isNative = annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE;
    const url = getAnnotationJsonUrl(annotation.value, sliceFormData, isNative);
    const queryRequest = $.ajax({
      url,
      dataType: 'json',
      timeout: timeout * 1000,
    });
    dispatch(annotationQueryStarted(annotation, queryRequest, sliceKey));
    return queryRequest
      .then(queryResponse => dispatch(annotationQuerySuccess(annotation, queryResponse, sliceKey)))
      .catch((err) => {
        if (err.statusText === 'timeout') {
          dispatch(annotationQueryFailed(annotation, { error: 'Query Timeout' }, sliceKey));
        } else if ((err.responseJSON.error || '').toLowerCase().startsWith('no data')) {
          dispatch(annotationQuerySuccess(annotation, err, sliceKey));
        } else if (err.statusText !== 'abort') {
          dispatch(annotationQueryFailed(annotation, err.responseJSON, sliceKey));
        }
      });
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
    const queryRequest = $.ajax({
      type: 'POST',
      url,
      dataType: 'json',
      data: {
        form_data: JSON.stringify(payload),
      },
      timeout: timeout * 1000,
    });
    const queryPromise = Promise.resolve(dispatch(chartUpdateStarted(queryRequest, payload, key)))
      .then(() => queryRequest)
      .then((queryResponse) => {
        Logger.append(LOG_ACTIONS_LOAD_CHART, {
          slice_id: key,
          is_cached: queryResponse.is_cached,
          force_refresh: force,
          row_count: queryResponse.rowcount,
          datasource: formData.datasource,
          start_offset: logStart,
          duration: Logger.getTimestamp() - logStart,
          has_extra_filters: formData.extra_filters && formData.extra_filters.length > 0,
          viz_type: formData.viz_type,
        });
        return dispatch(chartUpdateSucceeded(queryResponse, key));
      })
      .catch((err) => {
        Logger.append(LOG_ACTIONS_LOAD_CHART, {
          slice_id: key,
          has_err: true,
          datasource: formData.datasource,
          start_offset: logStart,
          duration: Logger.getTimestamp() - logStart,
        });
        if (err.statusText === 'timeout') {
          dispatch(chartUpdateTimeout(err.statusText, timeout, key));
        } else if (err.statusText === 'abort') {
          dispatch(chartUpdateStopped(key));
        } else {
          let errObject;
          if (err.responseJSON) {
            errObject = err.responseJSON;
          } else if (err.stack) {
            errObject = {
              error: t('Unexpected error: ') + err.description,
              stacktrace: err.stack,
            };
          } else if (err.responseText && err.responseText.indexOf('CSRF') >= 0) {
            errObject = {
              error: COMMON_ERR_MESSAGES.SESSION_TIMED_OUT,
            };
          } else {
            errObject = {
              error: t('Unexpected error.'),
            };
          }
          dispatch(chartUpdateFailed(errObject, key));
        }
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

export const SQLLAB_REDIRECT_FAILED = 'SQLLAB_REDIRECT_FAILED';
export function sqllabRedirectFailed(error, key) {
  return { type: SQLLAB_REDIRECT_FAILED, error, key };
}

export function redirectSQLLab(formData) {
  return function (dispatch) {
    const { url, payload } = getExploreUrlAndPayload({ formData, endpointType: 'query' });
    $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(payload),
      },
      success: (response) => {
        const redirectUrl = new URI(window.location);
        redirectUrl
          .pathname('/superset/sqllab')
          .search({ datasourceKey: formData.datasource, sql: response.query });
        window.open(redirectUrl.href(), '_blank');
      },
      error: (xhr, status, error) => dispatch(sqllabRedirectFailed(error, formData.slice_id)),
    });
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
