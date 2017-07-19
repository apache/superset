import * as actions from '../actions/keyBindingsActions';

// You watch for the phase change to trigger on keybindings

export const keyBindingsReducer = function (state = {}, action) {
  const actionHandlers = {
    [actions.SEARCH_COLUMNS]() {
      return { ...state, columnSearchTrigger: !state.columnSearchTrigger };
    },
    [actions.SEARCH_METRICS]() {
      return { ...state, metricSearchTrigger: !state.metricSearchTrigger };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};

