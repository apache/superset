import {
  FETCH_ALL_SLICES_FAILED,
  FETCH_ALL_SLICES_STARTED,
  SET_ALL_SLICES,
  UPDATE_SLICE_NAME,
} from '../actions/sliceEntities';
import { t } from '../../locales';

export const initSliceEntities = {
  slices: {},
  isLoading: true,
  errorMessage: null,
  lastUpdated: 0,
};

export default function (state = initSliceEntities, action) {
  const actionHandlers = {
    [UPDATE_SLICE_NAME]() {
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
    [FETCH_ALL_SLICES_STARTED]() {
      return {
        ...state,
        isLoading: true,
      };
    },
    [SET_ALL_SLICES]() {
      return {
        ...state,
        isLoading: false,
        slices: { ...state.slices, ...action.slices }, // append more slices
        lastUpdated: new Date().getTime(),
      };
    },
    [FETCH_ALL_SLICES_FAILED]() {
      const respJSON = action.error.responseJSON;
      const errorMessage =
        t('Sorry, there was an error adding slices to this dashboard: ') +
        (respJSON && respJSON.message) ? respJSON.message :
          error.responseText;
      return {
        ...state,
        isLoading: false,
        errorMessage,
        lastUpdated: new Date().getTime(),
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
