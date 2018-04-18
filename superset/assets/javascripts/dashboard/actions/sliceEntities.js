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
    const key = slice.slice_id;
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
export function setAllSlices(slices) {
  return { type: SET_ALL_SLICES, slices };
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
  return (dispatch, getState) => {
    const { sliceEntities }  = getState();
    if (sliceEntities.lastUpdated === 0) {
      dispatch(fetchAllSlicesStarted());

      const uri = `/sliceaddview/api/read?_flt_0_created_by=${userId}`;
      return $.ajax({
        url: uri,
        type: 'GET',
        success: response => {
          const slices = {};
          response.result.forEach(slice => {
            const form_data = JSON.parse(slice.params);
            slices[slice.id] = {
              slice_id: slice.id,
              slice_url: slice.slice_url,
              slice_name: slice.slice_name,
              edit_url: slice.edit_url,
              form_data,
              datasource: form_data.datasource,
              datasource_name: slice.datasource_name_text,
              datasource_link: slice.datasource_link,
              changed_on: new Date(slice.changed_on).getTime(),
              description: slice.description,
              description_markdown: slice.description_markeddown,
              viz_type: slice.viz_type,
              modified: slice.modified,
            }});
          return dispatch(setAllSlices(slices));
        },
        error: error => dispatch(fetchAllSlicesFailed(error)),
      });
    } else {
      return dispatch(setAllSlices(sliceEntities.slices));
    }
  };
}
