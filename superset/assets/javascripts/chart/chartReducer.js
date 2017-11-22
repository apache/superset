/* eslint camelcase: 0 */
import PropTypes from 'prop-types';

import { now } from '../modules/dates';
import * as actions from './chartAction';
import { t } from '../locales';

export const chartPropType = {
  chartKey: PropTypes.string.isRequired,
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryRequest: PropTypes.object,
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  lastRendered: PropTypes.number,
};

export const chart = {
  chartKey: '',
  chartAlert: null,
  chartStatus: 'loading',
  chartUpdateEndTime: null,
  chartUpdateStartTime: now(),
  latestQueryFormData: null,
  queryRequest: null,
  queryResponse: null,
  triggerQuery: true,
  lastRendered: 0,
};

export default function chartReducer(charts = {}, action) {
  const actionHandlers = {
    [actions.CHART_UPDATE_SUCCEEDED](state) {
      return { ...state,
        chartStatus: 'success',
        queryResponse: action.queryResponse,
        chartUpdateEndTime: now(),
      };
    },
    [actions.CHART_UPDATE_STARTED](state) {
      return { ...state,
        chartStatus: 'loading',
        chartAlert: null,
        chartUpdateEndTime: null,
        chartUpdateStartTime: now(),
        queryRequest: action.queryRequest,
      };
    },
    [actions.CHART_UPDATE_STOPPED](state) {
      return { ...state,
        chartStatus: 'stopped',
        chartAlert: t('Updating chart was stopped'),
      };
    },
    [actions.CHART_RENDERING_FAILED](state) {
      return { ...state,
        chartStatus: 'failed',
        chartAlert: t('An error occurred while rendering the visualization: %s', action.error),
      };
    },
    [actions.CHART_UPDATE_TIMEOUT](state) {
      return { ...state,
        chartStatus: 'failed',
        chartAlert: (
        `<strong>${t('Query timeout')}</strong> - ` +
        t(`visualization queries are set to timeout at ${action.timeout} seconds. `) +
        t('Perhaps your data has grown, your database is under unusual load, ' +
          'or you are simply querying a data source that is too large ' +
          'to be processed within the timeout range. ' +
          'If that is the case, we recommend that you summarize your data further.')),
      };
    },
    [actions.CHART_UPDATE_FAILED](state) {
      return { ...state,
        chartStatus: 'failed',
        chartAlert: action.queryResponse ? action.queryResponse.error : t('Network error.'),
        chartUpdateEndTime: now(),
        queryResponse: action.queryResponse,
      };
    },
    [actions.TRIGGER_QUERY](state) {
      return { ...state, triggerQuery: action.value };
    },
    [actions.RENDER_TRIGGERED](state) {
      return { ...state, lastRendered: action.value };
    },
  };

  /* eslint-disable no-param-reassign */
  if (action.type === actions.REMOVE_CHART) {
    delete charts[action.key];
    return charts;
  }

  if (action.type in actionHandlers) {
    return { ...charts, [action.key]: actionHandlers[action.type](charts[action.key], action) };
  }

  return charts;
}
