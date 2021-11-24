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
import { report } from 'process';
// import { allowCrossDomain } from 'src/utils/hostNamesConfig';
import {
  SET_REPORT,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
} from '../actions/reports';

/* -- Report schema --
reports: {
  dashboards: {
    [dashboardId]: {...reportObject}
  },
  charts: {
    [chartId]: {...reportObject}
  },
}
*/

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
      // Grab first matching report by matching dashboard id
      const reportWithDashboard = action.json.result.find(
        report => !!report.dashboard_id,
      );
      // Assign the report's id
      reportWithDashboard.id = action.json.id;

      // Grab first matching report by matching chart id
      const reportWithChart = action.json.result.find(
        report => !!report.chart.id,
      );
      // Assign the report's id
      reportWithChart.id = action.json.id;

      // This adds the report by its type, dashboard or chart
      if (reportWithDashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards,
            [reportWithDashboard.dashboard_id]: report,
          },
        };
      }
      return {
        ...state,
        charts: {
          ...state.chart,
          [reportWithChart.chart.id]: report,
        },
      };
    },

    [EDIT_REPORT]() {
      // Grab first matching report by matching dashboard id
      const reportWithDashboard = action.json.result.find(
        report => !!report.dashboard_id,
      );
      // Assign the report's id
      reportWithDashboard.id = action.json.id;

      // Grab first matching report by matching chart id
      const reportWithChart = action.json.result.find(
        report => !!report.chart.id,
      );
      // Assign the report's id
      reportWithChart.id = action.json.id;

      // This updates the report by its type, dashboard or chart
      if (reportWithDashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards,
            [reportWithDashboard.dashboard_id]: report,
          },
        };
      }
      return {
        ...state,
        charts: {
          ...state.chart,
          [reportWithChart.chart.id]: report,
        },
      };
    },

    [DELETE_REPORT]() {
      // Grabs the first report with a dashboard id that
      // matches the parameter report's dashboard_id
      const reportWithDashboard = action.report.result.find(
        report => !!report.dashboard_id,
      );

      // This deletes the report by its type, dashboard or chart
      if (reportWithDashboard) {
        return {
          ...state,
          dashboards: {
            ...state.dashboards.filter(report => report.id !== action.reportId),
          },
        };
      }
      return {
        ...state,
        charts: {
          ...state.charts.filter(chart => chart.id !== action.reportId),
        },
      };

      // state.users.filter(item => item.id !== action.payload)
      // return {
      //   ...state.filter(report => report.id !== action.reportId),
      // };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
