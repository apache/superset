/* eslint camelcase: 0 */
import { now } from '../../modules/dates';
import * as actions from '../actions/chartActions';
import { t } from '../../locales';

export default function chartReducer(state = {}, action) {
  const actionHandlers = {
    [actions.CHART_UPDATE_SUCCEEDED]() {
      return Object.assign(
        {},
        state,
        {
          chartStatus: 'success',
          queryResponse: action.queryResponse,
        },
      );
    },
    [actions.CHART_UPDATE_STARTED]() {
      return Object.assign({}, state,
        {
          chartStatus: 'loading',
          chartUpdateEndTime: null,
          chartUpdateStartTime: now(),
          queryRequest: action.queryRequest,
          latestQueryFormData: action.latestQueryFormData,
        });
    },
    [actions.CHART_UPDATE_STOPPED]() {
      return Object.assign({}, state,
        {
          chartStatus: 'stopped',
          chartAlert: t('Updating chart was stopped'),
        });
    },
    [actions.CHART_RENDERING_FAILED]() {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: t('An error occurred while rendering the visualization: %s', action.error),
      });
    },
    [actions.CHART_UPDATE_TIMEOUT]() {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: (
          '<strong>Query timeout</strong> - visualization query are set to timeout at ' +
          `${action.timeout} seconds. ` +
          t('Perhaps your data has grown, your database is under unusual load, ' +
          'or you are simply querying a data source that is to large ' +
          'to be processed within the timeout range. ' +
          'If that is the case, we recommend that you summarize your data further.')),
      });
    },
    [actions.CHART_UPDATE_FAILED]() {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: action.queryResponse ? action.queryResponse.error : t('Network error.'),
        chartUpdateEndTime: now(),
        queryResponse: action.queryResponse,
      });
    },
    [actions.UPDATE_CHART_STATUS]() {
      const newState = Object.assign({}, state, { chartStatus: action.status });
      if (action.status === 'success' || action.status === 'failed') {
        newState.chartUpdateEndTime = now();
      }
      return newState;
    },
    [actions.REMOVE_CHART_ALERT]() {
      if (state.chartAlert !== null) {
        return Object.assign({}, state, { chartAlert: null });
      }
      return state;
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
