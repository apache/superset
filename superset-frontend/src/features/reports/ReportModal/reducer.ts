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
import { omit } from 'lodash';
import {
  SET_REPORT,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
  ReportAction,
  SetReportAction,
  AddReportAction,
  EditReportAction,
  DeleteReportAction,
} from './actions';
import { ReportObject, ReportCreationMethod } from 'src/features/reports/types';

// State structure: { dashboards: { [id]: ReportObject }, charts: { [id]: ReportObject } }
export interface ReportsState {
  dashboards?: Record<number, ReportObject>;
  charts?: Record<number, ReportObject>;
  alerts_reports?: Record<number, ReportObject>;
}

type ActionHandlers = {
  [key: string]: () => ReportsState;
};

export default function reportsReducer(
  state: ReportsState = {},
  action: ReportAction,
): ReportsState {
  const actionHandlers: ActionHandlers = {
    [SET_REPORT]() {
      const { report, resourceId, creationMethod, filterField } =
        action as SetReportAction;
      // Map filterField ('dashboard_id' or 'chart_id') to the corresponding
      // ReportObject property ('dashboard' or 'chart')
      const propertyName =
        filterField === 'dashboard_id' ? 'dashboard' : 'chart';
      // For now report count should only be one, but we are checking in case
      // functionality changes.
      const reportObject = report.result?.find(
        (r: ReportObject) => r[propertyName] === resourceId,
      );

      if (reportObject) {
        return {
          ...state,
          [creationMethod]: {
            ...state[creationMethod],
            [resourceId]: reportObject,
          },
        };
      }
      if (state?.[creationMethod]?.[resourceId]) {
        // remove the empty report from state
        const methodState = state[creationMethod];
        if (methodState) {
          return {
            ...state,
            [creationMethod]: omit(methodState, resourceId),
          };
        }
      }
      return { ...state };
    },

    [ADD_REPORT]() {
      const { result, id } = (action as AddReportAction).json;
      const report: ReportObject = { ...result, id } as ReportObject;
      const reportTypeId = report.dashboard ?? report.chart;
      const creationMethod = report.creation_method as ReportCreationMethod;
      // this is the id of either the chart or the dashboard associated with the report.

      if (reportTypeId === undefined) {
        return state;
      }

      return {
        ...state,
        [creationMethod]: {
          ...state[creationMethod],
          [reportTypeId]: report,
        },
      };
    },

    [EDIT_REPORT]() {
      const actionTyped = action as EditReportAction;
      const report: ReportObject = {
        ...actionTyped.json.result,
        id: actionTyped.json.id,
      } as ReportObject;
      const reportTypeId = report.dashboard ?? report.chart;
      const creationMethod = report.creation_method as ReportCreationMethod;

      if (reportTypeId === undefined) {
        return state;
      }

      return {
        ...state,
        [creationMethod]: {
          ...state[creationMethod],
          [reportTypeId]: report,
        },
      };
    },

    [DELETE_REPORT]() {
      const { report } = action as DeleteReportAction;
      const reportTypeId = report.dashboard ?? report.chart;
      const creationMethod = report.creation_method as ReportCreationMethod;

      if (reportTypeId === undefined) {
        return state;
      }

      const methodState = state[creationMethod];
      return {
        ...state,
        [creationMethod]: methodState
          ? omit(methodState, reportTypeId)
          : undefined,
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
