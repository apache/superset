import { getExploreUrl } from '../exploreUtils';
import { getFormDataFromControls } from '../stores/store';
import { QUERY_TIMEOUT_THRESHOLD } from '../../constants';
import { triggerQuery } from './exploreActions';

const $ = window.$ = require('jquery');

export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryRequest, latestQueryFormData) {
  return { type: CHART_UPDATE_STARTED, queryRequest, latestQueryFormData };
}

export const CHART_UPDATE_SUCCEEDED = 'CHART_UPDATE_SUCCEEDED';
export function chartUpdateSucceeded(queryResponse) {
  return { type: CHART_UPDATE_SUCCEEDED, queryResponse };
}

export const CHART_UPDATE_STOPPED = 'CHART_UPDATE_STOPPED';
export function chartUpdateStopped(queryRequest) {
  if (queryRequest) {
    queryRequest.abort();
  }
  return { type: CHART_UPDATE_STOPPED };
}

export const CHART_UPDATE_TIMEOUT = 'CHART_UPDATE_TIMEOUT';
export function chartUpdateTimeout(statusText) {
  return { type: CHART_UPDATE_TIMEOUT, statusText };
}

export const CHART_UPDATE_FAILED = 'CHART_UPDATE_FAILED';
export function chartUpdateFailed(queryResponse) {
  return { type: CHART_UPDATE_FAILED, queryResponse };
}

export const UPDATE_CHART_STATUS = 'UPDATE_CHART_STATUS';
export function updateChartStatus(status) {
  return { type: UPDATE_CHART_STATUS, status };
}

export const CHART_RENDERING_FAILED = 'CHART_RENDERING_FAILED';
export function chartRenderingFailed(error) {
  return { type: CHART_RENDERING_FAILED, error };
}

export const RUN_QUERY = 'RUN_QUERY';
export function runQuery(formData, force = false) {
  return function (dispatch, getState) {
    const { explore } = getState();
    const lastQueryFormData = getFormDataFromControls(explore.controls);
    const url = getExploreUrl(formData, 'json', force);
    const queryRequest = $.ajax({
      url,
      dataType: 'json',
      success(queryResponse) {
        dispatch(chartUpdateSucceeded(queryResponse));
      },
      error(err) {
        if (err.statusText === 'timeout') {
          dispatch(chartUpdateTimeout(err.statusText));
        } else if (err.statusText !== 'abort') {
          dispatch(chartUpdateFailed(err.responseJSON));
        }
      },
      timeout: QUERY_TIMEOUT_THRESHOLD,
    });
    dispatch(chartUpdateStarted(queryRequest, lastQueryFormData));
    dispatch(triggerQuery(false));
  };
}
