import * as actions from '../actions/sliceEntities';
import { t } from '../../locales';

export const initAllSlices = {
  slices: {},
  isLoading: true,
  errorMsg: null,
  lastUpdated: 0,
};

export default function(state = initAllSlices, action) {
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
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}