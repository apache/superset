import { defaultOpts } from '../stores/store';
import * as actions from '../actions/exploreActions';
import { addToArr, removeFromArr, alterInArr } from '../../../utils/reducerUtils';

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.SET_TIME_COLUMN_OPTS]() {
      return Object.assign({}, state, { timeColumnOpts: action.timeColumnOpts });
    },
    [actions.SET_TIME_GRAIN_OPTS]() {
      return Object.assign({}, state, { timeGrainOpts: action.timeGrainOpts });
    },
    [actions.SET_GROUPBY_COLUMN_OPTS]() {
      return Object.assign({}, state, { groupByColumnOpts: action.groupByColumnOpts });
    },
    [actions.SET_METRICS_OPTS]() {
      return Object.assign({}, state, { metricsOpts: action.metricsOpts });
    },
    [actions.SET_COLUMN_OPTS]() {
      return Object.assign({}, state, { columnOpts: action.columnOpts });
    },
    [actions.SET_ORDERING_OPTS]() {
      return Object.assign({}, state, { orderingOpts: action.orderingOpts });
    },
    [actions.SET_FILTER_COLUMN_OPTS]() {
      return Object.assign({}, state, { filterColumnOpts: action.filterColumnOpts });
    },
    [actions.ADD_FILTER]() {
      return addToArr(state, 'filters', action.filter);
    },
    [actions.REMOVE_FILTER]() {
      return removeFromArr(state, 'filters', action.filter);
    },
    [actions.CHANGE_FILTER_FIELD]() {
      return alterInArr(state, 'filters', action.filter, { field: action.field });
    },
    [actions.CHANGE_FILTER_OP]() {
      return alterInArr(state, 'filters', action.filter, { op: action.op });
    },
    [actions.CHANGE_FILTER_VALUE]() {
      return alterInArr(state, 'filters', action.filter, { value: action.value });
    },
    [actions.CLEAR_ALL_OPTS]() {
      return Object.assign({}, state, defaultOpts);
    },
    [actions.SET_FIELD_VALUE]() {
      const newState = Object.assign({}, state);
      newState.viz.form_data[action.key] =
        action.value ? action.value : (!state.viz.form_data[action.key]);
      return newState;
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
