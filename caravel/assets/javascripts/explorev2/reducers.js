import shortid from 'shortid';
import * as actions from './actions';

const defaultTimeFilter = {
  timeColumn: null,
  timeGrain: null,
  since: null,
  until: null,
};

const defaultGroupBy = {
  groupByColumn: [],
  metrics: [],
};

const defaultSql = {
  where: '',
  having: '',
};

const defaultFilter = {
  id: shortid.generate(),
  eq: null,
  op: 'in',
  col: null,
};

export const initialState = {
  datasourceId: null,
  vizType: null,
  timeFilter: defaultTimeFilter,
  groupBy: defaultGroupBy,
  columns: [],
  orderings: [],
  timeStampFormat: null,
  rowLimit: null,
  searchBox: false,
  SQL: defaultSql,
  filters: [defaultFilter],
};

function addToArr(state, arrKey, obj) {
  const newState = {};
  newState[arrKey] = [...state[arrKey], obj];
  return Object.assign({}, state, newState);
}

function removeFromArr(state, arrKey, obj) {
  const newArr = [];
  state[arrKey].forEach((arrItem) => {
    if (!(obj === arrItem)) {
      newArr.push(arrItem);
    }
  });
  return Object.assign({}, state, { [arrKey]: newArr });
}

function addToObjArr(state, arrKey, obj) {
  const newObj = Object.assign({}, obj);
  if (!newObj.id) {
    newObj.id = shortid.generate();
  }
  const newState = {};
  newState[arrKey] = [...state[arrKey], newObj];
  return Object.assign({}, state, newState);
}

function removeFromObjArr(state, arrKey, obj, idKey = 'id') {
  const newArr = [];
  state[arrKey].forEach((arrItem) => {
    if (!(obj[idKey] === arrItem[idKey])) {
      newArr.push(arrItem);
    }
  });
  return Object.assign({}, state, { [arrKey]: newArr });
}

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasourceId: action.datasourceId });
    },
    [actions.SET_VIZTYPE]() {
      return Object.assign({}, state, { vizType: action.vizType });
    },
    [actions.SET_TIMEFILTER]() {
      return Object.assign({}, state, { timeFilter: action.timeFilter });
    },
    [actions.SET_GROUPBY]() {
      return Object.assign({}, state, { groupBy: action.groupBy });
    },
    [actions.ADD_COLUMN]() {
      return addToArr(state, 'columns', action.column);
    },
    [actions.REMOVE_COLUMN]() {
      return removeFromArr(state, 'columns', action.column);
    },
    [actions.ADD_ORDERING]() {
      return addToArr(state, 'orderings', action.ordering);
    },
    [actions.REMOVE_ORDERING]() {
      return removeFromArr(state, 'orderings', action.ordering);
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
      return addToObjArr(state, 'filters', action.filter);
    },
    [actions.REMOVE_FILTER]() {
      return removeFromObjArr(state, 'filters', action.filter);
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
