/* global notify */
import $ from 'jquery';

export const UPDATE_SLICE_NAME = 'UPDATE_SLICE_NAME';
export function updateSliceName(key, sliceName) {
  return { type: UPDATE_SLICE_NAME, key, sliceName };
}

export function saveSliceName(slice, sliceName) {
  const oldName = slice.slice_name;
  return (dispatch) => {
    const sliceParams = {};
    sliceParams.slice_id = slice.slice_id;
    sliceParams.action = 'overwrite';
    sliceParams.slice_name = sliceName;

    const url = slice.slice_url + '&' +
      Object.keys(sliceParams)
      .map(key => (key + '=' + sliceParams[key]))
      .join('&');
    const key = 'slice_' + slice.slice_id;
    return $.ajax({
      url,
      type: 'POST',
      success: () => {
        dispatch(updateSliceName(key, sliceName));
        notify.success('This slice name was saved successfully.');
      },
      error: () => {
        // if server-side reject the overwrite action,
        // revert to old state
        dispatch(updateSliceName(key, oldName));
        notify.error("You don't have the rights to alter this slice");
      },
    });
  };
}

export const SET_ALL_SLICES = 'SET_ALL_SLICES';
export function setAllSlices(result) {
  return { type: SET_ALL_SLICES, result };
}

export const FETCH_ALL_SLICES_STARTED = 'FETCH_ALL_SLICES_STARTED';
export function fetchAllSlicesStarted() {
  return { type: FETCH_ALL_SLICES_STARTED };
}

export const FETCH_ALL_SLICES_FAILED = 'FETCH_ALL_SLICES_FAILED';
export function fetchAllSlicesFailed(error) {
  return { type: FETCH_ALL_SLICES_FAILED, error };
}

export function fetchAllSlices(userId) {
  return (dispatch) => {
    dispatch(fetchAllSlicesStarted());

    const uri = `/sliceaddview/api/read?_flt_0_created_by=${userId}`;
    return $.ajax({
      url: uri,
      type: 'GET',
      success: response => dispatch(setAllSlices(response.result)),
      error: error => dispatch(fetchAllSlicesFailed(error)),
    });
  };
}
