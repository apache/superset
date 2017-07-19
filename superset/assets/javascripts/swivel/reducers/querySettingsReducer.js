import * as actions from '../actions/querySettingsActions';
import * as global from '../actions/globalActions';

import QuerySettingsStore from '../stores/QuerySettingsStore';
import { importFormData } from '../formDataUtils/importQuerySettings';

import ColumnTypes from '../ColumnTypes';

function twoDigits(d) {
  if (d >= 0 && d < 10) return '0' + d.toString();
  if (d > -10 && d < 0) return '-0' + (-1 * d).toString();
  return d.toString();
}

function toMysqlFormat(timestamp) {
  return timestamp.getUTCFullYear() + '-' + twoDigits(1 + timestamp.getUTCMonth()) + '-' +
      twoDigits(timestamp.getUTCDate()) + ' ' + twoDigits(timestamp.getUTCHours()) + ':' +
      twoDigits(timestamp.getUTCMinutes()) + ':' + twoDigits(timestamp.getUTCSeconds());
}


export const querySettingsReducer = function (currentState = new QuerySettingsStore(), action) {
  let state = currentState;
  if (state.constructor.name !== QuerySettingsStore.name) {
    state = new QuerySettingsStore(state);
  }
  const actionHandlers = {
    [global.RESET]() {
      return new QuerySettingsStore();
    },
    [global.IMPORT_FORM_DATA]() {
      const newState = new QuerySettingsStore(state);
      return importFormData(newState, action.formData, action.refData);
    },
    [actions.SET_DATASOURCE]() {
      if (state.datasource === action.uid) {
        return state;
      }
      return new QuerySettingsStore({ datasource: action.uid });
    },
    [actions.SET_VIZTYPE]() {
      if (action.vizType === state.vizType) {
        return state;
      }
      return state.getNextState({ vizType: action.vizType });
    },
    [actions.TOGGLE_METRIC]() {
      const id = action.metric.id;
      let orderBy = state.orderBy;
      const metrics = Object.assign({}, state.metrics);
      if (metrics[id]) {
        delete metrics[id];
        if (orderBy === id) {
          orderBy = Object.keys(metrics).sort()[0];
        }
      } else {
        metrics[id] = true;
        if (!orderBy || orderBy === '') {
          orderBy = id;
        }
      }
      return state.getNextState({ metrics, orderBy });
    },
    [actions.CONFIGURE_FILTER]() {
      const index = state.filters.findIndex(
          i => i.id === action.filter.id,
      );
      const filters = state.filters.slice();
      if (JSON.stringify(filters[index]) === JSON.stringify(action.filter)) {
        return state;
      }
      filters[index] = action.filter;
      return state.getNextState({ filters });
    },
    [actions.CONFIGURE_SPLIT]() {
      const index = state.splits.findIndex(
          i => i.id === action.split.id,
      );
      const prevSplit = state.splits[index];
      const splitProps = { justAdded: false };
      const stateProps = {};
      if (prevSplit.columnType === ColumnTypes.TIMESTAMP) {
        if (prevSplit.granularity === action.split.granularity) {
          return state;
        }

        splitProps.granularity = action.split.granularity;
      } else {
        const { limit, orderBy, orderDesc } = action.split;
        const parsedLimit = Number.parseInt(limit, 10) ? Number.parseInt(limit, 10) : null;
        if (state.limit === parsedLimit &&
            state.orderBy === orderBy &&
            state.orderDesc === orderDesc
        ) {
          return state;
        }
        stateProps.limit = parsedLimit;
        stateProps.orderBy = orderBy;
        stateProps.orderDesc = orderDesc;
      }
      const splits = state.splits.slice();
      splits[index] = Object.assign({}, prevSplit, splitProps);
      return state.getNextState(stateProps, { splits });
    },
    [actions.REMOVE_FILTER]() {
      const index = state.filters.findIndex(
          i => i.id === action.filter.id,
      );
      if (index > -1) {
        const filters = state.filters.slice();
        filters.splice(index, 1);
        return state.getNextState({ filters });
      }
      return state;
    },
    [actions.REMOVE_SPLIT]() {
      const index = state.splits.findIndex(
          i => i.id === action.split.id,
      );
      if (index > -1) {
        const splits = state.splits.slice();
        splits.splice(index, 1);
        if (!splits.length) {
          return state.getNextState({
            splits,
            limit: null,
            orderBy: null,
            orderDesc: true,
          });
        }
        return state.getNextState({ splits });
      }
      return state;
    },
    [actions.ADD_FILTER]() {
      const index = state.filters.findIndex(
          i => i.id === action.filter.id,
      );
      if (index < 0 && action.filter) {
        const filters = state.filters.slice();
        filters.push(action.filter);
        return state.getNextState({ filters });
      }
      return state;
    },
    [actions.ADD_SPLIT]() {
      const index = state.splits.findIndex(
          i => i.id === action.split.id,
      );
      if (index < 0 && action.split) {
        const splits = state.splits.slice();
        splits.push({
          ...action.split,
          justAdded: true,
        });
        return state.getNextState({ splits });
      }
      return state;
    },
    [actions.CHANGE_INTERVAL]() {
      let start = new Date(action.intervalStart);
      let end = new Date(action.intervalEnd);
      if (action.intervalStart > action.intervalEnd) {
        start = new Date(action.intervalEnd);
        end = new Date(action.intervalStart);
      }
      const index = state.filters.findIndex(
          x => x.columnType === ColumnTypes.TIMESTAMP,
      );
      if (index < 0) {
        return state;
      }
      const filters = state.filters.slice();
      filters[index] = Object.assign({}, filters[index],
        {
          intervalStart: toMysqlFormat(start),
          intervalEnd: toMysqlFormat(end),
        });
      return state.getNextState({ filters });
    },

    [actions.SET_DEFAULTS]() {
      const refData = action.refData;
      if (refData.columns && !state.filters.length) {
        state = querySettingsReducer(state, actions.addFilter(
            refData.columns.find(x => x.columnType === ColumnTypes.TIMESTAMP)));
      }
      if (refData.metrics &&
          refData.metrics.length &&
          !Object.keys(state.metrics).length) {
        state = querySettingsReducer(state, actions.toggleMetric(refData.metrics[0]));
      }
      return state;
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]() || state;
  }
  return state;
};
