import { defaultFormData, defaultOpts } from '../stores/store';
import * as actions from '../actions/exploreActions';
import { addToArr, removeFromArr, alterInArr } from '../../../utils/reducerUtils';

const setFormInViz = function (state, action) {
  const newFormData = Object.assign({}, state);
  newFormData[action.key] = action.value;
  return newFormData;
};

const setVizInState = function (state, action) {
  switch (action.type) {
    case actions.SET_FORM_DATA:
      return {
        ...state,
        formData: setFormInViz(state.formData, action),
      };
    default:
      return state;
  }
};

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasourceId: action.datasourceId });
    },
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
    [actions.TOGGLE_SEARCHBOX]() {
      return Object.assign({}, state, { searchBox: action.searchBox });
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
    [actions.RESET_FORM_DATA]() {
      return Object.assign({}, state, defaultFormData);
    },
    [actions.CLEAR_ALL_OPTS]() {
      return Object.assign({}, state, defaultOpts);
    },
    [actions.SET_DATASOURCE_TYPE]() {
      return Object.assign({}, state, { datasourceType: action.datasourceType });
    },
    [actions.SET_FORM_DATA]() {
      return {
        ...state,
        viz: setVizInState(state.viz, action),
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
