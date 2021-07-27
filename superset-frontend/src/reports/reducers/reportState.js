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
import { alterInArr } from 'src/reduxUtils';
import { SET_REPORT, EDIT_REPORT, TOGGLE_ACTIVE } from '../actions/reportState';

export default function reportStateReducer(state = {}, action) {
  const actionHandlers = {
    [SET_REPORT]() {
      return {
        ...state,
        report: action.report,
      };
    },
    [EDIT_REPORT]() {
      return {
        ...state,
        report: action.report,
      };
    },
    [TOGGLE_ACTIVE]() {
      const { report, isActive } = action;
      const existing = state.report.result.find(
        result => result.id === report.id,
      );
      const newArr = alterInArr(
        state.report,
        'result',
        existing,
        {
          active: isActive,
        },
        'id',
      );
      return {
        ...state,
        report: newArr,
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
