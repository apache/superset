import * as actions from '../actions/allSlices';

export default function slicesReducer(allSlices = {}, action) {
  const actionHandlers = {
    [actions.UPDATE_SLICE_NAME](state) {
      return { ...state, slice_name: action.sliceName };
    },
  };

  if (action.type in actionHandlers) {
    return {
      ...allSlices,
      [action.key]: actionHandlers[action.type](allSlices[action.key], action),
    };
  }
  return allSlices;
}