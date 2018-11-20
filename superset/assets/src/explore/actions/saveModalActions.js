import { getExploreUrlAndPayload } from '../exploreUtils';

const $ = window.$ = require('jquery');

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export function fetchDashboards(userId) {
  return function (dispatch) {
    const url = '/dashboardasync/api/read?_flt_0_owners=' + userId;
    return $.ajax({
      type: 'GET',
      url,
      success: (data) => {
        const choices = [];
        for (let i = 0; i < data.pks.length; i++) {
          choices.push({ value: data.pks[i], label: data.result[i].dashboard_title });
        }
        dispatch(fetchDashboardsSucceeded(choices));
      },
      error: () => {
        dispatch(fetchDashboardsFailed(userId));
      },
    });
  };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}
export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

export const REMOVE_SAVE_MODAL_ALERT = 'REMOVE_SAVE_MODAL_ALERT';
export function removeSaveModalAlert() {
  return { type: REMOVE_SAVE_MODAL_ALERT };
}

export function saveSlice(formData, requestParams) {
  return (dispatch) => {
    const { url, payload } = getExploreUrlAndPayload({
      formData,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams,
    });
    return $.ajax({
      type: 'POST',
      url,
      data: {
        form_data: JSON.stringify(payload),
      },
      success: ((data) => {
        dispatch(saveSliceSuccess(data));
      }),
      error: (() => {
        dispatch(saveSliceFailed());
      }),
    });
  };
}

export const GET_SLICE_BY_ID = 'GET_SLICE_BY_ID';
export function sliceById(data) {
  return { type: GET_SLICE_BY_ID, data };
}
export const GET_SLICE_BY_ID_FAILED = 'GET_SLICE_BY_ID_FAILED';
export function sliceByIdFailed() {
  return { type: GET_SLICE_BY_ID_FAILED };
}
export function getSliceById(sliceId)
{
  return (dispatch) => {
    const url = '/superset/slice_json/'+ sliceId;
    return $.ajax({
      type: 'GET',
      url,
      data: undefined,
      success: ((data) => {
        dispatch(sliceById(data));
      }),
      error: (() => {
        dispatch(sliceByIdFailed());
      }),
    });
  };
}
