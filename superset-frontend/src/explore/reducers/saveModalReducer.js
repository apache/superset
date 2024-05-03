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
import * as actions from '../actions/saveModalActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';

export default function saveModalReducer(state = {}, action) {
  const actionHandlers = {
    [actions.SET_SAVE_CHART_MODAL_VISIBILITY]() {
      return { ...state, isVisible: action.isVisible };
    },
    [actions.FETCH_DASHBOARDS_SUCCEEDED]() {
      return { ...state, dashboards: action.choices };
    },
    [actions.FETCH_DASHBOARDS_FAILED]() {
      return {
        ...state,
        saveModalAlert: `fetching dashboards failed for ${action.userId}`,
      };
    },
    [actions.SAVE_SLICE_FAILED]() {
      return { ...state, saveModalAlert: 'Failed to save slice' };
    },
    [actions.SAVE_SLICE_SUCCESS](data) {
      return { ...state, data };
    },
    [HYDRATE_EXPLORE]() {
      return { ...action.data.saveModal };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
