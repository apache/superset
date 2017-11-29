/* global notify */
import $ from 'jquery';
import { getExploreUrl } from '../explore/exploreUtils';

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(sliceId, col, vals, merge = true, refresh = true) {
  return { type: ADD_FILTER, sliceId, col, vals, merge, refresh };
}

export const CLEAR_FILTER = 'CLEAR_FILTER';
export function clearFilter(sliceId) {
  return { type: CLEAR_FILTER, sliceId };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(sliceId, col, vals) {
  return { type: REMOVE_FILTER, sliceId, col, vals };
}

export const UPDATE_DASHBOARD_LAYOUT = 'UPDATE_DASHBOARD_LAYOUT';
export function updateDashboardLayout(layout) {
  return { type: UPDATE_DASHBOARD_LAYOUT, layout };
}

export const UPDATE_DASHBOARD_TITLE = 'UPDATE_DASHBOARD_TITLE';
export function updateDashboardTitle(title) {
  return { type: UPDATE_DASHBOARD_TITLE, title };
}

export function addSlicesToDashboard(dashboardId, sliceIds) {
  return () => (
    $.ajax({
      type: 'POST',
      url: `/superset/add_slices/${dashboardId}/`,
      data: {
        data: JSON.stringify({ slice_ids: sliceIds }),
      },
    })
      .done(() => {
        // Refresh page to allow for slices to re-render
        window.location.reload();
      })
  );
}

export const REMOVE_SLICE = 'REMOVE_SLICE';
export function removeSlice(slice) {
  return { type: REMOVE_SLICE, slice };
}

export const UPDATE_SLICE_NAME = 'UPDATE_SLICE_NAME';
export function updateSliceName(slice, sliceName) {
  return { type: UPDATE_SLICE_NAME, slice, sliceName };
}
export function saveSlice(slice, sliceName) {
  const oldName = slice.slice_name;
  return (dispatch) => {
    const sliceParams = {};
    sliceParams.slice_id = slice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = sliceName;
    const saveUrl = getExploreUrl(slice.form_data, 'base', false, null, sliceParams);
    return $.ajax({
      url: saveUrl,
      type: 'GET',
      success: () => {
        dispatch(updateSliceName(slice, sliceName));
        notify.success('This slice name was saved successfully.');
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        dispatch(updateSliceName(slice, oldName));
        notify.error("You don't have the rights to alter this slice");
      },
    });
  };
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
