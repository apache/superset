import VizDataStore from '../stores/VizDataStore';
import FormDataStore from '../stores/FormDataStore';
import * as global from '../actions/globalActions';
import * as actions from '../actions/vizDataActions';

export const vizDataReducer = function (state = new VizDataStore(), action) {
  const actionHandlers = {
    [global.RESET]() {
      return new VizDataStore();
    },
    [actions.SET_OUTDATED]() {
      return new VizDataStore(state, { outdated: action.outdated });
    },
    [actions.SET_DATA]() {
      return new VizDataStore(state, { data: action.data });
    },
    [actions.RESET_DATA]() {
      return new VizDataStore(state, { data: null });
    },
    [global.UPDATE_FORM_DATA]() {
      const formData = new FormDataStore(state.formData, action.formData);
      if (action.wipeData) {
        return new VizDataStore(state, { data: null, formData });
      }
      return new VizDataStore(state, { formData });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};

