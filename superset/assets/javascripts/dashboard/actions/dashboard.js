import $ from 'jquery';

import { addChart, removeChart } from '../../chart/chartAction';
import { chart as initChart } from '../../chart/chartReducer';
import { fetchDatasourceMetadata } from '../../dashboard/actions/datasources';
import { applyDefaultFormData } from '../../explore/stores/store';

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(chart, col, vals, merge = true, refresh = true) {
  return { type: ADD_FILTER, chart, col, vals, merge, refresh };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(sliceId, col, vals, refresh = true) {
  return { type: REMOVE_FILTER, sliceId, col, vals, refresh };
}

export const UPDATE_DASHBOARD_TITLE = 'UPDATE_DASHBOARD_TITLE';
export function updateDashboardTitle(title) {
  return { type: UPDATE_DASHBOARD_TITLE, title };
}

export const ADD_SLICE = 'ADD_SLICE';
export function addSlice(slice) {
  return { type: ADD_SLICE, slice };
}

export const REMOVE_SLICE = 'REMOVE_SLICE';
export function removeSlice(sliceId) {
  return { type: REMOVE_SLICE, sliceId };
}

const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';
export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(id) {
  return function (dispatch) {
    const url = `${FAVESTAR_BASE_URL}/${id}/count`;
    return $.get(url)
      .done((data) => {
        if (data.count > 0) {
          dispatch(toggleFaveStar(true));
        }
      });
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(id, isStarred) {
  return function (dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    const url = `${FAVESTAR_BASE_URL}/${id}/${urlSuffix}/`;
    $.get(url);
    dispatch(toggleFaveStar(!isStarred));
  };
}

export const TOGGLE_EXPAND_SLICE = 'TOGGLE_EXPAND_SLICE';
export function toggleExpandSlice(slice, isExpanded) {
  return { type: TOGGLE_EXPAND_SLICE, slice, isExpanded };
}

export const SET_EDIT_MODE = 'SET_EDIT_MODE';
export function setEditMode(editMode) {
  return { type: SET_EDIT_MODE, editMode };
}

export const TOGGLE_BUILDER_PANE = 'TOGGLE_BUILDER_PANE';
export function toggleBuilderPane() {
  return { type: TOGGLE_BUILDER_PANE };
}

export function addSliceToDashboard(chartKey) {
  return (dispatch, getState) => {
    const { allSlices } = getState();
    const selectedSlice = allSlices.slices[chartKey];
    const form_data = JSON.parse(selectedSlice.form_data);
    const newChart = {
      ...initChart,
      chartKey,
      slice_id: selectedSlice.slice_id,
      form_data,
      formData: applyDefaultFormData(form_data),
    };

    return Promise
      .all([
        dispatch(addChart(newChart, chartKey)),
        dispatch(fetchDatasourceMetadata(form_data.datasource)),
      ])
      .then(() => dispatch(addSlice(selectedSlice)));
  };
}

export function removeSliceFromDashboard(chart) {
  return (dispatch) => {
    dispatch(removeSlice(chart.slice_id));
    dispatch(removeChart(chart.chartKey));
  };
}
