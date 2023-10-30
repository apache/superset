/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */
import { t } from '@superset-ui/core';
import { omit } from 'lodash';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import { DatasourcesAction } from 'src/dashboard/actions/datasources';
import { ChartState } from 'src/explore/types';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import { HYDRATE_EXPLORE } from 'src/explore/actions/hydrateExplore';
import { now } from 'src/utils/dates';
import * as actions from './chartAction';

export const chart: ChartState = {
  id: 0,
  chartAlert: null,
  chartStatus: 'loading',
  chartStackTrace: null,
  chartUpdateEndTime: null,
  chartUpdateStartTime: 0,
  latestQueryFormData: {},
  sliceFormData: null,
  queryController: null,
  queriesResponse: null,
  triggerQuery: true,
  lastRendered: 0,
};

type ChartActionHandler = (state: ChartState) => ChartState;

type AnyChartAction = Record<string, any>;

export default function chartReducer(
  charts: Record<string, ChartState> = {},
  action: AnyChartAction,
) {
  const actionHandlers: Record<string, ChartActionHandler> = {
    [actions.ADD_CHART]() {
      return {
        ...chart,
        ...action.chart,
      };
    },
    [actions.CHART_UPDATE_SUCCEEDED](state) {
      return {
        ...state,
        chartStatus: 'success',
        chartAlert: null,
        queriesResponse: action.queriesResponse,
        chartUpdateEndTime: now(),
      };
    },
    [actions.CHART_UPDATE_STARTED](state) {
      return {
        ...state,
        chartStatus: 'loading',
        chartStackTrace: null,
        chartAlert: null,
        chartUpdateEndTime: null,
        chartUpdateStartTime: now(),
        queryController: action.queryController,
      };
    },
    [actions.CHART_UPDATE_STOPPED](state) {
      return {
        ...state,
        chartStatus: 'stopped',
        chartAlert: t('Updating chart was stopped'),
        chartUpdateEndTime: now(),
      };
    },
    [actions.CHART_RENDERING_SUCCEEDED](state) {
      return { ...state, chartStatus: 'rendered', chartUpdateEndTime: now() };
    },
    [actions.CHART_RENDERING_FAILED](state) {
      return {
        ...state,
        chartStatus: 'failed',
        chartStackTrace: action.stackTrace,
        chartAlert: t(
          'An error occurred while rendering the visualization: %s',
          action.error,
        ),
      };
    },
    [actions.CHART_UPDATE_FAILED](state) {
      return {
        ...state,
        chartStatus: 'failed',
        chartAlert: action.queriesResponse
          ? action.queriesResponse?.[0]?.error
          : t('Network error.'),
        chartUpdateEndTime: now(),
        queriesResponse: action.queriesResponse,
        chartStackTrace: action.queriesResponse
          ? action.queriesResponse?.[0]?.stacktrace
          : null,
      };
    },
    [actions.DYNAMIC_PLUGIN_CONTROLS_READY](state) {
      const sliceFormData = getFormDataFromControls(action.controlsState);
      return { ...state, sliceFormData };
    },
    [actions.TRIGGER_QUERY](state) {
      return {
        ...state,
        triggerQuery: action.value,
        chartStatus: 'loading',
      };
    },
    [actions.RENDER_TRIGGERED](state) {
      return { ...state, lastRendered: action.value };
    },
    [actions.UPDATE_QUERY_FORM_DATA](state) {
      return { ...state, latestQueryFormData: action.value };
    },
    [actions.ANNOTATION_QUERY_STARTED](state) {
      if (state.annotationQuery?.[action.annotation.name]) {
        state.annotationQuery[action.annotation.name].abort();
      }
      const annotationQuery = {
        ...state.annotationQuery,
        [action.annotation.name]: action.queryController,
      };
      return {
        ...state,
        annotationQuery,
      };
    },
    [actions.ANNOTATION_QUERY_SUCCESS](state) {
      const annotationData = {
        ...state.annotationData,
        [action.annotation.name]: action.queryResponse.data,
      };
      const annotationError = { ...state.annotationError };
      delete annotationError[action.annotation.name];
      const annotationQuery = { ...state.annotationQuery };
      delete annotationQuery[action.annotation.name];
      return {
        ...state,
        annotationData,
        annotationError,
        annotationQuery,
      };
    },
    [actions.ANNOTATION_QUERY_FAILED](state) {
      const annotationData = { ...state.annotationData };
      delete annotationData[action.annotation.name];
      const annotationError = {
        ...state.annotationError,
        [action.annotation.name]: action.queryResponse
          ? action.queryResponse.error
          : t('Network error.'),
      };
      const annotationQuery = { ...state.annotationQuery };
      delete annotationQuery[action.annotation.name];
      return {
        ...state,
        annotationData,
        annotationError,
        annotationQuery,
      };
    },
  };

  /* eslint-disable no-param-reassign */
  if (action.type === actions.REMOVE_CHART) {
    return omit(charts, [action.key]);
  }
  if (action.type === actions.UPDATE_CHART_ID) {
    const { newId, key } = action;
    charts[newId] = {
      ...charts[key],
      id: newId,
    };
    delete charts[key];
    return charts;
  }
  if (action.type === HYDRATE_DASHBOARD || action.type === HYDRATE_EXPLORE) {
    return { ...action.data.charts };
  }
  if (action.type === DatasourcesAction.SET_DATASOURCES) {
    return Object.fromEntries(
      Object.entries(charts).map(([chartId, chart]) => [
        chartId,
        // some charts may not have properly handled missing datasource,
        // causing a JS error, so we reset error message and try to re-render
        // the chart once the datasource is fully loaded
        chart.chartStatus === 'failed' && chart.chartStackTrace
          ? {
              ...chart,
              chartStatus: '',
              chartStackTrace: null,
              chartAlert: null,
            }
          : chart,
      ]),
    );
  }

  if (action.type in actionHandlers) {
    return {
      ...charts,
      [action.key]: actionHandlers[action.type](charts[action.key]),
    };
  }

  return charts;
}
