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
/* eslint-disable camelcase */
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  SET_REPORT,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
} from '../actions/reports';

export default function reportsReducer(state = {}, action) {
  const actionHandlers = {
    [SET_REPORT]() {
      // Grabs the first report with a dashboard id that
      // matches the parameter report's dashboard_id
      const reportWithDashboard = action.report.result?.find(
        report => !!report.dashboard_id,
      );
      // Grabs the first report with a chart id that
      // matches the parameter report's chart.id
      const reportWithChart = action.report.result?.find(
        report => !!report.chart?.id,
      );

      // This organizes report by its type, dashboard or chart
      // and indexes it by the dashboard/chart id
      if (reportWithDashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards,
            [reportWithDashboard.dashboard_id]: reportWithDashboard,
          },
        };
      }
      if (reportWithChart) {
        return {
          ...state,
          charts: {
            ...state.chart,
            [reportWithChart.chart.id]: reportWithChart,
          },
        };
      }
      return {
        ...state,
      };
    },

    [ADD_REPORT]() {
      const { result, id } = action.json;
      const report = { ...result, id };
      if (result.dashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards,
            [result.dashboard]: report,
          },
        };
      }
      if (result.chart) {
        return {
          ...state,
          charts: {
            ...state.chart,
            [result.chart]: report,
          },
        };
      }
      return {
        ...state,
      };
    },

    [EDIT_REPORT]() {
      const report = {
        ...action.json.result,
        id: action.json.id,
      };

      if (action.json.result.dashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards,
            [report.dashboard]: report,
          },
        };
      }
      return {
        ...state,
        charts: {
          ...state.chart,
          [report.chart]: report,
        },
      };
    },

    [DELETE_REPORT]() {
      const reportWithDashboard = !!action.report.dashboard;

      if (reportWithDashboard) {
        const { dashboard } = action.report;
        // making a shallow copy so as to not directly delete state
        const { ...dashboardReports } = state.dashboards;
        delete dashboardReports[dashboard];
        return {
          ...state,
          dashboards: {
            dashboardReports,
          },
        };
      }

      const { chart } = action.report;
      // making a shallow copy so as to not directly delete state
      const { ...chartReports } = state.charts;
      delete chartReports[chart];
      return {
        ...state,
        charts: {
          chartReports,
        },
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
