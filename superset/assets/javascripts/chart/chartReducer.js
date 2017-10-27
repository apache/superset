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
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  triggerRender: PropTypes.bool,
};

export const chart = {
  chartKey: '',
  chartAlert: null,
  chartStatus: null,
  chartUpdateEndTime: null,
  chartUpdateStartTime: now(),
  latestQueryFormData: null,
  queryResponse: null,
  triggerQuery: true,
  triggerRender: false,
};

export default function chartReducer(charts = {}, action) {
  const actionHandlers = {
    [actions.CHART_UPDATE_SUCCEEDED](state) {
      return Object.assign(
        {},
        state,
        {
          chartStatus: 'success',
          queryResponse: action.queryResponse,
          chartUpdateEndTime: now(),
        },
      );
    },
    [actions.CHART_UPDATE_STARTED](state) {
      return Object.assign({}, state,
        {
          chartStatus: 'loading',
          chartUpdateEndTime: null,
          chartUpdateStartTime: now(),
          queryRequest: action.queryRequest,
        });
    },
    [actions.CHART_UPDATE_STOPPED](state) {
      return Object.assign({}, state,
        {
          chartStatus: 'stopped',
          chartAlert: t('Updating chart was stopped'),
        });
    },
    [actions.CHART_RENDERING_FAILED](state) {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: t('An error occurred while rendering the visualization: %s', action.error),
      });
    },
    [actions.CHART_UPDATE_TIMEOUT](state) {
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
    [actions.CHART_UPDATE_FAILED](state) {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: action.queryResponse ? action.queryResponse.error : t('Network error.'),
        chartUpdateEndTime: now(),
        queryResponse: action.queryResponse,
      });
    },
    [actions.TRIGGER_QUERY](state) {
      return Object.assign({}, state, { triggerQuery: action.value });
    },
    [actions.RENDER_TRIGGERED](state) {
      return Object.assign({}, state, { triggerRender: false });
    },
  };

  /* eslint-disable no-param-reassign */
  if (action.type === actions.REMOVE_CHART) {
    delete charts[action.key];
    return charts;
  }

  if (action.type in actionHandlers) {
    return Object.assign({}, charts, {
      [action.key]: actionHandlers[action.type](charts[action.key], action),
    });
  }

  return charts;
}
