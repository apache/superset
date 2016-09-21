import * as actions from '../actions/exploreActions';
import { addToArr, removeFromArr } from '../../../utils/reducerUtils';

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasourceId: action.datasourceId });
    },
    [actions.SET_VIZTYPE]() {
      return Object.assign({}, state, { vizType: action.vizType });
    },
    [actions.SET_TIME_FILTER]() {
      return Object.assign({}, state, { timeFilter: action.timeFilter });
    },
    [actions.SET_GROUPBY]() {
      return Object.assign({}, state, { groupBy: action.groupBy });
    },
    [actions.ADD_COLUMN]() {
      return Object.assign({}, state, { columns: [...state.columns, action.column] });
    },
    [actions.REMOVE_COLUMN]() {
      const newColumns = [];
      state.columns.forEach((c) => {
        if (c !== action.column) {
          newColumns.push(c);
        }
      });
      return Object.assign({}, state, { columns: newColumns });
    },
    [actions.ADD_ORDERING]() {
      return Object.assign({}, state, { orderings: [...state.orderings, action.ordering] });
    },
    [actions.REMOVE_ORDERING]() {
      const newOrderings = [];
      state.orderings.forEach((o) => {
        if (o !== action.ordering) {
          newOrderings.push(o);
        }
      });
      return Object.assign({}, state, { orderings: newOrderings });
    },
    [actions.SET_TIME_STAMP]() {
      return Object.assign({}, state, { timeStampFormat: action.timeStampFormat });
    },
    [actions.SET_ROW_LIMIT]() {
      return Object.assign({}, state, { rowLimit: action.rowLimit });
    },
    [actions.TOGGLE_SEARCHBOX]() {
      return Object.assign({}, state, { searchBox: action.searchBox });
    },
    [actions.SET_SQL]() {
      return Object.assign({}, state, { SQL: action.sql });
    },
    [actions.ADD_FILTER]() {
      return addToArr(state, 'filters', action.filter);
    },
    [actions.REMOVE_FILTER]() {
      return removeFromArr(state, 'filters', action.filter);
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
