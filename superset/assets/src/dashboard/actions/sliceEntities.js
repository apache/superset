/* eslint camelcase: 0 */
import $ from 'jquery';

import { getDatasourceParameter } from '../../modules/utils';

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
    const { sliceEntities } = getState();
    if (sliceEntities.lastUpdated === 0) {
      dispatch(fetchAllSlicesStarted());

      const uri = `/sliceaddview/api/read?_flt_0_created_by=${userId}`;
      return $.ajax({
        url: uri,
        type: 'GET',
        success: response => {
          const slices = {};
          response.result.forEach(slice => {
            let form_data = JSON.parse(slice.params);
            let datasource = form_data.datasource;
            if (!datasource) {
              datasource = getDatasourceParameter(
                slice.datasource_id,
                slice.datasource_type,
              );
              form_data = {
                ...form_data,
                datasource,
              };
            }
            if (['markup', 'separator'].indexOf(slice.viz_type) === -1) {
              slices[slice.id] = {
                slice_id: slice.id,
                slice_url: slice.slice_url,
                slice_name: slice.slice_name,
                edit_url: slice.edit_url,
                form_data,
                datasource_name: slice.datasource_name_text,
                datasource_link: slice.datasource_link,
                changed_on: new Date(slice.changed_on).getTime(),
                description: slice.description,
                description_markdown: slice.description_markeddown,
                viz_type: slice.viz_type,
                modified: slice.modified
                  ? slice.modified.replace(/<[^>]*>/g, '')
                  : '',
              };
            }
          });
          return dispatch(setAllSlices(slices));
        },
        error: error => dispatch(fetchAllSlicesFailed(error)),
      });
    }

    return dispatch(setAllSlices(sliceEntities.slices));
  };
}
