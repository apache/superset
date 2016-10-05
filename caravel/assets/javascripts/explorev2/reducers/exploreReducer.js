import { defaultFormData, defaultOpts } from '../stores/store';
import * as actions from '../actions/exploreActions';
import { addToArr, removeFromArr, alterInArr } from '../../../utils/reducerUtils';

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasourceId: action.datasourceId });
    },
    [actions.SET_VIZTYPE]() {
      return Object.assign({}, state, { vizType: action.vizType });
    },
    [actions.SET_TIME_COLUMN_OPTS]() {
      return Object.assign({}, state, { timeColumnOpts: action.timeColumnOpts });
    },
    [actions.SET_TIME_GRAIN_OPTS]() {
      return Object.assign({}, state, { timeGrainOpts: action.timeGrainOpts });
    },
    [actions.SET_TIME_COLUMN]() {
      return Object.assign({}, state, { timeColumn: action.timeColumn });
    },
    [actions.SET_TIME_GRAIN]() {
      return Object.assign({}, state, { timeGrain: action.timeGrain });
    },
    [actions.SET_SINCE]() {
      return Object.assign({}, state, { since: action.since });
    },
    [actions.SET_UNTIL]() {
      return Object.assign({}, state, { until: action.until });
    },
    [actions.SET_GROUPBY_COLUMN_OPTS]() {
      return Object.assign({}, state, { groupByColumnOpts: action.groupByColumnOpts });
    },
    [actions.SET_GROUPBY_COLUMNS]() {
      return Object.assign({}, state, { groupByColumns: action.groupByColumns });
    },
    [actions.SET_METRICS_OPTS]() {
      return Object.assign({}, state, { metricsOpts: action.metricsOpts });
    },
    [actions.SET_METRICS]() {
      return Object.assign({}, state, { metrics: action.metrics });
    },
    [actions.SET_COLUMN_OPTS]() {
      return Object.assign({}, state, { columnOpts: action.columnOpts });
    },
    [actions.SET_NOT_GROUPBY_COLUMNS]() {
      return Object.assign({}, state, { columns: action.columns });
    },
    [actions.SET_ORDERING_OPTS]() {
      return Object.assign({}, state, { orderingOpts: action.orderingOpts });
    },
    [actions.SET_ORDERINGS]() {
      return Object.assign({}, state, { orderings: action.orderings });
    },
    [actions.SET_TIME_STAMP_FORMAT]() {
      return Object.assign({}, state, { timeStampFormat: action.timeStampFormat });
    },
    [actions.SET_ROW_LIMIT]() {
      return Object.assign({}, state, { rowLimit: action.rowLimit });
    },
    [actions.TOGGLE_SEARCHBOX]() {
      return Object.assign({}, state, { searchBox: action.searchBox });
    },
    [actions.SET_WHERE_CLAUSE]() {
      return Object.assign({}, state, { whereClause: action.whereClause });
    },
    [actions.SET_HAVING_CLAUSE]() {
      return Object.assign({}, state, { havingClause: action.havingClause });
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
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
