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
import type {
  ChartRangeFailure,
  ChartRangesError,
  DashboardLimitsPayload,
} from 'src/utils/timeRangeLimits';
import {
  REMOVE_CHART,
  CHART_UPDATE_STARTED,
} from 'src/components/Chart/chartAction';
import {
  CHART_RANGES_HOLD,
  TIME_RANGE_LIMITS_FAILED,
  TIME_RANGE_LIMITS_LOADED,
  TIME_RANGE_LIMITS_LOADING,
  TIME_RANGE_USER_APPLY,
  type TimeRangeLimitsAction,
} from '../actions/timeRangeLimits';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';
import {
  ON_REFRESH,
  SET_ACTIVE_TAB,
  SET_ACTIVE_TABS,
} from '../actions/dashboardState';

/**
 * Where a held chart's failing ranges came from: the Time Range filter whose
 * applied value reached the chart (the dashboard's merge rule), the chart's own ranges,
 * or both.
 */
export type ChartHoldAttribution = {
  filterId: string | null;
  filterValue: string | null;
  chart: boolean;
};

export type ChartHoldStatus =
  | 'checking'
  | 'valid'
  | 'queried'
  | 'invalid'
  | 'unbounded'
  | 'unavailable'
  | 'error'
  | 'rejected';

/**
 * The check of one chart's request, keyed by the form data it was run for. A
 * `valid` check lets exactly one request through; it is `queried` once sent.
 */
export type ChartHold = {
  signature: string;
  status: ChartHoldStatus;
  failures?: ChartRangeFailure[];
  error?: ChartRangesError;
  attribution?: ChartHoldAttribution;
};

/**
 * The Time Range filter values of the user's last Apply, until a server
 * rejection for one of them moves focus, or the charts that Apply ran settle,
 * or a refresh, a tab change or another dashboard comes first. `started` once
 * a chart is checked or posted after it.
 */
export type TimeRangeUserApply = {
  filters: Record<string, string>;
  started: boolean;
};

export type TimeRangeLimitsState = {
  status: 'off' | 'loading' | 'loaded' | 'failed';
  dashboardId: number | null;
  request: number;
  payload: DashboardLimitsPayload | null;
  charts: Record<number, ChartHold>;
  userApply?: TimeRangeUserApply;
  /** A load of this dashboard failed and no load has succeeded since. */
  failedBefore: boolean;
  /** Counts the dashboard state hydrations: a load, or Try again on a link. */
  hydrations?: number;
};

const startUserApply = (state: TimeRangeLimitsState): TimeRangeLimitsState =>
  state.userApply && !state.userApply.started
    ? { ...state, userApply: { ...state.userApply, started: true } }
    : state;

export const initialTimeRangeLimitsState: TimeRangeLimitsState = {
  status: 'off',
  dashboardId: null,
  request: 0,
  payload: null,
  charts: {},
  failedBefore: false,
};

export default function timeRangeLimitsReducer(
  state: TimeRangeLimitsState = initialTimeRangeLimitsState,
  action:
    | TimeRangeLimitsAction
    | {
        type: typeof CHART_UPDATE_STARTED | typeof REMOVE_CHART;
        key: string | number;
      }
    | {
        type:
          | typeof HYDRATE_DASHBOARD
          | typeof ON_REFRESH
          | typeof SET_ACTIVE_TAB
          | typeof SET_ACTIVE_TABS;
      },
): TimeRangeLimitsState {
  switch (action.type) {
    case REMOVE_CHART: {
      if (!state.charts[action.key as number]) {
        return state;
      }
      const charts = { ...state.charts };
      delete charts[action.key as number];
      return { ...state, charts };
    }
    case CHART_UPDATE_STARTED: {
      const hold = state.charts[action.key as number];
      return startUserApply(
        hold?.status === 'valid'
          ? {
              ...state,
              charts: {
                ...state.charts,
                [action.key]: { ...hold, status: 'queried' },
              },
            }
          : state,
      );
    }
    case TIME_RANGE_USER_APPLY:
      return action.filters || state.userApply
        ? {
            ...state,
            userApply: action.filters
              ? { filters: action.filters, started: false }
              : undefined,
          }
        : state;
    case HYDRATE_DASHBOARD:
      return state.status === 'off'
        ? state
        : { ...state, hydrations: (state.hydrations ?? 0) + 1 };
    case ON_REFRESH:
    case SET_ACTIVE_TAB:
    case SET_ACTIVE_TABS:
      return state.userApply ? { ...state, userApply: undefined } : state;
    case TIME_RANGE_LIMITS_LOADING:
      return action.dashboardId === state.dashboardId
        ? { ...state, status: 'loading', request: action.request }
        : {
            ...initialTimeRangeLimitsState,
            status: 'loading',
            dashboardId: action.dashboardId,
            request: action.request,
            hydrations: state.hydrations,
          };
    case TIME_RANGE_LIMITS_LOADED:
      return action.request === state.request
        ? {
            ...state,
            status: 'loaded',
            payload: action.payload,
            failedBefore: false,
          }
        : state;
    case TIME_RANGE_LIMITS_FAILED:
      return action.request === state.request
        ? { ...state, status: 'failed', payload: null, failedBefore: true }
        : state;
    case CHART_RANGES_HOLD: {
      if (action.dashboardId !== state.dashboardId) {
        return state;
      }
      const next = {
        ...state,
        charts: { ...state.charts, [action.chartId]: action.hold },
      };
      return action.hold.status === 'checking' ? startUserApply(next) : next;
    }
    default:
      return state;
  }
}
