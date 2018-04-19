/* global notify */
import $ from 'jquery';

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(sliceId, col, vals, merge = true, refresh = true) {
  return { type: ADD_FILTER, sliceId, col, vals, merge, refresh };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(sliceId, col, vals, refresh = true) {
  return { type: REMOVE_FILTER, sliceId, col, vals, refresh };
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
