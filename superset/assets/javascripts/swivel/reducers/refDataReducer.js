import * as global from '../actions/globalActions';
import * as actions from '../actions/refDataActions';

import RefDataStore from '../stores/RefDataStore';

export const refDataReducer = function (state = new RefDataStore(), action) {
  const actionHandlers = {
    [global.RESET]() {
      return new RefDataStore({ datasources: state.datasources });
    },
    [actions.SET_COLUMNS]() {
      return Object.assign({}, state, { columns: action.columns });
    },
    [actions.SET_METRICS]() {
      return Object.assign({}, state, { metrics: action.metrics });
    },
    [actions.SET_TIME_GRAINS]() {
      return Object.assign({}, state, { timeGrains: action.timeGrains });
    },
    [actions.SET_DATASOURCES]() {
      return Object.assign({}, state, { datasources: action.datasources });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
