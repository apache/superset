import { getExploreUrl } from '../explore/exploreUtils';
import { t } from '../locales';

const $ = window.$ = require('jquery');

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryRequest, key) {
  return { type: CHART_UPDATE_STARTED, queryRequest, key };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queryResponse, key) {
  return { type: CHART_UPDATE_SUCCEEDED, queryResponse, key };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(queryRequest, key) {
  if (queryRequest) {
    queryRequest.abort();
  }
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

export const REMOVE_CHART = 'REMOVE_CHART';
export function removeChart(key) {
  return { type: REMOVE_CHART, key };
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

export const RUN_QUERY = 'RUN_QUERY';
export function runQuery(formData, force = false, timeout = 60, key) {
  return (dispatch) => {
    const url = getExploreUrl(formData, 'json', force);
    const queryRequest = $.ajax({
      url,
      dataType: 'json',
      timeout: timeout * 1000,
      success: (queryResponse =>
        dispatch(chartUpdateSucceeded(queryResponse, key))
      ),
      error: ((xhr) => {
        if (xhr.statusText === 'timeout') {
          dispatch(chartUpdateTimeout(xhr.statusText, timeout, key));
        } else {
          let error = '';
          if (!xhr.responseText) {
            const status = xhr.status;
            if (status === 0) {
              // This may happen when the worker in gunicorn times out
              error += (
                t('The server could not be reached. You may want to ' +
                  'verify your connection and try again.'));
            } else {
              error += (t('An unknown error occurred. (Status: %s )', status));
            }
          }
          const errorResponse = Object.assign({}, xhr.responseJSON, error);
          dispatch(chartUpdateFailed(errorResponse, key));
        }
      }),
    });

    dispatch(chartUpdateStarted(queryRequest, key));
    dispatch(triggerQuery(false, key));
  };
}
