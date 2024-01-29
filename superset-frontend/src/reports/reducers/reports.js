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
import { omit } from 'lodash';
import {
  SET_REPORT,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
} from '../actions/reports';

export default function reportsReducer(state = {}, action) {
  const actionHandlers = {
    [SET_REPORT]() {
      const { report, resourceId, creationMethod, filterField } = action;
      // For now report count should only be one, but we are checking in case
      // functionality changes.
      const reportObject = report.result?.find(
        report => report[filterField] === resourceId,
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
        const newState = { ...state };
        delete newState[creationMethod][resourceId];
        return newState;
      }
      return { ...state };
    },

    [ADD_REPORT]() {
      const { result, id } = action.json;
      const report = { ...result, id };
      const reportTypeId = report.dashboard || report.chart;
      // this is the id of either the chart or the dashboard associated with the report.

      return {
        ...state,
        [report.creation_method]: {
          ...state[report.creation_method],
          [reportTypeId]: report,
        },
      };
    },

    [EDIT_REPORT]() {
      const report = {
        ...action.json.result,
        id: action.json.id,
      };
      const reportTypeId = report.dashboard || report.chart;

      return {
        ...state,
        [report.creation_method]: {
          ...state[report.creation_method],
          [reportTypeId]: report,
        },
      };
    },

    [DELETE_REPORT]() {
      const { report } = action;
      const reportTypeId = report.dashboard || report.chart;
      return {
        ...state,
        [report.creation_method]: {
          ...omit(state[report.creation_method], reportTypeId),
        },
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
