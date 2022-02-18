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
import { SET_REPORT, ADD_REPORT, EDIT_REPORT } from '../actions/reports';

export default function reportsReducer(state = {}, action) {
  const actionHandlers = {
    [SET_REPORT]() {
      const { report, resourceId, creationMethod } = action;

      const reportObject = report.result?.find(report => !!report[resourceId]);

      return {
        ...state,
        [creationMethod]: {
          ...state[creationMethod],
          [resourceId]: reportObject,
        },
      };
    },

    [ADD_REPORT]() {
      const { result, id } = action.json;
      const report = { ...result, id };
      const reportId = report.dashboard || report.chart;

      return {
        ...state,
        [report.creation_method]: {
          ...state[report.creation_method],
          [reportId]: report,
        },
      };
    },

    [EDIT_REPORT]() {
      const report = {
        ...action.json.result,
        id: action.json.id,
      };
      const reportId = report.dashboard || report.chart;

      return {
        ...state,
        [report.creation_method]: {
          ...state[report.creation_method],
          [reportId]: report,
        },
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
