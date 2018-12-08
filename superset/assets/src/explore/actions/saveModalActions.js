import { SupersetClient } from '@superset-ui/connection';
import { getExploreUrlAndPayload } from '../exploreUtils';

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export function fetchDashboards(userId) {
  return function fetchDashboardsThunk(dispatch) {
    return SupersetClient.get({
      endpoint: `/dashboardasync/api/read?_flt_0_owners=${userId}`,
    })
      .then(({ json }) => {
        const choices = json.pks.map((id, index) => ({
          value: id,
          label: (json.result[index] || {}).dashboard_title,
        }));

        return dispatch(fetchDashboardsSucceeded(choices));
      })
      .catch(() => dispatch(fetchDashboardsFailed(userId)));
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

    return SupersetClient.post({ url, postPayload: { form_data: payload } })
      .then(({ json }) => dispatch(saveSliceSuccess(json)))
      .catch(() => dispatch(saveSliceFailed()));
  };
}
