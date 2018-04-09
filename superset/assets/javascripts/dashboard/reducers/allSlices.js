import * as actions from '../actions/allSlices';
import { t } from '../../locales';

export const initAllSlices = {
  slices: {},
  isLoading: true,
  errorMsg: null,
  lastUpdated: 0,
};

export default function allSlicesReducer(state = initAllSlices, action) {
  const actionHandlers = {
    [actions.UPDATE_SLICE_NAME]() {
      const updatedSlice = {
        ...state.slices[action.key],
        slice_name: action.sliceName,
      };
      const updatedSlices = {
        ...state.slices,
        [action.key]: updatedSlice,
      };
      return { ...state, slices: updatedSlices };
    },
    [actions.FETCH_ALL_SLICES_STARTED]() {
      return {
        ...state,
        isLoading: true,
      }
    },
    [actions.SET_ALL_SLICES]() {
      let slices = { ...state.slices };
      action.result.map(slice => (
        slices['slice_' + slice.id] = {
          slice_id: slice.id,
          slice_url: slice.slice_url,
          slice_name: slice.slice_name,
          edit_url: slice.edit_url,
          form_data: slice.params,
          datasource_name: slice.datasource_name_text,
          datasource_link: slice.datasource_link,
          changed_on: new Date(slice.changed_on).getTime(),
          description: slice.description,
          description_markdown: slice.description_markeddown,
          viz_type: slice.viz_type,
          modified: slice.modified,
        }));

      return {
        ...state,
        isLoading: false,
        slices,
        lastUpdated: new Date().getTime(),
      }
    },
    [actions.FETCH_ALL_SLICES_FAILED]() {
      const respJSON = action.error.responseJSON;
      const errorMsg =
        t('Sorry, there was an error adding slices to this dashboard: ') +
        (respJSON && respJSON.message) ? respJSON.message :
          error.responseText;
      return {
        ...state,
        isLoading: false,
        errorMsg,
        lastUpdated: new Date().getTime(),
      }
    }
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}